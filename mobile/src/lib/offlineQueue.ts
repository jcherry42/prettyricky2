/**
 * Offline Queue — queues API calls when the device is offline and
 * automatically replays them when connectivity returns.
 *
 * Usage:
 *   import { offlineQueue } from '../lib/offlineQueue';
 *
 *   // Instead of:
 *   await apiFetch('/customers', { method: 'POST', body });
 *
 *   // Use:
 *   await offlineQueue.enqueue('/customers', { method: 'POST', body });
 *
 * The queue persists to AsyncStorage so pending operations survive app restarts.
 * Only mutating requests (POST, PUT, DELETE, PATCH) are queued.
 * GET requests are rejected immediately when offline — they should use local cache.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo, { NetInfoState } from '@react-native-community/netinfo';
import { apiFetch } from './api';

const QUEUE_KEY = '@offlineQueue';
const MAX_RETRIES = 3;

export interface QueuedRequest {
  id: string;
  path: string;
  options: RequestInit;
  createdAt: number;
  retries: number;
}

type QueueListener = (queue: QueuedRequest[]) => void;

class OfflineQueue {
  private queue: QueuedRequest[] = [];
  private isOnline = true;
  private isFlushing = false;
  private listeners: Set<QueueListener> = new Set();
  private unsubNetInfo: (() => void) | null = null;

  /**
   * Initialize the queue — call once at app startup (e.g., in App.tsx).
   * Restores any persisted queue and subscribes to network changes.
   */
  async init(): Promise<void> {
    // Restore persisted queue
    try {
      const raw = await AsyncStorage.getItem(QUEUE_KEY);
      if (raw) {
        this.queue = JSON.parse(raw);
      }
    } catch {
      this.queue = [];
    }

    // Subscribe to network state changes
    this.unsubNetInfo = NetInfo.addEventListener((state: NetInfoState) => {
      const wasOffline = !this.isOnline;
      this.isOnline = !!state.isConnected && !!state.isInternetReachable;

      if (wasOffline && this.isOnline && this.queue.length > 0) {
        // Just came back online — flush the queue
        this.flush();
      }
    });

    // Check current state
    const state = await NetInfo.fetch();
    this.isOnline = !!state.isConnected && !!state.isInternetReachable;

    // Auto-flush if we start online with pending items
    if (this.isOnline && this.queue.length > 0) {
      this.flush();
    }
  }

  /**
   * Enqueue a request. If online, executes immediately.
   * If offline, queues for later and returns a pending marker.
   */
  async enqueue(path: string, options: RequestInit = {}): Promise<any> {
    const method = (options.method || 'GET').toUpperCase();

    // GET requests aren't queueable — they need fresh data
    if (method === 'GET') {
      if (!this.isOnline) {
        throw new Error('You are offline. This data will refresh when connectivity returns.');
      }
      return apiFetch(path, options);
    }

    // If online, just execute directly
    if (this.isOnline) {
      try {
        return await apiFetch(path, options);
      } catch (err: any) {
        // If the error is a network failure, queue it
        if (err?.message?.includes('Network request failed') || err?.message?.includes('fetch')) {
          this.isOnline = false;
          return this._addToQueue(path, options);
        }
        throw err;
      }
    }

    // Offline — queue the request
    return this._addToQueue(path, options);
  }

  /**
   * Get the current queue (for UI display).
   */
  getPending(): QueuedRequest[] {
    return [...this.queue];
  }

  /**
   * Subscribe to queue changes (for UI badge/counter).
   */
  subscribe(listener: QueueListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /**
   * Manually trigger a flush (e.g., from a "Retry" button).
   */
  async flush(): Promise<{ succeeded: number; failed: number }> {
    if (this.isFlushing || this.queue.length === 0) {
      return { succeeded: 0, failed: 0 };
    }

    this.isFlushing = true;
    let succeeded = 0;
    let failed = 0;

    // Process queue in order (FIFO)
    const toProcess = [...this.queue];
    for (const item of toProcess) {
      try {
        await apiFetch(item.path, item.options);
        // Success — remove from queue
        this.queue = this.queue.filter(q => q.id !== item.id);
        succeeded++;
      } catch (err: any) {
        item.retries++;
        if (item.retries >= MAX_RETRIES) {
          // Drop after max retries
          this.queue = this.queue.filter(q => q.id !== item.id);
          failed++;
          console.warn(`[OfflineQueue] Dropped after ${MAX_RETRIES} retries:`, item.path);
        } else if (err?.message?.includes('Network request failed')) {
          // Still offline — stop flushing
          break;
        }
      }
    }

    await this._persist();
    this._notify();
    this.isFlushing = false;

    return { succeeded, failed };
  }

  /**
   * Clear the entire queue (e.g., on logout).
   */
  async clear(): Promise<void> {
    this.queue = [];
    await this._persist();
    this._notify();
  }

  /**
   * Cleanup — call on app shutdown.
   */
  destroy(): void {
    if (this.unsubNetInfo) {
      this.unsubNetInfo();
      this.unsubNetInfo = null;
    }
    this.listeners.clear();
  }

  // ── Private helpers ──────────────────────────────────────────────

  private _addToQueue(path: string, options: RequestInit): { queued: true; id: string } {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const item: QueuedRequest = {
      id,
      path,
      options: {
        method: options.method,
        headers: options.headers,
        body: options.body,
      },
      createdAt: Date.now(),
      retries: 0,
    };

    this.queue.push(item);
    this._persist();
    this._notify();

    return { queued: true, id };
  }

  private async _persist(): Promise<void> {
    try {
      await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(this.queue));
    } catch {
      // Storage full or unavailable — queue is still in memory
    }
  }

  private _notify(): void {
    const snapshot = [...this.queue];
    this.listeners.forEach(fn => {
      try { fn(snapshot); } catch {}
    });
  }
}

// Singleton instance
export const offlineQueue = new OfflineQueue();

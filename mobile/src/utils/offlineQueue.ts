/**
 * Offline Queue System
 * Queues API operations when offline and syncs when back online
 */

import { loadJson, saveJson } from '../lib/storage';
import { apiFetch } from '../lib/api';

const QUEUE_KEY = 'sc_v1_offline_queue';
const MAX_QUEUE_SIZE = 100;

let syncInProgress = false;

interface QueueItem {
  id: string;
  path: string;
  options: Record<string, unknown>;
  timestamp: number;
  retries: number;
}

/**
 * Add operation to offline queue
 */
export async function queueOperation(path: string, options: Record<string, unknown> = {}): Promise<string> {
  const queue = await loadJson<QueueItem[]>(QUEUE_KEY, []);

  if (queue.length >= MAX_QUEUE_SIZE) {
    throw new Error('Offline queue is full');
  }

  const item: QueueItem = {
    id: `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    path,
    options,
    timestamp: Date.now(),
    retries: 0,
  };

  queue.push(item);
  await saveJson(QUEUE_KEY, queue);

  return item.id;
}

/**
 * Get current queue
 */
export async function getQueue(): Promise<QueueItem[]> {
  return await loadJson<QueueItem[]>(QUEUE_KEY, []);
}

/**
 * Process offline queue
 */
export async function syncQueue(onProgress?: (_current: number, _total: number) => void) {
  if (syncInProgress) {
    return { success: false, error: 'Sync already in progress' };
  }

  syncInProgress = true;

  try {
    const queue = await loadJson<QueueItem[]>(QUEUE_KEY, []);

    if (queue.length === 0) {
      return { success: true, processed: 0, failed: 0 };
    }

    let processed = 0;
    let failed = 0;
    const remainingQueue: QueueItem[] = [];

    for (let i = 0; i < queue.length; i++) {
      const item = queue[i];

      try {
        await apiFetch(item.path, item.options as import('../lib/api').ApiFetchOptions);
        processed++;

        if (onProgress) {
          onProgress(i + 1, queue.length);
        }
      } catch {
        if (item.retries < 3) {
          remainingQueue.push({
            ...item,
            retries: item.retries + 1,
          });
        }
        failed++;
      }
    }

    await saveJson(QUEUE_KEY, remainingQueue);

    return { success: true, processed, failed, remaining: remainingQueue.length };
  } catch (error: unknown) {
    return { success: false, error: (error as Error).message };
  } finally {
    syncInProgress = false;
  }
}

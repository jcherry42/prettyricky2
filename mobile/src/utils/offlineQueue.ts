/**
 * Offline Queue System
 * Queues API operations when offline and syncs when back online
 */

import { loadJson, saveJson } from '../lib/storage';
import { apiFetch } from '../lib/api';

const QUEUE_KEY = 'sc_v1_offline_queue';
const MAX_QUEUE_SIZE = 100;

let syncInProgress = false;

/**
 * Queue item structure:
 * {
 *   id: string,
 *   path: string,
 *   options: object,
 *   timestamp: number,
 *   retries: number,
 * }
 */

/**
 * Add operation to offline queue
 */
export async function queueOperation(path, options = {}) {
  const queue = await loadJson(QUEUE_KEY, []);

  // Check queue size limit
  if (queue.length >= MAX_QUEUE_SIZE) {
    throw new Error('Offline queue is full');
  }

  const item = {
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
export async function getQueue() {
  return await loadJson(QUEUE_KEY, []);
}

/**
 * Clear queue
 */
export async function clearQueue() {
  await saveJson(QUEUE_KEY, []);
}

/**
 * Process offline queue
 * Attempts to sync all queued operations
 */
export async function syncQueue(onProgress) {
  if (syncInProgress) {
    return { success: false, error: 'Sync already in progress' };
  }

  syncInProgress = true;

  try {
    const queue = await loadJson(QUEUE_KEY, []);

    if (queue.length === 0) {
      return { success: true, processed: 0, failed: 0 };
    }

    let processed = 0;
    let failed = 0;
    const remainingQueue = [];

    for (let i = 0; i < queue.length; i++) {
      const item = queue[i];

      try {
        await apiFetch(item.path, item.options);
        processed++;

        if (onProgress) {
          onProgress(i + 1, queue.length);
        }
      } catch (error) {
        // Retry logic
        if (item.retries < 3) {
          remainingQueue.push({
            ...item,
            retries: item.retries + 1,
          });
        }
        failed++;
      }
    }

    // Save remaining queue
    await saveJson(QUEUE_KEY, remainingQueue);

    return { success: true, processed, failed, remaining: remainingQueue.length };
  } catch (error) {
    return { success: false, error: error.message };
  } finally {
    syncInProgress = false;
  }
}

/**
 * Remove item from queue
 */
export async function removeFromQueue(itemId) {
  const queue = await loadJson(QUEUE_KEY, []);
  const filtered = queue.filter(item => item.id !== itemId);
  await saveJson(QUEUE_KEY, filtered);
}

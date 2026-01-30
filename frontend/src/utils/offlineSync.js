/**
 * Offline Data Sync Service
 * Handles local storage and sync queue for offline-first functionality
 */

const SYNC_QUEUE_KEY = 'superchargd_sync_queue';
const OFFLINE_DATA_KEY = 'superchargd_offline_data';

class OfflineSyncService {
  constructor() {
    this.isOnline = navigator.onLine;
    this.syncQueue = this.loadSyncQueue();
    
    window.addEventListener('online', () => this.handleOnline());
    window.addEventListener('offline', () => this.handleOffline());
  }

  handleOnline() {
    this.isOnline = true;
    this.processSyncQueue();
  }

  handleOffline() {
    this.isOnline = false;
  }

  loadSyncQueue() {
    try {
      const data = localStorage.getItem(SYNC_QUEUE_KEY);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  }

  saveSyncQueue() {
    try {
      localStorage.setItem(SYNC_QUEUE_KEY, JSON.stringify(this.syncQueue));
    } catch {
      // Storage full or disabled
    }
  }

  /**
   * Add an operation to the sync queue
   * @param {Object} operation - {type, endpoint, method, data, timestamp}
   */
  queueOperation(operation) {
    const queuedOp = {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      ...operation,
      timestamp: new Date().toISOString(),
      retries: 0
    };
    
    this.syncQueue.push(queuedOp);
    this.saveSyncQueue();
    
    if (this.isOnline) {
      this.processSyncQueue();
    }
    
    return queuedOp.id;
  }

  /**
   * Process queued operations when online
   */
  async processSyncQueue() {
    if (!this.isOnline || this.syncQueue.length === 0) return;

    const API_URL = import.meta.env.VITE_BACKEND_URL;
    const queue = [...this.syncQueue];
    
    for (const operation of queue) {
      try {
        const response = await fetch(`${API_URL}${operation.endpoint}`, {
          method: operation.method || 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(operation.data)
        });

        if (response.ok) {
          // Remove from queue on success
          this.syncQueue = this.syncQueue.filter(op => op.id !== operation.id);
          this.saveSyncQueue();
        } else if (response.status >= 500) {
          // Retry server errors
          operation.retries++;
          if (operation.retries >= 3) {
            this.syncQueue = this.syncQueue.filter(op => op.id !== operation.id);
          }
          this.saveSyncQueue();
        } else {
          // Remove on client errors (4xx) - no point retrying
          this.syncQueue = this.syncQueue.filter(op => op.id !== operation.id);
          this.saveSyncQueue();
        }
      } catch {
        // Network error - keep in queue
        operation.retries++;
        this.saveSyncQueue();
      }
    }
  }

  /**
   * Save data locally for offline access
   * @param {string} key - Storage key
   * @param {*} data - Data to store
   */
  saveOfflineData(key, data) {
    try {
      const offlineData = this.getOfflineStore();
      offlineData[key] = {
        data,
        savedAt: new Date().toISOString()
      };
      localStorage.setItem(OFFLINE_DATA_KEY, JSON.stringify(offlineData));
    } catch {
      // Storage full
    }
  }

  /**
   * Get offline stored data
   * @param {string} key - Storage key
   * @returns {*} Stored data or null
   */
  getOfflineData(key) {
    const store = this.getOfflineStore();
    return store[key]?.data || null;
  }

  getOfflineStore() {
    try {
      const data = localStorage.getItem(OFFLINE_DATA_KEY);
      return data ? JSON.parse(data) : {};
    } catch {
      return {};
    }
  }

  /**
   * Clear all offline data and sync queue
   */
  clearAll() {
    localStorage.removeItem(SYNC_QUEUE_KEY);
    localStorage.removeItem(OFFLINE_DATA_KEY);
    this.syncQueue = [];
  }

  /**
   * Get sync queue status
   */
  getStatus() {
    return {
      isOnline: this.isOnline,
      pendingOperations: this.syncQueue.length,
      lastSync: this.syncQueue[0]?.timestamp || null
    };
  }
}

// Export singleton instance
export const offlineSync = new OfflineSyncService();

// React hook for offline status
export function useOfflineStatus() {
  const [status, setStatus] = React.useState(offlineSync.getStatus());
  
  React.useEffect(() => {
    const handleStatusChange = () => {
      setStatus(offlineSync.getStatus());
    };
    
    window.addEventListener('online', handleStatusChange);
    window.addEventListener('offline', handleStatusChange);
    
    return () => {
      window.removeEventListener('online', handleStatusChange);
      window.removeEventListener('offline', handleStatusChange);
    };
  }, []);
  
  return status;
}

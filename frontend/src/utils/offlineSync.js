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
    this.listeners = [];
    
    window.addEventListener('online', () => this.handleOnline());
    window.addEventListener('offline', () => this.handleOffline());
  }

  handleOnline() {
    this.isOnline = true;
    this.notifyListeners();
    this.processSyncQueue();
  }

  handleOffline() {
    this.isOnline = false;
    this.notifyListeners();
  }

  addListener(callback) {
    this.listeners.push(callback);
    return () => {
      this.listeners = this.listeners.filter(l => l !== callback);
    };
  }

  notifyListeners() {
    this.listeners.forEach(cb => cb(this.getStatus()));
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

  queueOperation(operation) {
    const queuedOp = {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      ...operation,
      timestamp: new Date().toISOString(),
      retries: 0
    };
    
    this.syncQueue.push(queuedOp);
    this.saveSyncQueue();
    this.notifyListeners();
    
    if (this.isOnline) {
      this.processSyncQueue();
    }
    
    return queuedOp.id;
  }

  async processSyncQueue() {
    if (!this.isOnline || this.syncQueue.length === 0) return;

    const API_URL = import.meta.env.VITE_BACKEND_URL;
    const queue = [...this.syncQueue];
    
    for (const operation of queue) {
      try {
        const response = await fetch(`${API_URL}${operation.endpoint}`, {
          method: operation.method || 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(operation.data)
        });

        if (response.ok) {
          this.syncQueue = this.syncQueue.filter(op => op.id !== operation.id);
          this.saveSyncQueue();
          this.notifyListeners();
        } else if (response.status >= 500) {
          operation.retries++;
          if (operation.retries >= 3) {
            this.syncQueue = this.syncQueue.filter(op => op.id !== operation.id);
          }
          this.saveSyncQueue();
        } else {
          this.syncQueue = this.syncQueue.filter(op => op.id !== operation.id);
          this.saveSyncQueue();
        }
      } catch {
        operation.retries++;
        this.saveSyncQueue();
      }
    }
  }

  saveOfflineData(key, data) {
    try {
      const offlineData = this.getOfflineStore();
      offlineData[key] = { data, savedAt: new Date().toISOString() };
      localStorage.setItem(OFFLINE_DATA_KEY, JSON.stringify(offlineData));
    } catch {
      // Storage full
    }
  }

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

  getStatus() {
    return {
      isOnline: this.isOnline,
      pendingOperations: this.syncQueue.length
    };
  }
}

// Singleton instance
export const offlineSync = new OfflineSyncService();

export default offlineSync;

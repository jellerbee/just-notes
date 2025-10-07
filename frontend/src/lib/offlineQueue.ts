/**
 * IndexedDB queue for offline writes
 * Stores pending API calls when offline, syncs when back online
 */

const DB_NAME = 'jnotes-offline';
const DB_VERSION = 1;
const STORE_NAME = 'pending-appends';

export interface QueuedAppend {
  id: string // UUID
  noteId: string
  bulletId: string
  payload: {
    bulletId: string
    parentId: string | null
    depth: number
    text: string
    spans: any[]
    clientSeq?: number
  }
  timestamp: number
  retries: number
}

class OfflineQueue {
  private db: IDBDatabase | null = null;

  /**
   * Initialize IndexedDB
   */
  async init(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => {
        console.error('[OfflineQueue] Failed to open IndexedDB:', request.error);
        reject(request.error);
      };

      request.onsuccess = () => {
        this.db = request.result;
        console.log('[OfflineQueue] IndexedDB initialized');
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        // Create object store if it doesn't exist
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
          store.createIndex('timestamp', 'timestamp', { unique: false });
          store.createIndex('noteId', 'noteId', { unique: false });
          console.log('[OfflineQueue] Object store created');
        }
      };
    });
  }

  /**
   * Add an append to the queue
   */
  async enqueue(append: Omit<QueuedAppend, 'id' | 'timestamp' | 'retries'>): Promise<string> {
    if (!this.db) {
      await this.init();
    }

    const queuedAppend: QueuedAppend = {
      id: crypto.randomUUID(),
      ...append,
      timestamp: Date.now(),
      retries: 0,
    };

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.add(queuedAppend);

      request.onsuccess = () => {
        console.log('[OfflineQueue] Enqueued append:', queuedAppend.id);
        resolve(queuedAppend.id);
      };

      request.onerror = () => {
        console.error('[OfflineQueue] Failed to enqueue:', request.error);
        reject(request.error);
      };
    });
  }

  /**
   * Get all pending appends
   */
  async getAll(): Promise<QueuedAppend[]> {
    if (!this.db) {
      await this.init();
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.getAll();

      request.onsuccess = () => {
        const appends = request.result as QueuedAppend[];
        // Sort by timestamp (oldest first)
        appends.sort((a, b) => a.timestamp - b.timestamp);
        resolve(appends);
      };

      request.onerror = () => {
        console.error('[OfflineQueue] Failed to get all:', request.error);
        reject(request.error);
      };
    });
  }

  /**
   * Remove an append from the queue
   */
  async dequeue(id: string): Promise<void> {
    if (!this.db) {
      await this.init();
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.delete(id);

      request.onsuccess = () => {
        console.log('[OfflineQueue] Dequeued append:', id);
        resolve();
      };

      request.onerror = () => {
        console.error('[OfflineQueue] Failed to dequeue:', request.error);
        reject(request.error);
      };
    });
  }

  /**
   * Increment retry count for an append
   */
  async incrementRetries(id: string): Promise<void> {
    if (!this.db) {
      await this.init();
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const getRequest = store.get(id);

      getRequest.onsuccess = () => {
        const append = getRequest.result as QueuedAppend;
        if (append) {
          append.retries++;
          const putRequest = store.put(append);

          putRequest.onsuccess = () => resolve();
          putRequest.onerror = () => reject(putRequest.error);
        } else {
          resolve(); // Already removed
        }
      };

      getRequest.onerror = () => {
        reject(getRequest.error);
      };
    });
  }

  /**
   * Get count of pending appends
   */
  async count(): Promise<number> {
    if (!this.db) {
      await this.init();
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.count();

      request.onsuccess = () => {
        resolve(request.result);
      };

      request.onerror = () => {
        console.error('[OfflineQueue] Failed to count:', request.error);
        reject(request.error);
      };
    });
  }

  /**
   * Clear all pending appends
   */
  async clear(): Promise<void> {
    if (!this.db) {
      await this.init();
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.clear();

      request.onsuccess = () => {
        console.log('[OfflineQueue] Cleared all appends');
        resolve();
      };

      request.onerror = () => {
        console.error('[OfflineQueue] Failed to clear:', request.error);
        reject(request.error);
      };
    });
  }
}

// Export singleton instance
export const offlineQueue = new OfflineQueue();

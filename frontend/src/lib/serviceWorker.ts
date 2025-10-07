/**
 * Service Worker registration and management
 */

export interface SWRegistration {
  registration: ServiceWorkerRegistration | null;
  isOnline: boolean;
  pendingCount: number;
}

type SWListener = (state: SWRegistration) => void;

class ServiceWorkerManager {
  private registration: ServiceWorkerRegistration | null = null;
  private listeners: SWListener[] = [];
  private isOnline: boolean = navigator.onLine;
  private pendingCount: number = 0;

  /**
   * Register service worker
   */
  async register(): Promise<ServiceWorkerRegistration | null> {
    if (!('serviceWorker' in navigator)) {
      console.warn('[SW] Service workers not supported');
      return null;
    }

    try {
      this.registration = await navigator.serviceWorker.register('/sw.js', {
        scope: '/',
      });

      console.log('[SW] Service worker registered:', this.registration);

      // Listen for updates
      this.registration.addEventListener('updatefound', () => {
        const newWorker = this.registration!.installing;
        console.log('[SW] Update found, installing new worker...');

        newWorker?.addEventListener('statechange', () => {
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            console.log('[SW] New version available, reload to update');
            // Could show notification to user here
          }
        });
      });

      // Listen for messages from SW
      navigator.serviceWorker.addEventListener('message', (event) => {
        if (event.data && event.data.type === 'BACKGROUND_SYNC') {
          console.log('[SW] Background sync message received');
          this.notifyListeners();
        }
      });

      // Setup online/offline listeners
      window.addEventListener('online', () => {
        console.log('[SW] Back online');
        this.isOnline = true;
        this.notifyListeners();
        this.requestSync();
      });

      window.addEventListener('offline', () => {
        console.log('[SW] Gone offline');
        this.isOnline = false;
        this.notifyListeners();
      });

      this.notifyListeners();
      return this.registration;
    } catch (error) {
      console.error('[SW] Registration failed:', error);
      return null;
    }
  }

  /**
   * Request background sync
   */
  async requestSync(): Promise<void> {
    if (!this.registration) return;

    try {
      if ('sync' in this.registration) {
        await this.registration.sync.register('sync-appends');
        console.log('[SW] Background sync registered');
      } else {
        console.log('[SW] Background sync not supported, using manual sync');
        // Fallback: notify listeners to trigger manual sync
        this.notifyListeners();
      }
    } catch (error) {
      console.error('[SW] Failed to register sync:', error);
    }
  }

  /**
   * Update pending count
   */
  setPendingCount(count: number): void {
    this.pendingCount = count;
    this.notifyListeners();
  }

  /**
   * Get current state
   */
  getState(): SWRegistration {
    return {
      registration: this.registration,
      isOnline: this.isOnline,
      pendingCount: this.pendingCount,
    };
  }

  /**
   * Subscribe to state changes
   */
  subscribe(listener: SWListener): () => void {
    this.listeners.push(listener);

    // Return unsubscribe function
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  /**
   * Notify all listeners
   */
  private notifyListeners(): void {
    const state = this.getState();
    this.listeners.forEach((listener) => listener(state));
  }

  /**
   * Unregister service worker (for development)
   */
  async unregister(): Promise<void> {
    if (!this.registration) return;

    try {
      await this.registration.unregister();
      console.log('[SW] Service worker unregistered');
      this.registration = null;
      this.notifyListeners();
    } catch (error) {
      console.error('[SW] Failed to unregister:', error);
    }
  }
}

// Export singleton instance
export const swManager = new ServiceWorkerManager();

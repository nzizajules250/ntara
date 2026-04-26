/**
 * Browser Push Notifications & Background Sync Helper
 */

// Notification sounds
const NOTIFICATION_SOUNDS = {
  success: 'data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAAB9AAACABAAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj==',
  error: 'data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAAB9AAACABAAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBg==',
  ride_request: 'data:audio/wav;base64,UklGRpYHAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YZIHAAAAAA==',
  ride_accepted: 'data:audio/wav;base64,UklGRpYHAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YZIHAAAAAA=='
};

/**
 * Play notification sound
 */
export function playNotificationSound(type: 'success' | 'error' | 'ride_request' | 'ride_accepted' = 'success'): void {
  try {
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    
    // Create a simple beep sound
    const now = audioContext.currentTime;
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    // Set frequency based on notification type
    switch (type) {
      case 'success':
        oscillator.frequency.value = 800; // Higher pitch for success
        break;
      case 'error':
        oscillator.frequency.value = 400; // Lower pitch for error
        break;
      case 'ride_request':
        oscillator.frequency.value = 600; // Medium pitch for ride request
        break;
      case 'ride_accepted':
        oscillator.frequency.value = 900; // High pitch for accepted
        break;
    }
    
    // Set gain envelope
    gainNode.gain.setValueAtTime(0.3, now);
    gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.5);
    
    // Play the sound
    oscillator.start(now);
    oscillator.stop(now + 0.5);
  } catch (e) {
    console.warn('Failed to play notification sound:', e);
  }
}

export async function requestNotificationPermission(): Promise<boolean> {
  if (!("Notification" in window)) {
    console.warn("This browser does not support desktop notifications");
    return false;
  }

  if (Notification.permission === "granted") {
    // Permission already granted, register background sync
    await registerBackgroundSync();
    return true;
  }

  if (Notification.permission !== "denied") {
    const permission = await Notification.requestPermission();
    if (permission === "granted") {
      // Permission granted, register background sync
      await registerBackgroundSync();
      return true;
    }
    return false;
  }

  return false;
}

export function sendPushNotification(
  title: string,
  options?: NotificationOptions & { sound?: boolean }
): Notification | null {
  if (!("Notification" in window)) return null;
  
  if (Notification.permission === "granted") {
    try {
      const notification = new Notification(title, {
        icon: '/favicon.ico',
        badge: '/favicon.ico',
        tag: 'swiftride-notification',
        requireInteraction: true,
        ...options
      });

      // Play sound if enabled
      if (options?.sound !== false) {
        playNotificationSound(title.includes('Request') ? 'ride_request' : 'success');
      }

      // Auto-close after 7 seconds if no interaction required
      if (!options?.requireInteraction) {
        setTimeout(() => {
          try {
            notification.close();
          } catch (e) {
            console.warn('Failed to close notification:', e);
          }
        }, 7000);
      }

      return notification;
    } catch (e) {
      console.error("Error sending notification", e);
      return null;
    }
  }

  return null;
}

/**
 * Register background sync for real-time tracking
 */
export async function registerBackgroundSync(): Promise<void> {
  if (!('serviceWorker' in navigator)) {
    console.warn('Service Workers not supported');
    return;
  }

  try {
    const registration = await navigator.serviceWorker.ready;

    // Register periodic sync for ride tracking (every 5 minutes)
    if ('periodicSync' in registration) {
      try {
        await (registration as any).periodicSync.register('ride-tracking', {
          minInterval: 5 * 60 * 1000 // 5 minutes
        });
        console.log('✅ Ride tracking background sync registered');
      } catch (error) {
        console.warn('Periodic sync registration failed:', error);
      }
    }

    // Register one-time sync for notifications
    if ('sync' in registration) {
      try {
        await (registration as any).sync.register('notification-sync');
        console.log('✅ Notification sync registered');
      } catch (error) {
        console.warn('Sync registration failed:', error);
      }
    }

    // Listen for messages from service worker
    navigator.serviceWorker.addEventListener('message', handleServiceWorkerMessage);
  } catch (error) {
    console.error('Failed to register background sync:', error);
  }
}

/**
 * Handle messages from service worker
 */
function handleServiceWorkerMessage(event: ExtendableMessageEvent) {
  const { type, data } = event.data;

  switch (type) {
    case 'RIDE_TRACKING_UPDATE':
      console.log('🚗 Ride tracking update:', data);
      // Dispatch custom event for app to listen to
      window.dispatchEvent(
        new CustomEvent('rideTrackingUpdate', { detail: data })
      );
      break;

    case 'NOTIFICATION_SYNC_UPDATE':
      console.log('🔔 Notification sync update:', data);
      window.dispatchEvent(
        new CustomEvent('notificationSyncUpdate', { detail: data })
      );
      break;

    case 'LOCATION_SYNC_SUCCESS':
      console.log('📍 Location sync successful');
      window.dispatchEvent(new CustomEvent('locationSyncSuccess'));
      break;

    case 'CONFIRM_ARRIVAL':
      console.log('✅ Arrival confirmed from notification');
      window.dispatchEvent(
        new CustomEvent('confirmArrival', { detail: data })
      );
      break;

    case 'REJECT_ARRIVAL':
      console.log('❌ Arrival rejected from notification');
      window.dispatchEvent(
        new CustomEvent('rejectArrival', { detail: data })
      );
      break;

    default:
      console.log('Unknown message type:', type);
  }
}

/**
 * Request to enable background tracking
 */
export async function enableBackgroundTracking(): Promise<boolean> {
  try {
    const permission = await requestNotificationPermission();
    if (permission) {
      await registerBackgroundSync();
      return true;
    }
    return false;
  } catch (error) {
    console.error('Failed to enable background tracking:', error);
    return false;
  }
}

/**
 * Store location locally for background sync
 */
export async function storeLocationForSync(
  lat: number,
  lng: number,
  timestamp: number
): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('SwiftRideDB', 1);

    request.onerror = () => reject(request.error);

    request.onupgradeneeded = (event: IDBVersionChangeEvent) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains('locations')) {
        db.createObjectStore('locations', { keyPath: 'id', autoIncrement: true });
      }
    };

    request.onsuccess = () => {
      const db = request.result;
      const transaction = db.transaction('locations', 'readwrite');
      const objectStore = transaction.objectStore('locations');
      const addRequest = objectStore.add({
        lat,
        lng,
        timestamp,
        synced: false
      });

      addRequest.onerror = () => reject(addRequest.error);
      addRequest.onsuccess = () => {
        console.log('📍 Location stored for background sync');
        resolve();
      };
    };
  });
}

/**
 * Check if background sync is available
 */
export function isBackgroundSyncSupported(): boolean {
  return (
    'serviceWorker' in navigator &&
    ('sync' in ServiceWorkerRegistration.prototype ||
      'periodicSync' in ServiceWorkerRegistration.prototype)
  );
}

/**
 * Get background sync status
 */
export async function getBackgroundSyncStatus(): Promise<{
  supported: boolean;
  periodicSyncEnabled: boolean;
  oneSyncEnabled: boolean;
}> {
  const supported = isBackgroundSyncSupported();
  let periodicSyncEnabled = false;
  let oneSyncEnabled = false;

  if (supported && 'serviceWorker' in navigator) {
    try {
      const registration = await navigator.serviceWorker.ready;
      
      if ('periodicSync' in registration) {
        const tags = await (registration as any).periodicSync.getTags();
        periodicSyncEnabled = tags.includes('ride-tracking');
      }

      if ('sync' in registration) {
        const tags = await (registration as any).sync.getTags();
        oneSyncEnabled = tags.includes('notification-sync');
      }
    } catch (error) {
      console.warn('Failed to get background sync status:', error);
    }
  }

  return {
    supported,
    periodicSyncEnabled,
    oneSyncEnabled
  };
}


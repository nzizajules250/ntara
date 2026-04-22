const CACHE_NAME = 'ntwara-v2';
const APP_SHELL = ['/', '/index.html', '/manifest.json'];

// Background sync tags
const SYNC_TAGS = {
  RIDE_TRACKING: 'ride-tracking',
  NOTIFICATION_SYNC: 'notification-sync',
  LOCATION_TRACKING: 'location-tracking'
};

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) =>
      Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
          return Promise.resolve();
        })
      )
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then((networkResponse) => {
          const responseClone = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put('/index.html', responseClone));
          return networkResponse;
        })
        .catch(async () => {
          const cachedResponse = await caches.match('/index.html');
          return cachedResponse || caches.match('/');
        })
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }

      return fetch(event.request).then((networkResponse) => {
        if (networkResponse.ok) {
          const responseClone = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, responseClone));
        }
        return networkResponse;
      });
    })
  );
});

// Handle push notifications
self.addEventListener('push', (event) => {
  if (!event.data) return;

  let notificationData = {};
  try {
    notificationData = event.data.json();
  } catch (e) {
    notificationData = {
      title: event.data.text() || 'Ntwara Notification',
      body: 'You have a new message'
    };
  }

  const options = {
    badge: '/favicon.ico',
    icon: 'https://i.ibb.co/qYN9hjsH/Chat-GPT-Image-Apr-19-2026-03-11-30-PM.png',
    tag: notificationData.tag || 'notification',
    requireInteraction: notificationData.requireInteraction || false,
    actions: notificationData.actions || [],
    data: notificationData.data || {},
    ...notificationData
  };

  event.waitUntil(
    self.registration.showNotification(notificationData.title || 'Ntwara Notification', options)
  );
});

// Handle notification clicks
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const clickedAction = event.action;
  const notificationData = event.notification.data;

  // Handle action button clicks
  if (clickedAction) {
    if (clickedAction === 'confirm-arrival') {
      self.clients.matchAll().then((clients) => {
        clients.forEach((client) => {
          client.postMessage({
            type: 'CONFIRM_ARRIVAL',
            data: notificationData
          });
        });
      });
    } else if (clickedAction === 'reject-arrival') {
      self.clients.matchAll().then((clients) => {
        clients.forEach((client) => {
          client.postMessage({
            type: 'REJECT_ARRIVAL',
            data: notificationData
          });
        });
      });
    }
  } else {
    // Default: Open app
    event.waitUntil(
      clients.matchAll({ type: 'window' }).then((clientList) => {
        for (let client of clientList) {
          if (client.url === '/' && 'focus' in client) {
            return client.focus();
          }
        }
        if (clients.openWindow) {
          return clients.openWindow('/');
        }
      })
    );
  }
});

// Periodic background sync for ride tracking
self.addEventListener('periodicsync', (event) => {
  if (event.tag === SYNC_TAGS.RIDE_TRACKING) {
    event.waitUntil(handleRideTracking());
  } else if (event.tag === SYNC_TAGS.NOTIFICATION_SYNC) {
    event.waitUntil(handleNotificationSync());
  } else if (event.tag === SYNC_TAGS.LOCATION_TRACKING) {
    event.waitUntil(handleLocationTracking());
  }
});

// Background sync for failed requests
self.addEventListener('sync', (event) => {
  if (event.tag === SYNC_TAGS.RIDE_TRACKING) {
    event.waitUntil(handleRideTracking());
  } else if (event.tag === SYNC_TAGS.NOTIFICATION_SYNC) {
    event.waitUntil(handleNotificationSync());
  }
});

// Handle ride tracking background sync
async function handleRideTracking() {
  try {
    const response = await fetch('/api/rides/tracking', {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' }
    });

    if (response.ok) {
      const data = await response.json();
      
      // Notify all clients about ride updates
      self.clients.matchAll().then((clients) => {
        clients.forEach((client) => {
          client.postMessage({
            type: 'RIDE_TRACKING_UPDATE',
            data: data
          });
        });
      });

      // Show notifications for ride events
      if (data.rideEvents && data.rideEvents.length > 0) {
        data.rideEvents.forEach((event) => {
          self.registration.showNotification(event.title, {
            body: event.message,
            icon: 'https://i.ibb.co/qYN9hjsH/Chat-GPT-Image-Apr-19-2026-03-11-30-PM.png',
            tag: 'ride-' + event.rideId,
            requireInteraction: true,
            actions: [
              { action: 'confirm-arrival', title: 'Confirm Arrival' },
              { action: 'reject-arrival', title: 'Not Yet' }
            ],
            data: event
          });
        });
      }
    }
  } catch (error) {
    console.error('Ride tracking sync failed:', error);
  }
}

// Handle notification sync
async function handleNotificationSync() {
  try {
    const response = await fetch('/api/notifications/pending', {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' }
    });

    if (response.ok) {
      const data = await response.json();
      
      // Display pending notifications
      if (data.notifications && data.notifications.length > 0) {
        data.notifications.forEach((notification) => {
          self.registration.showNotification(notification.title, {
            body: notification.body,
            icon: 'https://i.ibb.co/qYN9hjsH/Chat-GPT-Image-Apr-19-2026-03-11-30-PM.png',
            tag: notification.id,
            requireInteraction: notification.requireInteraction || false,
            data: notification
          });
        });
      }

      // Notify clients
      self.clients.matchAll().then((clients) => {
        clients.forEach((client) => {
          client.postMessage({
            type: 'NOTIFICATION_SYNC_UPDATE',
            data: data
          });
        });
      });
    }
  } catch (error) {
    console.error('Notification sync failed:', error);
  }
}

// Handle location tracking background sync
async function handleLocationTracking() {
  try {
    // Get current location if available
    const locations = await getAllStoredLocations();
    
    if (locations && locations.length > 0) {
      const response = await fetch('/api/location/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ locations })
      });

      if (response.ok) {
        // Notify clients about successful location sync
        self.clients.matchAll().then((clients) => {
          clients.forEach((client) => {
            client.postMessage({
              type: 'LOCATION_SYNC_SUCCESS'
            });
          });
        });
      }
    }
  } catch (error) {
    console.error('Location tracking sync failed:', error);
  }
}

// Utility: Get stored locations from IndexedDB
async function getAllStoredLocations() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('SwiftRideDB');
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const db = request.result;
      const transaction = db.transaction('locations', 'readonly');
      const objectStore = transaction.objectStore('locations');
      const getAllRequest = objectStore.getAll();

      getAllRequest.onerror = () => reject(getAllRequest.error);
      getAllRequest.onsuccess = () => resolve(getAllRequest.result);
    };
  });
}

// Message handling for client communication
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});


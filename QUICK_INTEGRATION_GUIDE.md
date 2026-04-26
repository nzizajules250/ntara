# Quick Integration Guide

## 🎯 How to Use Each Feature in Your App

---

## 1. 🔍 Autocomplete Search

### In a Component:

```tsx
import MapComponent from './MapComponent';

export function MyComponent() {
  const [destination, setDestination] = useState('');
  const [destinationCoords, setDestinationCoords] = useState<{lat: number, lng: number} | null>(null);

  const handlePlaceSelected = (place: Place) => {
    setDestination(place.name);
    setDestinationCoords(place.position);
    console.log('Selected:', place.name, place.position);
  };

  return (
    <MapComponent
      showPlaces={true}  // Enable place search and autocomplete
      onPlaceSelected={handlePlaceSelected}
      markers={[]}
      routes={[]}
    />
  );
}
```

### What Happens:
1. Map displays with search bar in top-left
2. User types place name
3. Suggestions dropdown appears (max 5)
4. User clicks suggestion
5. `onPlaceSelected` callback fires with place data

---

## 2. 🛣️ Route Display

### In a Component:

```tsx
import MapComponent from './MapComponent';

export function RideRequestComponent() {
  const [pickup, setPickup] = useState('');
  const [destination, setDestination] = useState('');
  const [pickupCoords, setPickupCoords] = useState<{lat: number, lng: number} | null>(null);
  const [destinationCoords, setDestinationCoords] = useState<{lat: number, lng: number} | null>(null);

  // Pass direction requests to MapComponent
  const directionRequests = pickup && destination && pickupCoords && destinationCoords ? [
    {
      id: 'route-1',
      origin: pickupCoords,
      destination: destinationCoords,
      waypoints: [],  // Optional intermediate points
      color: '#3B82F6'  // Blue for pickup/destination route
    }
  ] : [];

  return (
    <MapComponent
      center={pickupCoords || { lat: -1.9536, lng: 29.8739 }}  // Center of Rwanda
      zoom={13}
      markers={[
        { id: 'pickup', position: pickupCoords, label: 'Pickup', type: 'passenger' },
        { id: 'dest', position: destinationCoords, label: 'Destination', type: 'destination' }
      ]}
      directionRequests={directionRequests}  // Pass requests to calculate routes
      autoFit={true}  // Auto-fit map to show all markers and routes
    />
  );
}
```

### What Happens:
1. MapComponent receives `directionRequests` prop
2. Routes automatically calculate distance and duration
3. Badge shows at top-center: "🛣️ 1 Route(s) Showing"
4. Blue polyline appears on map
5. Route info shown at bottom-left with distance/duration
6. If destination changes, route recalculates automatically

---

## 3. 🔔 Notifications with Sound

### Basic Usage:

```tsx
import { useNotifications } from './components/NotificationCenter';

export function MyComponent() {
  const { addNotification } = useNotifications();

  const handleRideAccepted = () => {
    // Add success notification with sound
    addNotification(
      'Ride Accepted!',  // title
      'Your driver is on the way',  // message
      'success',  // type (triggers 800 Hz beep)
      [],  // actions (optional)
      false  // persistent (optional, defaults to false)
    );
  };

  const handleError = () => {
    // Add error notification with sound
    addNotification(
      'Request Failed',
      'Unable to connect to server',
      'error',  // triggers 400 Hz beep
      [],
      true  // make it persistent (stays until cleared)
    );
  };

  const handleRideRequest = () => {
    // Add ride request notification with sound
    addNotification(
      'New Ride Request',
      'Passenger wants to go to City Center',
      'ride_request',  // triggers 600 Hz beep
      [
        { 
          label: 'Accept', 
          onClick: async () => {
            // Handle acceptance logic
            console.log('Ride accepted');
          },
          style: 'primary'  // green button
        },
        { 
          label: 'Reject', 
          onClick: () => console.log('Ride rejected'),
          style: 'secondary'  // gray button
        }
      ],
      true  // persistent - important for ride requests!
    );
  };

  return (
    <div>
      <button onClick={handleRideAccepted}>Test Success Notification</button>
      <button onClick={handleError}>Test Error Notification</button>
      <button onClick={handleRideRequest}>Test Ride Request Notification</button>
    </div>
  );
}
```

### Notification Types & Sounds:

| Type | Sound | Use Case |
|------|-------|----------|
| `'success'` | 800 Hz (medium) | Ride accepted, trip started, payment successful |
| `'error'` | 400 Hz (low) | Errors, connection issues, failed operations |
| `'ride_request'` | 600 Hz (medium-low) | New ride request, driver nearby |
| `'ride_accepted'` | 900 Hz (high) | Ride accepted, driver confirmed |
| `'info'` | 600 Hz (medium-low) | General info, trip updates |

### Advanced Usage with Actions:

```tsx
const { addNotification } = useNotifications();

// Notification with action buttons
addNotification(
  'Driver Arriving Soon',
  'Your driver will be here in 5 minutes',
  'info',
  [
    {
      label: 'Track Driver',
      onClick: () => {
        // Open tracking map
        console.log('Opening driver tracking');
      },
      style: 'primary'
    },
    {
      label: 'Call Driver',
      onClick: () => {
        // Call driver
        window.location.href = 'tel:+250123456789';
      },
      style: 'secondary'
    }
  ],
  false  // Not persistent, will auto-close after 6 seconds
);
```

### Real-World Example - Ride Lifecycle:

```tsx
import { useNotifications } from './components/NotificationCenter';
import { subscribeToUserRides } from '../lib/firebase';

export function PassengerDashboard() {
  const { addNotification } = useNotifications();

  useEffect(() => {
    const unsubscribe = subscribeToUserRides(userId, 'passenger', (rides) => {
      const activeRide = rides.find(r => 
        ['requested', 'accepted', 'arrived', 'ongoing'].includes(r.status)
      );

      if (activeRide) {
        switch (activeRide.status) {
          case 'requested':
            addNotification(
              'Looking for a driver...',
              'We\'re searching for available drivers',
              'info',
              [],
              true  // Persistent - user needs to know
            );
            break;

          case 'accepted':
            addNotification(
              'Ride Accepted! 🎉',
              `${activeRide.riderName} is on the way`,
              'ride_accepted',  // 900 Hz high beep
              [],
              true
            );
            break;

          case 'arrived':
            addNotification(
              'Driver Arrived! 📍',
              'Your driver is here. Go meet them!',
              'ride_accepted',  // 900 Hz high beep
              [
                {
                  label: 'Confirm Arrival',
                  onClick: () => handleConfirmArrival(activeRide.id),
                  style: 'primary'
                }
              ],
              true
            );
            break;

          case 'ongoing':
            addNotification(
              'Trip Started! 🚗',
              'Enjoy your ride',
              'success',  // 800 Hz medium beep
              [],
              false  // Auto-close after 6 seconds
            );
            break;
        }
      }
    });

    return unsubscribe;
  }, [userId, addNotification]);
}
```

---

## 📱 Notification UI Layout

### Three Zones:

**Zone 1 - Bell Icon (Top-Right)**:
```
┌─────────────────────────────────┐
│  [Ntwara Logo]    [Dark] [Bell]🔴2 │  ← Bell with unread count
└─────────────────────────────────┘
```

**Zone 2 - Drawer (Right Side)**:
```
┌──────────────────────────────────────┐
│                                      │
│  📍 Notification History             │
│                                      │
│  ┌─ Ride Accepted ─────────────────┐ │
│  │ Your driver is on the way       │ │
│  │ 5 minutes ago                   │ │
│  └─────────────────────────────────┘ │
│                                      │
│  ┌─ Driver Arrived ─────────────────┐ │
│  │ Your driver is here              │ │
│  │ 2 minutes ago                    │ │
│  └─────────────────────────────────┘ │
│                                      │
│  [Clear All]                         │
└──────────────────────────────────────┘
```

**Zone 3 - Inline (Bottom-Right)**:
```
┌────────────────────────────────┐
│                                │
│                      ┌─ Ride Accepted ─────────────────┐
│                      │ Your driver is on the way       │
│                      │ 5 seconds ago                   │
│                      └─────────────────────────────────┘
│                                │
│                      ┌─ Driver Arrived ─────────────────┐
│                      │ Your driver is here              │
│                      │ 2 seconds ago                    │
│                      └─────────────────────────────────┘
│                                │
└────────────────────────────────┘
```

---

## 🔧 Customization

### Change Notification Sound Frequencies:

```tsx
// In src/lib/pushNotifications.ts, modify the frequencies object:
const frequencies: { [key: string]: number } = {
  'success': 800,        // Change from 800 to any Hz (e.g., 750)
  'error': 400,          // Change from 400 to any Hz (e.g., 350)
  'ride_request': 600,   // Change from 600 to any Hz (e.g., 650)
  'ride_accepted': 900,  // Change from 900 to any Hz (e.g., 950)
  'default': 600
};

// Frequency range suggestions:
// 200-400 Hz = Low bass tones (errors, warnings)
// 400-600 Hz = Medium tones (info, requests)
// 600-900 Hz = High tones (success, alerts)
// 900+ Hz = Very high (alarms, urgent)
```

### Change Notification Auto-Close Time:

```tsx
// In src/components/NotificationCenter.tsx, find:
const AUTO_CLOSE_TIME = 6000;  // 6 seconds

// Change to your preferred value (in milliseconds):
const AUTO_CLOSE_TIME = 5000;  // 5 seconds
const AUTO_CLOSE_TIME = 10000; // 10 seconds
```

### Change Inline Notification Count:

```tsx
// In src/components/NotificationCenter.tsx, find:
{notifications.slice(0, 3).map(...);}  // Shows 3 notifications

// Change 3 to your preferred number:
{notifications.slice(0, 5).map(...);}  // Shows 5 notifications
```

---

## 📊 Complete Example - Full Ride Flow

```tsx
import { useState, useEffect } from 'react';
import { useNotifications } from './components/NotificationCenter';
import MapComponent from './MapComponent';
import { createRideRequest, subscribeToUserRides } from '../lib/firebase';

export function PassengerDashboard() {
  const { addNotification } = useNotifications();
  const [pickup, setPickup] = useState('');
  const [destination, setDestination] = useState('');
  const [pickupCoords, setPickupCoords] = useState<{lat: number, lng: number} | null>(null);
  const [destinationCoords, setDestinationCoords] = useState<{lat: number, lng: number} | null>(null);
  const [activeRide, setActiveRide] = useState(null);

  // Set up ride status listener
  useEffect(() => {
    const unsubscribe = subscribeToUserRides(userId, 'passenger', (rides) => {
      const active = rides.find(r => 
        ['requested', 'accepted', 'arrived', 'ongoing'].includes(r.status)
      );
      setActiveRide(active);

      if (active) {
        switch (active.status) {
          case 'accepted':
            // Sound will automatically play (900 Hz - high beep)
            addNotification(
              'Ride Accepted! 🎉',
              `${active.driverName} is on the way`,
              'ride_accepted',
              [],
              true
            );
            break;
          case 'arrived':
            addNotification(
              'Driver Arrived! 📍',
              'Go meet your driver',
              'ride_accepted',
              [],
              true
            );
            break;
          case 'ongoing':
            addNotification(
              'Trip Started! 🚗',
              'Enjoy your ride',
              'success',
              [],
              false
            );
            break;
        }
      }
    });

    return unsubscribe;
  }, [userId, addNotification]);

  // Direction requests for map
  const directionRequests = pickupCoords && destinationCoords ? [
    {
      id: 'route-1',
      origin: pickupCoords,
      destination: destinationCoords
    }
  ] : [];

  const handleRequestRide = async () => {
    if (!pickupCoords || !destinationCoords) {
      addNotification(
        'Missing Location',
        'Please select both pickup and destination',
        'error'
      );
      return;
    }

    try {
      // Show "requesting" notification
      addNotification(
        'Requesting Ride...',
        'Finding the best driver for you',
        'info',
        [],
        true  // Persistent
      );

      // Create ride request in Firestore
      await createRideRequest({
        pickup: pickupCoords,
        destination: destinationCoords,
        vehicleType: 'car',
        userId: currentUser.uid
      });

      // Success feedback
      addNotification(
        'Request Sent!',
        'Looking for available drivers...',
        'success',
        [],
        false  // Auto-close
      );
    } catch (error) {
      addNotification(
        'Request Failed',
        'Unable to create ride request',
        'error',
        [],
        true  // Persistent so user sees it
      );
    }
  };

  return (
    <div>
      {/* Map with autocomplete and route display */}
      <MapComponent
        center={pickupCoords || { lat: -1.9536, lng: 29.8739 }}
        zoom={13}
        showPlaces={true}
        onPlaceSelected={(place) => {
          setDestination(place.name);
          setDestinationCoords(place.position);
        }}
        markers={[
          ...(pickupCoords ? [{
            id: 'pickup',
            position: pickupCoords,
            label: 'Pickup',
            type: 'passenger'
          }] : []),
          ...(destinationCoords ? [{
            id: 'destination',
            position: destinationCoords,
            label: 'Destination',
            type: 'destination'
          }] : [])
        ]}
        directionRequests={directionRequests}  // Shows routes
        autoFit={true}
      />

      {/* Request Button */}
      <button 
        onClick={handleRequestRide}
        disabled={!pickupCoords || !destinationCoords}
      >
        Request Ride
      </button>
    </div>
  );
}
```

---

## ✅ Checklist Before Deployment

- [ ] Notification sounds work on all browsers
- [ ] Autocomplete dropdown appears when typing
- [ ] Routes display correctly with polylines
- [ ] Bell icon shows unread count
- [ ] Drawer opens/closes smoothly
- [ ] Inline notifications auto-close after 6s
- [ ] Persistent notifications stay visible
- [ ] Action buttons trigger correct callbacks
- [ ] No console errors on notification creation
- [ ] Sound frequencies appropriate for your use case

---

## 🆘 Quick Troubleshooting

| Problem | Solution |
|---------|----------|
| No sound | Check browser volume, allow audio in browser settings, check console for errors |
| Suggestions don't appear | Type more characters, check Places API enabled, verify API key |
| Routes not showing | Verify coordinates are valid, check zoom level >= 10, check Directions API enabled |
| Notifications not visible | Ensure NotificationProvider wraps App in main.tsx |
| Drawer doesn't open | Check z-index conflicts, verify isDrawerOpen state changes |


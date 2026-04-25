import { useState, useEffect, useRef } from 'react';
import { User as FirebaseUser } from 'firebase/auth';
import { UserProfile, createRideRequest, subscribeToUserRides, Ride, updateRideStatus, subscribeToUserProfile, rateRide, RatingReason, reverseGeocode, db, subscribeToOnlineRiders, saveLocation, removeSavedLocation, getNearbyDrivers, SavedLocation } from '../lib/firebase';
import { MapPin, Navigation, Clock, ChevronRight, X, Loader2, CheckCircle2, Navigation2, Star, User as UserIcon, Map as MapIcon, ShieldCheck, Award, Timer, Compass, Heart, Phone, Save, Trash2, MapPinPlus, Car, Bike, BarChart3, FileText } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useNotifications } from './NotificationCenter';
import { useLanguage } from '../lib/i18n';
import { updateDoc, doc, arrayUnion, arrayRemove, serverTimestamp } from 'firebase/firestore';
import MapComponent from './MapComponent';
import TripReport from './TripReport';
import TripAnalytics from './TripAnalytics';

interface Props {
  user: FirebaseUser;
  profile: UserProfile;
}

const hasValidCoordinates = (point?: { lat: number; lng: number } | null) =>
  !!point &&
  Number.isFinite(point.lat) &&
  Number.isFinite(point.lng) &&
  (point.lat !== 0 || point.lng !== 0);

export default function PassengerDashboard({ user, profile }: Props) {
  const { t } = useLanguage();
  const { addNotification } = useNotifications();
  const [viewMode, setViewMode] = useState<'ride' | 'reports' | 'analytics'>('ride');
  const [pickup, setPickup] = useState('');
  const [destination, setDestination] = useState('');
  const [vehicleType, setVehicleType] = useState<'car' | 'motorcycle'>('car');
  const [activeRide, setActiveRide] = useState<Ride | null>(null);
  const [completedRide, setCompletedRide] = useState<Ride | null>(null);
  const [riderProfile, setRiderProfile] = useState<UserProfile | null>(null);
  const [onlineRiders, setOnlineRiders] = useState<UserProfile[]>([]);
  const [nearbyDrivers, setNearbyDrivers] = useState<UserProfile[]>([]);
  // Map to track which rides have already had notifications sent for specific events
  const notificationSentRef = useRef<{
    [rideId: string]: Set<string>
  }>({});

  const hasNotificationBeenSent = (rideId: string, eventType: string): boolean => {
    if (!notificationSentRef.current[rideId]) {
      notificationSentRef.current[rideId] = new Set();
    }
    return notificationSentRef.current[rideId].has(eventType);
  };

  const markNotificationAsSent = (rideId: string, eventType: string): void => {
    if (!notificationSentRef.current[rideId]) {
      notificationSentRef.current[rideId] = new Set();
    }
    notificationSentRef.current[rideId].add(eventType);
  };

  const clearNotificationTracking = (rideId: string): void => {
    delete notificationSentRef.current[rideId];
  };
  const [isRequesting, setIsRequesting] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [isCancelling, setIsCancelling] = useState(false);
  const [selectedNearbyRiderId, setSelectedNearbyRiderId] = useState<string | null>(null);
  const [rating, setRating] = useState(0);
  const [ratingReason, setRatingReason] = useState<RatingReason | ''>('');
  const [isRating, setIsRating] = useState(false);
  
  // ETA logic
  const [eta, setEta] = useState<number | null>(null);

  // Location logic
  const [isLocating, setIsLocating] = useState(false);

  // Map Pins
  const [isPickingOnMap, setIsPickingOnMap] = useState<'pickup' | 'destination' | null>(null);
  const [passengerLocation, setPassengerLocation] = useState<{lat: number, lng: number} | null>(null);
  const [destinationLocation, setDestinationLocation] = useState<{lat: number, lng: number} | null>(null);
  
  // Saved Locations
  const [savedLocations, setSavedLocations] = useState<SavedLocation[]>(profile.savedLocations || []);
  const [showSaveLocationModal, setShowSaveLocationModal] = useState(false);
  const [locationNameToSave, setLocationNameToSave] = useState('');
  const [isSavingLocation, setIsSavingLocation] = useState(false);

  const handleSaveLocation = async (address: string, lat: number, lng: number) => {
    if (!locationNameToSave.trim()) {
      addNotification('Error', 'Please enter a name for this location', 'error');
      return;
    }
    
    setIsSavingLocation(true);
    try {
      await saveLocation(user.uid, {
        name: locationNameToSave,
        address,
        lat,
        lng
      });
      setSavedLocations([...savedLocations, {
        id: `${Date.now()}`,
        name: locationNameToSave,
        address,
        lat,
        lng
      }]);
      addNotification('Location Saved', `${locationNameToSave} has been saved to your favorites`, 'success');
      setShowSaveLocationModal(false);
      setLocationNameToSave('');
    } catch (e) {
      console.error(e);
      addNotification('Error', 'Failed to save location', 'error');
    } finally {
      setIsSavingLocation(false);
    }
  };

  const handleRemoveSavedLocation = async (locationId: string) => {
    try {
      await removeSavedLocation(user.uid, locationId);
      setSavedLocations(savedLocations.filter(loc => loc.id !== locationId));
      addNotification('Location Removed', 'Saved location has been deleted', 'success');
    } catch (e) {
      console.error(e);
      addNotification('Error', 'Failed to remove location', 'error');
    }
  };

  const handleToggleFavorite = async (targetUserId: string) => {
    const isFavorite = profile.favoriteUserIds?.includes(targetUserId);
    try {
      await updateDoc(doc(db, 'users', user.uid), {
        favoriteUserIds: isFavorite ? arrayRemove(targetUserId) : arrayUnion(targetUserId)
      });
      addNotification(
        isFavorite ? 'Removed from Favorites' : 'Added to Favorites',
        isFavorite ? 'Rider removed from your preferred list.' : 'Rider added to your preferred list.',
        'info'
      );
    } catch (e) {
      console.error(e);
    }
  };

  const handleUseCurrentLocation = async () => {
    if (!navigator.geolocation) {
      alert("Geolocation is not supported by your browser");
      return;
    }

    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        setPassengerLocation({ lat: latitude, lng: longitude });
        
        const address = await reverseGeocode(latitude, longitude);
        setPickup(address);
        setIsLocating(false);
      },
      (error) => {
        console.error("Error getting location", error);
        setIsLocating(false);
        alert("Unable to retrieve your location. Please ensure location services are enabled.");
      }
    );
  };

  useEffect(() => {
    // Only subscribe to all online riders if we don't have an active ride
    if (!activeRide) {
      const unsubscribe = subscribeToOnlineRiders((riders) => {
        setOnlineRiders(riders);
      });
      return unsubscribe;
    } else {
      setOnlineRiders([]);
    }
  }, [activeRide]);

  // Load nearby drivers when ride is active and passenger location is known
  useEffect(() => {
    const ridePickupLocation =
      passengerLocation ||
      (activeRide && hasValidCoordinates(activeRide.pickup)
        ? { lat: activeRide.pickup.lat, lng: activeRide.pickup.lng }
        : null);

    if (activeRide && ridePickupLocation && activeRide.status === 'requested') {
      const loadNearbyDrivers = async () => {
        try {
          const drivers = await getNearbyDrivers(ridePickupLocation.lat, ridePickupLocation.lng, 10);
          setNearbyDrivers(drivers);
        } catch (error) {
          console.error('Failed to load nearby drivers:', error);
        }
      };
      
      loadNearbyDrivers();
      const interval = setInterval(loadNearbyDrivers, 5000); // Refresh every 5 seconds
      return () => clearInterval(interval);
    } else {
      setNearbyDrivers([]);
    }
  }, [activeRide, passengerLocation]);

  useEffect(() => {
    const unsubscribe = subscribeToUserRides(user.uid, 'passenger', (rides) => {
      const active = rides.find(r => ['requested', 'accepted', 'arrived', 'ongoing'].includes(r.status));
      const justCompleted = rides.find(r => r.status === 'completed' && !r.riderRating);
      
      if (active) {
        // Status change notifications
        if (!hasNotificationBeenSent(active.id, `status-${active.status}`)) {
          if (active.status === 'accepted') {
            addNotification(t('rideAccepted'), t('riderOnWay'), 'ride_accepted');
            markNotificationAsSent(active.id, `status-${active.status}`);
          } else if (active.status === 'arrived') {
            addNotification(t('riderArrivedNotify'), t('riderArrivedMessage'), 'ride_accepted');
            markNotificationAsSent(active.id, `status-${active.status}`);
          } else if (active.status === 'ongoing') {
            addNotification(t('tripStartedNotify'), t('tripStartedMessage'), 'info');
            markNotificationAsSent(active.id, `status-${active.status}`);
          }
        }

        // Driver confirmed end of ride - send only once per ride
        if (active.status === 'ongoing' && active.riderConfirmedEnd && !hasNotificationBeenSent(active.id, 'driver-confirmed-end')) {
          addNotification(
            'Destination Reached! 📍',
            'Your driver has confirmed you\'ve reached the destination.',
            'ride_accepted',
            [
              {
                label: 'Confirm Arrival',
                onClick: async () => {
                  try {
                    await updateDoc(doc(db, 'rides', active.id), {
                      passengerConfirmedEnd: true,
                      status: 'completed',
                      completedAt: serverTimestamp(),
                      updatedAt: serverTimestamp()
                    });
                  } catch (err) {
                    console.error('Error confirming end:', err);
                  }
                },
                style: 'primary'
              },
              {
                label: 'Not Yet',
                onClick: async () => {
                  try {
                    await updateDoc(doc(db, 'rides', active.id), {
                      riderConfirmedEnd: false,
                      updatedAt: serverTimestamp()
                    });
                  } catch (err) {
                    console.error('Error rejecting end:', err);
                  }
                },
                style: 'secondary'
              }
            ]
          );
          markNotificationAsSent(active.id, 'driver-confirmed-end');
        }
      }

      if (justCompleted && !hasNotificationBeenSent(justCompleted.id, 'trip-completed')) {
        addNotification(t('tripCompletedNotify'), t('tripCompletedMessage'), 'success');
        markNotificationAsSent(justCompleted.id, 'trip-completed');
      }

      // Clear tracking when ride transitions away from active states
      const previousActive = notificationSentRef.current;
      for (const rideId in previousActive) {
        if (!rides.find(r => r.id === rideId && ['requested', 'accepted', 'arrived', 'ongoing', 'completed'].includes(r.status))) {
          clearNotificationTracking(rideId);
        }
      }

      setActiveRide(active || null);
      setCompletedRide(justCompleted || null);
    });
    return unsubscribe;
  }, [user.uid, addNotification]);

  useEffect(() => {
    const ridePickupLocation =
      passengerLocation ||
      (activeRide && hasValidCoordinates(activeRide.pickup)
        ? { lat: activeRide.pickup.lat, lng: activeRide.pickup.lng }
        : null);

    if (activeRide?.status === 'accepted' && riderProfile?.currentLocation && ridePickupLocation) {
      // Basic distance calculation for ETA (roughly 2 mins per 0.01 lat/lng diff)
      const latDiff = Math.abs(riderProfile.currentLocation.lat - ridePickupLocation.lat);
      const lngDiff = Math.abs(riderProfile.currentLocation.lng - ridePickupLocation.lng);
      const distance = Math.sqrt(Math.pow(latDiff, 2) + Math.pow(lngDiff, 2));
      const estimatedMinutes = Math.max(1, Math.round(distance * 200)); 
      setEta(estimatedMinutes);
    } else {
      setEta(null);
    }
  }, [activeRide?.status, riderProfile?.currentLocation, passengerLocation]);

  useEffect(() => {
    if (!passengerLocation && activeRide && hasValidCoordinates(activeRide.pickup)) {
      setPassengerLocation({ lat: activeRide.pickup.lat, lng: activeRide.pickup.lng });
    }
  }, [activeRide, passengerLocation]);

  useEffect(() => {
    const riderStillVisible = [...onlineRiders, ...nearbyDrivers].some((rider) => rider.uid === selectedNearbyRiderId);
    if (selectedNearbyRiderId && !riderStillVisible) {
      setSelectedNearbyRiderId(null);
    }
  }, [onlineRiders, nearbyDrivers, selectedNearbyRiderId]);

  // Track rider profile when accepted
  useEffect(() => {
    if (activeRide?.riderId) {
      const unsubscribe = subscribeToUserProfile(activeRide.riderId, (p) => {
        setRiderProfile(p);
      });
      return unsubscribe;
    } else {
      setRiderProfile(null);
    }
  }, [activeRide?.riderId]);

  const handleRequestRide = async () => {
    if (!pickup || !destination) return;
    setIsRequesting(true);
    try {
      await createRideRequest({
        passengerId: user.uid,
        pickup: { address: pickup, lat: passengerLocation?.lat || 0, lng: passengerLocation?.lng || 0 },
        destination: { address: destination, lat: destinationLocation?.lat || 0, lng: destinationLocation?.lng || 0 },
        status: 'requested',
        fare: 0,
        vehicleType: vehicleType,
      });
      setPickup('');
      setDestination('');
      setPassengerLocation(null);
      setDestinationLocation(null);
    } catch (error) {
      console.error("Failed to request ride", error);
    } finally {
      setIsRequesting(false);
    }
  };

  const handleCancelRide = async () => {
    if (!activeRide) return;
    setIsCancelling(true);
    try {
      await updateRideStatus(activeRide.id, 'cancelled', undefined, cancelReason || 'User cancelled');
      setShowCancelModal(false);
      setCancelReason('');
    } catch (error) {
      console.error("Failed to cancel", error);
    } finally {
      setIsCancelling(false);
    }
  };

  const handleRateRide = async () => {
    if (!completedRide || rating === 0 || !ratingReason) return;
    setIsRating(true);
    try {
      await rateRide(completedRide.id, rating, ratingReason as RatingReason);
      setCompletedRide(null);
      setRating(0);
      setRatingReason('');
    } catch (error) {
      console.error("Failed to rate", error);
    } finally {
      setIsRating(false);
    }
  };

  const handleConfirmArrival = async () => {
    if (!activeRide || activeRide.status !== 'arrived' || activeRide.passengerConfirmedArrival) return;
    try {
      await updateDoc(doc(db, 'rides', activeRide.id), {
        passengerConfirmedArrival: true,
        isOnTime: eta !== null, // If confirmed while we had an ETA
        updatedAt: serverTimestamp()
      });
      addNotification(t('confirmedArrival'), 'You have confirmed the driver has arrived.', 'success');
    } catch (e) { console.error(e); }
  };

  const handleConfirmStart = async () => {
    if (!activeRide || activeRide.status !== 'arrived' || !activeRide.passengerConfirmedArrival || !activeRide.riderConfirmedStart || activeRide.passengerConfirmedStart) return;
    try {
      await updateDoc(doc(db, 'rides', activeRide.id), {
        passengerConfirmedStart: true,
        status: 'ongoing',
        startedAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      addNotification(t('tripStartedNotify'), 'Enjoy your ride!', 'success');
    } catch (e) { console.error(e); }
  };

  const handleRejectArrival = async () => {
    if (!activeRide || activeRide.status !== 'arrived' || activeRide.passengerConfirmedArrival) return;
    try {
      await updateDoc(doc(db, 'rides', activeRide.id), {
        status: 'accepted',
        riderConfirmedStart: false,
        updatedAt: serverTimestamp()
      });
      addNotification('Arrival rejected', 'The rider was sent back to the on-the-way stage until they really reach you.', 'info');
    } catch (e) { console.error(e); }
  };

  const handleRejectStart = async () => {
    if (!activeRide || activeRide.status !== 'arrived' || !activeRide.riderConfirmedStart || activeRide.passengerConfirmedStart) return;
    try {
      await updateDoc(doc(db, 'rides', activeRide.id), {
        riderConfirmedStart: false,
        updatedAt: serverTimestamp()
      });
      addNotification('Start rejected', 'Trip start approval was removed until the rider actually begins the trip with you.', 'info');
    } catch (e) { console.error(e); }
  };

  const handleConfirmReached = async () => {
    if (!activeRide || activeRide.status !== 'ongoing' || !activeRide.riderConfirmedEnd || activeRide.passengerConfirmedEnd) return;
    try {
      await updateDoc(doc(db, 'rides', activeRide.id), {
        passengerConfirmedEnd: true,
        status: 'completed',
        completedAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
    } catch (e) { console.error(e); }
  };

  const handleRejectReached = async () => {
    if (!activeRide || activeRide.status !== 'ongoing' || !activeRide.riderConfirmedEnd || activeRide.passengerConfirmedEnd) return;
    try {
      await updateDoc(doc(db, 'rides', activeRide.id), {
        riderConfirmedEnd: false,
        updatedAt: serverTimestamp()
      });
      addNotification('Destination rejected', 'The ride stays active until you confirm you have really arrived.', 'info');
    } catch (e) { console.error(e); }
  };

  const handleMapClick = async ({ lat, lng }: { lat: number; lng: number }) => {
    if (!isPickingOnMap) return;
    const address = await reverseGeocode(lat, lng);
    
    if (isPickingOnMap === 'pickup') {
      setPickup(address);
      setPassengerLocation({ lat, lng });
    } else {
      setDestination(address);
      setDestinationLocation({ lat, lng });
    }
    setIsPickingOnMap(null);
  };

  const pickerCenter =
    (isPickingOnMap === 'destination' ? destinationLocation : passengerLocation) ||
    passengerLocation ||
    destinationLocation ||
    { lat: -1.9441, lng: 30.0619 };

  const pickerMarkers = [
    ...(passengerLocation ? [{
      id: 'picker-pickup',
      position: passengerLocation,
      label: pickup || t('pickupLocation'),
      type: 'passenger' as const
    }] : []),
    ...(destinationLocation ? [{
      id: 'picker-destination',
      position: destinationLocation,
      label: destination || t('destinationAddress'),
      type: 'destination' as const
    }] : [])
  ];
  const pickerDirectionRequests =
    passengerLocation && destinationLocation
      ? [{
          id: 'picker-route-preview',
          origin: passengerLocation,
          destination: destinationLocation,
          color: '#2563eb'
        }]
      : [];

  if (completedRide) {
    return (
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white p-8 rounded-[2.5rem] shadow-2xl space-y-8"
      >
        <div className="text-center space-y-2">
          <div className="w-20 h-20 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 className="w-10 h-10" />
          </div>
          <h2 className="text-2xl font-bold">{t('tripCompletedNotify')}</h2>
          <p className="text-gray-500">Rate your journey with Ntwara</p>
        </div>

        <div className="space-y-6">
          <div className="flex justify-center gap-2">
            {[1, 2, 3, 4, 5].map((star) => (
              <button 
                key={star}
                onClick={() => setRating(star)}
                className={`p-2 transition-transform active:scale-90 ${rating >= star ? 'text-amber-400' : 'text-gray-200'}`}
              >
                <Star className="w-10 h-10 fill-current" />
              </button>
            ))}
          </div>

          <div className="grid grid-cols-3 gap-3">
            {[
              { id: 'driving', label: 'Driving Skills', icon: Award },
              { id: 'timing', label: 'On Time', icon: Timer },
              { id: 'navigation', label: 'Navigation', icon: Compass }
            ].map((reason) => (
              <button
                key={reason.id}
                onClick={() => setRatingReason(reason.id as RatingReason)}
                className={`p-4 rounded-2xl flex flex-col items-center gap-2 transition-all border-2 ${ratingReason === reason.id ? 'bg-black text-white border-black' : 'bg-gray-50 text-gray-400 border-transparent hover:border-gray-200'}`}
              >
                <reason.icon className="w-6 h-6" />
                <span className="text-[10px] font-bold uppercase tracking-wider">{reason.label}</span>
              </button>
            ))}
          </div>
        </div>

        <button 
          onClick={handleRateRide}
          disabled={rating === 0 || !ratingReason || isRating}
          className="w-full bg-black text-white py-5 rounded-3xl font-bold disabled:opacity-50 hover:bg-gray-800 transition-all flex items-center justify-center gap-2 shadow-xl shadow-black/10"
        >
          {isRating ? <Loader2 className="w-5 h-5 animate-spin" /> : t('submitFeedback')}
        </button>
      </motion.div>
    );
  }

  if (activeRide) {
    const ridePickupLocation =
      passengerLocation ||
      (hasValidCoordinates(activeRide.pickup)
        ? { lat: activeRide.pickup.lat, lng: activeRide.pickup.lng }
        : null);
    const focusedNearbyDriver =
      nearbyDrivers.find((driver) => driver.uid === selectedNearbyRiderId && hasValidCoordinates(driver.currentLocation)) || null;
    const waitingForRiderStart = activeRide.status === 'arrived' && activeRide.passengerConfirmedArrival && !activeRide.riderConfirmedStart;
    const waitingForRiderEndSignal = activeRide.status === 'ongoing' && !activeRide.riderConfirmedEnd;
    const rideDestination =
      hasValidCoordinates(activeRide.destination)
        ? { lat: activeRide.destination.lat, lng: activeRide.destination.lng }
        : null;
    const activeRideDirectionRequests = [
      ...(activeRide.status === 'requested' && ridePickupLocation && rideDestination
        ? [{
            id: `passenger-requested-trip-${activeRide.id}`,
            origin: ridePickupLocation,
            destination: rideDestination,
            color: '#60a5fa'
          }]
        : []),
      ...((activeRide.status === 'accepted' || activeRide.status === 'arrived') &&
      riderProfile?.currentLocation &&
      ridePickupLocation
        ? [{
            id: `passenger-driver-to-pickup-${activeRide.id}`,
            origin: riderProfile.currentLocation,
            destination: ridePickupLocation,
            color: '#10b981'
          }]
        : []),
      ...((activeRide.status === 'accepted' || activeRide.status === 'arrived') &&
      ridePickupLocation &&
      rideDestination
        ? [{
            id: `passenger-pickup-to-destination-${activeRide.id}`,
            origin: ridePickupLocation,
            destination: rideDestination,
            color: '#60a5fa'
          }]
        : []),
      ...(activeRide.status === 'ongoing' &&
      riderProfile?.currentLocation &&
      rideDestination
        ? [{
            id: `passenger-live-trip-${activeRide.id}`,
            origin: riderProfile.currentLocation,
            destination: rideDestination,
            color: '#2563eb'
          }]
        : [])
    ];

    return (
      <div className="space-y-6">
        <h2 className="text-2xl font-bold tracking-tight">Active Ride</h2>
        
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-black text-white rounded-3xl shadow-2xl relative overflow-hidden"
        >
          {ridePickupLocation && (
            <MapComponent 
              markers={[
                {
                  id: 'passenger',
                  position: ridePickupLocation,
                  label: 'You',
                  type: 'passenger'
                },
                ...(riderProfile?.currentLocation ? [{
                  id: riderProfile.uid,
                  position: riderProfile.currentLocation,
                  label: riderProfile.name,
                  type: 'rider' as const,
                  profile: riderProfile
                }] : []),
                ...(hasValidCoordinates(activeRide.destination) ? [{
                  id: 'destination',
                  position: { lat: activeRide.destination.lat, lng: activeRide.destination.lng },
                  label: activeRide.destination.address || 'Destination',
                  type: 'destination' as const
                }] : []),
                ...(activeRide.status === 'requested' ? nearbyDrivers
                  .filter(d => d.currentLocation)
                  .map(driver => ({
                    id: driver.uid,
                    position: driver.currentLocation!,
                    label: driver.name,
                    type: 'nearby' as const,
                    profile: driver
                  })) : [])
              ]}
              directionRequests={activeRideDirectionRequests}
              center={focusedNearbyDriver?.currentLocation || riderProfile?.currentLocation || ridePickupLocation}
              zoom={15}
              height="384px"
              showNearbyDrivers={activeRide.status === 'requested'}
              onMarkerClick={(marker) => {
                if (marker.type === 'nearby') {
                  setSelectedNearbyRiderId(marker.id);
                }
              }}
            />
          )}

          <div className="p-8 relative z-10 flex flex-col h-full justify-between gap-8">
            <div className="flex justify-between items-start">
              <div className="max-w-[180px]">
                <div className="inline-flex items-center gap-2 px-3 py-1 bg-white/10 rounded-full text-[10px] font-bold uppercase tracking-wider mb-4">
                  <div className={`w-1.5 h-1.5 rounded-full ${activeRide.status === 'requested' ? 'bg-amber-400 animate-pulse' : 'bg-emerald-400'}`} />
                  {activeRide.status}
                </div>
                <h3 className="text-3xl font-bold mb-2 leading-tight">
                  {activeRide.status === 'requested' ? t('findingRider') : activeRide.status === 'accepted' ? t('riderOnWay') : activeRide.status === 'arrived' ? (activeRide.passengerConfirmedArrival ? t('arrivingSoon') : t('riderArrivedNotify')) : t('tripStartedNotify')}
                </h3>
                {eta !== null && activeRide.status === 'accepted' && (
                  <motion.div 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex flex-col gap-1 mt-4 p-4 bg-emerald-500/10 rounded-2xl border border-emerald-500/20"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-emerald-400 font-black text-[10px] uppercase tracking-[0.2em]">
                        <Timer className="w-3.5 h-3.5" />
                        <span>Live ETA</span>
                      </div>
                      <span className="text-emerald-400 font-black text-lg">{eta} <span className="text-[10px] uppercase">{t('minutes')}</span></span>
                    </div>
                    <div className="w-full h-1 bg-white/5 rounded-full overflow-hidden mt-2">
                      <motion.div 
                        initial={{ width: "0%" }}
                        animate={{ width: "100%" }}
                        transition={{ duration: 2, repeat: Infinity }}
                        className="h-full bg-emerald-500 shadow-[0_0_10px_#10b981]"
                      />
                    </div>
                    <p className="text-[9px] text-white/40 font-bold uppercase tracking-widest mt-1">Rider is filtering through traffic</p>
                  </motion.div>
                )}
                {activeRide.isOnTime && (
                  <div className="flex items-center gap-1 text-[10px] text-emerald-400 font-bold uppercase tracking-widest mt-1">
                    <ShieldCheck className="w-3 h-3" />
                    On Time Driver
                  </div>
                )}
              </div>
              
              {riderProfile && (
                <div className="flex flex-col items-end">
                  <div className="relative mb-2 flex items-center gap-3">
                    <button 
                      onClick={() => handleToggleFavorite(riderProfile.uid)}
                      className={`p-2 rounded-xl transition-all active:scale-95 ${profile.favoriteUserIds?.includes(riderProfile.uid) ? 'bg-red-500/20 text-red-500' : 'bg-white/10 text-white/40 hover:text-white'}`}
                    >
                      <Heart className={`w-5 h-5 ${profile.favoriteUserIds?.includes(riderProfile.uid) ? 'fill-current' : ''}`} />
                    </button>
                    <a
                      href={`tel:${riderProfile.phoneNumber}`}
                      className="p-2 rounded-xl transition-all active:scale-95 bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30"
                      title={`Call ${riderProfile.name}`}
                    >
                      <Phone className="w-5 h-5" />
                    </a>
                    <div className="relative">
                      {riderProfile.avatarUrl ? (
                        <img src={riderProfile.avatarUrl} referrerPolicy="no-referrer" className="w-14 h-14 rounded-2xl border-2 border-white/20" />
                      ) : (
                        <div className="w-14 h-14 bg-white/10 rounded-2xl flex items-center justify-center">
                          <UserIcon className="w-6 h-6 text-white/40" />
                        </div>
                      )}
                      <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-emerald-500 rounded-lg flex items-center justify-center border-2 border-black">
                        <ShieldCheck className="w-3 h-3 text-white" />
                      </div>
                    </div>
                  </div>
                  <p className="text-sm font-bold">{riderProfile.name}</p>
                  {riderProfile.vehicleModel && (
                    <p className="text-[10px] font-bold text-white/40 uppercase tracking-widest mt-0.5">
                      {riderProfile.vehicleModel} • {riderProfile.numberPlate}
                    </p>
                  )}
                  <div className="flex items-center gap-1 text-amber-400 mb-1 mt-1">
                    <Star className="w-3 h-3 fill-current" />
                    <span className="text-xs font-bold">{riderProfile.rating}</span>
                  </div>
                  {riderProfile.badges && riderProfile.badges.length > 0 && (
                    <div className="flex gap-1">
                      {riderProfile.badges.map((badge, idx) => (
                        <div key={idx} className="bg-white/10 p-1 rounded-md" title={badge}>
                          {badge === 'Top Navigator' && <Compass className="w-3 h-3 text-emerald-400" />}
                          {badge === 'Safe Driver' && <ShieldCheck className="w-3 h-3 text-blue-400" />}
                          {badge === 'Elite Status' && <Award className="w-3 h-3 text-amber-400" />}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="space-y-4">
              <div className="flex items-start gap-4">
                <div className="w-8 h-8 bg-white/10 rounded-full flex items-center justify-center flex-shrink-0">
                  <MapPin className="w-4 h-4 text-white/50" />
                </div>
                <div>
                  <p className="text-[10px] text-white/40 font-bold uppercase tracking-widest mb-0.5">{t('pickupLocation')}</p>
                  <p className="font-medium leading-tight">{activeRide.pickup.address}</p>
                </div>
              </div>
              <div className="flex items-start gap-4">
                <div className="w-8 h-8 bg-white/10 rounded-full flex items-center justify-center flex-shrink-0">
                  <Navigation className="w-4 h-4 text-white/50" />
                </div>
                <div>
                  <p className="text-[10px] text-white/40 font-bold uppercase tracking-widest mb-0.5">{t('destinationAddress')}</p>
                  <p className="font-medium leading-tight">{activeRide.destination.address}</p>
                </div>
              </div>
            </div>

            {/* Nearby Drivers Section - Removed, destination now shown on map */}
            {false && (
              <div className="pt-6 border-t border-white/10">
                <p className="text-[10px] text-white/40 font-bold uppercase tracking-widest mb-4">Nearby Drivers ({nearbyDrivers.length})</p>
                <div className="space-y-3 max-h-48 overflow-y-auto">
                  {nearbyDrivers.slice(0, 5).map((driver) => (
                    <motion.div 
                      key={driver.uid}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      onClick={() => setSelectedNearbyRiderId(driver.uid)}
                      className={`bg-white/10 backdrop-blur-sm rounded-2xl p-4 flex items-center justify-between border transition-all cursor-pointer ${selectedNearbyRiderId === driver.uid ? 'border-emerald-400/60 bg-emerald-500/10' : 'border-white/10 hover:border-white/20'}`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        {driver.avatarUrl ? (
                          <img src={driver.avatarUrl} className="w-10 h-10 rounded-xl object-cover" alt="" />
                        ) : (
                          <div className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center">
                            <UserIcon className="w-5 h-5 text-white/40" />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="font-bold text-white truncate">{driver.name}</p>
                            <div className="flex items-center gap-1 text-amber-400 text-[10px] font-bold">
                              <Star className="w-3 h-3 fill-current" />
                              {driver.rating}
                            </div>
                          </div>
                          {driver.badges && driver.badges.length > 0 && (
                            <div className="flex items-center gap-1 mt-1 flex-wrap">
                              {driver.badges.map((badge, idx) => (
                                <span key={idx} className="text-[8px] bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded-full font-bold">
                                  {badge}
                                </span>
                              ))}
                            </div>
                          )}
                          {driver.phoneNumber && (
                            <p className="text-[10px] text-white/40 font-medium mt-1">{driver.phoneNumber}</p>
                          )}
                        </div>
                      </div>
                      {driver.phoneNumber && (
                        <a 
                          href={`tel:${driver.phoneNumber}`}
                          onClick={(e) => e.stopPropagation()}
                          className="ml-3 p-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl transition-colors active:scale-95 flex-shrink-0"
                          title="Call driver"
                        >
                          <Phone className="w-4 h-4" />
                        </a>
                      )}
                    </motion.div>
                  ))}
                </div>
              </div>
            )}

            <div className="pt-6 border-t border-white/10 flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-white/40 font-bold uppercase tracking-widest mb-1">{t('fareToBeNegotiated')}</p>
                  <p className="text-lg font-bold text-emerald-400">{t('byAgreement')}</p>
                  <p className="text-xs text-white/40 mt-1">{t('negotiateOnArrival')}</p>
                </div>
                {['requested', 'accepted', 'arrived'].includes(activeRide.status) && (
                  <button 
                    onClick={() => setShowCancelModal(true)}
                    className="bg-white/10 hover:bg-white/20 text-white px-6 py-3 rounded-2xl font-bold transition-colors"
                  >
                    {t('cancel')}
                  </button>
                )}
              </div>

              {/* Handshake Buttons */}
              <div className="flex flex-col gap-2">
                {activeRide.status === 'arrived' && !activeRide.passengerConfirmedArrival && (
                  <div className="grid gap-2 sm:grid-cols-2">
                    <button 
                      onClick={handleConfirmArrival}
                      className="w-full bg-emerald-500 hover:bg-emerald-600 text-white py-4 rounded-2xl font-bold shadow-lg shadow-emerald-500/20 transition-all active:scale-95 flex items-center justify-center gap-2"
                    >
                      <CheckCircle2 className="w-5 h-5" />
                      Confirm Driver Arrival
                    </button>
                    <button
                      onClick={handleRejectArrival}
                      className="w-full bg-white/10 hover:bg-white/20 text-white py-4 rounded-2xl font-bold transition-all active:scale-95 flex items-center justify-center gap-2"
                    >
                      <X className="w-5 h-5" />
                      Rider Not Here
                    </button>
                  </div>
                )}

                {waitingForRiderStart && (
                  <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/70">
                    Your rider is waiting at pickup. Once they signal the trip start, you can approve it here.
                  </div>
                )}

                {activeRide.status === 'arrived' && activeRide.passengerConfirmedArrival && activeRide.riderConfirmedStart && (
                  <div className="grid gap-2 sm:grid-cols-2">
                    <button 
                      onClick={handleConfirmStart}
                      className="w-full bg-white text-black py-4 rounded-2xl font-bold transition-all active:scale-95 flex items-center justify-center gap-2"
                    >
                      <Navigation2 className="w-5 h-5" />
                      Approve Trip Start
                    </button>
                    <button
                      onClick={handleRejectStart}
                      className="w-full bg-white/10 hover:bg-white/20 text-white py-4 rounded-2xl font-bold transition-all active:scale-95 flex items-center justify-center gap-2"
                    >
                      <X className="w-5 h-5" />
                      Reject Start
                    </button>
                  </div>
                )}

                {waitingForRiderEndSignal && (
                  <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/70">
                    The ride is in progress. This panel will unlock the final confirmation once the rider marks that you have reached the destination.
                  </div>
                )}

                {activeRide.status === 'ongoing' && activeRide.riderConfirmedEnd && (
                  <div className="grid gap-2 sm:grid-cols-2">
                    <button 
                      onClick={handleConfirmReached}
                      className="w-full bg-emerald-500 hover:bg-emerald-600 text-white py-4 rounded-2xl font-bold shadow-lg shadow-emerald-500/20 transition-all active:scale-95 flex items-center justify-center gap-2"
                    >
                      <Award className="w-5 h-5" />
                      Confirm We've Arrived
                    </button>
                    <button
                      onClick={handleRejectReached}
                      className="w-full bg-white/10 hover:bg-white/20 text-white py-4 rounded-2xl font-bold transition-all active:scale-95 flex items-center justify-center gap-2"
                    >
                      <X className="w-5 h-5" />
                      Not There Yet
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </motion.div>
        
        {/* Cancellation Modal */}
        <AnimatePresence>
          {showCancelModal && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                onClick={() => setShowCancelModal(false)}
              />
              <motion.div 
                initial={{ opacity: 0, scale: 0.9, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: 20 }}
                className="bg-white w-full max-w-sm rounded-[2.5rem] p-8 relative z-10 shadow-2xl"
              >
                <h3 className="text-2xl font-bold mb-4">{t('cancelRideTitle')}</h3>
                <p className="text-gray-500 mb-6">{t('cancelRideDesc')}</p>
                
                <textarea 
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  placeholder={t('cancelPlaceholder')}
                  className="w-full bg-gray-50 rounded-2xl p-4 border-none focus:ring-2 focus:ring-black outline-none mb-6 resize-none min-h-[100px]"
                />

                <div className="flex gap-3">
                  <button 
                    onClick={() => setShowCancelModal(false)}
                    className="flex-1 py-4 font-bold text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    {t('keepRide')}
                  </button>
                  <button 
                    onClick={handleCancelRide}
                    disabled={isCancelling}
                    className="flex-1 bg-black text-white py-4 rounded-2xl font-bold hover:bg-gray-800 transition-all flex items-center justify-center gap-2"
                  >
                    {isCancelling ? <Loader2 className="w-5 h-5 animate-spin" /> : t('confirm')}
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </div>
    );
  }

  // View mode selector for non-active rides
  return (
    <div className="flex flex-col gap-6">
      {/* Tab Navigation */}
      <div className="flex gap-3 rounded-2xl bg-gray-100 p-1">
        <button
          onClick={() => setViewMode('ride')}
          className={`flex-1 py-3 px-4 rounded-xl font-bold transition-all flex items-center justify-center gap-2 ${
            viewMode === 'ride'
              ? 'bg-white text-gray-900 shadow-md'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          <MapIcon className="w-5 h-5" />
          <span className="hidden sm:inline">Request Ride</span>
        </button>
        <button
          onClick={() => setViewMode('reports')}
          className={`flex-1 py-3 px-4 rounded-xl font-bold transition-all flex items-center justify-center gap-2 ${
            viewMode === 'reports'
              ? 'bg-white text-gray-900 shadow-md'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          <FileText className="w-5 h-5" />
          <span className="hidden sm:inline">Reports</span>
        </button>
        <button
          onClick={() => setViewMode('analytics')}
          className={`flex-1 py-3 px-4 rounded-xl font-bold transition-all flex items-center justify-center gap-2 ${
            viewMode === 'analytics'
              ? 'bg-white text-gray-900 shadow-md'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          <BarChart3 className="w-5 h-5" />
          <span className="hidden sm:inline">Analytics</span>
        </button>
      </div>

      {/* Conditional Content Based on View Mode */}
      <AnimatePresence mode="wait">
        {viewMode === 'ride' && (
          <motion.div
            key="ride-view"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="w-full"
          >
        <div>
          <h2 className="text-4xl font-bold tracking-tight mb-2 text-gray-900">{t('whereTo')}</h2>
          <p className="text-gray-500 font-medium">{t('requestRide')}</p>
        </div>

        <div className="bg-white p-6 rounded-[2.5rem] shadow-sm border border-gray-100 space-y-4">
          <div className="relative">
            <div className="absolute left-4 top-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-black z-10" />
            <div className="absolute left-[1.125rem] top-[60%] w-0.5 h-full bg-gray-100" />
            <input 
              type="text"
              placeholder={t('pickupLocation')}
              value={pickup}
              onChange={(e) => {
                setPickup(e.target.value);
                setPassengerLocation(null);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && pickup.trim()) {
                  // When user presses Enter, show map for picking
                  setIsPickingOnMap('pickup');
                }
              }}
              className="w-full bg-gray-50 py-5 pl-12 pr-24 rounded-[1.5rem] border-none focus:ring-2 focus:ring-black transition-all outline-none"
            />
            <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-2">
              <button 
                onClick={handleUseCurrentLocation}
                disabled={isLocating}
                className="p-2 text-gray-400 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50"
                title="Use current location"
              >
                {isLocating ? <Loader2 className="w-5 h-5 animate-spin text-black" /> : <Navigation2 className="w-5 h-5" />}
              </button>
              <button 
                onClick={() => setIsPickingOnMap('pickup')}
                className={`p-2 rounded-lg transition-colors ${isPickingOnMap === 'pickup' ? 'bg-black text-white' : 'text-gray-400 hover:bg-gray-100'}`}
                title="Pick on map"
              >
                <MapIcon className="w-5 h-5" />
              </button>
            </div>
          </div>
          <div className="relative">
            <div className="absolute left-4 top-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-gray-300 z-10" />
            <input 
              type="text"
              placeholder={t('destinationAddress')}
              value={destination}
              onChange={(e) => {
                setDestination(e.target.value);
                setDestinationLocation(null);
              }}
              className="w-full bg-gray-50 py-5 pl-12 pr-12 rounded-[1.5rem] border-none focus:ring-2 focus:ring-black transition-all outline-none"
            />
            <button 
              onClick={() => setIsPickingOnMap('destination')}
              className={`absolute right-4 top-1/2 -translate-y-1/2 p-2 rounded-lg transition-colors ${isPickingOnMap === 'destination' ? 'bg-black text-white' : 'text-gray-400 hover:bg-gray-100'}`}
            >
              <MapIcon className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Vehicle Type Selection - With Location Inputs */}
        <div className="space-y-2">
          <p className="text-xs font-bold uppercase tracking-widest text-gray-400">Choose Vehicle</p>
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => setVehicleType('car')}
              className={`p-4 rounded-2xl border-2 transition-all font-bold flex flex-col items-center gap-2 ${
                vehicleType === 'car'
                  ? 'border-black bg-black text-white'
                  : 'border-gray-200 bg-gray-50 text-gray-600 hover:border-gray-300'
              }`}
            >
              <Car className="w-6 h-6" />
              <span className="text-sm">Car</span>
            </button>
            <button
              onClick={() => setVehicleType('motorcycle')}
              className={`p-4 rounded-2xl border-2 transition-all font-bold flex flex-col items-center gap-2 ${
                vehicleType === 'motorcycle'
                  ? 'border-black bg-black text-white'
                  : 'border-gray-200 bg-gray-50 text-gray-600 hover:border-gray-300'
              }`}
            >
              <Bike className="w-6 h-6" />
              <span className="text-sm">Motorcycle</span>
            </button>
          </div>
        </div>

        {isPickingOnMap && (
          <motion.div 
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            className="bg-gray-900 rounded-[2rem] overflow-hidden relative border-4 border-black"
          >
            <div className="absolute left-4 right-16 top-4 z-10 rounded-2xl bg-black/75 px-4 py-3 text-white shadow-xl backdrop-blur">
              <p className="font-bold uppercase tracking-widest text-[10px]">
                Tap on Google Map to set your {isPickingOnMap}
              </p>
              {isPickingOnMap === 'pickup' && pickup && (
                <p className="mt-2 text-xs font-semibold text-emerald-300">{pickup}</p>
              )}
              {isPickingOnMap === 'destination' && destination && (
                <p className="mt-2 text-xs font-semibold text-emerald-300">{destination}</p>
              )}
            </div>
            <MapComponent
              center={pickerCenter}
              zoom={15}
              markers={pickerMarkers}
              directionRequests={pickerDirectionRequests}
              onMapClick={handleMapClick}
              height="320px"
              showNearbyDrivers={false}
            />

            <button 
              onClick={() => setIsPickingOnMap(null)}
              className="absolute top-4 right-4 bg-white/10 p-2 rounded-xl text-white hover:bg-white/20"
            >
              <X className="w-4 h-4" />
            </button>
          </motion.div>
        )}

        {/* Available Riders Nearby */}
        {!activeRide && onlineRiders.length > 0 && (
          <div className="space-y-4">
          <div className="flex items-center justify-between px-2">
            <h3 className="text-sm font-black uppercase tracking-widest text-gray-400">{t('nearbyRiders')}</h3>
            <span className="bg-emerald-500/10 text-emerald-600 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest">
              {onlineRiders.length} {t('online')}
            </span>
          </div>
          {(passengerLocation || onlineRiders.some((rider) => hasValidCoordinates(rider.currentLocation))) && (
            <div className="bg-white p-3 rounded-[2rem] border border-gray-100 shadow-sm space-y-3">
              <MapComponent
                markers={[
                  ...(passengerLocation ? [{
                    id: 'passenger-preview',
                    position: passengerLocation,
                    label: 'You',
                    type: 'passenger' as const
                  }] : []),
                  ...onlineRiders
                    .filter((rider) => hasValidCoordinates(rider.currentLocation))
                    .map((rider) => ({
                      id: rider.uid,
                      position: rider.currentLocation!,
                      label: rider.name,
                      type: selectedNearbyRiderId === rider.uid ? 'rider' as const : 'nearby' as const,
                      profile: rider
                    }))
                ]}
                directionRequests={
                  passengerLocation && destinationLocation
                    ? [{
                        id: 'passenger-trip-preview',
                        origin: passengerLocation,
                        destination: destinationLocation,
                        color: '#2563eb'
                      }]
                    : []
                }
                center={
                  onlineRiders.find((rider) => rider.uid === selectedNearbyRiderId && hasValidCoordinates(rider.currentLocation))?.currentLocation ||
                  passengerLocation ||
                  onlineRiders.find((rider) => hasValidCoordinates(rider.currentLocation))?.currentLocation
                }
                zoom={14}
                height="260px"
                onMarkerClick={(marker) => {
                  if (marker.type === 'nearby' || marker.type === 'rider') {
                    setSelectedNearbyRiderId(marker.id);
                  }
                }}
              />
              {selectedNearbyRiderId && (
                <div className="rounded-2xl bg-gray-50 px-4 py-3 text-sm text-gray-600">
                  Viewing {onlineRiders.find((rider) => rider.uid === selectedNearbyRiderId)?.name || 'selected rider'} on the map.
                </div>
              )}
            </div>
          )}
          <div className="grid grid-cols-1 gap-4">
            {onlineRiders.map((rider) => (
              <motion.div 
                key={rider.uid}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                onClick={() => setSelectedNearbyRiderId(rider.uid)}
                className={`bg-white p-5 rounded-[2.5rem] border shadow-sm flex items-center justify-between group transition-all cursor-pointer ${selectedNearbyRiderId === rider.uid ? 'border-black ring-2 ring-black/10' : 'border-gray-100 hover:border-black'}`}
              >
                <div className="flex items-center gap-4">
                  <div className="relative">
                    {rider.avatarUrl ? (
                      <img src={rider.avatarUrl} className="w-14 h-14 rounded-2xl object-cover" alt="" />
                    ) : (
                      <div className="w-14 h-14 bg-gray-50 rounded-2xl flex items-center justify-center">
                        <UserIcon className="w-6 h-6 text-gray-300" />
                      </div>
                    )}
                    <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-emerald-500 rounded-lg flex items-center justify-center border-2 border-white shadow-sm">
                      <ShieldCheck className="w-3 h-3 text-white" />
                    </div>
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="font-bold text-gray-900">{rider.name}</h4>
                      {profile.favoriteUserIds?.includes(rider.uid) && (
                        <Heart className="w-3.5 h-3.5 text-red-500 fill-current" />
                      )}
                    </div>
                    <p className="text-xs text-gray-400 font-bold uppercase tracking-widest mt-0.5">
                      {rider.vehicleType} • {rider.rating} ★
                    </p>
                  </div>
                </div>
                
                <div className="flex items-center gap-2">
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      handleToggleFavorite(rider.uid);
                    }}
                    className={`p-3 rounded-2xl transition-all active:scale-95 ${profile.favoriteUserIds?.includes(rider.uid) ? 'bg-red-50 text-red-500 border border-red-100' : 'bg-gray-50 text-gray-400 hover:text-red-500'}`}
                  >
                    <Heart className={`w-5 h-5 ${profile.favoriteUserIds?.includes(rider.uid) ? 'fill-current' : ''}`} />
                  </button>
                  {rider.phoneNumber && (
                    <a 
                      href={`tel:${rider.phoneNumber}`}
                      onClick={(e) => e.stopPropagation()}
                      className="bg-black text-white p-3 rounded-2xl shadow-lg shadow-black/10 hover:bg-gray-800 transition-all active:scale-95 group-hover:scale-105"
                      title={t('callRider')}
                    >
                      <Phone className="w-5 h-5" />
                    </a>
                  )}
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      )}

      {pickup && destination && (
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-black text-white p-8 rounded-[2.5rem] flex items-center justify-between shadow-2xl shadow-black/20"
        >
          <div>
            <p className="text-xs text-white/40 font-bold uppercase tracking-widest mb-1">{t('fareToBeNegotiated')}</p>
            <p className="text-3xl font-bold">{t('byAgreement')}</p>
            <p className="mt-2 text-sm text-white/60">{t('fareNegotiationMessage')}</p>
          </div>
          <div className="text-right">
            <div className="flex items-center gap-2 text-emerald-400 font-bold text-sm mb-1 bg-white/5 py-1 px-3 rounded-full">
              <CheckCircle2 className="w-4 h-4" />
              <span>Ntwara Match</span>
            </div>
            <p className="text-[10px] text-white/30 uppercase tracking-widest font-bold">{t('negotiateOnArrival')}</p>
          </div>
        </motion.div>
      )}

      <button 
        onClick={handleRequestRide}
        disabled={!pickup || !destination || isRequesting}
        className="w-full bg-black text-white py-6 rounded-[2rem] font-bold text-xl flex items-center justify-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-800 transition-all shadow-xl shadow-black/10 active:scale-[0.98]"
      >
        {isRequesting ? (
          <>
            <Loader2 className="w-6 h-6 animate-spin" />
            {t('findingRider')}
          </>
        ) : (
          <>
            {t('requestNow')}
            <ChevronRight className="w-6 h-6" />
          </>
        )}
      </button>

      {/* Saved Locations */}
      <div className="space-y-4">
        <div className="flex items-center justify-between px-2">
          <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] text-gray-400">{t('savedLocations')}</h3>
          <button
            onClick={() => {
              if (destination) {
                setLocationNameToSave('');
                setShowSaveLocationModal(true);
              } else {
                addNotification('Info', 'Set a destination first to save this location', 'info');
              }
            }}
            className="p-1.5 text-gray-400 hover:bg-gray-100 rounded-lg transition-colors"
            title="Save current destination"
          >
            <Save className="w-4 h-4" />
          </button>
        </div>
        
        {savedLocations.length > 0 ? (
          <div className="grid gap-2">
            {savedLocations.map((loc) => (
              <div
                key={loc.id}
                role="button"
                tabIndex={0}
                onClick={() => { setDestination(loc.address); }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    setDestination(loc.address);
                  }
                }}
                className="w-full text-left bg-white p-5 rounded-3xl border border-transparent hover:border-gray-200 transition-all flex items-center justify-between group shadow-sm cursor-pointer focus:outline-none focus:ring-2 focus:ring-black/10"
              >
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-gray-50 rounded-2xl flex items-center justify-center group-hover:bg-black group-hover:text-white transition-colors">
                    <MapPin className="w-6 h-6" />
                  </div>
                  <div>
                    <p className="font-bold text-gray-900">{loc.name}</p>
                    <p className="text-xs text-gray-400 font-medium">{loc.address}</p>
                  </div>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleRemoveSavedLocation(loc.id);
                  }}
                  type="button"
                  className="p-2 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-gray-400 px-4">No saved locations yet. Add one to get started!</p>
        )}
      </div>

      {/* Save Location Modal */}
      <AnimatePresence>
        {showSaveLocationModal && (
          <div className="fixed inset-0 z-100 flex items-center justify-center p-6">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
              onClick={() => setShowSaveLocationModal(false)}
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-white w-full max-w-sm rounded-3xl p-8 relative z-10 shadow-2xl"
            >
              <h3 className="text-2xl font-bold mb-4 flex items-center gap-2">
                <MapPinPlus className="w-6 h-6" />
                Save Location
              </h3>
              <p className="text-gray-500 mb-6">Save "{destination}" as a favorite location</p>
              
              <input 
                type="text"
                value={locationNameToSave}
                onChange={(e) => setLocationNameToSave(e.target.value)}
                placeholder="e.g., Home, Work, Gym"
                className="w-full bg-gray-50 rounded-2xl p-4 border-none focus:ring-2 focus:ring-black outline-none mb-6 resize-none"
              />

              <div className="flex gap-3">
                <button 
                  onClick={() => setShowSaveLocationModal(false)}
                  className="flex-1 py-4 font-bold text-gray-400 hover:text-gray-600 transition-colors"
                >
                  Cancel
                </button>
                <button 
                  onClick={() => {
                    if (passengerLocation) {
                      handleSaveLocation(destination, passengerLocation.lat, passengerLocation.lng);
                    } else {
                      handleSaveLocation(destination, 51.5074, -0.1278);
                    }
                  }}
                  disabled={isSavingLocation}
                  className="flex-1 bg-black text-white py-4 rounded-2xl font-bold hover:bg-gray-800 transition-all flex items-center justify-center gap-2"
                >
                  {isSavingLocation ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Save'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Reports View */}
      <AnimatePresence mode="wait">
        {viewMode === 'reports' && (
          <motion.div
            key="reports-view"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="w-full"
          >
            <TripReport user={user} userRole="passenger" />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Analytics View */}
      <AnimatePresence mode="wait">
        {viewMode === 'analytics' && (
          <motion.div
            key="analytics-view"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="w-full"
          >
            <TripAnalytics user={user} userRole="passenger" />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

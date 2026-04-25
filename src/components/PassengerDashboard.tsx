import { useState, useEffect, useRef } from 'react';
import { User as FirebaseUser } from 'firebase/auth';
import { UserProfile, createRideRequest, subscribeToUserRides, Ride, updateRideStatus, subscribeToUserProfile, rateRide, RatingReason, reverseGeocode, db, subscribeToOnlineRiders, saveLocation, removeSavedLocation, getNearbyDrivers, SavedLocation } from '../lib/firebase';
import { MapPin, Navigation, Clock, ChevronRight, X, Loader2, CheckCircle2, Navigation2, Star, User as UserIcon, Map as MapIcon, ShieldCheck, Award, Timer, Compass, Heart, Phone, Save, Trash2, MapPinPlus, Car, Bike, Menu, CircleDot } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useNotifications } from './NotificationCenter';
import { useLanguage } from '../lib/i18n';
import { updateDoc, doc, arrayUnion, arrayRemove, serverTimestamp } from 'firebase/firestore';
import MapComponent from './MapComponent';

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
  const [pickup, setPickup] = useState('');
  const [destination, setDestination] = useState('');
  const [vehicleType, setVehicleType] = useState<'car' | 'motorcycle'>('car');
  const [activeRide, setActiveRide] = useState<Ride | null>(null);
  const [completedRide, setCompletedRide] = useState<Ride | null>(null);
  const [riderProfile, setRiderProfile] = useState<UserProfile | null>(null);
  const [onlineRiders, setOnlineRiders] = useState<UserProfile[]>([]);
  const [nearbyDrivers, setNearbyDrivers] = useState<UserProfile[]>([]);
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
  const [eta, setEta] = useState<number | null>(null);
  const [isLocating, setIsLocating] = useState(false);
  const [isPickingOnMap, setIsPickingOnMap] = useState<'pickup' | 'destination' | null>(null);
  const [passengerLocation, setPassengerLocation] = useState<{lat: number, lng: number} | null>(null);
  const [destinationLocation, setDestinationLocation] = useState<{lat: number, lng: number} | null>(null);
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
    if (!activeRide) {
      const unsubscribe = subscribeToOnlineRiders((riders) => {
        setOnlineRiders(riders);
      });
      return unsubscribe;
    } else {
      setOnlineRiders([]);
    }
  }, [activeRide]);

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
      const interval = setInterval(loadNearbyDrivers, 5000);
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
  }, [user.uid, addNotification, t]);

  useEffect(() => {
    const ridePickupLocation =
      passengerLocation ||
      (activeRide && hasValidCoordinates(activeRide.pickup)
        ? { lat: activeRide.pickup.lat, lng: activeRide.pickup.lng }
        : null);

    if (activeRide?.status === 'accepted' && riderProfile?.currentLocation && ridePickupLocation) {
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
        isOnTime: eta !== null,
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
          color: '#f97316'
        }]
      : [];

  if (completedRide) {
    return (
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-center p-4"
      >
        <div className="w-full max-w-md bg-white dark:bg-gray-900/90 backdrop-blur-sm rounded-3xl shadow-lg p-6 space-y-6">
          <div className="text-center space-y-2">
            <div className="w-16 h-16 bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-3">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">{t('tripCompletedNotify')}</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">Rate your journey with Ntwara</p>
          </div>

          <div className="space-y-5">
            <div className="flex justify-center gap-1">
              {[1, 2, 3, 4, 5].map((star) => (
                <button 
                  key={star}
                  onClick={() => setRating(star)}
                  className={`p-1 transition-transform active:scale-90 ${rating >= star ? 'text-orange-400' : 'text-gray-200 dark:text-gray-700'}`}
                >
                  <Star className="w-8 h-8 fill-current" />
                </button>
              ))}
            </div>

            <div className="grid grid-cols-3 gap-2">
              {[
                { id: 'driving', label: 'Driving Skills', icon: Award },
                { id: 'timing', label: 'On Time', icon: Timer },
                { id: 'navigation', label: 'Navigation', icon: Compass }
              ].map((reason) => (
                <button
                  key={reason.id}
                  onClick={() => setRatingReason(reason.id as RatingReason)}
                  className={`p-3 rounded-xl flex flex-col items-center gap-2 transition-all border-2 active:scale-95 ${
                    ratingReason === reason.id 
                      ? 'bg-orange-500 text-white border-orange-500' 
                      : 'bg-gray-50 dark:bg-gray-800 text-gray-400 dark:text-gray-500 border-transparent hover:border-gray-200 dark:hover:border-gray-700'
                  }`}
                >
                  <reason.icon className="w-5 h-5" />
                  <span className="text-[10px] font-bold uppercase tracking-wider">{reason.label}</span>
                </button>
              ))}
            </div>
          </div>

          <button 
            onClick={handleRateRide}
            disabled={rating === 0 || !ratingReason || isRating}
            className="w-full bg-orange-500 text-white py-4 rounded-xl font-semibold disabled:opacity-50 active:scale-95 transition-all flex items-center justify-center gap-2 shadow-lg"
          >
            {isRating ? <Loader2 className="w-5 h-5 animate-spin" /> : t('submitFeedback')}
          </button>
        </div>
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
            color: '#f97316'
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
            color: '#f97316'
          }]
        : []),
      ...(activeRide.status === 'ongoing' &&
      riderProfile?.currentLocation &&
      rideDestination
        ? [{
            id: `passenger-live-trip-${activeRide.id}`,
            origin: riderProfile.currentLocation,
            destination: rideDestination,
            color: '#f97316'
          }]
        : [])
    ];

    return (
      <div className="pb-24">
        <div className="sticky top-0 z-40 bg-white/80 dark:bg-black/80 backdrop-blur-xl border-b border-gray-100 dark:border-gray-800">
          <div className="max-w-md mx-auto px-4 py-3">
            <div className="flex items-center gap-3">
              <div className="w-2 h-2 rounded-full bg-orange-500 animate-pulse" />
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Active Ride</h2>
            </div>
          </div>
        </div>

        <div className="max-w-md mx-auto px-4 space-y-4">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white dark:bg-gray-900/90 backdrop-blur-sm rounded-3xl shadow-lg overflow-hidden"
          >
            {ridePickupLocation && (
              <div className="relative">
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
                  height="240px"
                  showNearbyDrivers={activeRide.status === 'requested'}
                  onMarkerClick={(marker) => {
                    if (marker.type === 'nearby') {
                      setSelectedNearbyRiderId(marker.id);
                    }
                  }}
                />
                <div className="absolute top-3 left-3 right-3 pointer-events-none">
                  <div className="bg-black/60 backdrop-blur-md rounded-xl px-3 py-1.5 inline-block">
                    <p className="text-white text-xs font-semibold">Live Tracking</p>
                  </div>
                </div>
              </div>
            )}

            <div className="p-5 space-y-4">
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-orange-50 dark:bg-orange-500/10 rounded-full mb-3">
                    <div className={`w-1.5 h-1.5 rounded-full ${activeRide.status === 'requested' ? 'bg-orange-400 animate-pulse' : 'bg-emerald-400'}`} />
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-orange-600 dark:text-orange-400">
                      {activeRide.status}
                    </span>
                  </div>
                  
                  <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
                    {activeRide.status === 'requested' ? t('findingRider') : 
                     activeRide.status === 'accepted' ? t('riderOnWay') : 
                     activeRide.status === 'arrived' ? (activeRide.passengerConfirmedArrival ? t('arrivingSoon') : t('riderArrivedNotify')) : 
                     t('tripStartedNotify')}
                  </h3>
                  
                  {eta !== null && activeRide.status === 'accepted' && (
                    <motion.div 
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="flex items-center justify-between p-3 bg-emerald-50 dark:bg-emerald-500/10 rounded-xl"
                    >
                      <div className="flex items-center gap-2">
                        <Timer className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                        <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">Est. arrival</span>
                      </div>
                      <span className="text-emerald-600 dark:text-emerald-400 font-bold text-xl">{eta} <span className="text-xs">min</span></span>
                    </motion.div>
                  )}
                </div>
                
                {riderProfile && (
                  <div className="flex flex-col items-end">
                    <div className="flex items-center gap-2 mb-2">
                      <button 
                        onClick={() => handleToggleFavorite(riderProfile.uid)}
                        className={`p-2 rounded-xl active:scale-95 transition-all ${
                          profile.favoriteUserIds?.includes(riderProfile.uid) 
                            ? 'bg-red-50 dark:bg-red-500/20 text-red-500' 
                            : 'bg-gray-100 dark:bg-gray-800 text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
                        }`}
                      >
                        <Heart className={`w-4 h-4 ${profile.favoriteUserIds?.includes(riderProfile.uid) ? 'fill-current' : ''}`} />
                      </button>
                      <a
                        href={`tel:${riderProfile.phoneNumber}`}
                        className="p-2 rounded-xl active:scale-95 bg-emerald-50 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-500/30 transition-all"
                      >
                        <Phone className="w-4 h-4" />
                      </a>
                    </div>
                    <div className="relative">
                      {riderProfile.avatarUrl ? (
                        <img src={riderProfile.avatarUrl} referrerPolicy="no-referrer" className="w-12 h-12 rounded-2xl object-cover border-2 border-gray-200 dark:border-gray-700" alt={riderProfile.name} />
                      ) : (
                        <div className="w-12 h-12 bg-gradient-to-br from-orange-400 to-orange-600 rounded-2xl flex items-center justify-center shadow-lg">
                          <UserIcon className="w-6 h-6 text-white" />
                        </div>
                      )}
                      <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-emerald-500 rounded-full flex items-center justify-center border-2 border-white dark:border-gray-900 shadow-sm">
                        <ShieldCheck className="w-2.5 h-2.5 text-white" />
                      </div>
                    </div>
                    <p className="text-sm font-semibold text-gray-900 dark:text-white mt-2">{riderProfile.name}</p>
                    {riderProfile.vehicleModel && (
                      <p className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider mt-0.5">
                        {riderProfile.vehicleModel} • {riderProfile.numberPlate}
                      </p>
                    )}
                    <div className="flex items-center gap-1 text-amber-400 mt-1">
                      <Star className="w-3 h-3 fill-current" />
                      <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">{riderProfile.rating}</span>
                    </div>
                  </div>
                )}
              </div>

              <div className="space-y-3 pt-2">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center flex-shrink-0">
                    <CircleDot className="w-4 h-4 text-orange-500" />
                  </div>
                  <div className="flex-1">
                    <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-0.5">{t('pickupLocation')}</p>
                    <p className="text-sm font-medium text-gray-900 dark:text-white leading-tight">{activeRide.pickup.address}</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center flex-shrink-0">
                    <Navigation className="w-4 h-4 text-gray-500" />
                  </div>
                  <div className="flex-1">
                    <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-0.5">{t('destinationAddress')}</p>
                    <p className="text-sm font-medium text-gray-900 dark:text-white leading-tight">{activeRide.destination.address}</p>
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t border-gray-100 dark:border-gray-800 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 font-semibold uppercase tracking-wider mb-1">{t('fareToBeNegotiated')}</p>
                    <p className="text-xl font-bold text-emerald-600 dark:text-emerald-400">{t('byAgreement')}</p>
                    <p className="text-xs text-gray-400 mt-1">{t('negotiateOnArrival')}</p>
                  </div>
                  {['requested', 'accepted', 'arrived'].includes(activeRide.status) && (
                    <button 
                      onClick={() => setShowCancelModal(true)}
                      className="bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 px-5 py-2.5 rounded-xl font-semibold active:scale-95 transition-all hover:bg-red-100 dark:hover:bg-red-500/20"
                    >
                      {t('cancel')}
                    </button>
                  )}
                </div>

                <div className="flex flex-col gap-2">
                  {activeRide.status === 'arrived' && !activeRide.passengerConfirmedArrival && (
                    <div className="flex gap-2">
                      <button 
                        onClick={handleConfirmArrival}
                        className="flex-1 bg-emerald-500 text-white py-3 rounded-xl font-semibold active:scale-95 transition-all flex items-center justify-center gap-2 hover:bg-emerald-600"
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        Confirm Driver Arrival
                      </button>
                      <button
                        onClick={handleRejectArrival}
                        className="flex-1 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 py-3 rounded-xl font-semibold active:scale-95 transition-all flex items-center justify-center gap-2 hover:bg-gray-200 dark:hover:bg-gray-700"
                      >
                        <X className="w-4 h-4" />
                        Rider Not Here
                      </button>
                    </div>
                  )}

                  {waitingForRiderStart && (
                    <div className="rounded-xl bg-amber-50 dark:bg-amber-500/10 px-4 py-3 text-sm text-amber-700 dark:text-amber-400 flex items-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Waiting for rider to start the trip...
                    </div>
                  )}

                  {activeRide.status === 'arrived' && activeRide.passengerConfirmedArrival && activeRide.riderConfirmedStart && (
                    <div className="flex gap-2">
                      <button 
                        onClick={handleConfirmStart}
                        className="flex-1 bg-orange-500 text-white py-3 rounded-xl font-semibold active:scale-95 transition-all flex items-center justify-center gap-2 hover:bg-orange-600"
                      >
                        <Navigation2 className="w-4 h-4" />
                        Approve Trip Start
                      </button>
                      <button
                        onClick={handleRejectStart}
                        className="flex-1 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 py-3 rounded-xl font-semibold active:scale-95 transition-all flex items-center justify-center gap-2 hover:bg-gray-200 dark:hover:bg-gray-700"
                      >
                        <X className="w-4 h-4" />
                        Reject Start
                      </button>
                    </div>
                  )}

                  {waitingForRiderEndSignal && (
                    <div className="rounded-xl bg-amber-50 dark:bg-amber-500/10 px-4 py-3 text-sm text-amber-700 dark:text-amber-400 flex items-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Waiting for driver to confirm arrival...
                    </div>
                  )}

                  {activeRide.status === 'ongoing' && activeRide.riderConfirmedEnd && (
                    <div className="flex gap-2">
                      <button 
                        onClick={handleConfirmReached}
                        className="flex-1 bg-emerald-500 text-white py-3 rounded-xl font-semibold active:scale-95 transition-all flex items-center justify-center gap-2 hover:bg-emerald-600"
                      >
                        <Award className="w-4 h-4" />
                        Confirm We've Arrived
                      </button>
                      <button
                        onClick={handleRejectReached}
                        className="flex-1 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 py-3 rounded-xl font-semibold active:scale-95 transition-all flex items-center justify-center gap-2 hover:bg-gray-200 dark:hover:bg-gray-700"
                      >
                        <X className="w-4 h-4" />
                        Not There Yet
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </motion.div>
        </div>

        <AnimatePresence>
          {showCancelModal && (
            <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 bg-black/50 backdrop-blur-sm"
                onClick={() => setShowCancelModal(false)}
              />
              <motion.div 
                initial={{ opacity: 0, y: '100%' }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: '100%' }}
                transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                className="bg-white dark:bg-gray-900 w-full max-w-md rounded-t-3xl sm:rounded-3xl p-6 relative z-10 shadow-2xl"
              >
                <div className="w-12 h-1 bg-gray-200 dark:bg-gray-700 rounded-full mx-auto mb-6 sm:hidden" />
                <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">{t('cancelRideTitle')}</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-5">{t('cancelRideDesc')}</p>
                
                <textarea 
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  placeholder={t('cancelPlaceholder')}
                  className="w-full bg-gray-50 dark:bg-gray-800 rounded-xl p-3 focus:ring-2 focus:ring-orange-500 outline-none mb-5 resize-none min-h-[80px] text-gray-900 dark:text-white"
                />

                <div className="flex gap-3">
                  <button 
                    onClick={() => setShowCancelModal(false)}
                    className="flex-1 py-3 font-semibold text-gray-500 dark:text-gray-400 active:opacity-70 transition-opacity"
                  >
                    {t('keepRide')}
                  </button>
                  <button 
                    onClick={handleCancelRide}
                    disabled={isCancelling}
                    className="flex-1 bg-red-500 text-white py-3 rounded-xl font-semibold active:scale-95 transition-all flex items-center justify-center gap-2 hover:bg-red-600"
                  >
                    {isCancelling ? <Loader2 className="w-4 h-4 animate-spin" /> : t('confirm')}
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </div>
    );
  }

  return (
    <div className="pb-24">
      {/* iOS Style Header - Transparent */}
      <div className="sticky top-0 z-40 bg-white/80 dark:bg-black/80 backdrop-blur-xl border-b border-gray-100 dark:border-gray-800">
        <div className="max-w-md mx-auto px-4 py-4">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Where to?</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">Choose your ride</p>
        </div>
      </div>

      <div className="max-w-md mx-auto px-4 space-y-5">
        {/* Location Inputs */}
        <div className="bg-white dark:bg-gray-900/90 backdrop-blur-sm rounded-2xl shadow-sm overflow-hidden">
          <div className="p-4 space-y-4">
            {/* Pickup Input */}
            <div className="relative">
              <div className="absolute left-3 top-1/2 -translate-y-1/2">
                <CircleDot className="w-4 h-4 text-orange-500" />
              </div>
              <input 
                type="text"
                placeholder={t('pickupLocation')}
                value={pickup}
                onChange={(e) => {
                  setPickup(e.target.value);
                  setPassengerLocation(null);
                }}
                className="w-full bg-gray-50 dark:bg-gray-800 py-3.5 pl-10 pr-24 rounded-xl focus:ring-2 focus:ring-orange-500 transition-all outline-none text-gray-900 dark:text-white placeholder-gray-400 text-base"
              />
              <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                <button 
                  onClick={handleUseCurrentLocation}
                  disabled={isLocating}
                  className="p-2 text-gray-400 active:bg-gray-200 dark:active:bg-gray-700 rounded-lg transition-colors disabled:opacity-50"
                  title="Use current location"
                >
                  {isLocating ? <Loader2 className="w-4 h-4 animate-spin text-orange-500" /> : <Navigation2 className="w-4 h-4" />}
                </button>
                <button 
                  onClick={() => setIsPickingOnMap('pickup')}
                  className={`p-2 rounded-lg transition-all ${isPickingOnMap === 'pickup' ? 'bg-orange-500 text-white' : 'text-gray-400 active:bg-gray-200 dark:active:bg-gray-700'}`}
                  title="Pick on map"
                >
                  <MapIcon className="w-4 h-4" />
                </button>
              </div>
            </div>
            
            {/* Destination Input */}
            <div className="relative">
              <div className="absolute left-3 top-1/2 -translate-y-1/2">
                <Navigation className="w-4 h-4 text-gray-400" />
              </div>
              <input 
                type="text"
                placeholder={t('destinationAddress')}
                value={destination}
                onChange={(e) => {
                  setDestination(e.target.value);
                  setDestinationLocation(null);
                }}
                className="w-full bg-gray-50 dark:bg-gray-800 py-3.5 pl-10 pr-12 rounded-xl focus:ring-2 focus:ring-orange-500 transition-all outline-none text-gray-900 dark:text-white placeholder-gray-400 text-base"
              />
              <button 
                onClick={() => setIsPickingOnMap('destination')}
                className={`absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-lg transition-all ${isPickingOnMap === 'destination' ? 'bg-orange-500 text-white' : 'text-gray-400 active:bg-gray-200 dark:active:bg-gray-700'}`}
              >
                <MapIcon className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Vehicle Type Selection */}
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 px-2">Choose Vehicle</p>
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => setVehicleType('car')}
              className={`p-4 rounded-2xl border-2 transition-all font-semibold flex flex-col items-center gap-2 active:scale-95 ${
                vehicleType === 'car'
                  ? 'border-orange-500 bg-orange-500 text-white shadow-lg'
                  : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900/90 backdrop-blur-sm text-gray-600 dark:text-gray-400 hover:border-orange-300 dark:hover:border-orange-700'
              }`}
            >
              <Car className="w-6 h-6" />
              <span className="text-sm">Car</span>
            </button>
            <button
              onClick={() => setVehicleType('motorcycle')}
              className={`p-4 rounded-2xl border-2 transition-all font-semibold flex flex-col items-center gap-2 active:scale-95 ${
                vehicleType === 'motorcycle'
                  ? 'border-orange-500 bg-orange-500 text-white shadow-lg'
                  : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900/90 backdrop-blur-sm text-gray-600 dark:text-gray-400 hover:border-orange-300 dark:hover:border-orange-700'
              }`}
            >
              <Bike className="w-6 h-6" />
              <span className="text-sm">Motorcycle</span>
            </button>
          </div>
        </div>

        {/* Map Picker Modal - Fullscreen */}
        <AnimatePresence>
          {isPickingOnMap && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 bg-black"
            >
              <div className="absolute top-0 left-0 right-0 z-10 bg-gradient-to-b from-black/80 to-transparent p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-white text-xs font-semibold uppercase tracking-wider">Select {isPickingOnMap}</p>
                    <p className="text-white/60 text-sm">Tap on the map to set location</p>
                  </div>
                  <button 
                    onClick={() => setIsPickingOnMap(null)}
                    className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center active:scale-95 transition-all"
                  >
                    <X className="w-5 h-5 text-white" />
                  </button>
                </div>
              </div>
              <MapComponent
                center={pickerCenter}
                zoom={15}
                markers={pickerMarkers}
                directionRequests={pickerDirectionRequests}
                onMapClick={handleMapClick}
                height="100%"
                showNearbyDrivers={false}
              />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Fare Preview Card */}
        {pickup && destination && (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-gradient-to-r from-orange-50 to-amber-50 dark:from-orange-950/30 dark:to-amber-950/30 backdrop-blur-sm rounded-2xl p-5 border border-orange-100 dark:border-orange-900/30"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-orange-600 dark:text-orange-400 font-semibold uppercase tracking-wider mb-1">Fare Estimate</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{t('byAgreement')}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Negotiate with driver</p>
              </div>
              <div className="bg-orange-500/20 rounded-full p-3">
                <CheckCircle2 className="w-6 h-6 text-orange-500" />
              </div>
            </div>
          </motion.div>
        )}

        {/* Request Button */}
        <button 
          onClick={handleRequestRide}
          disabled={!pickup || !destination || isRequesting}
          className="w-full bg-orange-500 text-white py-4 rounded-2xl font-semibold text-lg flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed active:scale-95 transition-all shadow-lg shadow-orange-500/25 hover:bg-orange-600"
        >
          {isRequesting ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              {t('findingRider')}
            </>
          ) : (
            <>
              {t('requestNow')}
              <ChevronRight className="w-5 h-5" />
            </>
          )}
        </button>

        {/* Saved Locations Section */}
        <div className="space-y-3">
          <div className="flex items-center justify-between px-2">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Saved Places</h3>
            <button
              onClick={() => {
                if (destination) {
                  setLocationNameToSave('');
                  setShowSaveLocationModal(true);
                } else {
                  addNotification('Info', 'Set a destination first to save this location', 'info');
                }
              }}
              className="p-2 text-orange-500 active:bg-orange-50 dark:active:bg-orange-500/10 rounded-full transition-colors"
              title="Save current destination"
            >
              <Save className="w-4 h-4" />
            </button>
          </div>
          
          {savedLocations.length > 0 ? (
            <div className="space-y-2">
              {savedLocations.slice(0, 3).map((loc) => (
                <motion.div
                  key={loc.id}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => { setDestination(loc.address); }}
                  className="w-full bg-white dark:bg-gray-900/90 backdrop-blur-sm rounded-xl active:bg-gray-50 dark:active:bg-gray-800 transition-all flex items-center justify-between shadow-sm cursor-pointer p-4"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-orange-50 dark:bg-orange-500/10 rounded-xl flex items-center justify-center">
                      <MapPin className="w-5 h-5 text-orange-500" />
                    </div>
                    <div>
                      <p className="font-semibold text-gray-900 dark:text-white">{loc.name}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 font-medium truncate max-w-[200px]">{loc.address}</p>
                    </div>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRemoveSavedLocation(loc.id);
                    }}
                    className="p-2 text-gray-400 active:text-red-500 active:bg-red-50 dark:active:bg-red-500/10 rounded-lg transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </motion.div>
              ))}
            </div>
          ) : (
            <div className="bg-white dark:bg-gray-900/90 backdrop-blur-sm rounded-xl p-6 text-center border border-dashed border-gray-200 dark:border-gray-800">
              <MapPinPlus className="w-8 h-8 text-gray-300 dark:text-gray-600 mx-auto mb-2" />
              <p className="text-sm text-gray-500 dark:text-gray-400">No saved places yet</p>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Save your favorite spots for quick access</p>
            </div>
          )}
        </div>

        {/* Nearby Riders Section */}
        {!activeRide && onlineRiders.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center justify-between px-2">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Nearby Drivers</h3>
              <span className="bg-orange-50 dark:bg-orange-500/10 text-orange-600 dark:text-orange-400 px-2 py-1 rounded-full text-[10px] font-semibold">
                {onlineRiders.length} online
              </span>
            </div>

            {passengerLocation && (
              <div className="bg-white dark:bg-gray-900/90 backdrop-blur-sm rounded-xl overflow-hidden shadow-sm">
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
                      .slice(0, 8)
                      .map((rider) => ({
                        id: rider.uid,
                        position: rider.currentLocation!,
                        label: rider.name,
                        type: 'nearby' as const,
                        profile: rider
                      }))
                  ]}
                  center={passengerLocation}
                  zoom={14}
                  height="200px"
                  showNearbyDrivers={false}
                />
              </div>
            )}

            <div className="space-y-2">
              {onlineRiders.slice(0, 5).map((rider) => (
                <motion.div 
                  key={rider.uid}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  whileTap={{ scale: 0.98 }}
                  className={`bg-white dark:bg-gray-900/90 backdrop-blur-sm rounded-xl p-4 shadow-sm flex items-center justify-between active:bg-gray-50 dark:active:bg-gray-800 transition-all cursor-pointer ${
                    selectedNearbyRiderId === rider.uid ? 'ring-2 ring-orange-500' : ''
                  }`}
                >
                  <div className="flex items-center gap-3 flex-1">
                    <div className="relative">
                      {rider.avatarUrl ? (
                        <img src={rider.avatarUrl} className="w-12 h-12 rounded-xl object-cover" alt={rider.name} />
                      ) : (
                        <div className="w-12 h-12 bg-gradient-to-br from-orange-400 to-orange-600 rounded-xl flex items-center justify-center">
                          <UserIcon className="w-5 h-5 text-white" />
                        </div>
                      )}
                      <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-emerald-500 rounded-full flex items-center justify-center border-2 border-white dark:border-gray-900">
                        <ShieldCheck className="w-2 h-2 text-white" />
                      </div>
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <h4 className="font-semibold text-gray-900 dark:text-white">{rider.name}</h4>
                        {profile.favoriteUserIds?.includes(rider.uid) && (
                          <Heart className="w-3 h-3 text-red-500 fill-current" />
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <div className="flex items-center gap-0.5">
                          <Star className="w-3 h-3 text-amber-400 fill-current" />
                          <span className="text-xs text-gray-600 dark:text-gray-400">{rider.rating}</span>
                        </div>
                        <span className="w-1 h-1 rounded-full bg-gray-300 dark:bg-gray-600" />
                        <p className="text-xs text-gray-500 dark:text-gray-400 capitalize">{rider.vehicleType}</p>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        handleToggleFavorite(rider.uid);
                      }}
                      className={`p-2 rounded-xl active:scale-95 transition-all ${
                        profile.favoriteUserIds?.includes(rider.uid) 
                          ? 'bg-red-50 dark:bg-red-500/10 text-red-500' 
                          : 'bg-gray-100 dark:bg-gray-800 text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
                      }`}
                    >
                      <Heart className={`w-4 h-4 ${profile.favoriteUserIds?.includes(rider.uid) ? 'fill-current' : ''}`} />
                    </button>
                    {rider.phoneNumber && (
                      <a 
                        href={`tel:${rider.phoneNumber}`}
                        onClick={(e) => e.stopPropagation()}
                        className="bg-orange-500 text-white p-2 rounded-xl active:scale-95 transition-all hover:bg-orange-600"
                      >
                        <Phone className="w-4 h-4" />
                      </a>
                    )}
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Save Location Modal - iOS Bottom Sheet */}
      <AnimatePresence>
        {showSaveLocationModal && (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/50 backdrop-blur-sm"
              onClick={() => setShowSaveLocationModal(false)}
            />
            <motion.div 
              initial={{ opacity: 0, y: '100%' }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="bg-white dark:bg-gray-900 w-full max-w-md rounded-t-3xl sm:rounded-3xl p-6 relative z-10 shadow-2xl"
            >
              <div className="w-12 h-1 bg-gray-200 dark:bg-gray-700 rounded-full mx-auto mb-6 sm:hidden" />
              
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 bg-orange-100 dark:bg-orange-500/20 rounded-2xl flex items-center justify-center">
                  <MapPinPlus className="w-6 h-6 text-orange-500" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-gray-900 dark:text-white">Save Location</h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Add to your saved places</p>
                </div>
              </div>
              
              <input 
                type="text"
                value={locationNameToSave}
                onChange={(e) => setLocationNameToSave(e.target.value)}
                placeholder="e.g., Home, Work, Gym"
                className="w-full bg-gray-50 dark:bg-gray-800 rounded-xl p-4 focus:ring-2 focus:ring-orange-500 outline-none mb-5 text-gray-900 dark:text-white text-base"
                autoFocus
              />

              <div className="flex gap-3">
                <button 
                  onClick={() => setShowSaveLocationModal(false)}
                  className="flex-1 py-3.5 font-semibold text-gray-600 dark:text-gray-400 active:opacity-70 transition-opacity rounded-xl"
                >
                  Cancel
                </button>
                <button 
                  onClick={() => {
                    if (passengerLocation) {
                      handleSaveLocation(destination, passengerLocation.lat, passengerLocation.lng);
                    } else if (destinationLocation) {
                      handleSaveLocation(destination, destinationLocation.lat, destinationLocation.lng);
                    } else {
                      handleSaveLocation(destination, -1.9441, 30.0619);
                    }
                  }}
                  disabled={isSavingLocation || !locationNameToSave.trim()}
                  className="flex-1 bg-orange-500 text-white py-3.5 rounded-xl font-semibold active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:active:scale-100 hover:bg-orange-600"
                >
                  {isSavingLocation ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save Location'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
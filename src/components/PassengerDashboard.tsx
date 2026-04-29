import { useState, useEffect, useRef } from 'react';
import { User as FirebaseUser } from 'firebase/auth';
import { UserProfile, createRideRequest, subscribeToUserRides, Ride, updateRideStatus, subscribeToUserProfile, rateRide, RatingReason, reverseGeocode, db, subscribeToOnlineRiders, saveLocation, removeSavedLocation, getNearbyDrivers, SavedLocation } from '../lib/firebase';
import { MapPin, Navigation, Clock, ChevronRight, X, Loader2, CheckCircle2, Navigation2, Star, User as UserIcon, Map as MapIcon, ShieldCheck, Award, Timer, Compass, Heart, Phone, Save, Trash2, MapPinPlus, Car, Bike, BarChart3, FileText, Zap, Send, Search } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useNotifications } from './NotificationCenter';
import { useLanguage } from '../lib/i18n';
import { updateDoc, doc, arrayUnion, arrayRemove, serverTimestamp, getDoc } from 'firebase/firestore';
import MapComponent from './MapComponent';
import TripReport from './TripReport';
import TripAnalytics from './TripAnalytics';

interface Props {
  user: FirebaseUser;
  profile: UserProfile;
}

const hasValidCoordinates = (point?: { lat: number; lng: number } | null) =>
  !!point && Number.isFinite(point.lat) && Number.isFinite(point.lng) && (point.lat !== 0 || point.lng !== 0);

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
  const notificationSentRef = useRef<{ [rideId: string]: Set<string> }>({});
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
  const [isCardExpanded, setIsCardExpanded] = useState(false);

  const hasNotificationBeenSent = (rideId: string, eventType: string): boolean => {
    if (!notificationSentRef.current[rideId]) notificationSentRef.current[rideId] = new Set();
    return notificationSentRef.current[rideId].has(eventType);
  };
  const markNotificationAsSent = (rideId: string, eventType: string): void => {
    if (!notificationSentRef.current[rideId]) notificationSentRef.current[rideId] = new Set();
    notificationSentRef.current[rideId].add(eventType);
  };
  const clearNotificationTracking = (rideId: string): void => { delete notificationSentRef.current[rideId]; };

  const handleSaveLocation = async (address: string, lat: number, lng: number) => {
    if (!locationNameToSave.trim()) { addNotification('Error', 'Please enter a name for this location', 'error'); return; }
    setIsSavingLocation(true);
    try {
      await saveLocation(user.uid, { name: locationNameToSave, address, lat, lng });
      setSavedLocations([...savedLocations, { id: `${Date.now()}`, name: locationNameToSave, address, lat, lng }]);
      addNotification('Location Saved', `${locationNameToSave} saved to favorites`, 'success');
      setShowSaveLocationModal(false); setLocationNameToSave('');
    } catch (e) { console.error(e); addNotification('Error', 'Failed to save location', 'error'); }
    finally { setIsSavingLocation(false); }
  };

  const handleRemoveSavedLocation = async (locationId: string) => {
    try {
      await removeSavedLocation(user.uid, locationId);
      setSavedLocations(savedLocations.filter(loc => loc.id !== locationId));
      addNotification('Location Removed', 'Saved location deleted', 'success');
    } catch (e) { console.error(e); addNotification('Error', 'Failed to remove location', 'error'); }
  };

  const handleToggleFavorite = async (targetUserId: string) => {
    const isFavorite = profile.favoriteUserIds?.includes(targetUserId);
    try {
      await updateDoc(doc(db, 'users', user.uid), { favoriteUserIds: isFavorite ? arrayRemove(targetUserId) : arrayUnion(targetUserId) });
      addNotification(isFavorite ? 'Removed from Favorites' : 'Added to Favorites', isFavorite ? 'Rider removed from preferred list.' : 'Rider added to preferred list.', 'info');
    } catch (e) { console.error(e); }
  };

  const handleUseCurrentLocation = async () => {
    if (!navigator.geolocation) { alert("Geolocation not supported"); return; }
    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        setPassengerLocation({ lat: latitude, lng: longitude });
        const address = await reverseGeocode(latitude, longitude);
        setPickup(address); setIsLocating(false);
      },
      (error) => { console.error("Error getting location", error); setIsLocating(false); alert("Unable to retrieve your location."); }
    );
  };

  const handleRequestRide = async () => {
    if (!pickup || !destination) return;
    setIsRequesting(true);
    try {
      await createRideRequest({
        passengerId: user.uid,
        pickup: { address: pickup, lat: passengerLocation?.lat || 0, lng: passengerLocation?.lng || 0 },
        destination: { address: destination, lat: destinationLocation?.lat || 0, lng: destinationLocation?.lng || 0 },
        status: 'requested', fare: 0, vehicleType: vehicleType,
      });
      setPickup(''); setDestination(''); setPassengerLocation(null); setDestinationLocation(null);
    } catch (error) { console.error("Failed to request ride", error); }
    finally { setIsRequesting(false); }
  };

  const handleCancelRide = async () => {
    if (!activeRide) return;
    setIsCancelling(true);
    try {
      await updateRideStatus(activeRide.id, 'cancelled', undefined, cancelReason || 'User cancelled');
      setShowCancelModal(false); setCancelReason('');
    } catch (error) { console.error("Failed to cancel", error); }
    finally { setIsCancelling(false); }
  };

  const handleRateRide = async () => {
    if (!completedRide || rating === 0 || !ratingReason) return;
    setIsRating(true);
    try {
      await rateRide(completedRide.id, rating, ratingReason as RatingReason);
      setCompletedRide(null); setRating(0); setRatingReason('');
    } catch (error) { console.error("Failed to rate", error); }
    finally { setIsRating(false); }
  };

  const handleConfirmArrival = async () => {
    if (!activeRide || activeRide.status !== 'arrived' || activeRide.passengerConfirmedArrival) return;
    try {
      await updateDoc(doc(db, 'rides', activeRide.id), { passengerConfirmedArrival: true, isOnTime: eta !== null, updatedAt: serverTimestamp() });
      addNotification(t('confirmedArrival'), 'You confirmed the driver has arrived.', 'success');
    } catch (e) { console.error(e); }
  };

  const handleConfirmStart = async () => {
    if (!activeRide || activeRide.status !== 'arrived' || !activeRide.passengerConfirmedArrival || !activeRide.riderConfirmedStart || activeRide.passengerConfirmedStart) return;
    try {
      await updateDoc(doc(db, 'rides', activeRide.id), { passengerConfirmedStart: true, status: 'ongoing', startedAt: serverTimestamp(), updatedAt: serverTimestamp() });
      addNotification(t('tripStartedNotify'), 'Enjoy your ride!', 'success');
    } catch (e) { console.error(e); }
  };

  const handleRejectArrival = async () => {
    if (!activeRide || activeRide.status !== 'arrived' || activeRide.passengerConfirmedArrival) return;
    try {
      await updateDoc(doc(db, 'rides', activeRide.id), { status: 'accepted', riderConfirmedStart: false, updatedAt: serverTimestamp() });
      addNotification('Arrival rejected', 'Rider sent back to on-the-way stage.', 'info');
    } catch (e) { console.error(e); }
  };

  const handleRejectStart = async () => {
    if (!activeRide || activeRide.status !== 'arrived' || !activeRide.riderConfirmedStart || activeRide.passengerConfirmedStart) return;
    try {
      await updateDoc(doc(db, 'rides', activeRide.id), { riderConfirmedStart: false, updatedAt: serverTimestamp() });
      addNotification('Start rejected', 'Trip start approval removed.', 'info');
    } catch (e) { console.error(e); }
  };

  const handleConfirmReached = async () => {
    if (!activeRide || activeRide.status !== 'ongoing' || !activeRide.riderConfirmedEnd || activeRide.passengerConfirmedEnd) return;
    try {
      await updateDoc(doc(db, 'rides', activeRide.id), { passengerConfirmedEnd: true, status: 'completed', completedAt: serverTimestamp(), updatedAt: serverTimestamp() });
    } catch (e) { console.error(e); }
  };

  const handleRejectReached = async () => {
    if (!activeRide || activeRide.status !== 'ongoing' || !activeRide.riderConfirmedEnd || activeRide.passengerConfirmedEnd) return;
    try {
      await updateDoc(doc(db, 'rides', activeRide.id), { riderConfirmedEnd: false, updatedAt: serverTimestamp() });
      addNotification('Destination rejected', 'Ride stays active until you confirm.', 'info');
    } catch (e) { console.error(e); }
  };

  const handleMapClick = async ({ lat, lng }: { lat: number; lng: number }) => {
    if (!isPickingOnMap) return;
    const address = await reverseGeocode(lat, lng);
    if (isPickingOnMap === 'pickup') { setPickup(address); setPassengerLocation({ lat, lng }); }
    else { setDestination(address); setDestinationLocation({ lat, lng }); }
    setIsPickingOnMap(null);
  };

  // Send SMS to emergency contact when ride starts
  const sendEmergencyContactSMS = async (ride: Ride) => {
    if (!profile.emergencyContact) return;

    try {
      const driverDoc = await getDoc(doc(db, 'users', ride.riderId || ''));
      const driverProfile = driverDoc.data() as UserProfile;

      if (!driverProfile) return;

      // Call Cloud Function to send SMS via Twilio
      const functions = (await import('firebase/functions')).getFunctions();
      const sendEmergencySMS = (await import('firebase/functions')).httpsCallable(functions, 'sendEmergencyContactSMS');

      const result = await sendEmergencySMS({
        emergencyContactPhone: profile.emergencyContact.phone,
        pickupAddress: ride.pickup.address,
        destinationAddress: ride.destination.address,
        driverName: driverProfile.name,
        driverPhone: driverProfile.phoneNumber || 'N/A',
        passengerName: profile.name,
      });

      console.log('Emergency SMS sent:', result);
      addNotification('Safety Alert Sent', 'Your emergency contact has been notified', 'success');
    } catch (error) {
      console.error('Error sending emergency SMS:', error);
      // Don't show error to user - it's optional
    }
  };

  // Effects
  useEffect(() => {
    if (!activeRide) { const unsubscribe = subscribeToOnlineRiders(setOnlineRiders); return unsubscribe; }
    else { setOnlineRiders([]); }
  }, [activeRide]);

  useEffect(() => {
    const ridePickupLocation = passengerLocation || (activeRide && hasValidCoordinates(activeRide.pickup) ? { lat: activeRide.pickup.lat, lng: activeRide.pickup.lng } : null);
    if (activeRide && ridePickupLocation && activeRide.status === 'requested') {
      const loadNearbyDrivers = async () => {
        try { const drivers = await getNearbyDrivers(ridePickupLocation.lat, ridePickupLocation.lng, 10); setNearbyDrivers(drivers); }
        catch (error) { console.error('Failed to load nearby drivers:', error); }
      };
      loadNearbyDrivers();
      const interval = setInterval(loadNearbyDrivers, 5000);
      return () => clearInterval(interval);
    } else { setNearbyDrivers([]); }
  }, [activeRide, passengerLocation]);

  useEffect(() => {
    const unsubscribe = subscribeToUserRides(user.uid, 'passenger', (rides) => {
      const active = rides.find(r => ['requested', 'accepted', 'arrived', 'ongoing'].includes(r.status));
      const justCompleted = rides.find(r => r.status === 'completed' && !r.riderRating);
      if (active) {
        if (!hasNotificationBeenSent(active.id, `status-${active.status}`)) {
          if (active.status === 'accepted') { addNotification(t('rideAccepted'), t('riderOnWay'), 'ride_accepted'); markNotificationAsSent(active.id, `status-${active.status}`); }
          else if (active.status === 'arrived') { addNotification(t('riderArrivedNotify'), t('riderArrivedMessage'), 'ride_accepted'); markNotificationAsSent(active.id, `status-${active.status}`); }
          else if (active.status === 'ongoing') { 
            addNotification(t('tripStartedNotify'), t('tripStartedMessage'), 'info'); 
            markNotificationAsSent(active.id, `status-${active.status}`);
            // Send SMS to emergency contact when ride starts
            sendEmergencyContactSMS(active);
          }
        }
        if (active.status === 'ongoing' && active.riderConfirmedEnd && !hasNotificationBeenSent(active.id, 'driver-confirmed-end')) {
          addNotification('Destination Reached! 📍', 'Your driver has confirmed you\'ve reached the destination.', 'ride_accepted', [
            { label: 'Confirm Arrival', onClick: async () => { try { await updateDoc(doc(db, 'rides', active.id), { passengerConfirmedEnd: true, status: 'completed', completedAt: serverTimestamp(), updatedAt: serverTimestamp() }); } catch (err) { console.error(err); } }, style: 'primary' },
            { label: 'Not Yet', onClick: async () => { try { await updateDoc(doc(db, 'rides', active.id), { riderConfirmedEnd: false, updatedAt: serverTimestamp() }); } catch (err) { console.error(err); } }, style: 'secondary' }
          ]);
          markNotificationAsSent(active.id, 'driver-confirmed-end');
        }
      }
      if (justCompleted && !hasNotificationBeenSent(justCompleted.id, 'trip-completed')) { addNotification(t('tripCompletedNotify'), t('tripCompletedMessage'), 'success'); markNotificationAsSent(justCompleted.id, 'trip-completed'); }
      const previousActive = notificationSentRef.current;
      for (const rideId in previousActive) {
        if (!rides.find(r => r.id === rideId && ['requested', 'accepted', 'arrived', 'ongoing', 'completed'].includes(r.status))) clearNotificationTracking(rideId);
      }
      setActiveRide(active || null); setCompletedRide(justCompleted || null);
    });
    return unsubscribe;
  }, [user.uid, addNotification, profile, sendEmergencyContactSMS]);

  useEffect(() => {
    const ridePickupLocation = passengerLocation || (activeRide && hasValidCoordinates(activeRide.pickup) ? { lat: activeRide.pickup.lat, lng: activeRide.pickup.lng } : null);
    if (activeRide?.status === 'accepted' && riderProfile?.currentLocation && ridePickupLocation) {
      const latDiff = Math.abs(riderProfile.currentLocation.lat - ridePickupLocation.lat);
      const lngDiff = Math.abs(riderProfile.currentLocation.lng - ridePickupLocation.lng);
      const distance = Math.sqrt(Math.pow(latDiff, 2) + Math.pow(lngDiff, 2));
      setEta(Math.max(1, Math.round(distance * 200)));
    } else { setEta(null); }
  }, [activeRide?.status, riderProfile?.currentLocation, passengerLocation]);

  useEffect(() => { if (!passengerLocation && activeRide && hasValidCoordinates(activeRide.pickup)) setPassengerLocation({ lat: activeRide.pickup.lat, lng: activeRide.pickup.lng }); }, [activeRide, passengerLocation]);
  useEffect(() => { if (selectedNearbyRiderId && ![...onlineRiders, ...nearbyDrivers].some(r => r.uid === selectedNearbyRiderId)) setSelectedNearbyRiderId(null); }, [onlineRiders, nearbyDrivers, selectedNearbyRiderId]);
  useEffect(() => {
    if (activeRide?.riderId) { const unsubscribe = subscribeToUserProfile(activeRide.riderId, setRiderProfile); return unsubscribe; }
    else { setRiderProfile(null); }
  }, [activeRide?.riderId]);

  const pickerCenter = (isPickingOnMap === 'destination' ? destinationLocation : passengerLocation) || passengerLocation || destinationLocation || { lat: -1.9441, lng: 30.0619 };
  const pickerMarkers = [
    ...(passengerLocation ? [{ id: 'picker-pickup', position: passengerLocation, label: pickup || t('pickupLocation'), type: 'passenger' as const }] : []),
    ...(destinationLocation ? [{ id: 'picker-destination', position: destinationLocation, label: destination || t('destinationAddress'), type: 'destination' as const }] : [])
  ];
  const pickerDirectionRequests = passengerLocation && destinationLocation ? [{ id: 'picker-route-preview', origin: passengerLocation, destination: destinationLocation, color: '#8b5cf6' }] : [];

  // Auto-assign location on component mount if not already set
  useEffect(() => {
    if (!passengerLocation && viewMode === 'ride' && !isPickingOnMap) {
      handleUseCurrentLocation();
    }
  }, [viewMode]);

  // ==================== COMPLETED RIDE RATING VIEW ====================
  if (completedRide) {
    return (
      <motion.div 
        initial={{ opacity: 0, scale: 0.9 }} 
        animate={{ opacity: 1, scale: 1 }}
        className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-slate-50 via-white to-purple-50 dark:from-slate-950 dark:via-zinc-900 dark:to-purple-950"
      >
        <div className="w-full max-w-lg bg-white/80 dark:bg-zinc-900/80 backdrop-blur-2xl p-8 md:p-10 rounded-[3rem] shadow-2xl space-y-8 border border-white/20 dark:border-zinc-700/50">
          <div className="text-center space-y-3">
            <motion.div 
              initial={{ scale: 0 }} 
              animate={{ scale: 1 }} 
              transition={{ type: "spring", stiffness: 200, delay: 0.2 }}
              className="relative mx-auto mb-6"
            >
              <div className="w-28 h-28 bg-gradient-to-br from-emerald-400 to-teal-600 rounded-[2.5rem] flex items-center justify-center shadow-2xl shadow-emerald-500/30 transform -rotate-3">
                <CheckCircle2 className="w-14 h-14 text-white" />
              </div>
              <div className="absolute -top-2 -right-2 w-10 h-10 bg-amber-400 rounded-full flex items-center justify-center shadow-lg animate-bounce">
                <Star className="w-5 h-5 text-white fill-current" />
              </div>
            </motion.div>
            <h2 className="text-3xl font-black text-gray-900 dark:text-white tracking-tight">{t('tripCompletedNotify')}</h2>
            <p className="text-gray-500 dark:text-zinc-400 font-medium text-lg">Rate your journey</p>
          </div>
          
          <div className="space-y-8">
            <div className="flex justify-center gap-4">
              {[1, 2, 3, 4, 5].map((star) => (
                <motion.button 
                  key={star} 
                  whileHover={{ scale: 1.3, rotate: -5 }} 
                  whileTap={{ scale: 0.85 }} 
                  onClick={() => setRating(star)}
                  className={`transition-all duration-300 ${
                    rating >= star ? 'text-amber-400 drop-shadow-lg scale-110' : 'text-gray-300 dark:text-zinc-600 hover:text-amber-300'
                  }`}
                >
                  <Star className="w-14 h-14 fill-current" />
                </motion.button>
              ))}
            </div>
            
            <div className="grid grid-cols-3 gap-4">
              {[
                { id: 'driving', label: 'Driving', icon: Award, gradient: 'from-blue-500 to-cyan-500' },
                { id: 'timing', label: 'On Time', icon: Timer, gradient: 'from-emerald-500 to-green-500' },
                { id: 'navigation', label: 'Navigation', icon: Compass, gradient: 'from-purple-500 to-pink-500' }
              ].map((reason) => (
                <motion.button 
                  key={reason.id} 
                  whileHover={{ scale: 1.05, y: -2 }} 
                  whileTap={{ scale: 0.95 }} 
                  onClick={() => setRatingReason(reason.id as RatingReason)}
                  className={`p-5 rounded-2xl flex flex-col items-center gap-3 transition-all duration-300 border-2 ${
                    ratingReason === reason.id 
                      ? `bg-gradient-to-br ${reason.gradient} text-white border-transparent shadow-2xl shadow-current/30` 
                      : 'bg-white dark:bg-zinc-800 text-gray-500 dark:text-zinc-400 border-gray-200 dark:border-zinc-700 hover:border-purple-300 dark:hover:border-purple-600'
                  }`}
                >
                  <reason.icon className="w-7 h-7" />
                  <span className="text-xs font-black uppercase tracking-wider">{reason.label}</span>
                </motion.button>
              ))}
            </div>
          </div>
          
          <motion.button 
            whileHover={{ scale: 1.02 }} 
            whileTap={{ scale: 0.98 }} 
            onClick={handleRateRide} 
            disabled={rating === 0 || !ratingReason || isRating}
            className="w-full bg-gradient-to-r from-purple-600 via-violet-600 to-indigo-600 text-white py-6 rounded-2xl font-black text-lg disabled:opacity-50 disabled:cursor-not-allowed hover:shadow-2xl hover:shadow-purple-500/30 transition-all duration-300 flex items-center justify-center gap-3"
          >
            {isRating ? (
              <Loader2 className="w-6 h-6 animate-spin" />
            ) : (
              <>
                <Send className="w-6 h-6" />
                {t('submitFeedback')}
              </>
            )}
          </motion.button>
        </div>
      </motion.div>
    );
  }

  if (activeRide) {
    const ridePickupLocation = passengerLocation || (hasValidCoordinates(activeRide.pickup) ? { lat: activeRide.pickup.lat, lng: activeRide.pickup.lng } : null);
    const focusedNearbyDriver = nearbyDrivers.find((driver) => driver.uid === selectedNearbyRiderId && hasValidCoordinates(driver.currentLocation)) || null;
    const waitingForRiderStart = activeRide.status === 'arrived' && activeRide.passengerConfirmedArrival && !activeRide.riderConfirmedStart;
    const waitingForRiderEndSignal = activeRide.status === 'ongoing' && !activeRide.riderConfirmedEnd;
    const rideDestination = hasValidCoordinates(activeRide.destination) ? { lat: activeRide.destination.lat, lng: activeRide.destination.lng } : null;
    const activeRideDirectionRequests = [
      ...(activeRide.status === 'requested' && ridePickupLocation && rideDestination ? [{ id: `passenger-requested-trip-${activeRide.id}`, origin: ridePickupLocation, destination: rideDestination, color: '#8b5cf6' }] : []),
      ...((activeRide.status === 'accepted' || activeRide.status === 'arrived') && riderProfile?.currentLocation && ridePickupLocation ? [{ id: `passenger-driver-to-pickup-${activeRide.id}`, origin: riderProfile.currentLocation, destination: ridePickupLocation, color: '#10b981' }] : []),
      ...((activeRide.status === 'accepted' || activeRide.status === 'arrived') && ridePickupLocation && rideDestination ? [{ id: `passenger-pickup-to-destination-${activeRide.id}`, origin: ridePickupLocation, destination: rideDestination, color: '#8b5cf6' }] : []),
      ...(activeRide.status === 'ongoing' && riderProfile?.currentLocation && rideDestination ? [{ id: `passenger-live-trip-${activeRide.id}`, origin: riderProfile.currentLocation, destination: rideDestination, color: '#8b5cf6' }] : [])
    ];

    return (
      <>
        {/* MOBILE: Full-Screen Map with Overlay */}
        <div className="md:hidden w-full h-screen flex flex-col relative bg-gradient-to-b from-slate-900 to-purple-950">
          {/* Full-Screen Map Background */}
          <div className="absolute inset-0 w-full h-full overflow-hidden">
            {ridePickupLocation ? (
              <MapComponent 
                markers={[
                  { id: 'passenger', position: ridePickupLocation, label: 'You', type: 'passenger' },
                  ...(riderProfile?.currentLocation ? [{ id: riderProfile.uid, position: riderProfile.currentLocation, label: riderProfile.name, type: 'rider' as const, profile: riderProfile }] : []),
                  ...(hasValidCoordinates(activeRide.destination) ? [{ id: 'destination', position: { lat: activeRide.destination.lat, lng: activeRide.destination.lng }, label: activeRide.destination.address || 'Destination', type: 'destination' as const }] : []),
                  ...(activeRide.status === 'requested' ? nearbyDrivers.filter(d => d.currentLocation).map(driver => ({ id: driver.uid, position: driver.currentLocation!, label: driver.name, type: 'nearby' as const, profile: driver })) : [])
                ]}
                directionRequests={activeRideDirectionRequests}
                center={focusedNearbyDriver?.currentLocation || riderProfile?.currentLocation || ridePickupLocation}
                zoom={15}
                height="100vh"
                freezeViewport={false}
                showNearbyDrivers={activeRide.status === 'requested'}
                onMarkerClick={(marker) => { if (marker.type === 'nearby') setSelectedNearbyRiderId(marker.id); }}
              />
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-slate-900 to-purple-950 flex items-center justify-center">
                <div className="text-center">
                  <Loader2 className="w-8 h-8 text-purple-400 animate-spin mx-auto mb-3" />
                  <p className="text-white/50 font-medium">Loading map...</p>
                </div>
              </div>
            )}
          </div>

          {/* Top Status Bar */}
          <div className="absolute top-0 left-0 right-0 bg-gradient-to-r from-violet-600/90 via-purple-600/90 to-indigo-700/90 backdrop-blur-xl p-5 shadow-2xl z-10 border-b border-white/10">
            <div className="flex items-center justify-between mb-3">
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-white/20 backdrop-blur-md rounded-full border border-white/10">
                <div className={`w-2.5 h-2.5 rounded-full ${
                  activeRide.status === 'requested' ? 'bg-amber-400 animate-pulse shadow-lg shadow-amber-400/50' : 
                  activeRide.status === 'accepted' ? 'bg-blue-400 animate-pulse shadow-lg shadow-blue-400/50' :
                  activeRide.status === 'arrived' ? 'bg-emerald-400 shadow-lg shadow-emerald-400/50' :
                  'bg-purple-400 shadow-lg shadow-purple-400/50'
                }`} />
                <span className="text-xs font-black text-white uppercase tracking-widest">{activeRide.status}</span>
              </div>
              {eta !== null && activeRide.status === 'accepted' && (
                <div className="px-4 py-2 bg-emerald-400/20 backdrop-blur-md rounded-full border border-emerald-400/30">
                  <span className="text-sm font-black text-emerald-200">{eta} min</span>
                </div>
              )}
            </div>
            <h2 className="text-2xl font-black text-white tracking-tight">
              {activeRide.status === 'requested' ? 'Finding your rider' : 
               activeRide.status === 'accepted' ? 'Rider on the way' : 
               activeRide.status === 'arrived' ? (activeRide.passengerConfirmedArrival ? 'Ready to go' : 'Rider has arrived') : 
               'On your way'}
            </h2>
          </div>

          {/* Overlay Card - COLLAPSIBLE */}
          <AnimatePresence>
            {!isCardExpanded ? (
              // COLLAPSED STATE - Minimal bar
              <motion.div
                key="collapsed"
                initial={{ y: 100, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: 100, opacity: 0 }}
                transition={{ type: "spring", stiffness: 300, damping: 30 }}
                className="absolute bottom-4 left-4 right-4 bg-white/95 dark:bg-zinc-900/95 backdrop-blur-2xl rounded-[2.5rem] border border-white/20 dark:border-zinc-700/50 shadow-2xl"
              >
                <button
                  onClick={() => setIsCardExpanded(true)}
                  className="w-full flex items-center justify-between p-5"
                >
                  <div className="flex-1 flex items-center gap-4">
                    <div className="w-12 h-12 bg-gradient-to-br from-red-400 to-red-600 rounded-2xl flex items-center justify-center shadow-lg">
                      <Navigation className="w-6 h-6 text-white" />
                    </div>
                    <div className="text-left flex-1 min-w-0">
                      <p className="text-[10px] font-black text-gray-400 dark:text-zinc-500 uppercase tracking-widest mb-1">Destination</p>
                      <p className="text-sm font-bold text-gray-900 dark:text-white truncate">{activeRide.destination.address}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 ml-3">
                    <ChevronRight className="w-5 h-5 text-gray-400" />
                  </div>
                </button>
              </motion.div>
            ) : (
              // EXPANDED STATE - Full details
              <motion.div
                key="expanded"
                initial={{ y: 100, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: 100, opacity: 0 }}
                transition={{ type: "spring", stiffness: 300, damping: 30 }}
                className="absolute bottom-4 left-4 right-4 bg-white/95 dark:bg-zinc-900/95 backdrop-blur-2xl rounded-[2.5rem] border border-white/20 dark:border-zinc-700/50 shadow-2xl max-h-[70vh] overflow-y-auto"
              >
                <div className="p-6 space-y-5">
                  {/* Handle Bar */}
                  <div className="flex justify-between items-center mb-2">
                    <div className="w-16 h-1.5 bg-gray-200 dark:bg-zinc-700 rounded-full mx-auto" />
                    <button
                      onClick={() => setIsCardExpanded(false)}
                      className="p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors"
                    >
                      <ChevronRight className="w-5 h-5 text-gray-400 transform -rotate-90" />
                    </button>
                  </div>

                  {/* Rider Info Card */}
                  {riderProfile && (
                    <div className="flex items-center justify-between p-4 bg-gradient-to-br from-gray-50 to-white dark:from-zinc-800 dark:to-zinc-800/50 rounded-2xl border border-gray-100 dark:border-zinc-700 shadow-lg">
                      <div className="flex items-center gap-4">
                        {riderProfile.avatarUrl ? (
                          <img src={riderProfile.avatarUrl} referrerPolicy="no-referrer" className="w-14 h-14 rounded-2xl ring-4 ring-white dark:ring-zinc-700 shadow-xl object-cover" alt="" />
                        ) : (
                          <div className="w-14 h-14 bg-gradient-to-br from-amber-400 to-orange-600 rounded-2xl flex items-center justify-center shadow-xl">
                            <UserIcon className="w-7 h-7 text-white" />
                          </div>
                        )}
                        <div>
                          <p className="font-black text-base text-gray-900 dark:text-white">{riderProfile.name}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <div className="flex items-center gap-1 bg-amber-50 dark:bg-amber-500/10 px-2.5 py-1 rounded-lg">
                              <Star className="w-3.5 h-3.5 text-amber-400 fill-current" />
                              <span className="text-xs font-bold text-amber-600 dark:text-amber-400">{riderProfile.rating}</span>
                            </div>
                            {riderProfile.vehicleModel && (
                              <span className="text-xs text-gray-400 font-semibold">{riderProfile.vehicleModel}</span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <motion.button whileTap={{ scale: 0.9 }} onClick={() => handleToggleFavorite(riderProfile.uid)}
                          className={`p-3 rounded-xl transition-all ${
                            profile.favoriteUserIds?.includes(riderProfile.uid) 
                              ? 'bg-red-50 dark:bg-red-500/10 text-red-500 shadow-lg shadow-red-500/20' 
                              : 'bg-white dark:bg-zinc-700 text-gray-400 hover:bg-red-50 dark:hover:bg-red-500/10 hover:text-red-500'
                          }`}
                        >
                          <Heart className={`w-5 h-5 ${profile.favoriteUserIds?.includes(riderProfile.uid) ? 'fill-current' : ''}`} />
                        </motion.button>
                        <motion.a 
                          whileTap={{ scale: 0.9 }} 
                          href={`tel:${riderProfile.phoneNumber}`}
                          className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-500/20 transition-all shadow-lg shadow-emerald-500/20"
                        >
                          <Phone className="w-5 h-5" />
                        </motion.a>
                      </div>
                    </div>
                  )}

                  {/* Locations */}
                  <div className="space-y-3">
                    <div className="flex items-start gap-4 p-4 rounded-2xl bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-500/10 dark:to-emerald-500/10 border border-green-100 dark:border-green-500/20">
                      <div className="w-10 h-10 bg-green-500 rounded-xl flex items-center justify-center shadow-lg shadow-green-500/30">
                        <MapPin className="w-5 h-5 text-white" />
                      </div>
                      <div className="flex-1">
                        <p className="text-[10px] font-black text-green-600 dark:text-green-400 uppercase tracking-widest mb-1">Pickup</p>
                        <p className="text-sm font-bold text-gray-900 dark:text-white leading-snug">{activeRide.pickup.address}</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-4 p-4 rounded-2xl bg-gradient-to-r from-red-50 to-rose-50 dark:from-red-500/10 dark:to-rose-500/10 border border-red-100 dark:border-red-500/20">
                      <div className="w-10 h-10 bg-red-500 rounded-xl flex items-center justify-center shadow-lg shadow-red-500/30">
                        <Navigation className="w-5 h-5 text-white" />
                      </div>
                      <div className="flex-1">
                        <p className="text-[10px] font-black text-red-600 dark:text-red-400 uppercase tracking-widest mb-1">Destination</p>
                        <p className="text-sm font-bold text-gray-900 dark:text-white leading-snug">{activeRide.destination.address}</p>
                      </div>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="space-y-3 pt-2 border-t border-gray-100 dark:border-zinc-800">
                    {activeRide.status === 'arrived' && !activeRide.passengerConfirmedArrival && (
                      <div className="grid gap-3 grid-cols-2">
                        <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} onClick={handleConfirmArrival}
                          className="bg-gradient-to-r from-emerald-500 to-emerald-600 text-white py-4 rounded-2xl font-bold shadow-xl shadow-emerald-500/30 flex items-center justify-center gap-2 text-sm">
                          <CheckCircle2 className="w-5 h-5" />Confirm
                        </motion.button>
                        <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} onClick={handleRejectArrival}
                          className="bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 py-4 rounded-2xl font-bold border-2 border-red-200 dark:border-red-500/30 flex items-center justify-center gap-2 text-sm">
                          <X className="w-5 h-5" />Not Here
                        </motion.button>
                      </div>
                    )}

                    {waitingForRiderStart && (
                      <div className="p-4 bg-amber-50 dark:bg-amber-500/10 rounded-2xl border border-amber-200 dark:border-amber-500/30 text-sm text-amber-600 dark:text-amber-400 font-semibold text-center">
                        <Loader2 className="w-4 h-4 animate-spin inline mr-2" />
                        Waiting for rider to confirm...
                      </div>
                    )}

                    {activeRide.status === 'arrived' && activeRide.passengerConfirmedArrival && activeRide.riderConfirmedStart && (
                      <div className="grid gap-3 grid-cols-2">
                        <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} onClick={handleConfirmStart}
                          className="bg-black dark:bg-white text-white dark:text-black py-4 rounded-2xl font-bold shadow-xl flex items-center justify-center gap-2 text-sm">
                          <Navigation2 className="w-5 h-5" />Start Trip
                        </motion.button>
                        <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} onClick={handleRejectStart}
                          className="bg-gray-100 dark:bg-zinc-800 text-gray-600 dark:text-gray-400 py-4 rounded-2xl font-bold text-sm">
                          Reject
                        </motion.button>
                      </div>
                    )}

                    {activeRide.status === 'ongoing' && activeRide.riderConfirmedEnd && (
                      <div className="grid gap-3 grid-cols-2">
                        <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} onClick={handleConfirmReached}
                          className="bg-gradient-to-r from-emerald-500 to-emerald-600 text-white py-4 rounded-2xl font-bold shadow-xl shadow-emerald-500/30 flex items-center justify-center gap-2 text-sm">
                          <Award className="w-5 h-5" />Arrived
                        </motion.button>
                        <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} onClick={handleRejectReached}
                          className="bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 py-4 rounded-2xl font-bold border-2 border-red-200 dark:border-red-500/30 text-sm">
                          Not Yet
                        </motion.button>
                      </div>
                    )}

                    {['requested', 'accepted', 'arrived'].includes(activeRide.status) && (
                      <motion.button whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.98 }} onClick={() => setShowCancelModal(true)}
                        className="w-full bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 py-4 rounded-2xl font-bold hover:bg-red-100 dark:hover:bg-red-500/20 transition-all border-2 border-red-200 dark:border-red-500/30 text-sm">
                        Cancel Ride
                      </motion.button>
                    )}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* DESKTOP: Traditional Layout */}
        <div className="hidden md:flex flex-col gap-6 p-6 bg-gradient-to-br from-slate-50 via-white to-purple-50 dark:from-slate-950 dark:via-zinc-900 dark:to-purple-950 min-h-screen">
          {/* Gradient Header */}
          <div className="relative overflow-hidden bg-gradient-to-br from-violet-600 via-purple-600 to-indigo-700 dark:from-violet-900 dark:via-purple-900 dark:to-indigo-950 rounded-[3rem] p-8 shadow-2xl shadow-purple-500/20">
            <div className="absolute inset-0 opacity-30">
              <div className="absolute top-0 right-0 w-64 h-64 bg-white rounded-full -translate-y-1/2 translate-x-1/2 blur-3xl" />
              <div className="absolute bottom-0 left-0 w-48 h-48 bg-white rounded-full translate-y-1/2 -translate-x-1/2 blur-3xl" />
              <div className="absolute top-1/2 left-1/2 w-32 h-32 bg-purple-300 rounded-full -translate-x-1/2 -translate-y-1/2 blur-2xl" />
            </div>
            <div className="relative z-10 flex items-center justify-between">
              <div>
                <div className="inline-flex items-center gap-2 px-4 py-2 bg-white/20 backdrop-blur-md rounded-full mb-4 border border-white/10">
                  <div className={`w-2.5 h-2.5 rounded-full ${
                    activeRide.status === 'requested' ? 'bg-amber-400 animate-pulse' : 
                    activeRide.status === 'accepted' ? 'bg-blue-400 animate-pulse' :
                    'bg-emerald-400'
                  }`} />
                  <span className="text-xs font-black text-white uppercase tracking-widest">{activeRide.status}</span>
                </div>
                <h2 className="text-3xl font-black text-white mb-1 tracking-tight">
                  {activeRide.status === 'requested' ? t('findingRider') : 
                   activeRide.status === 'accepted' ? t('riderOnWay') : 
                   activeRide.status === 'arrived' ? (activeRide.passengerConfirmedArrival ? t('arrivingSoon') : t('riderArrivedNotify')) : 
                   t('tripStartedNotify')}
                </h2>
              </div>
              {eta !== null && activeRide.status === 'accepted' && (
                <div className="bg-white/20 backdrop-blur-md rounded-3xl p-6 border border-white/10">
                  <p className="text-sm font-bold text-white/70 uppercase tracking-wider mb-1">ETA</p>
                  <p className="text-5xl font-black text-white">{eta} <span className="text-xl">min</span></p>
                </div>
              )}
            </div>
          </div>

          <motion.div 
            initial={{ opacity: 0, y: 20 }} 
            animate={{ opacity: 1, y: 0 }}
            className="bg-white/80 dark:bg-zinc-900/80 backdrop-blur-2xl rounded-[3rem] shadow-2xl border border-white/20 dark:border-zinc-700/50 overflow-hidden"
          >
            {/* Map */}
            {ridePickupLocation && (
              <div className="relative">
                <MapComponent 
                  markers={[
                    { id: 'passenger', position: ridePickupLocation, label: 'You', type: 'passenger' },
                    ...(riderProfile?.currentLocation ? [{ id: riderProfile.uid, position: riderProfile.currentLocation, label: riderProfile.name, type: 'rider' as const, profile: riderProfile }] : []),
                    ...(hasValidCoordinates(activeRide.destination) ? [{ id: 'destination', position: { lat: activeRide.destination.lat, lng: activeRide.destination.lng }, label: activeRide.destination.address || 'Destination', type: 'destination' as const }] : []),
                    ...(activeRide.status === 'requested' ? nearbyDrivers.filter(d => d.currentLocation).map(driver => ({ id: driver.uid, position: driver.currentLocation!, label: driver.name, type: 'nearby' as const, profile: driver })) : [])
                  ]}
                  directionRequests={activeRideDirectionRequests}
                  center={focusedNearbyDriver?.currentLocation || riderProfile?.currentLocation || ridePickupLocation}
                  zoom={15}
                  height="400px"
                  showNearbyDrivers={activeRide.status === 'requested'}
                  onMarkerClick={(marker) => { if (marker.type === 'nearby') setSelectedNearbyRiderId(marker.id); }}
                />
              </div>
            )}

            <div className="p-8 space-y-6">
              {/* Rider Info Card */}
              {riderProfile && (
                <div className="flex items-center justify-between p-5 bg-gradient-to-br from-gray-50 to-white dark:from-zinc-800 dark:to-zinc-800/50 rounded-[2.5rem] border border-gray-100 dark:border-zinc-700 shadow-xl">
                  <div className="flex items-center gap-4">
                    {riderProfile.avatarUrl ? (
                      <img src={riderProfile.avatarUrl} referrerPolicy="no-referrer" className="w-16 h-16 rounded-2xl ring-4 ring-white dark:ring-zinc-700 shadow-2xl object-cover" alt="" />
                    ) : (
                      <div className="w-16 h-16 bg-gradient-to-br from-amber-400 to-orange-600 rounded-2xl flex items-center justify-center shadow-2xl">
                        <UserIcon className="w-8 h-8 text-white" />
                      </div>
                    )}
                    <div>
                      <p className="font-black text-lg text-gray-900 dark:text-white">{riderProfile.name}</p>
                      <div className="flex items-center gap-3 mt-1">
                        <div className="flex items-center gap-1.5 bg-amber-50 dark:bg-amber-500/10 px-3 py-1 rounded-xl">
                          <Star className="w-4 h-4 text-amber-400 fill-current" />
                          <span className="text-sm font-bold text-amber-600 dark:text-amber-400">{riderProfile.rating}</span>
                        </div>
                        {riderProfile.vehicleModel && (
                          <span className="text-sm text-gray-400 font-semibold">{riderProfile.vehicleModel} • {riderProfile.numberPlate}</span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <motion.button whileTap={{ scale: 0.9 }} onClick={() => handleToggleFavorite(riderProfile.uid)}
                      className={`p-3.5 rounded-2xl transition-all ${
                        profile.favoriteUserIds?.includes(riderProfile.uid) 
                          ? 'bg-red-50 dark:bg-red-500/10 text-red-500 shadow-lg shadow-red-500/20' 
                          : 'bg-white dark:bg-zinc-700 text-gray-400 hover:bg-red-50 dark:hover:bg-red-500/10 hover:text-red-500'
                      }`}
                    >
                      <Heart className={`w-6 h-6 ${profile.favoriteUserIds?.includes(riderProfile.uid) ? 'fill-current' : ''}`} />
                    </motion.button>
                    <motion.a 
                      whileTap={{ scale: 0.9 }} 
                      href={`tel:${riderProfile.phoneNumber}`}
                      className="p-3.5 rounded-2xl bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-500/20 transition-all shadow-lg shadow-emerald-500/20"
                    >
                      <Phone className="w-6 h-6" />
                    </motion.a>
                  </div>
                </div>
              )}

              {/* Locations */}
              <div className="space-y-4">
                <div className="flex items-start gap-4 p-5 rounded-2xl bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-500/10 dark:to-emerald-500/10 border border-green-100 dark:border-green-500/20">
                  <div className="w-12 h-12 bg-green-500 rounded-2xl flex items-center justify-center shadow-xl shadow-green-500/30">
                    <MapPin className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <p className="text-xs font-black text-green-600 dark:text-green-400 uppercase tracking-widest mb-1">Pickup Location</p>
                    <p className="text-base font-bold text-gray-900 dark:text-white leading-snug">{activeRide.pickup.address}</p>
                  </div>
                </div>
                <div className="flex items-start gap-4 p-5 rounded-2xl bg-gradient-to-r from-red-50 to-rose-50 dark:from-red-500/10 dark:to-rose-500/10 border border-red-100 dark:border-red-500/20">
                  <div className="w-12 h-12 bg-red-500 rounded-2xl flex items-center justify-center shadow-xl shadow-red-500/30">
                    <Navigation className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <p className="text-xs font-black text-red-600 dark:text-red-400 uppercase tracking-widest mb-1">Destination</p>
                    <p className="text-base font-bold text-gray-900 dark:text-white leading-snug">{activeRide.destination.address}</p>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="space-y-4 pt-4 border-t border-gray-100 dark:border-zinc-800">
                {activeRide.status === 'arrived' && !activeRide.passengerConfirmedArrival && (
                  <div className="grid gap-4 sm:grid-cols-2">
                    <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} onClick={handleConfirmArrival}
                      className="bg-gradient-to-r from-emerald-500 to-emerald-600 text-white py-5 rounded-2xl font-bold shadow-xl shadow-emerald-500/30 flex items-center justify-center gap-3">
                      <CheckCircle2 className="w-6 h-6" />Confirm Driver Arrival
                    </motion.button>
                    <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} onClick={handleRejectArrival}
                      className="bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 py-5 rounded-2xl font-bold border-2 border-red-200 dark:border-red-500/30 flex items-center justify-center gap-3">
                      <X className="w-6 h-6" />Rider Not Here
                    </motion.button>
                  </div>
                )}

                {waitingForRiderStart && (
                  <div className="p-5 bg-amber-50 dark:bg-amber-500/10 rounded-2xl border border-amber-200 dark:border-amber-500/30 text-base text-amber-600 dark:text-amber-400 font-semibold text-center">
                    <Loader2 className="w-5 h-5 animate-spin inline mr-3" />
                    Waiting for rider to confirm trip start...
                  </div>
                )}

                {activeRide.status === 'arrived' && activeRide.passengerConfirmedArrival && activeRide.riderConfirmedStart && (
                  <div className="grid gap-4 sm:grid-cols-2">
                    <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} onClick={handleConfirmStart}
                      className="bg-black dark:bg-white text-white dark:text-black py-5 rounded-2xl font-bold shadow-xl flex items-center justify-center gap-3">
                      <Navigation2 className="w-6 h-6" />Confirm Start
                    </motion.button>
                    <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} onClick={handleRejectStart}
                      className="bg-gray-100 dark:bg-zinc-800 text-gray-600 dark:text-gray-400 py-5 rounded-2xl font-bold">
                      Reject
                    </motion.button>
                  </div>
                )}

                {activeRide.status === 'ongoing' && activeRide.riderConfirmedEnd && (
                  <div className="grid gap-4 sm:grid-cols-2">
                    <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} onClick={handleConfirmReached}
                      className="bg-gradient-to-r from-emerald-500 to-emerald-600 text-white py-5 rounded-2xl font-bold shadow-xl shadow-emerald-500/30 flex items-center justify-center gap-3">
                      <Award className="w-6 h-6" />Confirm Arrival
                    </motion.button>
                    <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} onClick={handleRejectReached}
                      className="bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 py-5 rounded-2xl font-bold border-2 border-red-200 dark:border-red-500/30">
                      Not Yet
                    </motion.button>
                  </div>
                )}

                {['requested', 'accepted', 'arrived'].includes(activeRide.status) && (
                  <motion.button whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.98 }} onClick={() => setShowCancelModal(true)}
                    className="w-full bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 py-5 rounded-2xl font-bold hover:bg-red-100 dark:hover:bg-red-500/20 transition-all border-2 border-red-200 dark:border-red-500/30">
                    Cancel Ride
                  </motion.button>
                )}
              </div>
            </div>
          </motion.div>
        </div>

        {/* Cancel Modal */}
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
                className="bg-white/90 dark:bg-zinc-950/90 backdrop-blur-2xl w-full max-w-sm rounded-[3rem] p-8 relative z-10 shadow-2xl border border-white/20 dark:border-zinc-700/50"
              >
                <div className="w-16 h-16 bg-red-100 dark:bg-red-500/10 rounded-2xl flex items-center justify-center mb-6 shadow-xl">
                  <X className="w-8 h-8 text-red-500" />
                </div>
                <h3 className="text-2xl font-black mb-3 text-gray-900 dark:text-white">{t('cancelRideTitle')}</h3>
                <p className="text-gray-500 dark:text-zinc-400 mb-6">{t('cancelRideDesc')}</p>
                <textarea 
                  value={cancelReason} 
                  onChange={(e) => setCancelReason(e.target.value)} 
                  placeholder={t('cancelPlaceholder')}
                  className="w-full bg-gray-50 dark:bg-zinc-800 rounded-2xl p-4 border-2 border-transparent focus:border-red-500 outline-none mb-6 resize-none font-medium"
                  rows={3} 
                />
                <div className="flex gap-4">
                  <button 
                    onClick={() => setShowCancelModal(false)} 
                    className="flex-1 py-4 font-bold text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    Keep
                  </button>
                  <motion.button 
                    whileTap={{ scale: 0.95 }} 
                    onClick={handleCancelRide} 
                    disabled={isCancelling}
                    className="flex-1 bg-gradient-to-r from-red-500 to-red-600 text-white py-4 rounded-2xl font-bold shadow-xl shadow-red-500/30"
                  >
                    {isCancelling ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : 'Cancel'}
                  </motion.button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </>
    );
  }

  // ==================== DEFAULT RIDE REQUEST VIEW ====================
  return (
    <div className="flex flex-col gap-6 h-full bg-gradient-to-br from-slate-50 via-white to-purple-50 dark:from-slate-950 dark:via-zinc-900 dark:to-purple-950 p-4 md:p-6">
      {/* Tab Navigation */}
      <div className="flex gap-2 p-2 bg-white/60 dark:bg-zinc-800/60 backdrop-blur-xl rounded-2xl border border-white/20 dark:border-zinc-700/50 shadow-lg">
        {[
          { key: 'ride' as const, label: 'Request', icon: MapIcon },
          { key: 'reports' as const, label: 'Reports', icon: FileText },
          { key: 'analytics' as const, label: 'Analytics', icon: BarChart3 }
        ].map((tab) => (
          <motion.button 
            key={tab.key} 
            whileTap={{ scale: 0.95 }} 
            onClick={() => setViewMode(tab.key)}
            className={`flex-1 py-3.5 px-4 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all duration-300 ${
              viewMode === tab.key 
                ? 'bg-white dark:bg-zinc-700 text-gray-900 dark:text-white shadow-xl shadow-purple-500/10' 
                : 'text-gray-500 dark:text-zinc-400 hover:text-gray-700 dark:hover:text-zinc-300 hover:bg-white/50 dark:hover:bg-zinc-700/50'
            }`}
          >
            <tab.icon className="w-4 h-4" />
            <span className="hidden sm:inline">{tab.label}</span>
          </motion.button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        {viewMode === 'ride' && (
          <motion.div 
            key="ride-view" 
            initial={{ opacity: 0, y: 20 }} 
            animate={{ opacity: 1, y: 0 }} 
            exit={{ opacity: 0, y: -20 }} 
            className="flex-1 flex flex-col md:gap-6 gap-0"
          >
            {/* MOBILE: Full-Screen Map with Overlay Card */}
            <div className="md:hidden flex-1 flex flex-col relative">
              {/* Full-Screen Map Background */}
              <div className="absolute inset-0 rounded-3xl overflow-hidden shadow-2xl">
                {passengerLocation || destinationLocation ? (
                  <MapComponent 
                    center={destinationLocation || passengerLocation || { lat: -1.9441, lng: 30.0619 }}
                    zoom={15}
                    markers={[
                      ...(passengerLocation ? [{ id: 'passenger', position: passengerLocation, label: 'You', type: 'passenger' as const }] : []),
                      ...(destinationLocation ? [{ id: 'destination', position: destinationLocation, label: 'Destination', type: 'destination' as const }] : []),
                      ...onlineRiders.filter(r => hasValidCoordinates(r.currentLocation)).map(rider => ({ id: rider.uid, position: rider.currentLocation!, label: rider.name, type: 'nearby' as const, profile: rider }))
                    ]}
                    directionRequests={passengerLocation && destinationLocation ? [{ id: 'route', origin: passengerLocation, destination: destinationLocation, color: '#8b5cf6' }] : []}
                    height="100%"
                    freezeViewport={false}
                    showNearbyDrivers={true}
                    onMarkerClick={(marker) => { if (marker.type === 'nearby') setSelectedNearbyRiderId(marker.id); }}
                  />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-slate-900 via-purple-950 to-slate-900 flex items-center justify-center">
                    <div className="text-center">
                      <div className="w-16 h-16 bg-purple-500/20 rounded-3xl flex items-center justify-center mx-auto mb-4">
                        <Loader2 className="w-8 h-8 animate-spin text-purple-400" />
                      </div>
                      <p className="text-white/50 font-medium">Locating you...</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Overlay Card - Request Form */}
              <motion.div 
                initial={{ y: 100, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ type: "spring", stiffness: 300, damping: 30 }}
                className="absolute bottom-4 left-4 right-4 bg-white/95 dark:bg-zinc-900/95 backdrop-blur-2xl rounded-[3rem] border border-white/20 dark:border-zinc-700/50 shadow-2xl max-h-[75vh] overflow-y-auto"
              >
                <div className="p-6 space-y-5">
                  {/* Handle Bar */}
                  <div className="flex justify-center mb-2">
                    <div className="w-16 h-1.5 bg-gray-200 dark:bg-zinc-700 rounded-full" />
                  </div>

                  {/* Header */}
                  <div>
                    <h2 className="text-3xl font-black text-gray-900 dark:text-white tracking-tight">Where to?</h2>
                    <p className="text-gray-500 dark:text-zinc-400 font-medium mt-2">{t('requestRide')}</p>
                  </div>

                  {/* Location Inputs */}
                  <div className="space-y-4">
                    <div className="relative group">
                      <div className="absolute left-5 top-5 w-3.5 h-3.5 rounded-full bg-green-500 ring-4 ring-green-100 dark:ring-green-500/20 z-10 group-hover:scale-110 transition-transform" />
                      <div className="absolute left-[1.65rem] top-9 bottom-0 w-0.5 bg-gradient-to-b from-green-500 to-red-500" />
                      <input 
                        type="text" 
                        placeholder={t('pickupLocation')} 
                        value={pickup}
                        onChange={(e) => { setPickup(e.target.value); setPassengerLocation(null); }}
                        className="w-full bg-gray-50 dark:bg-zinc-800 py-5 pl-14 pr-28 rounded-2xl border-2 border-transparent focus:border-purple-500 dark:focus:border-purple-400 transition-all outline-none font-semibold text-gray-900 dark:text-white placeholder:text-gray-400 shadow-lg group-hover:shadow-xl" 
                      />
                      <div className="absolute right-2 top-1/2 -translate-y-1/2 flex gap-1">
                        <button 
                          onClick={handleUseCurrentLocation} 
                          disabled={isLocating} 
                          className="p-3 rounded-xl hover:bg-gray-100 dark:hover:bg-zinc-700 transition-all hover:scale-105"
                        >
                          {isLocating ? <Loader2 className="w-5 h-5 animate-spin text-purple-500" /> : <Navigation2 className="w-5 h-5 text-gray-400" />}
                        </button>
                        <button 
                          onClick={() => setIsPickingOnMap('pickup')} 
                          className="p-3 rounded-xl hover:bg-gray-100 dark:hover:bg-zinc-700 transition-all hover:scale-105"
                        >
                          <Search className="w-5 h-5 text-gray-400" />
                        </button>
                      </div>
                    </div>
                    <div className="relative group">
                      <div className="absolute left-5 top-5 w-3.5 h-3.5 rounded-full bg-red-500 ring-4 ring-red-100 dark:ring-red-500/20 z-10 group-hover:scale-110 transition-transform" />
                      <input 
                        type="text" 
                        placeholder={t('destinationAddress')} 
                        value={destination}
                        onChange={(e) => { setDestination(e.target.value); setDestinationLocation(null); }}
                        className="w-full bg-gray-50 dark:bg-zinc-800 py-5 pl-14 pr-14 rounded-2xl border-2 border-transparent focus:border-purple-500 dark:focus:border-purple-400 transition-all outline-none font-semibold text-gray-900 dark:text-white placeholder:text-gray-400 shadow-lg group-hover:shadow-xl" 
                      />
                      <button 
                        onClick={() => setIsPickingOnMap('destination')} 
                        className="absolute right-3 top-1/2 -translate-y-1/2 p-3 rounded-xl hover:bg-gray-100 dark:hover:bg-zinc-700 transition-all hover:scale-105"
                      >
                        <Search className="w-5 h-5 text-gray-400" />
                      </button>
                    </div>
                  </div>

                  {/* Vehicle Selection */}
                  <div className="space-y-3">
                    <p className="text-xs font-black text-gray-400 dark:text-zinc-500 uppercase tracking-widest">Choose Vehicle</p>
                    <div className="grid grid-cols-2 gap-3">
                      {[
                        { type: 'car' as const, icon: Car, label: 'Car', gradient: 'from-blue-500 to-cyan-500' },
                        { type: 'motorcycle' as const, icon: Bike, label: 'Moto', gradient: 'from-orange-500 to-red-500' }
                      ].map((v) => (
                        <motion.button 
                          key={v.type} 
                          whileHover={{ scale: 1.02, y: -2 }} 
                          whileTap={{ scale: 0.98 }} 
                          onClick={() => setVehicleType(v.type)}
                          className={`p-5 rounded-2xl font-bold flex flex-col items-center gap-3 transition-all duration-300 ${
                            vehicleType === v.type 
                              ? `bg-gradient-to-br ${v.gradient} text-white shadow-2xl shadow-current/30 scale-105` 
                              : 'bg-gray-50 dark:bg-zinc-800 text-gray-500 dark:text-zinc-400 hover:bg-gray-100 dark:hover:bg-zinc-700 shadow-lg'
                          }`}
                        >
                          <v.icon className="w-7 h-7" />
                          <span className="text-sm">{v.label}</span>
                        </motion.button>
                      ))}
                    </div>
                  </div>

                  {/* Request Button */}
                  <motion.button 
                    whileHover={{ scale: 1.02 }} 
                    whileTap={{ scale: 0.98 }}
                    onClick={handleRequestRide} 
                    disabled={!pickup || !destination || isRequesting}
                    className="w-full bg-gradient-to-r from-purple-600 via-violet-600 to-indigo-600 text-white py-6 rounded-2xl font-black text-lg disabled:opacity-50 disabled:cursor-not-allowed shadow-2xl shadow-purple-500/30 flex items-center justify-center gap-3 hover:shadow-purple-500/50 transition-all"
                  >
                    {isRequesting ? (
                      <Loader2 className="w-6 h-6 animate-spin" />
                    ) : (
                      <>
                        <Zap className="w-6 h-6" />
                        {t('requestNow')}
                      </>
                    )}
                  </motion.button>

                  {/* Fare Info */}
                  {pickup && destination && (
                    <motion.div 
                      initial={{ opacity: 0, scale: 0.95 }} 
                      animate={{ opacity: 1, scale: 1 }}
                      className="bg-gradient-to-br from-purple-50 to-indigo-50 dark:from-purple-500/10 dark:to-indigo-500/10 p-5 rounded-2xl border border-purple-100 dark:border-purple-500/20 shadow-lg"
                    >
                      <p className="text-sm text-gray-500 dark:text-zinc-400 font-bold uppercase tracking-wider mb-1">{t('fareToBeNegotiated')}</p>
                      <p className="text-xl font-black text-purple-600 dark:text-purple-400">{t('byAgreement')}</p>
                    </motion.div>
                  )}
                </div>
              </motion.div>
            </div>

            {/* DESKTOP: Traditional Layout */}
            <div className="hidden md:flex flex-col gap-6">
              {/* Gradient Header */}
              <div className="relative overflow-hidden bg-gradient-to-br from-violet-600 via-purple-600 to-indigo-700 dark:from-violet-900 dark:via-purple-900 dark:to-indigo-950 rounded-[3rem] p-10 shadow-2xl shadow-purple-500/20">
                <div className="absolute inset-0 opacity-30">
                  <div className="absolute top-0 right-0 w-72 h-72 bg-white rounded-full -translate-y-1/2 translate-x-1/2 blur-3xl" />
                  <div className="absolute bottom-0 left-0 w-56 h-56 bg-white rounded-full translate-y-1/2 -translate-x-1/2 blur-3xl" />
                  <div className="absolute top-1/2 left-1/2 w-40 h-40 bg-purple-300 rounded-full -translate-x-1/2 -translate-y-1/2 blur-2xl" />
                </div>
                <div className="relative z-10">
                  <h2 className="text-4xl font-black text-white mb-3 tracking-tight">{t('whereTo')}</h2>
                  <p className="text-white/70 font-semibold text-lg">{t('requestRide')}</p>
                </div>
              </div>

              {/* Input Cards */}
              <div className="bg-white/80 dark:bg-zinc-900/80 backdrop-blur-2xl rounded-[3rem] p-6 shadow-xl border border-white/20 dark:border-zinc-700/50 space-y-4">
                <div className="relative group">
                  <div className="absolute left-5 top-5 w-3.5 h-3.5 rounded-full bg-green-500 ring-4 ring-green-100 dark:ring-green-500/20 z-10 group-hover:scale-110 transition-transform" />
                  <div className="absolute left-[1.65rem] top-9 bottom-0 w-0.5 bg-gradient-to-b from-green-500 to-red-500" />
                  <input 
                    type="text" 
                    placeholder={t('pickupLocation')} 
                    value={pickup}
                    onChange={(e) => { setPickup(e.target.value); setPassengerLocation(null); }}
                    className="w-full bg-gray-50 dark:bg-zinc-800 py-5 pl-14 pr-28 rounded-2xl border-2 border-transparent focus:border-purple-500 dark:focus:border-purple-400 transition-all outline-none font-semibold text-gray-900 dark:text-white placeholder:text-gray-400 shadow-lg" 
                  />
                  <div className="absolute right-2 top-1/2 -translate-y-1/2 flex gap-1">
                    <button 
                      onClick={handleUseCurrentLocation} 
                      disabled={isLocating} 
                      className="p-3 rounded-xl hover:bg-gray-100 dark:hover:bg-zinc-700 transition-all"
                    >
                      {isLocating ? <Loader2 className="w-5 h-5 animate-spin text-purple-500" /> : <Navigation2 className="w-5 h-5 text-gray-400" />}
                    </button>
                    <button 
                      onClick={() => setIsPickingOnMap('pickup')} 
                      className="p-3 rounded-xl hover:bg-gray-100 dark:hover:bg-zinc-700 transition-all"
                    >
                      <Search className="w-5 h-5 text-gray-400" />
                    </button>
                  </div>
                </div>
                <div className="relative group">
                  <div className="absolute left-5 top-5 w-3.5 h-3.5 rounded-full bg-red-500 ring-4 ring-red-100 dark:ring-red-500/20 z-10 group-hover:scale-110 transition-transform" />
                  <input 
                    type="text" 
                    placeholder={t('destinationAddress')} 
                    value={destination}
                    onChange={(e) => { setDestination(e.target.value); setDestinationLocation(null); }}
                    className="w-full bg-gray-50 dark:bg-zinc-800 py-5 pl-14 pr-14 rounded-2xl border-2 border-transparent focus:border-purple-500 dark:focus:border-purple-400 transition-all outline-none font-semibold text-gray-900 dark:text-white placeholder:text-gray-400 shadow-lg" 
                  />
                  <button 
                    onClick={() => setIsPickingOnMap('destination')} 
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-3 rounded-xl hover:bg-gray-100 dark:hover:bg-zinc-700 transition-all"
                  >
                    <Search className="w-5 h-5 text-gray-400" />
                  </button>
                </div>
              </div>

              {/* Vehicle Selection */}
              <div className="space-y-4">
                <p className="text-sm font-black text-gray-400 dark:text-zinc-500 uppercase tracking-widest px-2">Choose Vehicle</p>
                <div className="grid grid-cols-2 gap-4">
                  {[
                    { type: 'car' as const, icon: Car, label: 'Car', gradient: 'from-blue-500 to-cyan-500' },
                    { type: 'motorcycle' as const, icon: Bike, label: 'Moto', gradient: 'from-orange-500 to-red-500' }
                  ].map((v) => (
                    <motion.button 
                      key={v.type} 
                      whileHover={{ scale: 1.02, y: -2 }} 
                      whileTap={{ scale: 0.98 }} 
                      onClick={() => setVehicleType(v.type)}
                      className={`p-6 rounded-2xl font-bold flex flex-col items-center gap-3 transition-all duration-300 ${
                        vehicleType === v.type 
                          ? `bg-gradient-to-br ${v.gradient} text-white shadow-2xl shadow-current/30 scale-105` 
                          : 'bg-white/80 dark:bg-zinc-800/80 backdrop-blur-sm text-gray-500 dark:text-zinc-400 hover:bg-gray-100 dark:hover:bg-zinc-700 shadow-lg border border-white/20 dark:border-zinc-700/50'
                      }`}
                    >
                      <v.icon className="w-8 h-8" />
                      <span className="text-base">{v.label}</span>
                    </motion.button>
                  ))}
                </div>
              </div>

              {/* Map Picker */}
              {isPickingOnMap && (
                <motion.div 
                  initial={{ opacity: 0, height: 0 }} 
                  animate={{ opacity: 1, height: 'auto' }}
                  className="rounded-[3rem] overflow-hidden border-2 border-purple-500 dark:border-purple-400 shadow-2xl"
                >
                  <div className="relative">
                    <div className="absolute top-4 left-4 right-20 z-10 bg-black/80 backdrop-blur-md rounded-2xl px-5 py-4 text-white shadow-2xl border border-white/10">
                      <p className="font-bold text-sm uppercase tracking-wider">Tap map to set {isPickingOnMap}</p>
                      {(isPickingOnMap === 'pickup' && pickup) && <p className="mt-2 text-sm text-emerald-300 font-semibold truncate">{pickup}</p>}
                      {(isPickingOnMap === 'destination' && destination) && <p className="mt-2 text-sm text-emerald-300 font-semibold truncate">{destination}</p>}
                    </div>
                    <MapComponent 
                      center={pickerCenter} 
                      zoom={15} 
                      markers={pickerMarkers} 
                      directionRequests={pickerDirectionRequests} 
                      onMapClick={handleMapClick} 
                      height="400px" 
                      showNearbyDrivers={false} 
                    />
                    <button 
                      onClick={() => setIsPickingOnMap(null)} 
                      className="absolute top-4 right-4 bg-white/90 backdrop-blur-md p-3.5 rounded-2xl shadow-xl hover:bg-white transition-all z-10"
                    >
                      <X className="w-6 h-6 text-gray-700" />
                    </button>
                  </div>
                </motion.div>
              )}

              {/* Available Riders Nearby */}
              {!activeRide && onlineRiders.length > 0 && (
                <div className="space-y-5">
                  <div className="flex items-center justify-between px-4">
                    <h3 className="text-sm font-black uppercase tracking-widest text-gray-400">{t('nearbyRiders')}</h3>
                    <span className="bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 px-4 py-2 rounded-full text-xs font-black uppercase tracking-widest border border-emerald-500/30">
                      {onlineRiders.length} {t('online')}
                    </span>
                  </div>
                  {(passengerLocation || onlineRiders.some((rider) => hasValidCoordinates(rider.currentLocation))) && (
                    <div className="bg-white/80 dark:bg-zinc-900/80 backdrop-blur-2xl p-4 rounded-[3rem] border border-white/20 dark:border-zinc-700/50 shadow-xl space-y-4">
                      <div className="rounded-[2rem] overflow-hidden shadow-lg">
                        <MapComponent
                          markers={[
                            ...(passengerLocation ? [{ id: 'passenger-preview', position: passengerLocation, label: 'You', type: 'passenger' as const }] : []),
                            ...onlineRiders.filter((rider) => hasValidCoordinates(rider.currentLocation)).map((rider) => ({
                              id: rider.uid, position: rider.currentLocation!, label: rider.name,
                              type: selectedNearbyRiderId === rider.uid ? 'rider' as const : 'nearby' as const, profile: rider
                            }))
                          ]}
                          directionRequests={passengerLocation && destinationLocation ? [{ id: 'passenger-trip-preview', origin: passengerLocation, destination: destinationLocation, color: '#8b5cf6' }] : []}
                          center={onlineRiders.find((rider) => rider.uid === selectedNearbyRiderId && hasValidCoordinates(rider.currentLocation))?.currentLocation || passengerLocation || onlineRiders.find((rider) => hasValidCoordinates(rider.currentLocation))?.currentLocation}
                          zoom={14} 
                          height="320px"
                          onMarkerClick={(marker) => { if (marker.type === 'nearby' || marker.type === 'rider') setSelectedNearbyRiderId(marker.id); }}
                        />
                      </div>
                      {selectedNearbyRiderId && (
                        <div className="rounded-2xl bg-gradient-to-r from-purple-50 to-indigo-50 dark:from-purple-500/10 dark:to-indigo-500/10 px-5 py-4 text-sm text-purple-600 dark:text-purple-400 font-semibold border border-purple-100 dark:border-purple-500/20">
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
                        className={`bg-white/80 dark:bg-zinc-900/80 backdrop-blur-xl p-5 rounded-[2.5rem] border shadow-xl flex items-center justify-between cursor-pointer transition-all duration-300 ${
                          selectedNearbyRiderId === rider.uid 
                            ? 'border-purple-400 dark:border-purple-600 ring-2 ring-purple-500/20 shadow-purple-500/20' 
                            : 'border-white/20 dark:border-zinc-700/50 hover:border-purple-300 dark:hover:border-purple-700'
                        }`}
                      >
                        <div className="flex items-center gap-4">
                          <div className="relative">
                            {rider.avatarUrl ? (
                              <img src={rider.avatarUrl} className="w-14 h-14 rounded-2xl object-cover shadow-lg" alt="" />
                            ) : (
                              <div className="w-14 h-14 bg-gradient-to-br from-amber-400 to-orange-600 rounded-2xl flex items-center justify-center shadow-lg">
                                <UserIcon className="w-7 h-7 text-white" />
                              </div>
                            )}
                            <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-emerald-500 rounded-xl flex items-center justify-center border-2 border-white dark:border-zinc-800 shadow-lg">
                              <ShieldCheck className="w-3.5 h-3.5 text-white" />
                            </div>
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <h4 className="font-black text-gray-900 dark:text-white">{rider.name}</h4>
                              {profile.favoriteUserIds?.includes(rider.uid) && (
                                <Heart className="w-4 h-4 text-red-500 fill-current" />
                              )}
                            </div>
                            <p className="text-xs text-gray-400 font-bold uppercase tracking-widest mt-1">{rider.vehicleType} • {rider.rating} ★</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <button 
                            onClick={(e) => { e.stopPropagation(); handleToggleFavorite(rider.uid); }}
                            className={`p-3 rounded-xl transition-all ${
                              profile.favoriteUserIds?.includes(rider.uid) 
                                ? 'bg-red-50 text-red-500 shadow-lg shadow-red-500/20' 
                                : 'bg-gray-50 dark:bg-zinc-700 text-gray-400 hover:text-red-500'
                            }`}
                          >
                            <Heart className={`w-5 h-5 ${profile.favoriteUserIds?.includes(rider.uid) ? 'fill-current' : ''}`} />
                          </button>
                          {rider.phoneNumber && (
                            <a 
                              href={`tel:${rider.phoneNumber}`} 
                              onClick={(e) => e.stopPropagation()}
                              className="bg-black dark:bg-white text-white dark:text-black p-3 rounded-xl shadow-xl hover:scale-105 transition-transform"
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

              {/* Fare Info Card */}
              {pickup && destination && (
                <motion.div 
                  initial={{ opacity: 0, scale: 0.95 }} 
                  animate={{ opacity: 1, scale: 1 }}
                  className="bg-gradient-to-br from-gray-900 to-black dark:from-zinc-800 dark:to-zinc-900 text-white p-8 rounded-[3rem] flex items-center justify-between shadow-2xl"
                >
                  <div>
                    <p className="text-sm text-white/50 font-bold uppercase tracking-widest mb-2">{t('fareToBeNegotiated')}</p>
                    <p className="text-4xl font-black tracking-tight">{t('byAgreement')}</p>
                    <p className="mt-3 text-base text-white/40">{t('fareNegotiationMessage')}</p>
                  </div>
                  <div className="w-16 h-16 bg-emerald-500/20 rounded-2xl flex items-center justify-center shadow-xl border border-emerald-500/30">
                    <CheckCircle2 className="w-8 h-8 text-emerald-400" />
                  </div>
                </motion.div>
              )}

              {/* Request Button */}
              <motion.button 
                whileHover={{ scale: 1.02 }} 
                whileTap={{ scale: 0.98 }}
                onClick={handleRequestRide} 
                disabled={!pickup || !destination || isRequesting}
                className="w-full bg-gradient-to-r from-purple-600 via-violet-600 to-indigo-600 text-white py-7 rounded-2xl font-black text-xl disabled:opacity-50 disabled:cursor-not-allowed shadow-2xl shadow-purple-500/30 flex items-center justify-center gap-3 hover:shadow-purple-500/50 transition-all"
              >
                {isRequesting ? (
                  <Loader2 className="w-6 h-6 animate-spin" />
                ) : (
                  <>
                    <Zap className="w-6 h-6" />
                    {t('requestNow')}
                  </>
                )}
              </motion.button>

              {/* Saved Locations */}
              {savedLocations.length > 0 && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between px-4">
                    <h3 className="text-sm font-black text-gray-400 uppercase tracking-widest">{t('savedLocations')}</h3>
                    <button 
                      onClick={() => { 
                        if (destination) { setLocationNameToSave(''); setShowSaveLocationModal(true); } 
                        else { addNotification('Info', 'Set a destination first to save this location', 'info'); } 
                      }}
                      className="p-3 text-gray-400 hover:bg-gray-100 dark:hover:bg-zinc-700 rounded-xl transition-all hover:scale-105"
                    >
                      <Save className="w-5 h-5" />
                    </button>
                  </div>
                  <div className="grid gap-3">
                    {savedLocations.map((loc) => (
                      <div 
                        key={loc.id} 
                        onClick={() => setDestination(loc.address)}
                        className="bg-white/80 dark:bg-zinc-900/80 backdrop-blur-sm p-5 rounded-2xl border border-white/20 dark:border-zinc-700/50 hover:border-purple-300 dark:hover:border-purple-700 cursor-pointer flex items-center justify-between group transition-all shadow-lg hover:shadow-xl"
                      >
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 bg-purple-50 dark:bg-purple-500/10 rounded-2xl flex items-center justify-center group-hover:bg-purple-600 group-hover:text-white transition-all shadow-lg">
                            <MapPin className="w-6 h-6" />
                          </div>
                          <div>
                            <p className="font-bold text-base text-gray-900 dark:text-white">{loc.name}</p>
                            <p className="text-sm text-gray-400 truncate max-w-[250px]">{loc.address}</p>
                          </div>
                        </div>
                        <button 
                          onClick={(e) => { e.stopPropagation(); handleRemoveSavedLocation(loc.id); }}
                          className="p-3 rounded-xl hover:bg-red-50 text-gray-300 hover:text-red-500 transition-all opacity-0 group-hover:opacity-100 hover:scale-110"
                        >
                          <Trash2 className="w-5 h-5" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Save Location Modal */}
              <AnimatePresence>
                {showSaveLocationModal && (
                  <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
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
                      className="bg-white/90 dark:bg-zinc-950/90 backdrop-blur-2xl w-full max-w-sm rounded-[3rem] p-8 relative z-10 shadow-2xl border border-white/20 dark:border-zinc-700/50"
                    >
                      <div className="w-16 h-16 bg-purple-100 dark:bg-purple-500/10 rounded-2xl flex items-center justify-center mb-6 shadow-xl">
                        <MapPinPlus className="w-8 h-8 text-purple-600" />
                      </div>
                      <h3 className="text-2xl font-black mb-3 text-gray-900 dark:text-white">Save Location</h3>
                      <p className="text-gray-500 dark:text-zinc-400 mb-6 truncate">"{destination}"</p>
                      <input 
                        type="text" 
                        value={locationNameToSave} 
                        onChange={(e) => setLocationNameToSave(e.target.value)}
                        placeholder="e.g., Home, Work, Gym"
                        className="w-full bg-gray-50 dark:bg-zinc-800 rounded-2xl p-4 border-2 border-transparent focus:border-purple-500 outline-none mb-6 font-semibold shadow-lg" 
                      />
                      <div className="flex gap-4">
                        <button 
                          onClick={() => setShowSaveLocationModal(false)} 
                          className="flex-1 py-4 font-bold text-gray-400 hover:text-gray-600 transition-colors"
                        >
                          Cancel
                        </button>
                        <motion.button 
                          whileTap={{ scale: 0.95 }}
                          onClick={() => { 
                            if (passengerLocation) handleSaveLocation(destination, passengerLocation.lat, passengerLocation.lng); 
                            else handleSaveLocation(destination, 51.5074, -0.1278); 
                          }}
                          disabled={isSavingLocation}
                          className="flex-1 bg-gradient-to-r from-purple-600 to-indigo-600 text-white py-4 rounded-2xl font-bold shadow-xl"
                        >
                          {isSavingLocation ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : 'Save'}
                        </motion.button>
                      </div>
                    </motion.div>
                  </div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        )}
        {viewMode === 'reports' && (
          <motion.div 
            key="reports-view" 
            initial={{ opacity: 0, y: 20 }} 
            animate={{ opacity: 1, y: 0 }} 
            exit={{ opacity: 0, y: -20 }}
            className="bg-white/80 dark:bg-zinc-900/80 backdrop-blur-2xl rounded-[3rem] p-6 shadow-2xl border border-white/20 dark:border-zinc-700/50"
          >
            <TripReport user={user} userRole="passenger" />
          </motion.div>
        )}
        {viewMode === 'analytics' && (
          <motion.div 
            key="analytics-view" 
            initial={{ opacity: 0, y: 20 }} 
            animate={{ opacity: 1, y: 0 }} 
            exit={{ opacity: 0, y: -20 }}
            className="bg-white/80 dark:bg-zinc-900/80 backdrop-blur-2xl rounded-[3rem] p-6 shadow-2xl border border-white/20 dark:border-zinc-700/50"
          >
            <TripAnalytics user={user} userRole="passenger" />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
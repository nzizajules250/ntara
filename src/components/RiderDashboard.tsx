import { useState, useEffect, useRef } from 'react';
import { User as FirebaseUser } from 'firebase/auth';
import { UserProfile, subscribeToAvailableRides, subscribeToUserRides, Ride, updateRideStatus, updateUserLocation, updateDoc, doc, db, getUserProfile, RideStatus, updateDriverStatus, reverseGeocode } from '../lib/firebase';
import { MapPin, Navigation, DollarSign, CheckCircle2, Navigation2, Loader2, ArrowRight, User, Award, ShieldCheck, Star, Car, Heart, Timer, Target, Phone, X, BarChart3, FileText, Zap, Radio, Map as MapIcon, Bike } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useNotifications } from './NotificationCenter';
import { useLanguage } from '../lib/i18n';
import { arrayUnion, arrayRemove, serverTimestamp } from 'firebase/firestore';
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

const MANUAL_LOCATION_RELEASE_DISTANCE_METERS = 35;

const getDistanceInMeters = (
  start: { lat: number; lng: number },
  end: { lat: number; lng: number }
) => {
  const toRadians = (value: number) => (value * Math.PI) / 180;
  const earthRadius = 6371000;
  const dLat = toRadians(end.lat - start.lat);
  const dLng = toRadians(end.lng - start.lng);
  const startLat = toRadians(start.lat);
  const endLat = toRadians(end.lat);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(startLat) * Math.cos(endLat) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);

  return earthRadius * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

export default function RiderDashboard({ user, profile }: Props) {
  const { t } = useLanguage();
  const { addNotification } = useNotifications();
  
  // ==================== STATE DECLARATIONS ====================
  const [viewMode, setViewMode] = useState<'ride' | 'reports' | 'analytics'>('ride');
  const [availableRides, setAvailableRides] = useState<Ride[]>([]);
  const [activeRide, setActiveRide] = useState<Ride | null>(null);
  const [passengerProfile, setPassengerProfile] = useState<UserProfile | null>(null);
  const [riderLocation, setRiderLocation] = useState<{ lat: number; lng: number } | null>(profile.currentLocation || null);
  const [isPickingOnMap, setIsPickingOnMap] = useState<boolean>(false);
  const [selectedRidePreviewId, setSelectedRidePreviewId] = useState<string | null>(null);
  
  // ==================== REFS ====================
  const prevRidesCount = useRef(0);
  const lastStatusRef = useRef<string | null>(null);
  const endConfirmationSentRef = useRef<Set<string>>(new Set());
  
  // ==================== DERIVED VARIABLES ====================
  const effectiveRiderLocation = riderLocation || profile.currentLocation || null;
  const manualLocationAnchor =
    profile.locationTrackingMode === 'manual' && hasValidCoordinates(profile.manualLocationAnchor)
      ? profile.manualLocationAnchor
      : null;

  // ==================== BADGE LOGIC ====================
  const possibleBadges = [
    { id: 'Top Navigator', earned: profile.rating >= 4.8 },
    { id: 'Safe Driver', earned: profile.totalTrips >= 5 },
    { id: 'Elite Status', earned: profile.rating >= 4.9 }
  ];

  const displayBadges = [
    { title: 'Top Navigator', description: 'Exceptional navigation skills', icon: Navigation, earned: profile.rating >= 4.8 },
    { title: 'Safe Driver', description: 'Consistently high safety ratings', icon: ShieldCheck, earned: profile.totalTrips >= 5 },
    { title: 'Elite Status', description: 'Premier rider status active', icon: Award, earned: profile.rating >= 4.9 }
  ];

  // ==================== HANDLER FUNCTIONS ====================
  const handleMapClick = async ({ lat, lng }: { lat: number; lng: number }) => {
    if (!isPickingOnMap) return;
    try {
      await reverseGeocode(lat, lng);
      setRiderLocation({ lat, lng });
      await updateUserLocation(user.uid, lat, lng, { source: 'manual' });
    } catch (error) {
      console.error('Error updating location:', error);
    }
    setIsPickingOnMap(false);
  };

  const handleToggleFavorite = async (targetUserId: string) => {
    const isFavorite = profile.favoriteUserIds?.includes(targetUserId);
    try {
      await updateDoc(doc(db, 'users', user.uid), {
        favoriteUserIds: isFavorite ? arrayRemove(targetUserId) : arrayUnion(targetUserId)
      });
      addNotification(
        isFavorite ? t('favorites') : t('favorites'),
        isFavorite ? 'Passenger removed from your preferred list.' : 'Passenger added to your preferred list.',
        'info'
      );
    } catch (e) {
      console.error(e);
    }
  };

  const handleAccept = async (rideId: string) => {
    try {
      await updateDoc(doc(db, 'rides', rideId), {
        status: 'accepted',
        riderId: user.uid,
        acceptedAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
    } catch (error) {
      console.error("Failed to accept", error);
    }
  };

  const handleNextStep = async () => {
    if (!activeRide) return;
    try {
      if (activeRide.status === 'accepted') {
        await updateDoc(doc(db, 'rides', activeRide.id), {
          status: 'arrived',
          arrivedAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
      } else if (activeRide.status === 'arrived') {
        if (!activeRide.passengerConfirmedArrival || activeRide.riderConfirmedStart) return;
        await updateDoc(doc(db, 'rides', activeRide.id), {
          riderConfirmedStart: true,
          updatedAt: serverTimestamp()
        });
      } else if (activeRide.status === 'ongoing') {
        if (activeRide.riderConfirmedEnd) return;
        await updateDoc(doc(db, 'rides', activeRide.id), {
          riderConfirmedEnd: true,
          updatedAt: serverTimestamp()
        });
        if (!endConfirmationSentRef.current.has(activeRide.id)) {
          addNotification(
            'Ride Ending',
            'You have confirmed the destination. Waiting for passenger confirmation...',
            'info'
          );
          endConfirmationSentRef.current.add(activeRide.id);
        }
      }
    } catch (error) {
      console.error("Failed to update status", error);
    }
  };

  // ==================== USE EFFECTS ====================
  useEffect(() => {
    if (hasValidCoordinates(profile.currentLocation)) {
      setRiderLocation(profile.currentLocation);
    }
  }, [profile.currentLocation?.lat, profile.currentLocation?.lng]);

  useEffect(() => {
    const earnedBadgeIds = possibleBadges.filter(b => b.earned).map(b => b.id);
    const currentBadges = profile.badges || [];
    if (earnedBadgeIds.length > 0 && !earnedBadgeIds.every(id => currentBadges.includes(id))) {
      updateDoc(doc(db, 'users', user.uid), {
        badges: Array.from(new Set([...currentBadges, ...earnedBadgeIds]))
      }).catch(console.error);
    }
  }, [profile.rating, profile.totalTrips, user.uid, profile.badges]);

  useEffect(() => {
    const subAvailable = subscribeToAvailableRides((rides) => {
      let filtered = rides.filter(r => r.passengerId !== user.uid);
      if (profile.vehicleType) {
        filtered = filtered.filter(ride => !ride.vehicleType || ride.vehicleType === profile.vehicleType);
      }
      if (profile.availabilityRadius && effectiveRiderLocation) {
        filtered = filtered.filter(ride => {
          const latDiff = Math.abs(ride.pickup.lat - effectiveRiderLocation.lat);
          const lngDiff = Math.abs(ride.pickup.lng - effectiveRiderLocation.lng);
          const distance = Math.sqrt(Math.pow(latDiff, 2) + Math.pow(lngDiff, 2));
          return (distance * 111) <= profile.availabilityRadius!;
        });
      }
      if (filtered.length > prevRidesCount.current) {
        addNotification(t('newRideRequest'), t('newRideRequestMessage'), 'ride_request');
      }
      prevRidesCount.current = filtered.length;
      setAvailableRides(filtered);
    });

    const subMyRides = subscribeToUserRides(user.uid, 'rider', (rides) => {
      const active = rides.find(r => ['accepted', 'arrived', 'ongoing'].includes(r.status));
      if (active && active.status !== lastStatusRef.current) {
        if (active.status === 'arrived') {
          addNotification(
            t('riderArrivedNotify'), 
            'You have marked yourself as arrived at the pickup location.', 
            'info',
            [{ label: 'Confirm Arrival', onClick: async () => { try { await updateRideStatus(active.id, 'arrived'); } catch (err) { console.error(err); } }, style: 'primary' }]
          );
        } else if (active.status === 'ongoing') {
          addNotification(
            t('tripStartedNotify'), 
            'You have started the ride with the passenger.', 
            'info',
            [{ label: 'Trip Started', onClick: async () => { try { await updateRideStatus(active.id, 'ongoing'); } catch (err) { console.error(err); } }, style: 'primary' }]
          );
        }
        lastStatusRef.current = active.status;
      }
      const completedRides = rides.filter(r => r.status === 'completed');
      completedRides.forEach(ride => { endConfirmationSentRef.current.delete(ride.id); });
      setActiveRide(active || null);
    });

    return () => { subAvailable(); subMyRides(); };
  }, [user.uid, addNotification, profile.availabilityRadius, effectiveRiderLocation?.lat, effectiveRiderLocation?.lng, profile.vehicleType]);

  useEffect(() => {
    if (!activeRide) {
      updateDriverStatus(user.uid, 'active').catch(console.error);
    } else {
      updateDriverStatus(user.uid, 'riding').catch(console.error);
    }
  }, [activeRide, user.uid]);

  useEffect(() => {
    if (!("geolocation" in navigator)) return;
    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        const liveLocation = { lat: latitude, lng: longitude };
        if (manualLocationAnchor) {
          const distanceFromPinnedLocation = getDistanceInMeters(manualLocationAnchor, liveLocation);
          if (distanceFromPinnedLocation < MANUAL_LOCATION_RELEASE_DISTANCE_METERS) return;
        }
        setRiderLocation(liveLocation);
        updateUserLocation(user.uid, latitude, longitude, { source: 'live' }).catch(console.error);
      },
      (error) => { console.error("Error tracking location:", error); },
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 10000 }
    );
    return () => navigator.geolocation.clearWatch(watchId);
  }, [user.uid, manualLocationAnchor?.lat, manualLocationAnchor?.lng]);

  useEffect(() => {
    if (activeRide?.passengerId) {
      getUserProfile(activeRide.passengerId).then(setPassengerProfile).catch(console.error);
    } else {
      setPassengerProfile(null);
    }
  }, [activeRide?.passengerId]);

  useEffect(() => {
    if (availableRides.length === 0) {
      setSelectedRidePreviewId(null);
      return;
    }
    if (!selectedRidePreviewId || !availableRides.some((ride) => ride.id === selectedRidePreviewId)) {
      setSelectedRidePreviewId(availableRides[0].id);
    }
  }, [availableRides, selectedRidePreviewId]);

  // ==================== PREVIEW RIDE VARIABLES ====================
  const previewRide = availableRides.find((ride) => ride.id === selectedRidePreviewId) || availableRides[0] || null;
  const previewPickupLocation = previewRide && hasValidCoordinates(previewRide.pickup) ? { lat: previewRide.pickup.lat, lng: previewRide.pickup.lng } : null;
  const previewDestinationLocation = previewRide && hasValidCoordinates(previewRide.destination) ? { lat: previewRide.destination.lat, lng: previewRide.destination.lng } : null;
  
  const previewMapMarkers = [
    ...(effectiveRiderLocation && hasValidCoordinates(effectiveRiderLocation) ? [{ id: 'driver-live', position: effectiveRiderLocation, label: profile.name, type: 'rider' as const, profile }] : []),
    ...(previewPickupLocation ? [{ id: `preview-pickup-${previewRide?.id}`, position: previewPickupLocation, label: previewRide?.pickup.address || 'Pickup', type: 'passenger' as const }] : []),
    ...(previewDestinationLocation ? [{ id: `preview-destination-${previewRide?.id}`, position: previewDestinationLocation, label: previewRide?.destination.address || 'Destination', type: 'destination' as const }] : [])
  ];
  
  const previewDirectionRequests = [
    ...(effectiveRiderLocation && hasValidCoordinates(effectiveRiderLocation) && previewPickupLocation ? [{ id: `preview-driver-to-pickup-${previewRide?.id || 'route'}`, origin: effectiveRiderLocation, destination: previewPickupLocation, color: '#10b981' }] : []),
    ...(previewPickupLocation && previewDestinationLocation ? [{ id: `preview-trip-${previewRide?.id || 'route'}`, origin: previewPickupLocation, destination: previewDestinationLocation, color: '#60a5fa' }] : [])
  ];
  
  const riderPickerCenter = effectiveRiderLocation || { lat: -1.9441, lng: 30.0619 };
  const riderPickerMarkers = [
    ...(effectiveRiderLocation ? [{ id: 'rider-picker-location', position: effectiveRiderLocation, label: profile.name, type: 'rider' as const, profile }] : [])
  ];

  // ==================== ACTIVE RIDE CONDITIONAL RENDER ====================
  if (activeRide) {
    const ridePickupLocation = hasValidCoordinates(activeRide.pickup) ? { lat: activeRide.pickup.lat, lng: activeRide.pickup.lng } : null;
    const rideDestination = hasValidCoordinates(activeRide.destination) ? { lat: activeRide.destination.lat, lng: activeRide.destination.lng } : null;
    
    const rideMapMarkers = [
      ...(hasValidCoordinates(effectiveRiderLocation) ? [{ id: 'rider-live', position: effectiveRiderLocation!, label: profile.name, type: 'rider' as const, profile }] : []),
      ...(ridePickupLocation ? [{ id: 'pickup', position: ridePickupLocation, label: activeRide.pickup.address, type: 'passenger' as const }] : []),
      ...(rideDestination ? [{ id: 'destination', position: rideDestination, label: activeRide.destination.address, type: 'destination' as const }] : [])
    ];
    
    const activeRideDirectionRequests = [
      ...((activeRide.status === 'accepted' || activeRide.status === 'arrived') && hasValidCoordinates(effectiveRiderLocation) && ridePickupLocation ? [{ id: `rider-driver-to-pickup-${activeRide.id}`, origin: effectiveRiderLocation!, destination: ridePickupLocation, color: '#10b981' }] : []),
      ...((activeRide.status === 'accepted' || activeRide.status === 'arrived') && ridePickupLocation && rideDestination ? [{ id: `rider-pickup-to-destination-${activeRide.id}`, origin: ridePickupLocation, destination: rideDestination, color: '#60a5fa' }] : []),
      ...(activeRide.status === 'ongoing' && hasValidCoordinates(effectiveRiderLocation) && rideDestination ? [{ id: `rider-live-trip-${activeRide.id}`, origin: effectiveRiderLocation!, destination: rideDestination, color: '#8b5cf6' }] : [])
    ];

    const rideMapCenter = effectiveRiderLocation || (activeRide.status === 'ongoing' && hasValidCoordinates(activeRide.destination) ? { lat: activeRide.destination.lat, lng: activeRide.destination.lng } : hasValidCoordinates(activeRide.pickup) ? { lat: activeRide.pickup.lat, lng: activeRide.pickup.lng } : undefined);

    const riderActionDisabled = (activeRide.status === 'arrived' && (!activeRide.passengerConfirmedArrival || !!activeRide.riderConfirmedStart)) || (activeRide.status === 'ongoing' && !!activeRide.riderConfirmedEnd);

    const riderActionLabel = activeRide.status === 'accepted' ? t('arrivedButton') : activeRide.status === 'arrived' ? activeRide.passengerConfirmedArrival ? (activeRide.riderConfirmedStart ? t('waitingForPassenger') : t('startTripButton')) : 'Waiting for passenger confirmation' : (activeRide.riderConfirmedEnd ? t('waitingForPassenger') : t('completeRideButton'));

    const riderActionHint = activeRide.status === 'accepted' ? 'Mark arrival once you reach the pickup point.' : activeRide.status === 'arrived' ? activeRide.passengerConfirmedArrival ? (activeRide.riderConfirmedStart ? 'Start request sent. Waiting for the passenger to approve the trip start.' : 'Passenger confirmed your arrival. Start the trip when you are both ready.') : 'The passenger needs to confirm your arrival before you can start the trip.' : activeRide.riderConfirmedEnd ? 'Arrival notice sent. Waiting for the passenger to confirm the trip has ended.' : 'Signal the passenger once you reach the destination.';

    return (
      <div className="space-y-6">
        {/* Gradient Header */}
        <div className="relative overflow-hidden bg-gradient-to-br from-emerald-600 via-teal-600 to-cyan-700 dark:from-emerald-900 dark:via-teal-900 dark:to-cyan-950 rounded-[3rem] p-6 shadow-2xl shadow-emerald-500/20">
          <div className="absolute inset-0 opacity-20">
            <div className="absolute top-0 right-0 w-48 h-48 bg-white rounded-full -translate-y-1/2 translate-x-1/2 blur-3xl" />
            <div className="absolute bottom-0 left-0 w-32 h-32 bg-white rounded-full translate-y-1/2 -translate-x-1/2 blur-3xl" />
          </div>
          <div className="relative z-10 flex items-center justify-between">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-white/20 backdrop-blur-sm rounded-full mb-3">
                <div className="w-2 h-2 rounded-full bg-emerald-300" />
                <span className="text-[10px] font-black text-white uppercase tracking-wider">{t(activeRide.status as any)}</span>
              </div>
              <h2 className="text-2xl font-black text-white mb-1">
                {activeRide.status === 'accepted' ? t('headingToPickup') : activeRide.status === 'arrived' ? t('waitingAtPickup') : t('headingToDestination')}
              </h2>
              {passengerProfile && (
                <p className="text-white/70 font-semibold text-sm">{t('passenger')}: <span className="text-white font-bold">{passengerProfile.name}</span></p>
              )}
            </div>
            <div className="w-12 h-12 bg-white/20 backdrop-blur-sm rounded-2xl flex items-center justify-center">
              <Navigation2 className="w-6 h-6 text-white" />
            </div>
          </div>
        </div>
        
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-white dark:bg-zinc-900 rounded-[2.5rem] shadow-xl border border-gray-100 dark:border-zinc-800 overflow-hidden"
        >
          {rideMapMarkers.length > 0 ? (
            <MapComponent markers={rideMapMarkers} center={rideMapCenter} zoom={15} showNearbyDrivers={false} height="240px" directionRequests={activeRideDirectionRequests} freezeViewport={true} />
          ) : (
            <div className="p-6">
              <div className="rounded-2xl bg-gray-50 dark:bg-zinc-800 p-4 text-sm text-gray-500 dark:text-zinc-400 text-center font-semibold">Map data loading...</div>
            </div>
          )}

          <div className="p-6 space-y-5">
            {passengerProfile && (
              <div className="flex items-center justify-between p-4 bg-gradient-to-r from-gray-50 to-gray-100 dark:from-zinc-800 dark:to-zinc-800/50 rounded-[2rem] border border-gray-100 dark:border-zinc-700">
                <div className="flex items-center gap-3">
                  {passengerProfile.avatarUrl ? (
                    <img src={passengerProfile.avatarUrl} className="w-12 h-12 rounded-2xl ring-2 ring-white dark:ring-zinc-700 shadow-lg object-cover" alt="" />
                  ) : (
                    <div className="w-12 h-12 bg-gradient-to-br from-blue-400 to-cyan-600 rounded-2xl flex items-center justify-center shadow-lg">
                      <User className="w-6 h-6 text-white" />
                    </div>
                  )}
                  <div>
                    <p className="font-bold text-gray-900 dark:text-white">{passengerProfile.name}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <div className="flex items-center gap-1 bg-amber-50 dark:bg-amber-500/10 px-2 py-0.5 rounded-lg">
                        <Star className="w-3 h-3 text-amber-400 fill-current" />
                        <span className="text-xs font-bold text-amber-600 dark:text-amber-400">{passengerProfile.rating}</span>
                      </div>
                      <span className="text-xs text-gray-400 dark:text-zinc-500 font-semibold">{passengerProfile.totalTrips} trips</span>
                    </div>
                  </div>
                </div>
                <div className="flex gap-2">
                  <motion.button whileTap={{ scale: 0.9 }} onClick={() => handleToggleFavorite(passengerProfile.uid)} className={`p-2.5 rounded-xl transition-all ${profile.favoriteUserIds?.includes(passengerProfile.uid) ? 'bg-red-50 dark:bg-red-500/10 text-red-500' : 'bg-white dark:bg-zinc-700 text-gray-400 hover:bg-red-50 dark:hover:bg-red-500/10 hover:text-red-500'}`}>
                    <Heart className={`w-5 h-5 ${profile.favoriteUserIds?.includes(passengerProfile.uid) ? 'fill-current' : ''}`} />
                  </motion.button>
                  <motion.a whileTap={{ scale: 0.9 }} href={`tel:${passengerProfile.phoneNumber}`} className="p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-500/20 transition-all">
                    <Phone className="w-5 h-5" />
                  </motion.a>
                </div>
              </div>
            )}

            <div className="space-y-3">
              <div className="flex items-start gap-3 p-3 rounded-2xl hover:bg-gray-50 dark:hover:bg-zinc-800/50 transition-colors">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5 ${activeRide.status === 'accepted' ? 'bg-emerald-100 dark:bg-emerald-500/10' : 'bg-gray-100 dark:bg-zinc-800'}`}>
                  <MapPin className={`w-5 h-5 ${activeRide.status === 'accepted' ? 'text-emerald-600' : 'text-gray-400'}`} />
                </div>
                <div>
                  <p className="text-[10px] font-bold text-gray-400 dark:text-zinc-500 uppercase tracking-wider mb-0.5">Pickup</p>
                  <p className="text-sm font-bold text-gray-900 dark:text-white leading-snug">{activeRide.pickup.address}</p>
                </div>
              </div>
              <div className="flex items-start gap-3 p-3 rounded-2xl hover:bg-gray-50 dark:hover:bg-zinc-800/50 transition-colors">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5 ${activeRide.status === 'ongoing' ? 'bg-blue-100 dark:bg-blue-500/10' : 'bg-gray-100 dark:bg-zinc-800'}`}>
                  <Navigation className={`w-5 h-5 ${activeRide.status === 'ongoing' ? 'text-blue-600' : 'text-gray-400'}`} />
                </div>
                <div>
                  <p className="text-[10px] font-bold text-gray-400 dark:text-zinc-500 uppercase tracking-wider mb-0.5">Destination</p>
                  <p className="text-sm font-bold text-gray-900 dark:text-white leading-snug">{activeRide.destination.address}</p>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-zinc-800 rounded-2xl">
              <div>
                <p className="text-[10px] font-bold text-gray-400 dark:text-zinc-500 uppercase tracking-wider mb-0.5">Fare</p>
                <p className="text-lg font-black text-emerald-600 dark:text-emerald-400">{t('byAgreement')}</p>
              </div>
              <div className="w-10 h-10 bg-emerald-100 dark:bg-emerald-500/10 rounded-xl flex items-center justify-center">
                <DollarSign className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
              </div>
            </div>

            <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} onClick={handleNextStep} disabled={riderActionDisabled} className="w-full bg-gradient-to-r from-emerald-500 to-teal-600 text-white py-5 rounded-2xl font-bold text-lg flex items-center justify-center gap-3 hover:from-emerald-600 hover:to-teal-700 disabled:opacity-50 disabled:cursor-not-allowed shadow-xl shadow-emerald-500/25 transition-all">
              {riderActionLabel}
              <ArrowRight className="w-5 h-5" />
            </motion.button>

            <div className="p-4 bg-amber-50 dark:bg-amber-500/10 rounded-2xl border border-amber-100 dark:border-amber-500/20">
              <div className="flex items-start gap-2">
                <Timer className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-amber-700 dark:text-amber-300 font-semibold">{riderActionHint}</p>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    );
  }

  // ==================== DEFAULT VIEW ====================
  return (
    <div className="space-y-6">
      {/* Profile Card */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden bg-gradient-to-br from-violet-600 via-purple-600 to-indigo-700 dark:from-violet-900 dark:via-purple-900 dark:to-indigo-950 rounded-[3rem] p-6 shadow-2xl shadow-purple-500/20"
      >
        <div className="absolute inset-0 opacity-20">
          <div className="absolute top-0 right-0 w-48 h-48 bg-white rounded-full -translate-y-1/2 translate-x-1/2 blur-3xl" />
          <div className="absolute bottom-0 left-0 w-32 h-32 bg-white rounded-full translate-y-1/2 -translate-x-1/2 blur-3xl" />
        </div>
        <div className="relative z-10 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="relative">
              {profile.avatarUrl ? (
                <img src={profile.avatarUrl} className="w-16 h-16 rounded-2xl ring-2 ring-white/30 shadow-xl object-cover" alt="" />
              ) : (
                <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center ring-2 ring-white/30">
                  <User className="w-8 h-8 text-white/60" />
                </div>
              )}
              <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-emerald-500 rounded-lg flex items-center justify-center ring-2 ring-white">
                <ShieldCheck className="w-3 h-3 text-white" />
              </div>
            </div>
            <div>
              <h2 className="text-2xl font-black text-white">{profile.name}</h2>
              {profile.vehicleModel ? (
                <p className="text-xs font-bold text-white/60 uppercase tracking-wider flex items-center gap-2 mt-0.5">
                  {profile.vehicleType === 'car' ? <Car className="w-3 h-3" /> : <Bike className="w-3 h-3" />}
                  {profile.vehicleModel} • {profile.numberPlate}
                </p>
              ) : (
                <p className="text-xs font-bold text-white/60 uppercase tracking-wider mt-0.5">{profile.role}</p>
              )}
            </div>
          </div>
          <motion.button 
            whileTap={{ scale: 0.95 }}
            onClick={() => updateDoc(doc(db, 'users', user.uid), { isOnline: !profile.isOnline }).catch(console.error)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl font-bold text-sm transition-all ${profile.isOnline ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/30' : 'bg-white/20 text-white/60 hover:bg-white/30'}`}
          >
            <Radio className="w-4 h-4" />
            <span className="uppercase tracking-wider text-xs">{profile.isOnline ? t('available') : t('unavailable')}</span>
          </motion.button>
        </div>
        <div className="relative z-10 flex gap-3 mt-5">
          <div className="flex items-center gap-2 bg-white/10 backdrop-blur-sm px-3 py-1.5 rounded-xl">
            <Star className="w-4 h-4 text-amber-400 fill-current" />
            <span className="text-white font-bold text-sm">{profile.rating}</span>
          </div>
          <div className="flex items-center gap-2 bg-white/10 backdrop-blur-sm px-3 py-1.5 rounded-xl">
            <Award className="w-4 h-4 text-emerald-400" />
            <span className="text-white font-bold text-sm">{profile.totalTrips} trips</span>
          </div>
        </div>
      </motion.div>

      {/* Tab Navigation */}
      <div className="flex gap-2 p-1.5 bg-gray-100 dark:bg-zinc-800 rounded-2xl">
        {[
          { key: 'ride' as const, label: 'Rides', icon: Navigation },
          { key: 'reports' as const, label: 'Reports', icon: FileText },
          { key: 'analytics' as const, label: 'Analytics', icon: BarChart3 }
        ].map((tab) => (
          <motion.button
            key={tab.key}
            whileTap={{ scale: 0.95 }}
            onClick={() => setViewMode(tab.key)}
            className={`flex-1 py-3 px-4 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all ${viewMode === tab.key ? 'bg-white dark:bg-zinc-700 text-gray-900 dark:text-white shadow-lg' : 'text-gray-500 dark:text-zinc-400 hover:text-gray-700 dark:hover:text-zinc-300'}`}
          >
            <tab.icon className="w-4 h-4" />
            <span className="hidden sm:inline">{tab.label}</span>
          </motion.button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        {viewMode === 'ride' && (
          <motion.div key="ride-view" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="space-y-6">
            {/* Availability Radius */}
            <div className="bg-white dark:bg-zinc-900 rounded-[2.5rem] p-6 shadow-sm border border-gray-100 dark:border-zinc-800">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-emerald-100 dark:bg-emerald-500/10 rounded-2xl flex items-center justify-center">
                    <Target className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                  </div>
                  <div>
                    <h3 className="font-black text-gray-900 dark:text-white">Availability Radius</h3>
                    <p className="text-xs text-gray-400 dark:text-zinc-500 font-semibold">{t('availabilityRadiusDescription')}</p>
                  </div>
                </div>
                <span className="bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 px-4 py-2 rounded-xl font-black text-sm">{profile.availabilityRadius || 10} km</span>
              </div>
              <input type="range" min="1" max="50" step="1" value={profile.availabilityRadius || 10} onChange={(e) => updateDoc(doc(db, 'users', user.uid), { availabilityRadius: parseInt(e.target.value) })} className="w-full h-2 bg-gray-200 dark:bg-zinc-700 rounded-full appearance-none cursor-pointer accent-emerald-500" />
              <div className="flex justify-between text-[10px] font-bold text-gray-400 dark:text-zinc-500 mt-2 px-1">
                <span>1 KM</span><span>25 KM</span><span>50 KM</span>
              </div>
            </div>

            {/* Map Preview */}
            {!activeRide && effectiveRiderLocation && hasValidCoordinates(effectiveRiderLocation) && (
              <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="bg-white dark:bg-zinc-900 rounded-[2.5rem] shadow-sm border border-gray-100 dark:border-zinc-800 overflow-hidden">
                <MapComponent markers={previewMapMarkers} directionRequests={previewDirectionRequests} center={previewPickupLocation || effectiveRiderLocation} zoom={14} showNearbyDrivers={false} height="240px" autoFit={!!previewRide} />
                <div className="p-4 flex items-center justify-between bg-gradient-to-r from-gray-50 to-white dark:from-zinc-800 dark:to-zinc-900">
                  <div>
                    <p className="font-bold text-sm text-gray-900 dark:text-white">{previewRide ? 'Route Preview' : 'Your Location'}</p>
                    <p className="text-xs text-gray-400 dark:text-zinc-500 font-semibold mt-0.5">{previewRide ? `${previewRide.pickup.address} → ${previewRide.destination.address}` : 'Visible to nearby passengers'}</p>
                  </div>
                  <motion.button whileTap={{ scale: 0.95 }} onClick={() => setIsPickingOnMap(!isPickingOnMap)} className={`px-4 py-2.5 rounded-xl font-bold text-sm transition-all flex items-center gap-2 ${isPickingOnMap ? 'bg-red-500 text-white' : 'bg-gray-200 dark:bg-zinc-700 text-gray-700 dark:text-zinc-300 hover:bg-gray-300 dark:hover:bg-zinc-600'}`}>
                    <MapIcon className="w-4 h-4" />{isPickingOnMap ? 'Cancel' : 'Update Location'}
                  </motion.button>
                </div>
              </motion.div>
            )}

            {/* Map Picker */}
            {isPickingOnMap && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="rounded-[2rem] overflow-hidden border-2 border-emerald-500 dark:border-emerald-400 shadow-2xl">
                <div className="relative">
                  <div className="absolute top-4 left-4 right-16 z-10 bg-black/80 backdrop-blur-sm rounded-2xl px-4 py-3 text-white shadow-xl">
                    <p className="font-bold text-xs uppercase tracking-wider">Tap map to set your location</p>
                    {riderLocation && <p className="mt-1 text-xs text-emerald-300 font-semibold">{riderLocation.lat.toFixed(5)}, {riderLocation.lng.toFixed(5)}</p>}
                  </div>
                  <MapComponent center={riderPickerCenter} zoom={15} markers={riderPickerMarkers} onMapClick={handleMapClick} height="320px" showNearbyDrivers={false} />
                  <button onClick={() => setIsPickingOnMap(false)} className="absolute top-4 right-4 bg-white/90 backdrop-blur-sm p-2.5 rounded-xl shadow-lg hover:bg-white transition-all z-10"><X className="w-5 h-5 text-gray-700" /></button>
                </div>
              </motion.div>
            )}

            {/* Available Rides */}
            <div>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-purple-100 dark:bg-purple-500/10 rounded-2xl flex items-center justify-center"><Zap className="w-5 h-5 text-purple-600 dark:text-purple-400" /></div>
                <div>
                  <h2 className="font-black text-gray-900 dark:text-white text-lg">{t('availableJobs')}</h2>
                  <p className="text-xs text-gray-400 dark:text-zinc-500 font-semibold">{availableRides.length} request{availableRides.length !== 1 ? 's' : ''} nearby</p>
                </div>
              </div>
            </div>

            <AnimatePresence mode="popLayout">
              {availableRides.length === 0 ? (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="bg-white dark:bg-zinc-900 p-12 rounded-[2.5rem] border-2 border-dashed border-gray-200 dark:border-zinc-800 text-center">
                  <div className="w-20 h-20 bg-gradient-to-br from-gray-100 to-gray-200 dark:from-zinc-800 dark:to-zinc-700 rounded-[2rem] flex items-center justify-center mx-auto mb-6 shadow-lg">
                    <Loader2 className="w-10 h-10 text-gray-400 dark:text-zinc-500 animate-spin" />
                  </div>
                  <p className="text-lg font-bold text-gray-900 dark:text-white">{t('waitingForRequests')}</p>
                  <p className="text-sm text-gray-500 dark:text-zinc-400 mt-1">{t('freshRidesAppear')}</p>
                </motion.div>
              ) : (
                <div className="grid gap-3">
                  {availableRides.map((ride) => (
                    <motion.div key={ride.id} layout initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.9 }} onClick={() => setSelectedRidePreviewId(ride.id)} onMouseEnter={() => setSelectedRidePreviewId(ride.id)} className={`bg-white dark:bg-zinc-900 p-5 rounded-[2rem] border shadow-sm transition-all cursor-pointer group ${selectedRidePreviewId === ride.id ? 'border-purple-300 dark:border-purple-700 ring-2 ring-purple-500/10 shadow-lg' : 'border-gray-100 dark:border-zinc-800 hover:border-purple-200 dark:hover:border-purple-700 hover:shadow-md'}`}>
                      <div className="flex justify-between items-start mb-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-gradient-to-br from-blue-400 to-cyan-600 rounded-2xl flex items-center justify-center shadow-lg"><User className="w-5 h-5 text-white" /></div>
                          <div>
                            <p className="font-bold text-gray-900 dark:text-white">{t('passengerRequest')}</p>
                            <p className="text-xs text-gray-400 dark:text-zinc-500 font-semibold">~ 2.4 km away</p>
                          </div>
                        </div>
                        <div className="bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 px-3 py-1.5 rounded-xl font-black text-xs">{t('byAgreement')}</div>
                      </div>
                      <div className="space-y-3 mb-4">
                        <div className="flex items-start gap-3">
                          <div className="w-8 h-8 bg-green-100 dark:bg-green-500/10 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5"><MapPin className="w-4 h-4 text-green-600" /></div>
                          <div>
                            <p className="text-[10px] font-bold text-gray-400 dark:text-zinc-500 uppercase tracking-wider mb-0.5">From</p>
                            <p className="text-sm font-semibold text-gray-700 dark:text-zinc-300">{ride.pickup.address}</p>
                          </div>
                        </div>
                        <div className="flex items-start gap-3">
                          <div className="w-8 h-8 bg-red-100 dark:bg-red-500/10 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5"><Navigation className="w-4 h-4 text-red-600" /></div>
                          <div>
                            <p className="text-[10px] font-bold text-gray-400 dark:text-zinc-500 uppercase tracking-wider mb-0.5">To</p>
                            <p className="text-sm font-semibold text-gray-700 dark:text-zinc-300">{ride.destination.address}</p>
                          </div>
                        </div>
                      </div>
                      <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} onClick={(e) => { e.stopPropagation(); handleAccept(ride.id); }} className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 text-white py-4 rounded-2xl font-bold flex items-center justify-center gap-3 hover:from-purple-700 hover:to-indigo-700 shadow-xl shadow-purple-500/25 transition-all">
                        {t('acceptRide')}<ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                      </motion.button>
                    </motion.div>
                  ))}
                </div>
              )}
            </AnimatePresence>

            {/* Badges */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-black text-gray-400 dark:text-zinc-500 uppercase tracking-wider">{t('achievements')}</h3>
                <div className="flex items-center gap-1 text-amber-500 font-bold text-sm"><Star className="w-4 h-4 fill-current" />{profile.rating}</div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {displayBadges.map((badge, i) => (
                  <motion.div key={i} initial={{ opacity: 0, y: 10 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.1 }} whileHover={{ y: -4 }} className={`p-5 rounded-[2rem] border-2 transition-all ${badge.earned ? 'bg-white dark:bg-zinc-900 border-emerald-200 dark:border-emerald-500/20 shadow-lg hover:shadow-xl' : 'bg-gray-50 dark:bg-zinc-800/50 border-gray-200 dark:border-zinc-700 opacity-60 grayscale'}`}>
                    <div className={`w-10 h-10 rounded-2xl flex items-center justify-center mb-3 shadow-lg ${badge.earned ? 'bg-gradient-to-br from-emerald-400 to-emerald-600 text-white' : 'bg-gray-200 dark:bg-zinc-700 text-gray-400 dark:text-zinc-500'}`}><badge.icon className="w-5 h-5" /></div>
                    <h4 className="font-black text-sm mb-1 text-gray-900 dark:text-white">{badge.title}</h4>
                    <p className="text-[10px] text-gray-500 dark:text-zinc-400 font-semibold leading-relaxed">{badge.description}</p>
                    {badge.earned && <div className="mt-3 flex items-center gap-1.5 text-[9px] font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-wider"><CheckCircle2 className="w-3 h-3" />Earned</div>}
                  </motion.div>
                ))}
              </div>
            </div>
          </motion.div>
        )}

        {viewMode === 'reports' && (
          <motion.div key="reports-view" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
            <TripReport user={user} userRole="rider" />
          </motion.div>
        )}

        {viewMode === 'analytics' && (
          <motion.div key="analytics-view" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
            <TripAnalytics user={user} userRole="rider" />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
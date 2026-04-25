import { useState, useEffect, useRef } from 'react';
import { User as FirebaseUser } from 'firebase/auth';
import { UserProfile, subscribeToAvailableRides, subscribeToUserRides, Ride, updateRideStatus, updateUserLocation, updateDoc, doc, db, getUserProfile, RideStatus, updateDriverStatus, reverseGeocode } from '../lib/firebase';
import { MapPin, Navigation, DollarSign, CheckCircle2, Navigation2, Loader2, ArrowRight, User, Award, ShieldCheck, Star, Car, Heart, Timer, Target, Phone, X, BarChart3, FileText } from 'lucide-react';
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
  const [viewMode, setViewMode] = useState<'ride' | 'reports' | 'analytics'>('ride');
  const [availableRides, setAvailableRides] = useState<Ride[]>([]);
  const [activeRide, setActiveRide] = useState<Ride | null>(null);
  const [passengerProfile, setPassengerProfile] = useState<UserProfile | null>(null);
  const [riderLocation, setRiderLocation] = useState<{ lat: number; lng: number } | null>(profile.currentLocation || null);
  const [isPickingOnMap, setIsPickingOnMap] = useState<boolean>(false);
  const [selectedRidePreviewId, setSelectedRidePreviewId] = useState<string | null>(null);
  const prevRidesCount = useRef(0);
  const lastStatusRef = useRef<string | null>(null);
  const endConfirmationSentRef = useRef<Set<string>>(new Set());
  const effectiveRiderLocation = riderLocation || profile.currentLocation || null;
  const manualLocationAnchor =
    profile.locationTrackingMode === 'manual' && hasValidCoordinates(profile.manualLocationAnchor)
      ? profile.manualLocationAnchor
      : null;

  const possibleBadges = [
    { id: 'Top Navigator', earned: profile.rating >= 4.8 },
    { id: 'Safe Driver', earned: profile.totalTrips >= 5 },
    { id: 'Elite Status', earned: profile.rating >= 4.9 }
  ];

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

  const displayBadges = [
    { title: 'Top Navigator', description: 'Exceptional navigation skills', icon: Navigation, earned: profile.rating >= 4.8 },
    { title: 'Safe Driver', description: 'Consistently high safety ratings', icon: ShieldCheck, earned: profile.totalTrips >= 5 },
    { title: 'Elite Status', description: 'Premier rider status active', icon: Award, earned: profile.rating >= 4.9 }
  ];

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
            [{
              label: 'Confirm Arrival',
              onClick: async () => {
                try {
                  await updateRideStatus(active.id, 'arrived');
                } catch (err) {
                  console.error('Error confirming arrival:', err);
                }
              },
              style: 'primary'
            }]
          );
        } else if (active.status === 'ongoing') {
          addNotification(
            t('tripStartedNotify'), 
            'You have started the ride with the passenger.', 
            'info',
            [{
              label: 'Trip Started',
              onClick: async () => {
                try {
                  await updateRideStatus(active.id, 'ongoing');
                } catch (err) {
                  console.error('Error confirming trip start:', err);
                }
              },
              style: 'primary'
            }]
          );
        }
        lastStatusRef.current = active.status;
      }
      
      const completedRides = rides.filter(r => r.status === 'completed');
      completedRides.forEach(ride => {
        endConfirmationSentRef.current.delete(ride.id);
      });
      
      setActiveRide(active || null);
    });

    return () => {
      subAvailable();
      subMyRides();
    };
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

          if (distanceFromPinnedLocation < MANUAL_LOCATION_RELEASE_DISTANCE_METERS) {
            return;
          }
        }

        setRiderLocation(liveLocation);
        updateUserLocation(user.uid, latitude, longitude, { source: 'live' }).catch(console.error);
      },
      (error) => {
        console.error("Error tracking location:", error);
      },
      {
        enableHighAccuracy: true,
        maximumAge: 5000,
        timeout: 10000
      }
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

  if (activeRide) {
    const ridePickupLocation =
      hasValidCoordinates(activeRide.pickup)
        ? { lat: activeRide.pickup.lat, lng: activeRide.pickup.lng }
        : null;
    const rideDestination =
      hasValidCoordinates(activeRide.destination)
        ? { lat: activeRide.destination.lat, lng: activeRide.destination.lng }
        : null;
    const rideMapMarkers = [
      ...(hasValidCoordinates(effectiveRiderLocation) ? [{
        id: 'rider-live',
        position: effectiveRiderLocation!,
        label: profile.name,
        type: 'rider' as const,
        profile
      }] : []),
      ...(ridePickupLocation ? [{
        id: 'pickup',
        position: ridePickupLocation,
        label: activeRide.pickup.address,
        type: 'passenger' as const
      }] : []),
      ...(rideDestination ? [{
        id: 'destination',
        position: rideDestination,
        label: activeRide.destination.address,
        type: 'destination' as const
      }] : [])
    ];
    const activeRideDirectionRequests = [
      ...((activeRide.status === 'accepted' || activeRide.status === 'arrived') &&
      hasValidCoordinates(effectiveRiderLocation) &&
      ridePickupLocation
        ? [{
            id: `rider-driver-to-pickup-${activeRide.id}`,
            origin: effectiveRiderLocation!,
            destination: ridePickupLocation,
            color: '#f97316'
          }]
        : []),
      ...((activeRide.status === 'accepted' || activeRide.status === 'arrived') &&
      ridePickupLocation &&
      rideDestination
        ? [{
            id: `rider-pickup-to-destination-${activeRide.id}`,
            origin: ridePickupLocation,
            destination: rideDestination,
            color: '#f97316'
          }]
        : []),
      ...(activeRide.status === 'ongoing' &&
      hasValidCoordinates(effectiveRiderLocation) &&
      rideDestination
        ? [{
            id: `rider-live-trip-${activeRide.id}`,
            origin: effectiveRiderLocation!,
            destination: rideDestination,
            color: '#f97316'
          }]
        : [])
    ];

    const rideMapCenter =
      effectiveRiderLocation ||
      (activeRide.status === 'ongoing' && hasValidCoordinates(activeRide.destination)
        ? { lat: activeRide.destination.lat, lng: activeRide.destination.lng }
        : hasValidCoordinates(activeRide.pickup)
          ? { lat: activeRide.pickup.lat, lng: activeRide.pickup.lng }
          : undefined);

    const riderActionDisabled =
      (activeRide.status === 'arrived' && (!activeRide.passengerConfirmedArrival || !!activeRide.riderConfirmedStart)) ||
      (activeRide.status === 'ongoing' && !!activeRide.riderConfirmedEnd);

    const riderActionLabel =
      activeRide.status === 'accepted'
        ? t('arrivedButton')
        : activeRide.status === 'arrived'
          ? activeRide.passengerConfirmedArrival
            ? (activeRide.riderConfirmedStart ? t('waitingForPassenger') : t('startTripButton'))
            : 'Waiting for passenger confirmation'
          : (activeRide.riderConfirmedEnd ? t('waitingForPassenger') : t('completeRideButton'));

    const riderActionHint =
      activeRide.status === 'accepted'
        ? 'Mark arrival once you reach the pickup point.'
        : activeRide.status === 'arrived'
          ? activeRide.passengerConfirmedArrival
            ? (activeRide.riderConfirmedStart
              ? 'Start request sent. Waiting for the passenger to approve the trip start.'
              : 'Passenger confirmed your arrival. Start the trip when you are both ready.')
            : 'The passenger needs to confirm your arrival before you can start the trip.'
          : activeRide.riderConfirmedEnd
            ? 'Arrival notice sent. Waiting for the passenger to confirm the trip has ended.'
            : 'Signal the passenger once you reach the destination.';

    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white">{t('activeDuty')}</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">You're on an active ride</p>
        </div>
        
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-white/90 dark:bg-gray-900/90 backdrop-blur-sm rounded-3xl shadow-lg overflow-hidden border border-gray-100 dark:border-gray-800"
        >
          {rideMapMarkers.length > 0 ? (
            <div className="p-3 sm:p-4">
              <MapComponent
                markers={rideMapMarkers}
                center={rideMapCenter}
                zoom={15}
                showNearbyDrivers={false}
                height="240px"
                directionRequests={activeRideDirectionRequests}
                freezeViewport={true}
              />
            </div>
          ) : (
            <div className="px-8 pt-8">
              <div className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
                The map will appear once pickup or rider location data is available.
              </div>
            </div>
          )}

          <div className="relative z-10 p-6 space-y-6">
            <div className="flex justify-between items-start">
              <div className="flex-1">
                <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-orange-50 dark:bg-orange-500/10 rounded-full mb-3">
                  <div className={`w-1.5 h-1.5 rounded-full ${
                    activeRide.status === 'accepted' ? 'bg-orange-400 animate-pulse' : 'bg-emerald-400'
                  }`} />
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-orange-600 dark:text-orange-400">
                    {t(activeRide.status as any)}
                  </span>
                </div>
                <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
                  {activeRide.status === 'accepted' ? t('headingToPickup') : 
                   activeRide.status === 'arrived' ? t('waitingAtPickup') : 
                   t('headingToDestination')}
                </h3>
                {passengerProfile && (
                  <div className="flex items-center gap-2 mt-2">
                    <div className="flex items-center gap-2">
                      <button 
                        onClick={() => handleToggleFavorite(passengerProfile.uid)}
                        className={`p-2 rounded-xl transition-all active:scale-95 ${
                          profile.favoriteUserIds?.includes(passengerProfile.uid) 
                            ? 'bg-red-50 dark:bg-red-500/20 text-red-500' 
                            : 'bg-gray-100 dark:bg-gray-800 text-gray-400'
                        }`}
                      >
                        <Heart className={`w-4 h-4 ${profile.favoriteUserIds?.includes(passengerProfile.uid) ? 'fill-current' : ''}`} />
                      </button>
                      <a 
                        href={`tel:${passengerProfile.phoneNumber}`}
                        className="p-2 rounded-xl transition-all active:scale-95 bg-emerald-50 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400"
                      >
                        <Phone className="w-4 h-4" />
                      </a>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                        Passenger: <span className="font-semibold text-gray-900 dark:text-white">{passengerProfile.name}</span>
                      </p>
                    </div>
                  </div>
                )}
              </div>
              <div className="text-right">
                <p className="text-[10px] text-gray-500 dark:text-gray-400 font-semibold uppercase tracking-wider mb-1">{t('fareToBeNegotiated')}</p>
                <p className="text-lg font-bold text-emerald-600 dark:text-emerald-400">{t('byAgreement')}</p>
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                  activeRide.status === 'accepted' 
                    ? 'bg-orange-100 dark:bg-orange-500/20 text-orange-600' 
                    : 'bg-gray-100 dark:bg-gray-800 text-gray-400'
                }`}>
                  <MapPin className="w-4 h-4" />
                </div>
                <div className="flex-1">
                  <p className="text-[10px] text-gray-500 dark:text-gray-400 font-semibold uppercase tracking-wider mb-0.5">{t('pickupLocation')}</p>
                  <p className="font-medium text-sm text-gray-900 dark:text-white">{activeRide.pickup.address}</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                  activeRide.status === 'ongoing' 
                    ? 'bg-orange-100 dark:bg-orange-500/20 text-orange-600' 
                    : 'bg-gray-100 dark:bg-gray-800 text-gray-400'
                }`}>
                  <Navigation className="w-4 h-4" />
                </div>
                <div className="flex-1">
                  <p className="text-[10px] text-gray-500 dark:text-gray-400 font-semibold uppercase tracking-wider mb-0.5">{t('destinationAddress')}</p>
                  <p className="font-medium text-sm text-gray-900 dark:text-white">{activeRide.destination.address}</p>
                </div>
              </div>
            </div>

            <button 
              onClick={handleNextStep}
              disabled={riderActionDisabled}
              className="w-full bg-orange-500 text-white py-4 rounded-xl font-semibold flex items-center justify-center gap-2 hover:bg-orange-600 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-orange-500/25"
            >
              {riderActionLabel}
              <ArrowRight className="w-5 h-5" />
            </button>

            <div className="rounded-xl bg-gray-50 dark:bg-gray-800/50 px-4 py-3 text-sm text-gray-600 dark:text-gray-400 border border-gray-100 dark:border-gray-800">
              {riderActionHint}
            </div>

            {activeRide.status === 'accepted' && (
              <div className="flex justify-center">
                <p className="text-[10px] text-gray-500 dark:text-gray-400 font-semibold uppercase tracking-wider flex items-center gap-2">
                  <Timer className="w-3 h-3" />
                  {t('beOnTime')}
                </p>
              </div>
            )}
          </div>
        </motion.div>
      </div>
    );
  }

  const previewRide = availableRides.find((ride) => ride.id === selectedRidePreviewId) || availableRides[0] || null;
  const previewPickupLocation =
    previewRide && hasValidCoordinates(previewRide.pickup)
      ? { lat: previewRide.pickup.lat, lng: previewRide.pickup.lng }
      : null;
  const previewDestinationLocation =
    previewRide && hasValidCoordinates(previewRide.destination)
      ? { lat: previewRide.destination.lat, lng: previewRide.destination.lng }
      : null;
  const previewMapMarkers = [
    ...(effectiveRiderLocation && hasValidCoordinates(effectiveRiderLocation) ? [{
      id: 'driver-live',
      position: effectiveRiderLocation,
      label: profile.name,
      type: 'rider' as const,
      profile
    }] : []),
    ...(previewPickupLocation ? [{
      id: `preview-pickup-${previewRide?.id}`,
      position: previewPickupLocation,
      label: previewRide?.pickup.address || 'Pickup',
      type: 'passenger' as const
    }] : []),
    ...(previewDestinationLocation ? [{
      id: `preview-destination-${previewRide?.id}`,
      position: previewDestinationLocation,
      label: previewRide?.destination.address || 'Destination',
      type: 'destination' as const
    }] : [])
  ];
  const previewDirectionRequests = [
    ...(effectiveRiderLocation && hasValidCoordinates(effectiveRiderLocation) && previewPickupLocation
      ? [{
          id: `preview-driver-to-pickup-${previewRide?.id || 'route'}`,
          origin: effectiveRiderLocation,
          destination: previewPickupLocation,
          color: '#f97316'
        }]
      : []),
    ...(previewPickupLocation && previewDestinationLocation
      ? [{
          id: `preview-trip-${previewRide?.id || 'route'}`,
          origin: previewPickupLocation,
          destination: previewDestinationLocation,
          color: '#f97316'
        }]
      : [])
  ];
  const riderPickerCenter = effectiveRiderLocation || { lat: -1.9441, lng: 30.0619 };
  const riderPickerMarkers = [
    ...(effectiveRiderLocation
      ? [{
          id: 'rider-picker-location',
          position: effectiveRiderLocation,
          label: profile.name,
          type: 'rider' as const,
          profile
        }]
      : [])
  ];

  return (
    <div className="space-y-6">
      {/* Profile Card */}
      <div className="bg-white/90 dark:bg-gray-900/90 backdrop-blur-sm rounded-2xl p-5 border border-gray-100 dark:border-gray-800 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="relative">
              {profile.avatarUrl ? (
                <img src={profile.avatarUrl} className="w-14 h-14 rounded-xl object-cover border-2 border-orange-500/20" alt="" />
              ) : (
                <div className="w-14 h-14 bg-gradient-to-br from-orange-400 to-orange-600 rounded-xl flex items-center justify-center">
                  <User className="w-7 h-7 text-white" />
                </div>
              )}
              <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-emerald-500 rounded-full flex items-center justify-center border-2 border-white dark:border-gray-900">
                <ShieldCheck className="w-2.5 h-2.5 text-white" />
              </div>
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{profile.name}</h2>
              {profile.vehicleModel ? (
                <p className="text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider flex items-center gap-1">
                  <Car className="w-3 h-3" />
                  {profile.vehicleModel} • {profile.numberPlate}
                </p>
              ) : (
                <p className="text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">{profile.role}</p>
              )}
            </div>
          </div>
          <div className="text-right">
            <button 
              onClick={() => updateDoc(doc(db, 'users', user.uid), { isOnline: !profile.isOnline }).catch(console.error)}
              className="flex items-center gap-2 px-3 py-1.5 bg-gray-100 dark:bg-gray-800 rounded-xl hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
            >
              <div className={`w-2 h-2 rounded-full ${profile.isOnline ? 'bg-emerald-500 animate-pulse' : 'bg-gray-400'}`} />
              <span className="font-semibold text-[10px] uppercase tracking-wider text-gray-700 dark:text-gray-300">
                {profile.isOnline ? t('available') : t('unavailable')}
              </span>
            </button>
          </div>
        </div>
      </div>

      {/* View Mode Tabs */}
      <div className="flex gap-3 rounded-2xl bg-gray-100 p-1">
        <button 
          onClick={() => setViewMode('ride')}
          className={`flex items-center gap-2 px-6 py-3 rounded-xl font-bold transition-all ${
            viewMode === 'ride' 
              ? 'bg-white shadow-sm text-black' 
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          <Navigation className="w-4 h-4" />
          Active Rides
        </button>
        <button 
          onClick={() => setViewMode('reports')}
          className={`flex items-center gap-2 px-6 py-3 rounded-xl font-bold transition-all ${
            viewMode === 'reports' 
              ? 'bg-white shadow-sm text-black' 
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          <FileText className="w-4 h-4" />
          Reports
        </button>
        <button 
          onClick={() => setViewMode('analytics')}
          className={`flex items-center gap-2 px-6 py-3 rounded-xl font-bold transition-all ${
            viewMode === 'analytics' 
              ? 'bg-white shadow-sm text-black' 
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          <BarChart3 className="w-4 h-4" />
          Analytics
        </button>
      </div>

      <AnimatePresence mode="wait">
        {viewMode === 'ride' && (
          <motion.div 
            key="ride-view"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-8"
          >
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white p-6 rounded-[2.5rem] border border-gray-100 shadow-sm space-y-4"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Target className="w-5 h-5 text-emerald-500" />
                  <h3 className="font-bold text-lg tracking-tight">Availability Radius</h3>
                </div>
                <span className="bg-emerald-50 text-emerald-600 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider">
                  {profile.availabilityRadius || 10} km
                </span>
              </div>
              <div className="space-y-4">
                <input 
                  type="range" 
                  min="1" 
                  max="50" 
                  step="1"
                  value={profile.availabilityRadius || 10}
                  onChange={(e) => updateDoc(doc(db, 'users', user.uid), { availabilityRadius: parseInt(e.target.value) })}
                  className="w-full h-2 bg-gray-100 rounded-lg appearance-none cursor-pointer accent-emerald-500 hover:accent-emerald-600 transition-all"
                />
                <div className="flex justify-between text-[10px] font-bold text-gray-400 uppercase tracking-widest px-1">
                  <span>1 KM</span>
                  <span>25 KM</span>
                  <span>50 KM</span>
                </div>
                <p className="text-xs text-gray-400 font-medium leading-relaxed">
                  {t('availabilityRadiusDescription')}
                </p>
              </div>
            </motion.div>

            {/* Driver Map View - Show when waiting for rides */}
            {!activeRide && effectiveRiderLocation && hasValidCoordinates(effectiveRiderLocation) && (
              <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="bg-black text-white rounded-3xl shadow-2xl relative overflow-hidden"
              >
                <div className="p-3 sm:p-4">
                  <MapComponent
                    markers={previewMapMarkers}
                    directionRequests={previewDirectionRequests}
                    center={previewPickupLocation || effectiveRiderLocation}
                    zoom={14}
                    showNearbyDrivers={false}
                    height="250px"
                    autoFit={!!previewRide}
                  />
                </div>
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black to-transparent p-4 text-sm text-white/80">
                  <div className="flex justify-between items-center">
                    <div>
                      <p className="font-semibold">
                        {previewRide ? 'Previewing a live request route' : 'Waiting for ride requests...'}
                      </p>
                      <p className="text-xs text-white/50">
                        {previewRide ? `${previewRide.pickup.address} to ${previewRide.destination.address}` : 'Your location is visible to nearby passengers'}
                      </p>
                    </div>
                    <button
                      onClick={() => setIsPickingOnMap(!isPickingOnMap)}
                      className={`px-4 py-2 rounded-xl font-bold text-sm transition-all ${isPickingOnMap ? 'bg-emerald-500 text-white' : 'bg-white/20 text-white hover:bg-white/30'}`}
                    >
                      {isPickingOnMap ? 'Cancel' : 'Pick Location'}
                    </button>
                  </div>
                </div>
              </motion.div>
            )}

            {/* Map Location Picker */}
            {isPickingOnMap && (
              <motion.div 
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                className="bg-gray-900 rounded-[2rem] overflow-hidden relative border-4 border-black"
              >
                <div className="absolute left-4 right-16 top-4 z-10 rounded-2xl bg-black/75 px-4 py-3 text-white shadow-xl backdrop-blur">
                  <p className="font-bold uppercase tracking-widest text-[10px]">
                    Tap on Google Map to set your location
                  </p>
                  {riderLocation && (
                    <p className="mt-2 text-xs font-semibold text-emerald-300">
                      {riderLocation.lat.toFixed(5)}, {riderLocation.lng.toFixed(5)}
                    </p>
                  )}
                </div>
                <MapComponent
                  center={riderPickerCenter}
                  zoom={15}
                  markers={riderPickerMarkers}
                  onMapClick={handleMapClick}
                  height="320px"
                  showNearbyDrivers={false}
                />

                <button 
                  onClick={() => setIsPickingOnMap(false)}
                  className="absolute top-4 right-4 bg-white/10 p-2 rounded-xl text-white hover:bg-white/20"
                >
                  <X className="w-4 h-4" />
                </button>
              </motion.div>
            )}

            <div>
              <h2 className="text-4xl font-bold tracking-tight mb-2">{t('availableJobs')}</h2>
              <p className="text-gray-500">{t('pickupPassengersNearby')}</p>
            </div>

            <AnimatePresence mode="popLayout">
              {availableRides.length === 0 ? (
                <motion.div 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="bg-white p-12 rounded-3xl border border-dashed border-gray-200 text-center"
                >
                  <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-6">
                    <Loader2 className="w-8 h-8 text-gray-300 animate-spin" />
                  </div>
                  <p className="font-semibold text-gray-900">{t('waitingForRequests')}</p>
                  <p className="text-sm text-gray-400">{t('freshRidesAppear')}</p>
                </motion.div>
              ) : (
                <div className="grid gap-4">
                  {availableRides.map((ride) => (
                    <motion.div
                      key={ride.id}
                      layout
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.9 }}
                      onClick={() => setSelectedRidePreviewId(ride.id)}
                      onMouseEnter={() => setSelectedRidePreviewId(ride.id)}
                      className={`bg-white p-6 rounded-3xl border shadow-sm transition-all group cursor-pointer ${
                        selectedRidePreviewId === ride.id
                          ? 'border-black ring-2 ring-black/10'
                          : 'border-gray-100 hover:border-black hover:shadow-md'
                      }`}
                    >
                      <div className="flex justify-between items-start mb-6">
                        <div className="flex items-center gap-3">
                          <div className="w-12 h-12 bg-gray-50 rounded-2xl flex items-center justify-center">
                            <User className="w-6 h-6 text-gray-300" />
                          </div>
                          <div>
                            <p className="font-bold">{t('passengerRequest')}</p>
                            <p className="text-xs text-gray-400">~ 2.4 bits {t('away')}</p>
                          </div>
                        </div>
                        <div className="bg-emerald-50 text-emerald-600 px-4 py-2 rounded-xl font-bold text-sm">
                          {t('byAgreement')}
                        </div>
                      </div>

                      <div className="space-y-4 mb-8">
                        <div className="flex items-start gap-4">
                          <div className="w-1.5 h-1.5 rounded-full bg-black mt-1.5" />
                          <div>
                            <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest leading-none mb-1">From</p>
                            <p className="text-sm font-semibold text-gray-600">{ride.pickup.address}</p>
                          </div>
                        </div>
                        <div className="flex items-start gap-4">
                          <div className="w-1.5 h-1.5 rounded-full bg-gray-300 mt-1.5" />
                          <div>
                            <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest leading-none mb-1">To</p>
                            <p className="text-sm font-semibold text-gray-600">{ride.destination.address}</p>
                          </div>
                        </div>
                      </div>

                      <button 
                        onClick={() => handleAccept(ride.id)}
                        className="w-full bg-black text-white py-4 px-6 rounded-2xl font-bold flex items-center justify-between hover:bg-gray-800 transition-all group-hover:scale-[1.02] shadow-xl shadow-black/5"
                      >
                        {t('acceptRide')}
                        <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                      </button>
                    </motion.div>
                  ))}
                </div>
              )}
            </AnimatePresence>

            {/* Badges Section */}
            <div className="space-y-6 pt-12">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-bold tracking-tight">{t('achievements')}</h3>
                <div className="flex items-center gap-1 text-amber-500 font-bold text-sm">
                  <Star className="w-4 h-4 fill-current" />
                  {profile.rating} {t('rating')}
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {displayBadges.map((badge, i) => (
                  <motion.div 
                    key={i}
                    initial={{ opacity: 0, y: 10 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: i * 0.1 }}
                    className={`p-5 rounded-[2rem] border-2 transition-all ${badge.earned ? 'bg-white border-emerald-100 shadow-lg shadow-emerald-500/5' : 'bg-gray-50 border-transparent opacity-50 grayscale'}`}
                  >
                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center mb-4 ${badge.earned ? 'bg-emerald-500 text-white shadow-xl shadow-emerald-500/30' : 'bg-gray-200 text-gray-400'}`}>
                      <badge.icon className="w-6 h-6" />
                    </div>
                    <h4 className="font-bold text-sm mb-1">{badge.title}</h4>
                    <p className="text-[10px] text-gray-500 font-medium leading-relaxed">{badge.description}</p>
                    {badge.earned && (
                      <div className="mt-4 flex items-center gap-1.5 text-[9px] font-bold text-emerald-600 uppercase tracking-wider">
                        <CheckCircle2 className="w-3 h-3" />
                        {t('earnedBadge')}
                      </div>
                    )}
                  </motion.div>
                ))}
              </div>
            </div>
          </motion.div>
        )}

        {viewMode === 'reports' && (
          <motion.div 
            key="reports-view"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
          >
            <TripReport user={user} userRole="rider" />
          </motion.div>
        )}

        {viewMode === 'analytics' && (
          <motion.div 
            key="analytics-view"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
          >
            <TripAnalytics user={user} userRole="rider" />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
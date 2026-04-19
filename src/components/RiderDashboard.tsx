import { useState, useEffect, useRef } from 'react';
import { User as FirebaseUser } from 'firebase/auth';
import { UserProfile, subscribeToAvailableRides, subscribeToUserRides, Ride, updateRideStatus, updateUserLocation, updateDoc, doc, db, getUserProfile, RideStatus, updateDriverStatus } from '../lib/firebase';
import { MapPin, Navigation, DollarSign, CheckCircle2, Navigation2, Loader2, ArrowRight, User, Award, ShieldCheck, Star, Car, Heart, Timer, Target } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useNotifications } from './NotificationCenter';
import { useLanguage } from '../lib/i18n';
import { arrayUnion, arrayRemove, serverTimestamp } from 'firebase/firestore';

interface Props {
  user: FirebaseUser;
  profile: UserProfile;
}

export default function RiderDashboard({ user, profile }: Props) {
  const { t } = useLanguage();
  const { addNotification } = useNotifications();
  const [availableRides, setAvailableRides] = useState<Ride[]>([]);
  const [activeRide, setActiveRide] = useState<Ride | null>(null);
  const [passengerProfile, setPassengerProfile] = useState<UserProfile | null>(null);
  const prevRidesCount = useRef(0);
  const lastStatusRef = useRef<string | null>(null);

  // Badge logic
  const possibleBadges = [
    { id: 'Top Navigator', earned: profile.rating >= 4.8 },
    { id: 'Safe Driver', earned: profile.totalTrips >= 5 },
    { id: 'Elite Status', earned: profile.rating >= 4.9 }
  ];

  useEffect(() => {
    const earnedBadgeIds = possibleBadges.filter(b => b.earned).map(b => b.id);
    const currentBadges = profile.badges || [];
    
    // If we have new badges that aren't in the profile yet, update them
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
    // Subscribe to rides requested by others
    const subAvailable = subscribeToAvailableRides((rides) => {
      let filtered = rides.filter(r => r.passengerId !== user.uid);
      
      // Filter by radius if set and rider has a location
      if (profile.availabilityRadius && profile.currentLocation) {
        filtered = filtered.filter(ride => {
          const latDiff = Math.abs(ride.pickup.lat - profile.currentLocation!.lat);
          const lngDiff = Math.abs(ride.pickup.lng - profile.currentLocation!.lng);
          const distance = Math.sqrt(Math.pow(latDiff, 2) + Math.pow(lngDiff, 2));
          // roughly distance * 111 for km. So distance * 111 <= radius.
          return (distance * 111) <= profile.availabilityRadius!;
        });
      }

      if (filtered.length > prevRidesCount.current) {
        addNotification(t('newRideRequest'), t('newRideRequestMessage'), 'ride_request');
      }
      prevRidesCount.current = filtered.length;
      setAvailableRides(filtered);
    });

    // Subscribe to rides accepted by me
    const subMyRides = subscribeToUserRides(user.uid, 'rider', (rides) => {
      const active = rides.find(r => ['accepted', 'arrived', 'ongoing'].includes(r.status));
      if (active && active.status !== lastStatusRef.current) {
        if (active.status === 'arrived') {
          addNotification(t('riderArrivedNotify'), 'You have marked yourself as arrived at the pickup location.', 'info');
        } else if (active.status === 'ongoing') {
          addNotification(t('tripStartedNotify'), 'You have started the ride with the passenger.', 'info');
        }
        lastStatusRef.current = active.status;
      }
      setActiveRide(active || null);
    });

    return () => {
      subAvailable();
      subMyRides();
    };
  }, [user.uid, addNotification, profile.availabilityRadius, profile.currentLocation]);

  // Update driver status based on active ride
  useEffect(() => {
    if (!activeRide) {
      // Driver is available and not in an active ride
      updateDriverStatus(user.uid, 'active').catch(console.error);
    } else {
      // Driver is currently in an active ride
      updateDriverStatus(user.uid, 'riding').catch(console.error);
    }
  }, [activeRide, user.uid]);


  // Real-time location tracking using Geolocation API
  useEffect(() => {
    if (!("geolocation" in navigator)) return;

    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        updateUserLocation(user.uid, latitude, longitude).catch(console.error);
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
  }, [user.uid]);

  useEffect(() => {
    if (activeRide?.passengerId) {
      getUserProfile(activeRide.passengerId).then(setPassengerProfile).catch(console.error);
    } else {
      setPassengerProfile(null);
    }
  }, [activeRide?.passengerId]);

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
        await updateDoc(doc(db, 'rides', activeRide.id), {
          riderConfirmedStart: true,
          updatedAt: serverTimestamp()
        });
      } else if (activeRide.status === 'ongoing') {
        await updateDoc(doc(db, 'rides', activeRide.id), {
          riderConfirmedEnd: true,
          updatedAt: serverTimestamp()
        });
      }
    } catch (error) {
      console.error("Failed to update status", error);
    }
  };

  if (activeRide) {
    return (
      <div className="space-y-6">
        <h2 className="text-2xl font-bold tracking-tight">{t('activeDuty')}</h2>
        
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-black text-white p-8 rounded-3xl shadow-2xl relative overflow-hidden"
        >
          <div className="relative z-10 space-y-8">
            <div className="flex justify-between items-start">
              <div className="flex items-center gap-4">
                {passengerProfile && (
                  <button 
                    onClick={() => handleToggleFavorite(passengerProfile.uid)}
                    className={`p-3 rounded-2xl transition-all active:scale-95 border ${profile.favoriteUserIds?.includes(passengerProfile.uid) ? 'bg-red-500/20 border-red-500/30 text-red-500' : 'bg-white/5 border-white/10 text-white/40'}`}
                  >
                    <Heart className={`w-6 h-6 ${profile.favoriteUserIds?.includes(passengerProfile.uid) ? 'fill-current' : ''}`} />
                  </button>
                )}
                <div>
                  <div className="inline-flex items-center gap-2 px-3 py-1 bg-white/10 rounded-full text-xs font-bold uppercase tracking-wider mb-4">
                    <div className="w-2 h-2 rounded-full bg-emerald-400" />
                    {t(activeRide.status as any)}
                  </div>
                  <h3 className="text-4xl font-bold mb-2">
                    {activeRide.status === 'accepted' ? t('headingToPickup') : activeRide.status === 'arrived' ? t('waitingAtPickup') : t('headingToDestination')}
                  </h3>
                  {passengerProfile && (
                      <p className="text-sm font-medium text-white/60">
                        {t('passenger')}: <span className="text-white font-bold">{passengerProfile.name}</span>
                      </p>
                  )}
                </div>
              </div>
              <div className="text-right">
                <p className="text-xs text-white/40 font-bold uppercase tracking-widest mb-1">{t('earned')}</p>
                <p className="text-3xl font-bold text-emerald-400">${activeRide.fare}</p>
              </div>
            </div>

            <div className="space-y-6">
              <div className="flex items-start gap-4">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${activeRide.status === 'accepted' ? 'bg-white text-black' : 'bg-white/10 text-white/40'}`}>
                  <MapPin className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-xs text-white/40 font-bold uppercase tracking-widest mb-1">{t('pickupLocation')}</p>
                  <p className="font-medium text-lg leading-tight">{activeRide.pickup.address}</p>
                </div>
              </div>
              <div className="flex items-start gap-4">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${activeRide.status === 'ongoing' ? 'bg-white text-black' : 'bg-white/10 text-white/40'}`}>
                  <Navigation className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-xs text-white/40 font-bold uppercase tracking-widest mb-1">{t('destinationAddress')}</p>
                  <p className="font-medium text-lg leading-tight">{activeRide.destination.address}</p>
                </div>
              </div>
            </div>

            <button 
              onClick={handleNextStep}
              disabled={
                (activeRide.status === 'arrived' && activeRide.riderConfirmedStart) ||
                (activeRide.status === 'ongoing' && activeRide.riderConfirmedEnd)
              }
              className="w-full bg-white text-black py-5 px-6 rounded-2xl font-bold text-lg flex items-center justify-center gap-3 hover:bg-gray-100 transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {activeRide.status === 'accepted' ? t('arrivedButton') : 
               activeRide.status === 'arrived' ? (activeRide.riderConfirmedStart ? t('waitingForPassenger') : t('startTripButton')) : 
               (activeRide.riderConfirmedEnd ? t('waitingForPassenger') : t('completeRideButton'))}
              <ArrowRight className="w-6 h-6" />
            </button>

            {activeRide.status === 'accepted' && (
              <div className="flex justify-center">
                <p className="text-[10px] text-white/40 font-bold uppercase tracking-widest flex items-center gap-2">
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

  return (
    <div className="space-y-8">
      <div className="flex items-end justify-between bg-white p-6 rounded-[2.5rem] border border-gray-100 shadow-sm">
        <div className="flex items-center gap-4">
          <div className="relative">
            {profile.avatarUrl ? (
              <img src={profile.avatarUrl} className="w-16 h-16 rounded-2xl border-4 border-white shadow-lg" />
            ) : (
              <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center border-4 border-white shadow-lg">
                <User className="w-8 h-8 text-gray-400" />
              </div>
            )}
            <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-emerald-500 rounded-lg flex items-center justify-center border border-white">
              <ShieldCheck className="w-3 h-3 text-white" />
            </div>
          </div>
          <div>
            <h2 className="text-2xl font-bold tracking-tight">{profile.name}</h2>
            {profile.vehicleModel ? (
              <p className="text-xs font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2">
                {profile.vehicleType === 'car' ? <Car className="w-3 h-3" /> : <Navigation2 className="w-3 h-3" />}
                {profile.vehicleModel} • {profile.numberPlate}
              </p>
            ) : (
              <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">{profile.role}</p>
            )}
          </div>
        </div>
        <div className="text-right flex flex-col items-end gap-1">
          <p className="text-xs font-bold text-emerald-600 uppercase tracking-widest">Status</p>
          <button 
            onClick={() => updateDoc(doc(db, 'users', user.uid), { isOnline: !profile.isOnline }).catch(console.error)}
            className="flex items-center gap-2 px-3 py-1.5 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors border border-gray-100"
          >
            <div className={`w-2 h-2 rounded-full ${profile.isOnline ? 'bg-emerald-500 animate-pulse' : 'bg-gray-300'}`} />
            <span className="font-bold text-xs uppercase tracking-wider">{profile.isOnline ? t('available') : t('unavailable')}</span>
          </button>
        </div>
      </div>

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
                className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm hover:shadow-md transition-all group"
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
                  <div className="bg-emerald-50 text-emerald-600 px-4 py-2 rounded-xl font-bold text-lg">
                    ${ride.fare}
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
    </div>
  );
}

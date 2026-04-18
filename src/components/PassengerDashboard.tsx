import { useState, useEffect, MouseEvent, useRef } from 'react';
import { User as FirebaseUser } from 'firebase/auth';
import { UserProfile, createRideRequest, subscribeToUserRides, Ride, updateRideStatus, subscribeToUserProfile, rateRide, validatePromoCode, PromoCode, RatingReason, reverseGeocode, db, subscribeToOnlineRiders } from '../lib/firebase';
import { MapPin, Navigation, Clock, CreditCard, ChevronRight, X, Loader2, CheckCircle2, Navigation2, Star, User as UserIcon, Tag, Map as MapIcon, ShieldCheck, Award, Timer, Compass, Heart } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useNotifications } from './NotificationCenter';
import { updateDoc, doc, arrayUnion, arrayRemove } from 'firebase/firestore';

interface Props {
  user: FirebaseUser;
  profile: UserProfile;
}

export default function PassengerDashboard({ user, profile }: Props) {
  const { addNotification } = useNotifications();
  const [pickup, setPickup] = useState('');
  const [destination, setDestination] = useState('');
  const [activeRide, setActiveRide] = useState<Ride | null>(null);
  const [completedRide, setCompletedRide] = useState<Ride | null>(null);
  const [riderProfile, setRiderProfile] = useState<UserProfile | null>(null);
  const [onlineRiders, setOnlineRiders] = useState<UserProfile[]>([]);
  const lastStatusRef = useRef<string | null>(null);
  const [isRequesting, setIsRequesting] = useState(false);
  const [estimatedFare, setEstimatedFare] = useState<number | null>(null);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [isCancelling, setIsCancelling] = useState(false);
  const [rating, setRating] = useState(0);
  const [ratingReason, setRatingReason] = useState<RatingReason | ''>('');
  const [isRating, setIsRating] = useState(false);
  
  // Location logic
  const [isLocating, setIsLocating] = useState(false);

  // Promo logic
  const [promoInput, setPromoInput] = useState('');
  const [appliedPromo, setAppliedPromo] = useState<PromoCode | null>(null);
  const [promoError, setPromoError] = useState('');
  const [isValidatingPromo, setIsValidatingPromo] = useState(false);

  // Map Pins
  const [isPickingOnMap, setIsPickingOnMap] = useState<'pickup' | 'destination' | null>(null);
  const [passengerLocation, setPassengerLocation] = useState<{lat: number, lng: number} | null>(null);
  const [showTraffic, setShowTraffic] = useState(true);

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

  // Sophisticated fare calculation logic
  useEffect(() => {
    if (pickup && destination) {
      const distanceKey = `${pickup.trim()}-${destination.trim()}`.toLowerCase();
      let hash = 0;
      for (let i = 0; i < distanceKey.length; i++) {
        hash = (hash << 5) - hash + distanceKey.charCodeAt(i);
        hash |= 0;
      }
      const mockDistance = Math.abs(hash % 15) + 2;
      const baseFare = 5;
      const perKm = 1.5;
      const hour = new Date().getHours();
      let multiplier = 1.0;
      if ((hour >= 7 && hour <= 10) || (hour >= 16 && hour <= 19)) multiplier = 1.5;
      else if (hour >= 23 || hour <= 5) multiplier = 1.2;
      
      let fare = Math.round((baseFare + mockDistance * perKm) * multiplier);
      
      // Apply discount
      if (appliedPromo) {
        if (appliedPromo.discountType === 'percentage') {
          fare = Math.round(fare * (1 - appliedPromo.value / 100));
        } else {
          fare = Math.max(0, fare - appliedPromo.value);
        }
      }
      
      setEstimatedFare(fare);
    } else {
      setEstimatedFare(null);
    }
  }, [pickup, destination, appliedPromo]);

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

  useEffect(() => {
    const unsubscribe = subscribeToUserRides(user.uid, 'passenger', (rides) => {
      const active = rides.find(r => ['requested', 'accepted', 'arrived', 'ongoing'].includes(r.status));
      const justCompleted = rides.find(r => r.status === 'completed' && !r.riderRating);
      
      if (active && active.status !== lastStatusRef.current) {
        if (active.status === 'accepted') {
          addNotification('Ride Accepted!', 'A rider is on the way to your location.', 'ride_accepted');
        } else if (active.status === 'arrived') {
          addNotification('Rider Arrived!', 'Your rider has arrived at the pickup location.', 'ride_accepted');
        } else if (active.status === 'ongoing') {
          addNotification('Ride Started', 'You are now on your way to the destination.', 'info');
        }
        lastStatusRef.current = active.status;
      }

      if (justCompleted && lastStatusRef.current !== 'completed') {
        addNotification('Trip Completed', 'You have arrived at your destination. Please rate your rider.', 'success');
        lastStatusRef.current = 'completed';
      }

      setActiveRide(active || null);
      setCompletedRide(justCompleted || null);
    });
    return unsubscribe;
  }, [user.uid, addNotification]);

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

  const handleApplyPromo = async () => {
    if (!promoInput) return;
    setIsValidatingPromo(true);
    setPromoError('');
    try {
      const promo = await validatePromoCode(promoInput);
      if (promo) {
        setAppliedPromo(promo);
        setPromoInput('');
      } else {
        setPromoError('Invalid or expired promo code');
      }
    } catch (e) {
      setPromoError('Error validating promo code');
    } finally {
      setIsValidatingPromo(false);
    }
  };

  const handleRequestRide = async () => {
    if (!pickup || !destination || estimatedFare === null) return;
    setIsRequesting(true);
    try {
      await createRideRequest({
        passengerId: user.uid,
        pickup: { address: pickup, lat: 0, lng: 0 },
        destination: { address: destination, lat: 0, lng: 0 },
        status: 'requested',
        fare: estimatedFare,
        promoCode: appliedPromo?.code || null,
        discountAmount: appliedPromo ? (estimatedFare / (1 - (appliedPromo.discountType === 'percentage' ? appliedPromo.value / 100 : 0)) - estimatedFare) : 0
      });
      setPickup('');
      setDestination('');
      setAppliedPromo(null);
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

  const handleMapClick = async (e: MouseEvent) => {
    if (!isPickingOnMap) return;
    
    // Calculate simulated lat/lng based on click position in the container
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    // Map pixels back to coordinates relative to London center (51.5074, -0.1278)
    // Scale is ~1000*5 pixels per degree from RiderDashboard mock
    const lng = (x / 5000) - 0.1278;
    const lat = (y / 5000) + 51.5074;

    const address = await reverseGeocode(lat, lng);
    
    if (isPickingOnMap === 'pickup') {
      setPickup(address);
      setPassengerLocation({ lat, lng });
    } else {
      setDestination(address);
    }
    setIsPickingOnMap(null);
  };

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
          <h2 className="text-2xl font-bold">You've Arrived!</h2>
          <p className="text-gray-500">Rate your journey with SwiftRide</p>
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
          {isRating ? <Loader2 className="w-5 h-5 animate-spin" /> : "Submit Feedback"}
        </button>
      </motion.div>
    );
  }

  if (activeRide) {
    return (
      <div className="space-y-6">
        <h2 className="text-2xl font-bold tracking-tight">Active Ride</h2>
        
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-black text-white rounded-3xl shadow-2xl relative overflow-hidden"
        >
          <div className="h-48 bg-gray-900 relative overflow-hidden">
            <div className="absolute inset-0 opacity-20 pointer-events-none">
              <div className="absolute inset-0 border border-white/10" style={{ background: 'repeating-linear-gradient(0deg, transparent, transparent 39px, rgba(255,255,255,0.05) 40px), repeating-linear-gradient(90deg, transparent, transparent 39px, rgba(255,255,255,0.05) 40px)' }} />
            </div>
            
            {/* Online Riders (only if status is requested) */}
            {activeRide.status === 'requested' && onlineRiders.map((rider) => (
              <motion.div 
                key={rider.uid}
                initial={{ opacity: 0, scale: 0 }}
                animate={{ 
                  opacity: 1, 
                  scale: 1,
                  x: rider.currentLocation ? (rider.currentLocation.lng + 0.1278) * 1000 * 5 : 0, 
                  y: rider.currentLocation ? (rider.currentLocation.lat - 51.5074) * 1000 * 5 : 0 
                }}
                className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-10"
              >
                <div className="w-4 h-4 bg-emerald-500/40 rounded-full flex items-center justify-center border border-emerald-400">
                  <Navigation2 className="w-2 h-2 text-emerald-400 fill-current" />
                </div>
              </motion.div>
            ))}

            {/* Real-time traffic mock line */}
            {showTraffic && (
              <>
                <div className="absolute top-1/2 left-0 w-full h-1 bg-red-500/30 blur-sm shadow-[0_0_10px_rgba(239,68,68,0.5)] overflow-hidden">
                  <motion.div 
                    animate={{ x: ['100%', '-100%'] }}
                    transition={{ duration: 10, repeat: Infinity, ease: 'linear' }}
                    className="w-full h-full bg-red-400 opacity-50" 
                  />
                </div>
                <div className="absolute top-[48%] left-[20%] w-[30%] h-1 bg-orange-400/50 overflow-hidden">
                  <motion.div 
                    animate={{ x: ['100%', '-100%'] }}
                    transition={{ duration: 15, repeat: Infinity, ease: 'linear' }}
                    className="w-full h-full bg-orange-300 opacity-50" 
                  />
                </div>
                <div className="absolute top-1/2 right-0 w-[40%] h-1 bg-emerald-500/40 overflow-hidden" />
              </>
            )}

            {riderProfile?.currentLocation && (
              <motion.div 
                animate={{ 
                  x: (riderProfile.currentLocation.lng + 0.1278) * 1000 * 5, 
                  y: (riderProfile.currentLocation.lat - 51.5074) * 1000 * 5 
                }}
                className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-20"
              >
                <div className="relative group">
                  <div className="w-8 h-8 bg-emerald-500 rounded-full flex items-center justify-center shadow-lg shadow-emerald-500/50 border-2 border-white">
                    <Navigation2 className="w-4 h-4 text-white fill-current" />
                  </div>
                  <div className="absolute -top-10 left-1/2 -translate-x-1/2 bg-black text-white text-[8px] px-2 py-1 rounded-md opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                    Rider: {riderProfile.name}
                  </div>
                </div>
              </motion.div>
            )}

            {passengerLocation && (
              <motion.div 
                className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-30"
                style={{ marginLeft: 20, marginTop: 20 }} // Slightly offset passenger from center for demo
              >
                <div className="relative group">
                  <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center shadow-lg shadow-blue-500/50 border-2 border-white">
                    <UserIcon className="w-4 h-4 text-white" />
                  </div>
                  <div className="absolute -top-10 left-1/2 -translate-x-1/2 bg-black text-white text-[8px] px-2 py-1 rounded-md opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                    You
                  </div>
                </div>
              </motion.div>
            )}

            <div className="absolute bottom-4 left-4 z-40">
              <button 
                onClick={() => setShowTraffic(!showTraffic)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-[8px] font-bold uppercase tracking-wider backdrop-blur-md border transition-all ${showTraffic ? 'bg-red-500/20 text-red-200 border-red-500/30' : 'bg-white/10 text-white/60 border-white/20'}`}
              >
                <div className={`w-1.5 h-1.5 rounded-full ${showTraffic ? 'bg-red-500 animate-pulse' : 'bg-gray-400'}`} />
                {showTraffic ? 'Traffic On' : 'Traffic Off'}
              </button>
            </div>

            <div className="absolute bottom-4 right-4 z-20 flex gap-2">
              <div className="bg-white/10 backdrop-blur-md px-3 py-1.5 rounded-xl text-[8px] font-bold uppercase tracking-wider text-white/60">
                Live Tracking
              </div>
            </div>
          </div>

          <div className="p-8 relative z-10 flex flex-col h-full justify-between gap-8">
            <div className="flex justify-between items-start">
              <div className="max-w-[180px]">
                <div className="inline-flex items-center gap-2 px-3 py-1 bg-white/10 rounded-full text-[10px] font-bold uppercase tracking-wider mb-4">
                  <div className={`w-1.5 h-1.5 rounded-full ${activeRide.status === 'requested' ? 'bg-amber-400 animate-pulse' : 'bg-emerald-400'}`} />
                  {activeRide.status}
                </div>
                <h3 className="text-3xl font-bold mb-2 leading-tight">
                  {activeRide.status === 'requested' ? 'Finding a rider...' : activeRide.status === 'accepted' ? 'Rider is on the way' : activeRide.status === 'arrived' ? 'Rider has arrived' : 'Your ride is ongoing'}
                </h3>
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
                  <p className="text-[10px] text-white/40 font-bold uppercase tracking-widest mb-0.5">Pickup</p>
                  <p className="font-medium leading-tight">{activeRide.pickup.address}</p>
                </div>
              </div>
              <div className="flex items-start gap-4">
                <div className="w-8 h-8 bg-white/10 rounded-full flex items-center justify-center flex-shrink-0">
                  <Navigation className="w-4 h-4 text-white/50" />
                </div>
                <div>
                  <p className="text-[10px] text-white/40 font-bold uppercase tracking-widest mb-0.5">Destination</p>
                  <p className="font-medium leading-tight">{activeRide.destination.address}</p>
                </div>
              </div>
            </div>

            <div className="pt-6 border-t border-white/10 flex items-center justify-between">
              <div>
                <p className="text-xs text-white/40 font-bold uppercase tracking-widest mb-1">Estimated Fare</p>
                <div className="flex items-center gap-2">
                  <p className="text-3xl font-bold">${activeRide.fare}</p>
                  {activeRide.promoCode && (
                    <div className="bg-emerald-500/20 text-emerald-400 text-[10px] font-bold px-2 py-0.5 rounded-md uppercase tracking-wide">
                      Promo: {activeRide.promoCode}
                    </div>
                  )}
                </div>
              </div>
              {activeRide.status === 'requested' && (
                <button 
                  onClick={() => setShowCancelModal(true)}
                  className="bg-white/10 hover:bg-white/20 text-white px-6 py-3 rounded-2xl font-bold transition-colors"
                >
                  Cancel
                </button>
              )}
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
                <h3 className="text-2xl font-bold mb-4">Cancel Ride?</h3>
                <p className="text-gray-500 mb-6">Please let us know why you are cancelling.</p>
                
                <textarea 
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  placeholder="Reason for cancellation (optional)"
                  className="w-full bg-gray-50 rounded-2xl p-4 border-none focus:ring-2 focus:ring-black outline-none mb-6 resize-none min-h-[100px]"
                />

                <div className="flex gap-3">
                  <button 
                    onClick={() => setShowCancelModal(false)}
                    className="flex-1 py-4 font-bold text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    Keep Ride
                  </button>
                  <button 
                    onClick={handleCancelRide}
                    disabled={isCancelling}
                    className="flex-1 bg-black text-white py-4 rounded-2xl font-bold hover:bg-gray-800 transition-all flex items-center justify-center gap-2"
                  >
                    {isCancelling ? <Loader2 className="w-5 h-5 animate-spin" /> : "Confirm"}
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
    <div className="space-y-8">
      <div>
        <h2 className="text-4xl font-bold tracking-tight mb-2 text-gray-900">Where to?</h2>
        <p className="text-gray-500 font-medium">Request a ride in seconds.</p>
      </div>

      <div className="bg-white p-6 rounded-[2.5rem] shadow-sm border border-gray-100 space-y-4">
        <div className="relative">
          <div className="absolute left-4 top-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-black z-10" />
          <div className="absolute left-[1.125rem] top-[60%] w-0.5 h-full bg-gray-100" />
          <input 
            type="text"
            placeholder="Pickup location"
            value={pickup}
            onChange={(e) => setPickup(e.target.value)}
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
            placeholder="Destination address"
            value={destination}
            onChange={(e) => setDestination(e.target.value)}
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

      {isPickingOnMap && (
        <motion.div 
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          className="bg-gray-900 rounded-[2rem] overflow-hidden relative cursor-crosshair border-4 border-black"
          onClick={handleMapClick}
        >
          <div className="h-64 flex flex-col items-center justify-center p-8 text-center text-white/40">
            <div className="space-y-4 mb-8">
              <MapPin className="w-12 h-12 mx-auto animate-bounce text-emerald-400" />
              <p className="font-bold uppercase tracking-widest text-[10px]">Click anywhere to set {isPickingOnMap}</p>
            </div>
            
            <div className="flex gap-4">
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-red-500/20 text-red-200 border border-red-500/30 text-[8px] font-bold uppercase tracking-wider">
                <div className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                Live Traffic
              </div>
              {passengerLocation && (
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-blue-500/20 text-blue-200 border border-blue-500/30 text-[8px] font-bold uppercase tracking-wider">
                  <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                  Your Location
                </div>
              )}
            </div>
          </div>
          <div className="absolute inset-0 opacity-10 pointer-events-none" style={{ background: 'repeating-linear-gradient(0deg, transparent, transparent 39px, rgba(255,255,255,0.05) 40px), repeating-linear-gradient(90deg, transparent, transparent 39px, rgba(255,255,255,0.05) 40px)' }} />
          
          {passengerLocation && (
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center gap-2" style={{ marginLeft: -40 }}>
              <div className="w-4 h-4 bg-blue-500 rounded-full border-2 border-white shadow-lg shadow-blue-500/50" />
              <span className="text-[8px] text-white/60 font-bold uppercase tracking-widest">You</span>
            </div>
          )}

          <button 
            onClick={(e) => { e.stopPropagation(); setIsPickingOnMap(null); }}
            className="absolute top-4 right-4 bg-white/10 p-2 rounded-xl text-white hover:bg-white/20"
          >
            <X className="w-4 h-4" />
          </button>
        </motion.div>
      )}

      {/* Promo Code UI */}
      {!appliedPromo ? (
        <div className="flex gap-2">
          <div className="flex-1 relative">
            <Tag className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input 
              type="text"
              placeholder="Promo code (e.g. RIDE50)"
              value={promoInput}
              onChange={(e) => setPromoInput(e.target.value)}
              className="w-full bg-white border border-gray-100 py-4 pl-12 pr-4 rounded-2xl outline-none focus:ring-2 focus:ring-black transition-all text-sm"
            />
          </div>
          <button 
            onClick={handleApplyPromo}
            disabled={!promoInput || isValidatingPromo}
            className="bg-gray-900 text-white px-6 rounded-2xl font-bold text-sm disabled:opacity-50"
          >
            {isValidatingPromo ? <Loader2 className="w-5 h-5 animate-spin" /> : "Apply"}
          </button>
        </div>
      ) : (
        <div className="bg-emerald-50 border border-emerald-100 p-4 rounded-2xl flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-emerald-500 text-white rounded-xl flex items-center justify-center">
              <Tag className="w-5 h-5" />
            </div>
            <div>
              <p className="font-bold text-emerald-900">Promo Applied: {appliedPromo.code}</p>
              <p className="text-xs text-emerald-600">
                {appliedPromo.discountType === 'percentage' ? `${appliedPromo.value}% off` : `$${appliedPromo.value} off`} your ride
              </p>
            </div>
          </div>
          <button onClick={() => setAppliedPromo(null)} className="p-2 text-emerald-400 hover:text-emerald-600">
            <X className="w-5 h-5" />
          </button>
        </div>
      )}
      {promoError && <p className="text-xs text-red-500 px-4 -mt-4">{promoError}</p>}

      {estimatedFare !== null && (
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-black text-white p-8 rounded-[2.5rem] flex items-center justify-between shadow-2xl shadow-black/20"
        >
          <div>
            <p className="text-xs text-white/40 font-bold uppercase tracking-widest mb-1">Total Fare</p>
            <div className="flex items-baseline gap-2">
              <p className="text-4xl font-bold">${estimatedFare}</p>
              {appliedPromo && <p className="text-sm text-white/40 line-through">${estimatedFare + (appliedPromo.discountType === 'percentage' ? Math.round(estimatedFare / (1 - appliedPromo.value / 100) - estimatedFare) : appliedPromo.value)}</p>}
            </div>
          </div>
          <div className="text-right">
            <div className="flex items-center gap-2 text-emerald-400 font-bold text-sm mb-1 bg-white/5 py-1 px-3 rounded-full">
              <CheckCircle2 className="w-4 h-4" />
              <span>Swift Match</span>
            </div>
            <p className="text-[10px] text-white/30 uppercase tracking-widest font-bold">Includes dynamic fee</p>
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
            Confirming Match...
          </>
        ) : (
          <>
            Request SwiftRide
            <ChevronRight className="w-6 h-6" />
          </>
        )}
      </button>

      {/* Suggested Locations */}
      <div className="space-y-4">
        <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] text-gray-400 px-4">Saved Locations</h3>
        <div className="grid gap-2">
          {[
            { name: "Coffee Central", address: "123 Brew St, Downtown", icon: Clock },
            { name: "Global Office", address: "Tech Park II, Unit 4B", icon: ShieldCheck }
          ].map((loc, i) => (
            <button 
              key={i}
              onClick={() => { setPickup("Search Location"); setDestination(loc.address); }}
              className="w-full text-left bg-white p-5 rounded-[1.5rem] border border-transparent hover:border-gray-200 transition-all flex items-center justify-between group shadow-sm"
            >
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-gray-50 rounded-2xl flex items-center justify-center group-hover:bg-black group-hover:text-white transition-colors">
                  <loc.icon className="w-6 h-6" />
                </div>
                <div>
                  <p className="font-bold text-gray-900">{loc.name}</p>
                  <p className="text-xs text-gray-400 font-medium">{loc.address}</p>
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-gray-300 group-hover:text-black transition-colors" />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

import React, { useState, useEffect } from 'react';
import { User as FirebaseUser } from 'firebase/auth';
import { UserProfile, subscribeToUserRides, Ride, getUserProfile, db } from '../lib/firebase';
import { Clock, MapPin, Navigation, DollarSign, Calendar, ChevronRight, User as UserIcon, Star, X, ShieldCheck, Award, Compass, Search, Tag, Info, Heart } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { updateDoc, doc, arrayUnion, arrayRemove } from 'firebase/firestore';
import { useLanguage } from '../lib/i18n';

interface Props {
  user: FirebaseUser;
  profile: UserProfile;
}

export default function RideHistory({ user, profile }: Props) {
  const { t } = useLanguage();
  const [history, setHistory] = useState<Ride[]>([]);
  const [riders, setRiders] = useState<Record<string, UserProfile>>({});
  const [selectedRide, setSelectedRide] = useState<Ride | null>(null);

  useEffect(() => {
    const unsubscribe = subscribeToUserRides(user.uid, profile.role, (rides) => {
      const pastRides = rides.filter(r => ['completed', 'cancelled'].includes(r.status));
      setHistory(pastRides);

      // Fetch rider profiles for passenger history
      if (profile.role === 'passenger') {
        pastRides.forEach(async (ride) => {
          if (ride.riderId && !riders[ride.riderId]) {
            const p = await getUserProfile(ride.riderId);
            if (p) {
              setRiders(prev => ({ ...prev, [ride.riderId!]: p }));
            }
          }
        });
      }
    });
    return unsubscribe;
  }, [user.uid, profile.role]);

  const handleToggleFavorite = async (e: React.MouseEvent, targetUserId: string) => {
    e.stopPropagation();
    const isFavorite = profile.favoriteUserIds?.includes(targetUserId);
    try {
      await updateDoc(doc(db, 'users', user.uid), {
        favoriteUserIds: isFavorite ? arrayRemove(targetUserId) : arrayUnion(targetUserId)
      });
    } catch (e) {
      console.error(e);
    }
  };

  const getRiderProfile = (rideId: string) => {
    const ride = history.find(r => r.id === rideId);
    return ride?.riderId ? riders[ride.riderId] : null;
  };

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-4xl font-bold tracking-tight mb-2 dark:text-white">{t('tripHistory')}</h2>
        <p className="text-gray-500 dark:text-gray-400">{t('pastJourneys')}</p>
      </div>

      {history.length === 0 ? (
        <div className="bg-white dark:bg-zinc-900 p-12 rounded-3xl border border-dashed border-gray-200 dark:border-zinc-800 text-center">
          <div className="w-16 h-16 bg-gray-50 dark:bg-zinc-800 rounded-full flex items-center justify-center mx-auto mb-6">
            <HistoryIcon className="w-8 h-8 text-gray-300 dark:text-zinc-700" />
          </div>
          <p className="font-semibold text-gray-900 dark:text-white">{t('noTrips')}</p>
          <p className="text-sm text-gray-400 dark:text-zinc-500">{t('completeFirstRide')}</p>
        </div>
      ) : (
        <div className="space-y-4">
          {history.map((ride, i) => (
            <motion.div
              key={ride.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              onClick={() => setSelectedRide(ride)}
              className="bg-white dark:bg-zinc-900 p-6 rounded-3xl border border-gray-100 dark:border-zinc-800 shadow-sm cursor-pointer hover:border-black dark:hover:border-white transition-colors group"
            >
              <div className="flex justify-between items-start mb-6">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${ride.status === 'completed' ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600' : 'bg-red-50 dark:bg-red-500/10 text-red-600'}`}>
                    <Calendar className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="font-bold dark:text-white">{ride.status === 'completed' ? t('successfulTrip') : t('cancelled')}</p>
                    <p className="text-[10px] text-gray-400 dark:text-zinc-500 font-bold uppercase tracking-widest leading-none">
                      {ride.createdAt?.toDate?.() ? ride.createdAt.toDate().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Recently'}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-lg font-bold dark:text-white">
                    {ride.fare > 0 ? (
                      ride.discountAmount ? (
                      <span className="flex flex-col">
                        <span>${ride.fare}</span>
                        <span className="text-[10px] text-emerald-500 line-through opacity-50">${ride.fare + ride.discountAmount}</span>
                      </span>
                      ) : (
                      `$${ride.fare}`
                      )
                    ) : (
                      t('byAgreement')
                    )}
                  </p>
                  <p className="text-[10px] text-gray-400 dark:text-zinc-500 font-bold uppercase tracking-widest">{profile.role === 'rider' ? t('earned') : t('paid')}</p>
                </div>
              </div>

              <div className="space-y-3 mb-4">
                <div className="flex items-center gap-3">
                  <MapPin className="w-4 h-4 text-gray-300 group-hover:text-black dark:group-hover:text-white transition-colors" />
                  <p className="text-xs text-gray-500 dark:text-gray-400 truncate group-hover:text-gray-900 dark:group-hover:text-gray-200 transition-colors">{ride.pickup.address}</p>
                </div>
                <div className="flex items-center gap-3">
                  <Navigation className="w-4 h-4 text-gray-300 group-hover:text-black dark:group-hover:text-white transition-colors" />
                  <p className="text-xs text-gray-500 dark:text-gray-400 truncate group-hover:text-gray-900 dark:group-hover:text-gray-200 transition-colors">{ride.destination.address}</p>
                </div>
                {ride.status === 'completed' && ride.completedAt?.toDate && ride.startedAt?.toDate && (
                  <div className="flex items-center gap-3 pt-1">
                    <Clock className="w-4 h-4 text-emerald-500/50" />
                    <p className="text-[10px] font-bold text-emerald-600/70 uppercase tracking-widest">
                      {t('tripDuration')}: {Math.round((ride.completedAt.toDate().getTime() - ride.startedAt.toDate().getTime()) / 60000)} {t('minutes')}
                    </p>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between pt-4 border-t border-gray-50 dark:border-zinc-800">
                {profile.role === 'passenger' && ride.riderId && riders[ride.riderId] ? (
                  <div className="flex items-center gap-2">
                    {riders[ride.riderId].avatarUrl ? (
                      <img src={riders[ride.riderId].avatarUrl} className="w-6 h-6 rounded-lg" />
                    ) : (
                      <div className="w-6 h-6 bg-gray-100 dark:bg-zinc-800 rounded-lg flex items-center justify-center">
                        <UserIcon className="w-3 h-3 text-gray-400" />
                      </div>
                    )}
                    <span className="text-xs font-semibold dark:text-zinc-300">{riders[ride.riderId].name}</span>
                    <button 
                      onClick={(e) => handleToggleFavorite(e, ride.riderId!)}
                      className={`p-1 rounded-md transition-colors ${profile.favoriteUserIds?.includes(ride.riderId!) ? 'text-red-500' : 'text-gray-300 dark:text-zinc-700 hover:text-red-400'}`}
                    >
                      <Heart className={`w-3 h-3 ${profile.favoriteUserIds?.includes(ride.riderId!) ? 'fill-current' : ''}`} />
                    </button>
                    <div className="flex gap-1">
                      {riders[ride.riderId].badges?.map((badge, idx) => (
                        <div key={idx} className="bg-gray-50 dark:bg-zinc-800 p-0.5 rounded shadow-sm">
                          {badge === 'Top Navigator' && <Compass className="w-2.5 h-2.5 text-emerald-500" />}
                          {badge === 'Safe Driver' && <ShieldCheck className="w-2.5 h-2.5 text-blue-500" />}
                          {badge === 'Elite Status' && <Award className="w-2.5 h-2.5 text-amber-500" />}
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="w-1" />
                )}
                
                <div className="flex items-center gap-4">
                  {ride.riderRating && (
                    <div className="flex items-center gap-0.5 text-amber-400 font-bold text-xs">
                      <Star className="w-3 h-3 fill-current" />
                      <span>{ride.riderRating}</span>
                    </div>
                  )}
                  <div className="bg-gray-50 dark:bg-zinc-800 p-1.5 rounded-lg group-hover:bg-black group-hover:text-white dark:group-hover:bg-white dark:group-hover:text-black transition-all">
                    <ChevronRight className="w-4 h-4" />
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Ride Detail Modal */}
      <AnimatePresence>
        {selectedRide && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/60 backdrop-blur-md"
              onClick={() => setSelectedRide(null)}
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-white dark:bg-zinc-900 w-full max-w-lg rounded-[2.5rem] p-8 relative z-10 shadow-2xl overflow-hidden border border-white/10 dark:border-zinc-800"
            >
              <button 
                onClick={() => setSelectedRide(null)}
                className="absolute top-6 right-6 p-2 bg-gray-50 dark:bg-zinc-800 rounded-2xl text-gray-400 hover:text-black dark:hover:text-white transition-colors"
                title="Close"
              >
                <X className="w-6 h-6" />
              </button>

              <div className="flex items-center gap-4 mb-8">
                <div className={`w-16 h-16 rounded-[1.5rem] flex items-center justify-center ${selectedRide.status === 'completed' ? 'bg-emerald-100 dark:bg-emerald-500/10 text-emerald-600' : 'bg-red-100 dark:bg-red-500/10 text-red-600'}`}>
                  <HistoryIcon className="w-8 h-8" />
                </div>
                <div>
                  <h3 className="text-2xl font-bold dark:text-white">{t('rideDetail')} #{selectedRide.id.slice(-6).toUpperCase()}</h3>
                  <p className="text-gray-500 dark:text-gray-400 font-medium">{selectedRide.status === 'completed' ? t('successfulTrip') : t('cancelled')}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 mb-10">
                <div className="bg-gray-50 dark:bg-zinc-800 p-5 rounded-3xl">
                  <p className="text-[10px] text-gray-400 dark:text-zinc-500 font-bold uppercase tracking-widest mb-1">
                    {selectedRide.fare > 0 ? t('totalFare') : t('fareToBeNegotiated')}
                  </p>
                  <p className="text-3xl font-bold dark:text-white">
                    {selectedRide.fare > 0 ? `$${selectedRide.fare}` : t('byAgreement')}
                  </p>
                  {selectedRide.fare > 0 && selectedRide.promoCode && (
                    <div className="inline-flex items-center gap-1.5 mt-2 bg-emerald-500/10 text-emerald-600 px-2 py-1 rounded-lg text-[10px] font-bold">
                      <Tag className="w-3 h-3" />
                      PROMO: {selectedRide.promoCode}
                    </div>
                  )}
                  {selectedRide.fare <= 0 && (
                    <p className="mt-2 text-xs text-gray-500 dark:text-zinc-400">{t('fareNegotiationMessage')}</p>
                  )}
                </div>
                <div className="bg-gray-50 dark:bg-zinc-800 p-5 rounded-3xl">
                  <p className="text-[10px] text-gray-400 dark:text-zinc-500 font-bold uppercase tracking-widest mb-1">{t('date')}</p>
                  <p className="text-xl font-bold dark:text-white">
                    {selectedRide.createdAt?.toDate?.() ? selectedRide.createdAt.toDate().toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : 'Today'}
                  </p>
                  <p className="text-xs text-gray-400 dark:text-zinc-500 font-medium">
                    {selectedRide.createdAt?.toDate?.() ? selectedRide.createdAt.toDate().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) : 'Just now'}
                  </p>
                </div>
              </div>

              <div className="space-y-6 mb-10">
                <div className="flex items-start gap-4">
                  <div className="w-8 h-8 bg-blue-50 dark:bg-blue-500/10 text-blue-600 rounded-full flex items-center justify-center flex-shrink-0 mt-1">
                    <MapPin className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-[10px] text-gray-400 dark:text-zinc-500 font-bold uppercase tracking-widest mb-0.5">Pickup Location</p>
                    <p className="font-semibold text-gray-900 dark:text-white leading-tight">{selectedRide.pickup.address}</p>
                  </div>
                </div>
                <div className="flex items-start gap-4">
                  <div className="w-8 h-8 bg-amber-50 dark:bg-amber-500/10 text-amber-600 rounded-full flex items-center justify-center flex-shrink-0 mt-1">
                    <Navigation className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-[10px] text-gray-400 dark:text-zinc-500 font-bold uppercase tracking-widest mb-0.5">Destination Point</p>
                    <p className="font-semibold text-gray-900 dark:text-white leading-tight">{selectedRide.destination.address}</p>
                  </div>
                </div>
              </div>

              {selectedRide.cancellationReason && (
                <div className="bg-red-50 dark:bg-red-500/10 p-5 rounded-3xl border border-red-100 dark:border-red-900/30 mb-10">
                  <div className="flex items-center gap-2 mb-2">
                    <X className="w-4 h-4 text-red-500" />
                    <p className="text-[10px] text-red-500 font-bold uppercase tracking-widest leading-none">Cancellation Reason</p>
                  </div>
                  <p className="text-sm font-medium text-red-700 dark:text-red-400 italic">"{selectedRide.cancellationReason}"</p>
                </div>
              )}

              {selectedRide.riderRating && (
                <div className="bg-amber-50 dark:bg-amber-500/10 p-6 rounded-[2rem] border border-amber-100 dark:border-amber-900/30">
                  <div className="flex justify-between items-center">
                    <div>
                      <p className="text-[10px] text-amber-600 font-bold uppercase tracking-widest mb-2">Feedback Provided</p>
                      <div className="flex items-center gap-1 mb-2">
                        {[1, 2, 3, 4, 5].map((s) => (
                          <Star key={s} className={`w-5 h-5 ${s <= selectedRide.riderRating! ? 'text-amber-400 fill-current' : 'text-gray-200 dark:text-zinc-800'}`} />
                        ))}
                      </div>
                      {selectedRide.ratingReason && (
                        <p className="text-xs font-bold text-amber-800 dark:text-amber-400 uppercase tracking-widest bg-amber-200/50 dark:bg-amber-500/20 px-2 py-1 rounded-lg inline-block">
                          Category: {selectedRide.ratingReason}
                        </p>
                      )}
                    </div>
                    {getRiderProfile(selectedRide.id) && (
                      <div className="text-right">
                        <div className="relative inline-block mb-1">
                          {getRiderProfile(selectedRide.id)!.avatarUrl ? (
                            <img src={getRiderProfile(selectedRide.id)!.avatarUrl} className="w-12 h-12 rounded-2xl border-2 border-white dark:border-zinc-800 shadow-sm" />
                          ) : (
                            <div className="w-12 h-12 bg-gray-200 dark:bg-zinc-800 rounded-2xl flex items-center justify-center">
                              <UserIcon className="w-6 h-6 text-gray-400 dark:text-zinc-600" />
                            </div>
                          )}
                        </div>
                        <p className="text-xs font-bold dark:text-white">{getRiderProfile(selectedRide.id)!.name}</p>
                        {getRiderProfile(selectedRide.id)!.vehicleModel && (
                          <p className="text-[8px] font-bold text-gray-400 dark:text-zinc-500 uppercase tracking-widest leading-tight">
                            {getRiderProfile(selectedRide.id)!.vehicleModel}<br/>
                            {getRiderProfile(selectedRide.id)!.numberPlate}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

function HistoryIcon({ className }: { className?: string }) {
  return (
    <svg 
      className={className} 
      xmlns="http://www.w3.org/2000/svg" 
      width="24" height="24" 
      viewBox="0 0 24 24" 
      fill="none" 
      stroke="currentColor" 
      strokeWidth="2" 
      strokeLinecap="round" 
      strokeLinejoin="round"
    >
      <path d="M12 8v4l3 3"/><circle cx="12" cy="12" r="10"/>
    </svg>
  );
}

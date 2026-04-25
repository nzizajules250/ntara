import React, { useState, useEffect } from 'react';
import { User as FirebaseUser } from 'firebase/auth';
import { UserProfile, subscribeToUserRides, Ride, getUserProfile, db } from '../lib/firebase';
import { Clock, MapPin, Navigation, DollarSign, Calendar, ChevronRight, User as UserIcon, Star, X, ShieldCheck, Award, Compass, Search, Tag, Info, Heart, TrendingUp, TrendingDown, Route, Timer } from 'lucide-react';
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
  const [filter, setFilter] = useState<'all' | 'completed' | 'cancelled'>('all');

  useEffect(() => {
    const unsubscribe = subscribeToUserRides(user.uid, profile.role, (rides) => {
      const pastRides = rides.filter(r => ['completed', 'cancelled'].includes(r.status));
      setHistory(pastRides);

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

  const filteredHistory = filter === 'all' 
    ? history 
    : history.filter(ride => ride.status === filter);

  const totalSpent = history
    .filter(r => r.status === 'completed')
    .reduce((sum, r) => sum + (r.fare || 0), 0);
  
  const completedRides = history.filter(r => r.status === 'completed').length;
  const cancelledRides = history.filter(r => r.status === 'cancelled').length;

  const stats = [
    { 
      label: t('totalSpent') || 'Total Spent', 
      value: `$${totalSpent.toFixed(2)}`, 
      icon: DollarSign, 
      color: 'from-emerald-400 to-emerald-600',
      bgColor: 'bg-emerald-50 dark:bg-emerald-500/10'
    },
    { 
      label: t('completedTrips') || 'Completed', 
      value: completedRides.toString(), 
      icon: TrendingUp, 
      color: 'from-blue-400 to-blue-600',
      bgColor: 'bg-blue-50 dark:bg-blue-500/10'
    },
    { 
      label: t('cancelledTrips') || 'Cancelled', 
      value: cancelledRides.toString(), 
      icon: TrendingDown, 
      color: 'from-red-400 to-red-600',
      bgColor: 'bg-red-50 dark:bg-red-500/10'
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header with Gradient */}
      <div className="relative overflow-hidden bg-gradient-to-br from-violet-600 via-purple-600 to-indigo-700 dark:from-violet-900 dark:via-purple-900 dark:to-indigo-950 rounded-[3rem] p-8 shadow-2xl shadow-purple-500/20">
        <div className="absolute inset-0 opacity-20">
          <div className="absolute top-0 right-0 w-48 h-48 bg-white rounded-full -translate-y-1/2 translate-x-1/2 blur-3xl" />
          <div className="absolute bottom-0 left-0 w-32 h-32 bg-white rounded-full translate-y-1/2 -translate-x-1/2 blur-3xl" />
        </div>
        <div className="relative z-10">
          <h2 className="text-3xl font-black text-white mb-2">{t('tripHistory')}</h2>
          <p className="text-white/70 font-semibold">{t('pastJourneys')}</p>
        </div>
      </div>

      {/* Stats Overview */}
      {history.length > 0 && (
        <div className="grid grid-cols-3 gap-3">
          {stats.map((stat, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
              whileHover={{ y: -4 }}
              className={`${stat.bgColor} p-4 rounded-[2rem] border border-gray-100/50 dark:border-zinc-800/50 shadow-sm hover:shadow-md transition-all duration-300 text-center`}
            >
              <div className={`w-10 h-10 bg-gradient-to-br ${stat.color} rounded-2xl flex items-center justify-center mx-auto mb-3 shadow-lg`}>
                <stat.icon className="w-5 h-5 text-white" />
              </div>
              <p className="text-xl font-black text-gray-900 dark:text-white leading-tight">{stat.value}</p>
              <p className="text-[10px] font-bold text-gray-500 dark:text-zinc-400 uppercase tracking-wider mt-0.5">{stat.label}</p>
            </motion.div>
          ))}
        </div>
      )}

      {/* Filter Tabs */}
      {history.length > 0 && (
        <div className="flex gap-2 p-1 bg-gray-100 dark:bg-zinc-800 rounded-2xl">
          {(['all', 'completed', 'cancelled'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`flex-1 py-2.5 px-4 rounded-xl font-bold text-xs uppercase tracking-wider transition-all ${
                filter === f 
                  ? 'bg-white dark:bg-zinc-700 text-gray-900 dark:text-white shadow-lg' 
                  : 'text-gray-500 dark:text-zinc-400 hover:text-gray-700 dark:hover:text-zinc-300'
              }`}
            >
              {t(f)}
            </button>
          ))}
        </div>
      )}

      {/* Ride List */}
      {filteredHistory.length === 0 ? (
        <div className="bg-white dark:bg-zinc-900 p-12 rounded-3xl border-2 border-dashed border-gray-200 dark:border-zinc-800 text-center">
          <div className="w-20 h-20 bg-gradient-to-br from-gray-100 to-gray-200 dark:from-zinc-800 dark:to-zinc-700 rounded-[2rem] flex items-center justify-center mx-auto mb-6 shadow-lg">
            <HistoryIcon className="w-10 h-10 text-gray-400 dark:text-zinc-500" />
          </div>
          <p className="font-bold text-gray-900 dark:text-white text-lg">{t('noTrips')}</p>
          <p className="text-sm text-gray-500 dark:text-zinc-400 mt-1">{t('completeFirstRide')}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredHistory.map((ride, i) => (
            <motion.div
              key={ride.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.05 }}
              onClick={() => setSelectedRide(ride)}
              className="bg-white dark:bg-zinc-900 p-5 rounded-[2rem] border border-gray-100 dark:border-zinc-800 shadow-sm cursor-pointer hover:shadow-md hover:border-purple-300 dark:hover:border-purple-700 transition-all group"
            >
              <div className="flex justify-between items-start mb-4">
                <div className="flex items-center gap-3">
                  <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shadow-lg ${
                    ride.status === 'completed' 
                      ? 'bg-gradient-to-br from-emerald-400 to-emerald-600 text-white' 
                      : 'bg-gradient-to-br from-red-400 to-red-600 text-white'
                  }`}>
                    {ride.status === 'completed' ? <Route className="w-5 h-5" /> : <X className="w-5 h-5" />}
                  </div>
                  <div>
                    <p className="font-bold text-gray-900 dark:text-white">
                      {ride.status === 'completed' ? t('successfulTrip') : t('cancelled')}
                    </p>
                    <p className="text-xs text-gray-400 dark:text-zinc-500 font-semibold uppercase tracking-wider">
                      {ride.createdAt?.toDate?.() 
                        ? ride.createdAt.toDate().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
                        : 'Recently'}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-lg font-black text-gray-900 dark:text-white">
                    {ride.fare > 0 ? (
                      ride.discountAmount ? (
                        <span className="flex flex-col items-end">
                          <span>${ride.fare}</span>
                          <span className="text-xs text-emerald-500 line-through opacity-75">${ride.fare + ride.discountAmount}</span>
                        </span>
                      ) : (
                        `$${ride.fare}`
                      )
                    ) : (
                      <span className="text-sm font-bold text-amber-600 dark:text-amber-400">{t('byAgreement')}</span>
                    )}
                  </p>
                  <p className="text-[10px] text-gray-400 dark:text-zinc-500 font-bold uppercase tracking-widest">
                    {profile.role === 'rider' ? t('earned') : t('paid')}
                  </p>
                </div>
              </div>

              <div className="space-y-2.5 mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-green-50 dark:bg-green-500/10 rounded-xl flex items-center justify-center flex-shrink-0">
                    <MapPin className="w-4 h-4 text-green-600" />
                  </div>
                  <p className="text-sm text-gray-600 dark:text-zinc-300 truncate group-hover:text-gray-900 dark:group-hover:text-white transition-colors">
                    {ride.pickup.address}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-red-50 dark:bg-red-500/10 rounded-xl flex items-center justify-center flex-shrink-0">
                    <Navigation className="w-4 h-4 text-red-600" />
                  </div>
                  <p className="text-sm text-gray-600 dark:text-zinc-300 truncate group-hover:text-gray-900 dark:group-hover:text-white transition-colors">
                    {ride.destination.address}
                  </p>
                </div>
                {ride.status === 'completed' && ride.completedAt?.toDate && ride.startedAt?.toDate && (
                  <div className="flex items-center gap-3 pt-1">
                    <div className="w-8 h-8 bg-purple-50 dark:bg-purple-500/10 rounded-xl flex items-center justify-center flex-shrink-0">
                      <Timer className="w-4 h-4 text-purple-600" />
                    </div>
                    <p className="text-xs font-bold text-purple-600 dark:text-purple-400 uppercase tracking-wider">
                      {Math.round((ride.completedAt.toDate().getTime() - ride.startedAt.toDate().getTime()) / 60000)} {t('minutes')}
                    </p>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between pt-4 border-t border-gray-100 dark:border-zinc-800">
                {profile.role === 'passenger' && ride.riderId && riders[ride.riderId] ? (
                  <div className="flex items-center gap-2">
                    {riders[ride.riderId].avatarUrl ? (
                      <img src={riders[ride.riderId].avatarUrl} className="w-8 h-8 rounded-xl ring-2 ring-gray-100 dark:ring-zinc-800" alt="" />
                    ) : (
                      <div className="w-8 h-8 bg-gradient-to-br from-amber-400 to-orange-600 rounded-xl flex items-center justify-center">
                        <UserIcon className="w-4 h-4 text-white" />
                      </div>
                    )}
                    <span className="text-sm font-bold text-gray-900 dark:text-white">{riders[ride.riderId].name}</span>
                    <button 
                      onClick={(e) => handleToggleFavorite(e, ride.riderId!)}
                      className={`p-1.5 rounded-lg transition-all ${
                        profile.favoriteUserIds?.includes(ride.riderId!) 
                          ? 'bg-red-50 dark:bg-red-500/10 text-red-500' 
                          : 'text-gray-300 dark:text-zinc-600 hover:bg-red-50 dark:hover:bg-red-500/10 hover:text-red-400'
                      }`}
                    >
                      <Heart className={`w-3.5 h-3.5 ${profile.favoriteUserIds?.includes(ride.riderId!) ? 'fill-current' : ''}`} />
                    </button>
                    <div className="flex gap-1">
                      {riders[ride.riderId].badges?.slice(0, 3).map((badge, idx) => (
                        <div key={idx} className="bg-gray-100 dark:bg-zinc-800 p-1 rounded-lg shadow-sm" title={badge}>
                          {badge === 'Top Navigator' && <Compass className="w-3 h-3 text-emerald-500" />}
                          {badge === 'Safe Driver' && <ShieldCheck className="w-3 h-3 text-blue-500" />}
                          {badge === 'Elite Status' && <Award className="w-3 h-3 text-amber-500" />}
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div />
                )}
                
                <div className="flex items-center gap-3">
                  {ride.riderRating && (
                    <div className="flex items-center gap-1 bg-amber-50 dark:bg-amber-500/10 px-2.5 py-1 rounded-xl">
                      <Star className="w-3.5 h-3.5 text-amber-400 fill-current" />
                      <span className="text-xs font-bold text-amber-600 dark:text-amber-400">{ride.riderRating}</span>
                    </div>
                  )}
                  <motion.div 
                    whileHover={{ scale: 1.1 }}
                    className="bg-gray-100 dark:bg-zinc-800 p-2 rounded-xl group-hover:bg-purple-600 dark:group-hover:bg-purple-500 group-hover:text-white transition-all"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </motion.div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Ride Detail Modal */}
      <AnimatePresence>
        {selectedRide && (
          <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-6">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
              onClick={() => setSelectedRide(null)}
            />
            <motion.div 
              initial={{ opacity: 0, y: 100, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 100, scale: 0.95 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="bg-white dark:bg-zinc-950 w-full max-w-lg rounded-t-[3rem] sm:rounded-[3rem] p-8 relative z-10 shadow-2xl max-h-[90vh] overflow-y-auto"
            >
              {/* Close Button */}
              <button 
                onClick={() => setSelectedRide(null)}
                className="absolute top-6 right-6 w-10 h-10 bg-gray-100 dark:bg-zinc-800 rounded-2xl flex items-center justify-center text-gray-400 hover:bg-gray-200 dark:hover:bg-zinc-700 transition-all z-10"
              >
                <X className="w-5 h-5" />
              </button>

              {/* Status Banner */}
              <div className={`mb-8 p-4 rounded-3xl ${
                selectedRide.status === 'completed' 
                  ? 'bg-gradient-to-br from-emerald-50 to-emerald-100 dark:from-emerald-500/10 dark:to-emerald-500/5 border border-emerald-200 dark:border-emerald-500/20' 
                  : 'bg-gradient-to-br from-red-50 to-red-100 dark:from-red-500/10 dark:to-red-500/5 border border-red-200 dark:border-red-500/20'
              }`}>
                <div className="flex items-center gap-4">
                  <div className={`w-14 h-14 rounded-[1.5rem] flex items-center justify-center shadow-lg ${
                    selectedRide.status === 'completed'
                      ? 'bg-gradient-to-br from-emerald-400 to-emerald-600 text-white'
                      : 'bg-gradient-to-br from-red-400 to-red-600 text-white'
                  }`}>
                    <HistoryIcon className="w-7 h-7" />
                  </div>
                  <div>
                    <h3 className="text-xl font-black text-gray-900 dark:text-white">
                      {t('rideDetail')} #{selectedRide.id.slice(-6).toUpperCase()}
                    </h3>
                    <p className="text-sm font-semibold text-gray-600 dark:text-zinc-400">
                      {selectedRide.status === 'completed' ? t('successfulTrip') : t('cancelled')}
                    </p>
                  </div>
                </div>
              </div>

              {/* Fare & Date Cards */}
              <div className="grid grid-cols-2 gap-4 mb-8">
                <div className="bg-gradient-to-br from-gray-50 to-gray-100 dark:from-zinc-800 dark:to-zinc-900 p-5 rounded-[2rem] border border-gray-100 dark:border-zinc-800">
                  <p className="text-[10px] font-bold text-gray-400 dark:text-zinc-500 uppercase tracking-wider mb-2">
                    {selectedRide.fare > 0 ? t('totalFare') : 'Fare Type'}
                  </p>
                  <p className="text-2xl font-black text-gray-900 dark:text-white">
                    {selectedRide.fare > 0 ? `$${selectedRide.fare}` : t('byAgreement')}
                  </p>
                  {selectedRide.fare > 0 && selectedRide.discountAmount && selectedRide.discountAmount > 0 && (
                    <div className="flex items-center gap-1.5 mt-2">
                      <Tag className="w-3 h-3 text-emerald-500" />
                      <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">
                        Saved ${selectedRide.discountAmount}
                      </span>
                    </div>
                  )}
                  {selectedRide.fare > 0 && selectedRide.promoCode && (
                    <div className="inline-flex items-center gap-1.5 mt-2 bg-purple-50 dark:bg-purple-500/10 text-purple-600 dark:text-purple-400 px-2.5 py-1 rounded-xl text-[10px] font-bold">
                      <Tag className="w-3 h-3" />
                      {selectedRide.promoCode}
                    </div>
                  )}
                </div>
                <div className="bg-gradient-to-br from-gray-50 to-gray-100 dark:from-zinc-800 dark:to-zinc-900 p-5 rounded-[2rem] border border-gray-100 dark:border-zinc-800">
                  <p className="text-[10px] font-bold text-gray-400 dark:text-zinc-500 uppercase tracking-wider mb-2">{t('date')}</p>
                  <p className="text-xl font-black text-gray-900 dark:text-white">
                    {selectedRide.createdAt?.toDate?.() 
                      ? selectedRide.createdAt.toDate().toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                      : 'Today'}
                  </p>
                  <p className="text-sm font-semibold text-gray-500 dark:text-zinc-400 mt-1">
                    {selectedRide.createdAt?.toDate?.() 
                      ? selectedRide.createdAt.toDate().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
                      : 'Just now'}
                  </p>
                </div>
              </div>

              {/* Locations */}
              <div className="space-y-4 mb-8">
                <div className="flex items-start gap-4 p-4 bg-gray-50 dark:bg-zinc-800/50 rounded-[2rem]">
                  <div className="w-10 h-10 bg-green-100 dark:bg-green-500/10 rounded-2xl flex items-center justify-center flex-shrink-0 mt-0.5">
                    <MapPin className="w-5 h-5 text-green-600" />
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-gray-400 dark:text-zinc-500 uppercase tracking-wider mb-1">Pickup Location</p>
                    <p className="font-bold text-gray-900 dark:text-white leading-snug">{selectedRide.pickup.address}</p>
                  </div>
                </div>
                <div className="flex items-start gap-4 p-4 bg-gray-50 dark:bg-zinc-800/50 rounded-[2rem]">
                  <div className="w-10 h-10 bg-red-100 dark:bg-red-500/10 rounded-2xl flex items-center justify-center flex-shrink-0 mt-0.5">
                    <Navigation className="w-5 h-5 text-red-600" />
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-gray-400 dark:text-zinc-500 uppercase tracking-wider mb-1">Destination</p>
                    <p className="font-bold text-gray-900 dark:text-white leading-snug">{selectedRide.destination.address}</p>
                  </div>
                </div>
              </div>

              {/* Cancellation Reason */}
              {selectedRide.cancellationReason && (
                <div className="bg-gradient-to-br from-red-50 to-red-100 dark:from-red-500/10 dark:to-red-500/5 p-5 rounded-[2rem] border border-red-200 dark:border-red-500/20 mb-8">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-8 h-8 bg-red-100 dark:bg-red-500/20 rounded-xl flex items-center justify-center">
                      <X className="w-4 h-4 text-red-600 dark:text-red-400" />
                    </div>
                    <p className="text-xs font-bold text-red-600 dark:text-red-400 uppercase tracking-wider">Cancellation Reason</p>
                  </div>
                  <p className="text-sm font-semibold text-red-700 dark:text-red-300 italic pl-10">
                    "{selectedRide.cancellationReason}"
                  </p>
                </div>
              )}

              {/* Rating Section */}
              {selectedRide.riderRating && (
                <div className="bg-gradient-to-br from-amber-50 to-yellow-50 dark:from-amber-500/10 dark:to-yellow-500/5 p-6 rounded-[2rem] border border-amber-200 dark:border-amber-500/20">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="text-[10px] font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider mb-3">Your Rating</p>
                      <div className="flex items-center gap-1 mb-3">
                        {[1, 2, 3, 4, 5].map((s) => (
                          <Star 
                            key={s} 
                            className={`w-6 h-6 ${
                              s <= selectedRide.riderRating! 
                                ? 'text-amber-400 fill-current drop-shadow-lg' 
                                : 'text-gray-200 dark:text-zinc-700'
                            }`} 
                          />
                        ))}
                      </div>
                      {selectedRide.ratingReason && (
                        <span className="inline-block text-xs font-bold text-amber-800 dark:text-amber-300 uppercase tracking-wider bg-amber-200/50 dark:bg-amber-500/20 px-3 py-1.5 rounded-xl">
                          {selectedRide.ratingReason}
                        </span>
                      )}
                    </div>
                    {getRiderProfile(selectedRide.id) && (
                      <div className="text-right">
                        {getRiderProfile(selectedRide.id)!.avatarUrl ? (
                          <img 
                            src={getRiderProfile(selectedRide.id)!.avatarUrl} 
                            className="w-14 h-14 rounded-2xl ring-2 ring-white dark:ring-zinc-800 shadow-lg mb-2" 
                            alt="" 
                          />
                        ) : (
                          <div className="w-14 h-14 bg-gradient-to-br from-amber-400 to-orange-600 rounded-2xl flex items-center justify-center ring-2 ring-white dark:ring-zinc-800 shadow-lg mb-2 mx-auto">
                            <UserIcon className="w-7 h-7 text-white" />
                          </div>
                        )}
                        <p className="text-xs font-bold text-gray-900 dark:text-white">
                          {getRiderProfile(selectedRide.id)!.name}
                        </p>
                        {getRiderProfile(selectedRide.id)!.vehicleModel && (
                          <p className="text-[10px] font-bold text-gray-400 dark:text-zinc-500 uppercase tracking-wider mt-0.5">
                            {getRiderProfile(selectedRide.id)!.vehicleModel}
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
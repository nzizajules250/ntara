import React, { useState, useEffect } from 'react';
import { User as FirebaseUser } from 'firebase/auth';
import { UserProfile, subscribeToUserRides, Ride, getUserProfile, db } from '../lib/firebase';
import { Clock, MapPin, Navigation, DollarSign, Calendar, ChevronRight, User as UserIcon, Star, X, ShieldCheck, Award, Compass, Search, Tag, Info, Heart, Settings, Moon, Sun } from 'lucide-react';
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
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'completed' | 'cancelled'>('all');

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

  // Filter rides based on search and status
  const filteredRides = history.filter(ride => {
    const matchesSearch = searchTerm === '' || 
      ride.pickup.address.toLowerCase().includes(searchTerm.toLowerCase()) ||
      ride.destination.address.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (ride.riderId && riders[ride.riderId]?.name.toLowerCase().includes(searchTerm.toLowerCase()));
    
    const matchesStatus = filterStatus === 'all' || ride.status === filterStatus;
    
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-3xl font-bold tracking-tight mb-2 text-gray-900 dark:text-white">{t('tripHistory')}</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400">{t('pastJourneys')}</p>
      </div>

      {/* Search and Filter Bar */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search by location or driver..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-white/90 dark:bg-gray-900/90 backdrop-blur-sm rounded-xl py-3 pl-11 pr-4 border border-gray-100 dark:border-gray-800 focus:outline-none focus:ring-2 focus:ring-orange-500 text-sm text-gray-900 dark:text-white"
          />
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setFilterStatus('all')}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
              filterStatus === 'all'
                ? 'bg-orange-500 text-white shadow-lg'
                : 'bg-white/90 dark:bg-gray-900/90 text-gray-600 dark:text-gray-400 border border-gray-100 dark:border-gray-800'
            }`}
          >
            All
          </button>
          <button
            onClick={() => setFilterStatus('completed')}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
              filterStatus === 'completed'
                ? 'bg-emerald-500 text-white shadow-lg'
                : 'bg-white/90 dark:bg-gray-900/90 text-gray-600 dark:text-gray-400 border border-gray-100 dark:border-gray-800'
            }`}
          >
            Completed
          </button>
          <button
            onClick={() => setFilterStatus('cancelled')}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
              filterStatus === 'cancelled'
                ? 'bg-red-500 text-white shadow-lg'
                : 'bg-white/90 dark:bg-gray-900/90 text-gray-600 dark:text-gray-400 border border-gray-100 dark:border-gray-800'
            }`}
          >
            Cancelled
          </button>
        </div>
      </div>

      {filteredRides.length === 0 ? (
        <div className="bg-white/90 dark:bg-gray-900/90 backdrop-blur-sm p-12 rounded-2xl border border-dashed border-gray-200 dark:border-gray-800 text-center">
          <div className="w-16 h-16 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-6">
            <HistoryIcon className="w-8 h-8 text-gray-300 dark:text-gray-600" />
          </div>
          <p className="font-semibold text-gray-900 dark:text-white">{t('noTrips')}</p>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{t('completeFirstRide')}</p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredRides.map((ride, i) => (
            <motion.div
              key={ride.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              onClick={() => setSelectedRide(ride)}
              className="bg-white/90 dark:bg-gray-900/90 backdrop-blur-sm p-5 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm cursor-pointer hover:border-orange-500 dark:hover:border-orange-500 transition-all group"
            >
              <div className="flex justify-between items-start mb-4">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                    ride.status === 'completed' 
                      ? 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600' 
                      : 'bg-red-100 dark:bg-red-500/20 text-red-600'
                  }`}>
                    <Calendar className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900 dark:text-white">
                      {ride.status === 'completed' ? t('successfulTrip') : t('cancelled')}
                    </p>
                    <p className="text-[10px] text-gray-400 dark:text-gray-500 font-bold uppercase tracking-wider">
                      {ride.createdAt?.toDate?.() 
                        ? ride.createdAt.toDate().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) 
                        : 'Recently'}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-lg font-bold text-gray-900 dark:text-white">
                    {ride.fare > 0 ? `$${ride.fare}` : t('byAgreement')}
                  </p>
                  <p className="text-[10px] text-gray-400 dark:text-gray-500 font-bold uppercase tracking-wider">
                    {profile.role === 'rider' ? t('earned') : t('paid')}
                  </p>
                </div>
              </div>

              <div className="space-y-2 mb-4">
                <div className="flex items-center gap-3">
                  <MapPin className="w-4 h-4 text-gray-400 group-hover:text-orange-500 transition-colors" />
                  <p className="text-xs text-gray-600 dark:text-gray-400 truncate flex-1">{ride.pickup.address}</p>
                </div>
                <div className="flex items-center gap-3">
                  <Navigation className="w-4 h-4 text-gray-400 group-hover:text-orange-500 transition-colors" />
                  <p className="text-xs text-gray-600 dark:text-gray-400 truncate flex-1">{ride.destination.address}</p>
                </div>
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-gray-100 dark:border-gray-800">
                {profile.role === 'passenger' && ride.riderId && riders[ride.riderId] ? (
                  <div className="flex items-center gap-2">
                    {riders[ride.riderId].avatarUrl ? (
                      <img src={riders[ride.riderId].avatarUrl} className="w-6 h-6 rounded-lg object-cover" alt="" />
                    ) : (
                      <div className="w-6 h-6 bg-gray-100 dark:bg-gray-800 rounded-lg flex items-center justify-center">
                        <UserIcon className="w-3 h-3 text-gray-400" />
                      </div>
                    )}
                    <span className="text-xs font-medium text-gray-700 dark:text-gray-300">{riders[ride.riderId].name}</span>
                    <button 
                      onClick={(e) => handleToggleFavorite(e, ride.riderId!)}
                      className={`p-1 rounded-md transition-colors ${
                        profile.favoriteUserIds?.includes(ride.riderId!) 
                          ? 'text-red-500' 
                          : 'text-gray-300 dark:text-gray-600 hover:text-red-400'
                      }`}
                    >
                      <Heart className={`w-3 h-3 ${profile.favoriteUserIds?.includes(ride.riderId!) ? 'fill-current' : ''}`} />
                    </button>
                  </div>
                ) : (
                  <div className="w-1" />
                )}
                
                <div className="flex items-center gap-3">
                  {ride.riderRating && (
                    <div className="flex items-center gap-0.5 text-amber-500 text-xs font-medium">
                      <Star className="w-3 h-3 fill-current" />
                      <span>{ride.riderRating}</span>
                    </div>
                  )}
                  <div className="bg-gray-100 dark:bg-gray-800 p-1.5 rounded-lg group-hover:bg-orange-500 group-hover:text-white transition-all">
                    <ChevronRight className="w-4 h-4" />
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Ride Detail Modal - iOS Bottom Sheet */}
      <AnimatePresence>
        {selectedRide && (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/60 backdrop-blur-md"
              onClick={() => setSelectedRide(null)}
            />
            <motion.div 
              initial={{ opacity: 0, y: '100%' }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="bg-white/95 dark:bg-gray-900/95 backdrop-blur-xl w-full max-w-md rounded-t-3xl sm:rounded-3xl p-6 relative z-10 shadow-2xl max-h-[90vh] overflow-y-auto"
            >
              {/* iOS Handle */}
              <div className="w-12 h-1 bg-gray-300 dark:bg-gray-700 rounded-full mx-auto mb-6 sm:hidden" />
              
              <button 
                onClick={() => setSelectedRide(null)}
                className="absolute top-4 right-4 p-2 bg-gray-100 dark:bg-gray-800 rounded-full text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors z-10"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="flex items-center gap-4 mb-6">
                <div className={`w-14 h-14 rounded-2xl flex items-center justify-center ${
                  selectedRide.status === 'completed' 
                    ? 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600' 
                    : 'bg-red-100 dark:bg-red-500/20 text-red-600'
                }`}>
                  <HistoryIcon className="w-7 h-7" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-gray-900 dark:text-white">Ride Details</h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400 font-mono">#{selectedRide.id.slice(-8).toUpperCase()}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 mb-6">
                <div className="bg-gray-50 dark:bg-gray-800/50 p-4 rounded-2xl">
                  <p className="text-[10px] text-gray-400 dark:text-gray-500 font-bold uppercase tracking-wider mb-1">
                    {selectedRide.fare > 0 ? 'Total Fare' : 'Fare'}
                  </p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">
                    {selectedRide.fare > 0 ? `$${selectedRide.fare}` : 'By Agreement'}
                  </p>
                  {selectedRide.promoCode && (
                    <div className="inline-flex items-center gap-1 mt-2 bg-emerald-500/10 text-emerald-600 px-2 py-1 rounded-lg text-[10px] font-bold">
                      <Tag className="w-3 h-3" />
                      {selectedRide.promoCode}
                    </div>
                  )}
                </div>
                <div className="bg-gray-50 dark:bg-gray-800/50 p-4 rounded-2xl">
                  <p className="text-[10px] text-gray-400 dark:text-gray-500 font-bold uppercase tracking-wider mb-1">Date & Time</p>
                  <p className="text-base font-bold text-gray-900 dark:text-white">
                    {selectedRide.createdAt?.toDate?.() 
                      ? selectedRide.createdAt.toDate().toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) 
                      : 'Today'}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">
                    {selectedRide.createdAt?.toDate?.() 
                      ? selectedRide.createdAt.toDate().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) 
                      : 'Just now'}
                  </p>
                </div>
              </div>

              <div className="space-y-4 mb-6">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 bg-blue-50 dark:bg-blue-500/10 rounded-full flex items-center justify-center flex-shrink-0">
                    <MapPin className="w-4 h-4 text-blue-600" />
                  </div>
                  <div className="flex-1">
                    <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider mb-0.5">Pickup</p>
                    <p className="text-sm font-medium text-gray-900 dark:text-white">{selectedRide.pickup.address}</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 bg-amber-50 dark:bg-amber-500/10 rounded-full flex items-center justify-center flex-shrink-0">
                    <Navigation className="w-4 h-4 text-amber-600" />
                  </div>
                  <div className="flex-1">
                    <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider mb-0.5">Destination</p>
                    <p className="text-sm font-medium text-gray-900 dark:text-white">{selectedRide.destination.address}</p>
                  </div>
                </div>
              </div>

              {selectedRide.cancellationReason && (
                <div className="bg-red-50 dark:bg-red-500/10 p-4 rounded-2xl mb-6 border border-red-100 dark:border-red-800/30">
                  <div className="flex items-center gap-2 mb-2">
                    <X className="w-4 h-4 text-red-500" />
                    <p className="text-[10px] text-red-500 font-bold uppercase tracking-wider">Cancellation Reason</p>
                  </div>
                  <p className="text-sm font-medium text-red-700 dark:text-red-400">{selectedRide.cancellationReason}</p>
                </div>
              )}

              {selectedRide.riderRating && (
                <div className="bg-amber-50 dark:bg-amber-500/10 p-4 rounded-2xl border border-amber-100 dark:border-amber-800/30">
                  <div className="flex justify-between items-center">
                    <div>
                      <p className="text-[10px] text-amber-600 font-bold uppercase tracking-wider mb-2">Your Rating</p>
                      <div className="flex items-center gap-1">
                        {[1, 2, 3, 4, 5].map((s) => (
                          <Star key={s} className={`w-5 h-5 ${
                            s <= selectedRide.riderRating! 
                              ? 'text-amber-400 fill-current' 
                              : 'text-gray-300 dark:text-gray-600'
                          }`} />
                        ))}
                      </div>
                      {selectedRide.ratingReason && (
                        <p className="text-xs font-medium text-amber-700 dark:text-amber-400 mt-2 capitalize">
                          Category: {selectedRide.ratingReason}
                        </p>
                      )}
                    </div>
                    {getRiderProfile(selectedRide.id) && (
                      <div className="text-right">
                        {getRiderProfile(selectedRide.id)!.avatarUrl ? (
                          <img src={getRiderProfile(selectedRide.id)!.avatarUrl} className="w-12 h-12 rounded-xl object-cover" alt="" />
                        ) : (
                          <div className="w-12 h-12 bg-gray-200 dark:bg-gray-800 rounded-xl flex items-center justify-center">
                            <UserIcon className="w-6 h-6 text-gray-400" />
                          </div>
                        )}
                        <p className="text-xs font-bold text-gray-900 dark:text-white mt-1">{getRiderProfile(selectedRide.id)!.name}</p>
                        {getRiderProfile(selectedRide.id)!.vehicleModel && (
                          <p className="text-[8px] font-bold text-gray-500 dark:text-gray-400 uppercase">
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
import { useState, useEffect } from 'react';
import { User as FirebaseUser } from 'firebase/auth';
import { Ride, db, getUserProfile, UserProfile } from '../lib/firebase';
import { Download, Calendar, Filter, Loader2, AlertCircle, MapPin, Clock, DollarSign, TrendingUp, Star, ChevronDown, FileText, BarChart3, Route, Users } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useLanguage } from '../lib/i18n';
import { formatDistanceKm, formatRwf } from '../lib/fareUtils';
import { collection, query, where, orderBy, getDocs } from 'firebase/firestore';

interface TripReportProps {
  user: FirebaseUser;
  userRole: 'passenger' | 'rider';
  passengerId?: string;
  riderId?: string;
}

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

export default function TripReport({ user, userRole, passengerId, riderId }: TripReportProps) {
  const { t } = useLanguage();
  const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [trips, setTrips] = useState<Ride[]>([]);
  const [userProfiles, setUserProfiles] = useState<{ [key: string]: UserProfile }>({});
  const [isLoading, setIsLoading] = useState(false);
  const [showFilters, setShowFilters] = useState(false);

  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 5 }, (_, i) => currentYear - i);

  useEffect(() => {
    loadTrips();
  }, [selectedMonth, selectedYear, userRole]);

  const loadTrips = async () => {
    setIsLoading(true);
    try {
      const startDate = new Date(selectedYear, selectedMonth, 1);
      const endDate = new Date(selectedYear, selectedMonth + 1, 0, 23, 59, 59);

      const q = userRole === 'passenger'
        ? query(
            collection(db, 'rides'),
            where('passengerId', '==', user.uid),
            where('status', '==', 'completed'),
            where('completedAt', '>=', startDate),
            where('completedAt', '<=', endDate),
            orderBy('completedAt', 'desc')
          )
        : query(
            collection(db, 'rides'),
            where('riderId', '==', user.uid),
            where('status', '==', 'completed'),
            where('completedAt', '>=', startDate),
            where('completedAt', '<=', endDate),
            orderBy('completedAt', 'desc')
          );

      const snapshot = await getDocs(q);
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Ride));
      setTrips(data);

      // Fetch user profiles for all unique user IDs
      const userIds = new Set<string>();
      data.forEach(trip => {
        if (trip.passengerId) userIds.add(trip.passengerId);
        if (trip.riderId) userIds.add(trip.riderId);
      });

      const profiles: { [key: string]: UserProfile } = {};
      await Promise.all(
        Array.from(userIds).map(async (uid) => {
          try {
            const profile = await getUserProfile(uid);
            if (profile) {
              profiles[uid] = profile;
            }
          } catch (error) {
            console.error(`Error fetching profile for ${uid}:`, error);
          }
        })
      );
      setUserProfiles(profiles);
    } catch (error) {
      console.error('Error loading trips:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const getUserName = (uid: string): string => {
    const profile = userProfiles[uid];
    if (profile?.name) return profile.name;
    return uid;
  };

  const getUserAvatar = (uid: string): string | null => {
    const profile = userProfiles[uid];
    return profile?.avatarUrl || null;
  };

  const exportToCSV = () => {
    const headers = userRole === 'passenger'
      ? ['Date', 'Driver', 'Pickup', 'Destination', 'Fare', 'Rating']
      : ['Date', 'Passenger', 'Pickup', 'Destination', 'Fare', 'Your Rating'];

    const rows = trips.map(trip => {
      const date = trip.completedAt?.toDate ? trip.completedAt.toDate() : new Date(trip.completedAt);
      return [
        date.toLocaleDateString(),
        userRole === 'passenger' 
          ? (trip.riderId ? getUserName(trip.riderId) : 'Unknown')
          : (trip.passengerId ? getUserName(trip.passengerId) : 'Unknown'),
        trip.pickup.address,
        trip.destination.address,
        trip.fare || '0',
        trip.riderRating || 'N/A'
      ];
    });

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    const element = document.createElement('a');
    element.setAttribute('href', 'data:text/csv;charset=utf-8,' + encodeURIComponent(csvContent));
    element.setAttribute('download', `trip-report-${MONTHS[selectedMonth]}-${selectedYear}.csv`);
    element.style.display = 'none';
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  const totalFare = trips.reduce((sum, trip) => sum + (trip.fare || 0), 0);
  const averageRating = trips.length > 0
    ? (trips.reduce((sum, trip) => sum + (trip.riderRating || 0), 0) / trips.length).toFixed(1)
    : '0';
  const totalDistanceMeters = trips.reduce((sum, trip) => sum + (trip.routeDistanceMeters || 0), 0);

  const stats = [
    { 
      label: 'Total Trips', 
      value: trips.length.toString(), 
      icon: Route, 
      color: 'from-violet-400 to-purple-600',
      bgColor: 'bg-violet-50 dark:bg-violet-500/10'
    },
    { 
      label: 'Total Fare', 
      value: formatRwf(totalFare), 
      icon: DollarSign, 
      color: 'from-emerald-400 to-green-600',
      bgColor: 'bg-emerald-50 dark:bg-emerald-500/10'
    },
    { 
      label: 'Avg Rating', 
      value: averageRating, 
      icon: Star, 
      color: 'from-amber-400 to-orange-600',
      bgColor: 'bg-amber-50 dark:bg-amber-500/10'
    },
    {
      label: 'Distance',
      value: formatDistanceKm(totalDistanceMeters),
      icon: Route,
      color: 'from-sky-400 to-blue-600',
      bgColor: 'bg-sky-50 dark:bg-sky-500/10'
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header with Gradient */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden bg-gradient-to-br from-violet-600 via-purple-600 to-indigo-700 dark:from-violet-900 dark:via-purple-900 dark:to-indigo-950 rounded-[2rem] sm:rounded-[3rem] p-5 sm:p-8 shadow-2xl shadow-purple-500/20"
      >
        <div className="absolute inset-0 opacity-20">
          <div className="absolute top-0 right-0 w-48 h-48 bg-white rounded-full -translate-y-1/2 translate-x-1/2 blur-3xl" />
          <div className="absolute bottom-0 left-0 w-32 h-32 bg-white rounded-full translate-y-1/2 -translate-x-1/2 blur-3xl" />
        </div>
        <div className="relative z-10 flex items-center justify-between">
          <div>
            <h2 className="text-3xl font-black text-white mb-2 flex items-center gap-3">
              <BarChart3 className="w-8 h-8" />
              Trip Report
            </h2>
            <p className="text-white/70 font-semibold">
              {MONTHS[selectedMonth]} {selectedYear}
            </p>
          </div>
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setShowFilters(!showFilters)}
            className="w-12 h-12 bg-white/20 backdrop-blur-sm rounded-2xl flex items-center justify-center text-white hover:bg-white/30 transition-all"
          >
            <Filter className="w-5 h-5" />
          </motion.button>
        </div>
      </motion.div>

      {/* Filters */}
      <AnimatePresence>
        {showFilters && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="bg-white dark:bg-zinc-900 rounded-[2.5rem] p-6 shadow-lg border border-gray-100 dark:border-zinc-800 space-y-4"
          >
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-gray-400 dark:text-zinc-500 uppercase tracking-wider px-1">
                  Month
                </label>
                <select
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(Number(e.target.value))}
                  className="w-full bg-gray-50 dark:bg-zinc-800 border-2 border-transparent focus:border-purple-500 dark:focus:border-purple-400 rounded-2xl px-5 py-3.5 font-semibold text-gray-900 dark:text-white transition-all outline-none"
                >
                  {MONTHS.map((month, idx) => (
                    <option key={idx} value={idx}>{month}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-gray-400 dark:text-zinc-500 uppercase tracking-wider px-1">
                  Year
                </label>
                <select
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(Number(e.target.value))}
                  className="w-full bg-gray-50 dark:bg-zinc-800 border-2 border-transparent focus:border-purple-500 dark:focus:border-purple-400 rounded-2xl px-5 py-3.5 font-semibold text-gray-900 dark:text-white transition-all outline-none"
                >
                  {years.map((year) => (
                    <option key={year} value={year}>{year}</option>
                  ))}
                </select>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Summary Stats */}
      {trips.length > 0 && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3">
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

      {/* Export Button */}
      <motion.button
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        onClick={exportToCSV}
        disabled={trips.length === 0 || isLoading}
        className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 text-white py-4 rounded-2xl font-bold hover:from-purple-700 hover:to-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed shadow-xl shadow-purple-500/25 transition-all flex items-center justify-center gap-3"
      >
        {isLoading ? (
          <Loader2 className="w-5 h-5 animate-spin" />
        ) : (
          <>
            <FileText className="w-5 h-5" />
            Export as CSV
          </>
        )}
      </motion.button>

      {/* Trips List */}
      <div className="space-y-3">
        {isLoading ? (
          <div className="flex justify-center py-12">
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
            >
              <Loader2 className="w-10 h-10 text-purple-600" />
            </motion.div>
          </div>
        ) : trips.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white dark:bg-zinc-900 rounded-[2.5rem] p-12 text-center border-2 border-dashed border-gray-200 dark:border-zinc-800"
          >
            <div className="w-20 h-20 bg-gradient-to-br from-gray-100 to-gray-200 dark:from-zinc-800 dark:to-zinc-700 rounded-[2rem] flex items-center justify-center mx-auto mb-6 shadow-lg">
              <AlertCircle className="w-10 h-10 text-gray-400 dark:text-zinc-500" />
            </div>
            <p className="text-lg font-bold text-gray-900 dark:text-white">
              No trips found
            </p>
            <p className="text-sm text-gray-500 dark:text-zinc-400 mt-1">
              for {MONTHS[selectedMonth]} {selectedYear}
            </p>
          </motion.div>
        ) : (
          trips.map((trip, index) => {
            const date = trip.completedAt?.toDate ? trip.completedAt.toDate() : new Date(trip.completedAt);
            const displayName = userRole === 'passenger' 
              ? (trip.riderId ? getUserName(trip.riderId) : 'Unknown Driver')
              : (trip.passengerId ? getUserName(trip.passengerId) : 'Unknown Passenger');
            const avatarUrl = userRole === 'passenger' 
              ? (trip.riderId ? getUserAvatar(trip.riderId) : null)
              : (trip.passengerId ? getUserAvatar(trip.passengerId) : null);
              
            return (
              <motion.div
                key={trip.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.05 }}
                whileHover={{ scale: 1.01, y: -2 }}
                className="bg-white dark:bg-zinc-900 rounded-[2rem] p-5 border border-gray-100 dark:border-zinc-800 shadow-sm hover:shadow-md hover:border-purple-300 dark:hover:border-purple-700 transition-all cursor-pointer group"
              >
                <div className="flex justify-between items-start mb-4">
                  <div className="flex-1">
                    {/* Date and Time */}
                    <div className="flex items-center gap-2 mb-3">
                      <div className="w-8 h-8 bg-purple-50 dark:bg-purple-500/10 rounded-xl flex items-center justify-center">
                        <Calendar className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-gray-900 dark:text-white">
                          {date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-zinc-400 font-semibold">
                          {date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                    </div>

                    {/* User Info */}
                    <div className="flex items-center gap-3 mb-3">
                      {avatarUrl ? (
                        <img src={avatarUrl} className="w-10 h-10 rounded-2xl ring-2 ring-gray-100 dark:ring-zinc-800 object-cover" alt="" />
                      ) : (
                        <div className="w-10 h-10 bg-gradient-to-br from-amber-400 to-orange-600 rounded-2xl flex items-center justify-center ring-2 ring-gray-100 dark:ring-zinc-800">
                          <Users className="w-5 h-5 text-white" />
                        </div>
                      )}
                      <div>
                        <p className="text-sm font-bold text-gray-900 dark:text-white">{displayName}</p>
                        <p className="text-[10px] font-semibold text-gray-400 dark:text-zinc-500 uppercase tracking-wider">
                          {userRole === 'passenger' ? 'Driver' : 'Passenger'}
                        </p>
                      </div>
                    </div>

                    {/* Locations */}
                    <div className="space-y-2">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-green-50 dark:bg-green-500/10 rounded-xl flex items-center justify-center flex-shrink-0">
                          <MapPin className="w-4 h-4 text-green-600" />
                        </div>
                        <span className="text-sm text-gray-600 dark:text-zinc-300 truncate group-hover:text-gray-900 dark:group-hover:text-white transition-colors">
                          {trip.pickup.address}
                        </span>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-red-50 dark:bg-red-500/10 rounded-xl flex items-center justify-center flex-shrink-0">
                          <MapPin className="w-4 h-4 text-red-600" />
                        </div>
                        <span className="text-sm text-gray-600 dark:text-zinc-300 truncate group-hover:text-gray-900 dark:group-hover:text-white transition-colors">
                          {trip.destination.address}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Fare and Rating */}
                  <div className="text-right ml-4">
                    <div className="bg-gradient-to-br from-gray-50 to-gray-100 dark:from-zinc-800 dark:to-zinc-900 rounded-2xl p-4 shadow-sm">
                      <p className="text-2xl font-black text-gray-900 dark:text-white">
                        {formatRwf(trip.fare || 0)}
                      </p>
                      {trip.discountAmount && trip.discountAmount > 0 && (
                        <p className="text-xs text-emerald-500 font-bold line-through opacity-75">
                          {formatRwf(trip.fare + trip.discountAmount)}
                        </p>
                      )}
                      {trip.riderRating && (
                        <div className="flex items-center gap-1 mt-2 bg-amber-50 dark:bg-amber-500/10 px-2.5 py-1 rounded-xl">
                          <Star className="w-3.5 h-3.5 text-amber-400 fill-current" />
                          <span className="text-xs font-bold text-amber-600 dark:text-amber-400">
                            {trip.riderRating}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </motion.div>
            );
          })
        )}
      </div>
    </div>
  );
}

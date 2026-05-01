import { useState, useEffect } from 'react';
import { User as FirebaseUser } from 'firebase/auth';
import { Ride, db, UserProfile } from '../lib/firebase';
import { BarChart3, TrendingUp, User as UserIcon, Loader2, AlertCircle, DollarSign, Star, Activity, ArrowUpRight, Users, Calendar, Route } from 'lucide-react';
import { motion } from 'motion/react';
import { formatRwf } from '../lib/fareUtils';
import { useLanguage } from '../lib/i18n';
import { collection, query, where, orderBy, getDocs, doc, getDoc } from 'firebase/firestore';

interface TripAnalyticsProps {
  user: FirebaseUser;
  userRole: 'passenger' | 'rider';
}

interface MonthlyStats {
  month: number;
  year: number;
  trips: number;
  totalFare: number;
  averageRating: number;
}

interface CompanionStats {
  userId: string;
  name: string;
  avatar?: string;
  trips: number;
  totalFare: number;
}

const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export default function TripAnalytics({ user, userRole }: TripAnalyticsProps) {
  const { t } = useLanguage();
  const [monthlyStats, setMonthlyStats] = useState<MonthlyStats[]>([]);
  const [companions, setCompanions] = useState<CompanionStats[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedMetric, setSelectedMetric] = useState<'trips' | 'fare' | 'rating'>('trips');

  useEffect(() => {
    loadAnalytics();
  }, [userRole, user.uid]);

  const loadAnalytics = async () => {
    setIsLoading(true);
    try {
      const completedRides: Ride[] = [];
      const now = new Date();

      for (let i = 0; i < 12; i++) {
        const month = (now.getMonth() - i + 12) % 12;
        const year = now.getFullYear() - Math.floor((now.getMonth() - i + 12) / 12);
        const startDate = new Date(year, month, 1);
        const endDate = new Date(year, month + 1, 0, 23, 59, 59);

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
        const monthRides = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Ride));
        completedRides.push(...monthRides);
      }

      const stats: { [key: string]: MonthlyStats } = {};
      const companionMap: { [key: string]: { trips: number; totalFare: number; profile: UserProfile | null } } = {};

      for (const ride of completedRides) {
        const date = ride.completedAt?.toDate ? ride.completedAt.toDate() : new Date(ride.completedAt);
        const monthKey = `${date.getFullYear()}-${date.getMonth()}`;

        if (!stats[monthKey]) {
          stats[monthKey] = {
            month: date.getMonth(),
            year: date.getFullYear(),
            trips: 0,
            totalFare: 0,
            averageRating: 0
          };
        }

        stats[monthKey].trips++;
        stats[monthKey].totalFare += ride.fare || 0;
        stats[monthKey].averageRating += ride.riderRating || 0;

        const companionId = userRole === 'passenger' ? ride.riderId : ride.passengerId;
        if (companionId) {
          if (!companionMap[companionId]) {
            companionMap[companionId] = { trips: 0, totalFare: 0, profile: null };
          }
          companionMap[companionId].trips++;
          companionMap[companionId].totalFare += ride.fare || 0;
        }
      }

      const monthlyArray = Object.values(stats).sort((a, b) => {
        if (a.year !== b.year) return a.year - b.year;
        return a.month - b.month;
      });

      monthlyArray.forEach(stat => {
        if (stat.trips > 0) {
          stat.averageRating = stat.averageRating / stat.trips;
        }
      });

      setMonthlyStats(monthlyArray);

      const companionStats: CompanionStats[] = [];
      for (const [userId, data] of Object.entries(companionMap)) {
        try {
          const userDoc = await getDoc(doc(db, 'users', userId));
          const profile = userDoc.data() as UserProfile;
          companionStats.push({
            userId,
            name: profile.name,
            avatar: profile.avatarUrl,
            trips: data.trips,
            totalFare: data.totalFare
          });
        } catch (e) {
          console.error('Error loading companion profile:', e);
        }
      }

      companionStats.sort((a, b) => b.trips - a.trips);
      setCompanions(companionStats.slice(0, 5));
    } catch (error) {
      console.error('Error loading analytics:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const getMaxValue = () => {
    if (selectedMetric === 'trips') {
      return Math.max(...monthlyStats.map(s => s.trips), 1);
    } else if (selectedMetric === 'fare') {
      return Math.max(...monthlyStats.map(s => s.totalFare), 1);
    } else {
      return 5;
    }
  };

  const maxValue = getMaxValue();
  
  const totalTrips = monthlyStats.reduce((sum, s) => sum + s.trips, 0);
  const avgMonthlyFare = monthlyStats.length > 0 
    ? monthlyStats.reduce((sum, s) => sum + s.totalFare, 0) / monthlyStats.length 
    : 0;
  const overallRating = monthlyStats.length > 0
    ? monthlyStats.reduce((sum, s) => sum + s.averageRating, 0) / monthlyStats.length
    : 0;

  const metrics = [
    { key: 'trips' as const, label: 'Trips', icon: Route, color: 'from-violet-400 to-purple-600' },
    { key: 'fare' as const, label: 'Earnings', icon: DollarSign, color: 'from-emerald-400 to-green-600' },
    { key: 'rating' as const, label: 'Rating', icon: Star, color: 'from-amber-400 to-orange-600' },
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
        <div className="relative z-10">
          <h2 className="text-3xl font-black text-white mb-2 flex items-center gap-3">
            <Activity className="w-8 h-8" />
            Analytics
          </h2>
          <p className="text-white/70 font-semibold">12-month performance overview</p>
        </div>
      </motion.div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
          >
            <Loader2 className="w-10 h-10 text-purple-600" />
          </motion.div>
        </div>
      ) : monthlyStats.length === 0 ? (
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-white dark:bg-zinc-900 rounded-[2.5rem] p-12 text-center border-2 border-dashed border-gray-200 dark:border-zinc-800"
        >
          <div className="w-20 h-20 bg-gradient-to-br from-gray-100 to-gray-200 dark:from-zinc-800 dark:to-zinc-700 rounded-[2rem] flex items-center justify-center mx-auto mb-6 shadow-lg">
            <BarChart3 className="w-10 h-10 text-gray-400 dark:text-zinc-500" />
          </div>
          <p className="text-lg font-bold text-gray-900 dark:text-white">
            No trip data available yet
          </p>
          <p className="text-sm text-gray-500 dark:text-zinc-400 mt-1">
            Complete your first ride to see analytics
          </p>
        </motion.div>
      ) : (
        <>
          {/* Metric Selector */}
          <div className="flex gap-2 p-1.5 bg-gray-100 dark:bg-zinc-800 rounded-2xl">
            {metrics.map((metric) => (
              <button
                key={metric.key}
                onClick={() => setSelectedMetric(metric.key)}
                className={`flex-1 py-3 px-4 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all ${
                  selectedMetric === metric.key
                    ? 'bg-white dark:bg-zinc-700 text-gray-900 dark:text-white shadow-lg'
                    : 'text-gray-500 dark:text-zinc-400 hover:text-gray-700 dark:hover:text-zinc-300'
                }`}
              >
                <metric.icon className="w-4 h-4" />
                {metric.label}
              </button>
            ))}
          </div>

          {/* Bar Chart */}
          <div className="bg-white dark:bg-zinc-900 rounded-[2.5rem] p-6 shadow-sm border border-gray-100 dark:border-zinc-800">
            <h3 className="text-xs font-black text-gray-400 dark:text-zinc-500 uppercase tracking-wider mb-6">
              Monthly {metrics.find(m => m.key === selectedMetric)?.label} Overview
            </h3>
            <div className="space-y-4">
              {monthlyStats.map((stat, index) => {
                let value = 0;
                let label = '';
                let barColor = '';

                if (selectedMetric === 'trips') {
                  value = stat.trips;
                  label = `${stat.trips} trip${stat.trips !== 1 ? 's' : ''}`;
                  barColor = 'from-violet-400 to-purple-600';
                } else if (selectedMetric === 'fare') {
                  value = stat.totalFare;
                  label = formatRwf(stat.totalFare);
                  barColor = 'from-emerald-400 to-green-600';
                } else {
                  value = stat.averageRating;
                  label = `${stat.averageRating.toFixed(1)} ⭐`;
                  barColor = 'from-amber-400 to-orange-600';
                }

                const percentage = (value / maxValue) * 100;

                return (
                  <motion.div
                    key={`${stat.year}-${stat.month}`}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.05 }}
                    className="space-y-2"
                  >
                    <div className="flex justify-between text-sm">
                      <span className="font-bold text-gray-700 dark:text-zinc-300">
                        {MONTHS_SHORT[stat.month]} {stat.year}
                      </span>
                      <span className="font-black text-gray-900 dark:text-white">{label}</span>
                    </div>
                    <div className="w-full bg-gray-100 dark:bg-zinc-800 rounded-full h-3 overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${percentage}%` }}
                        transition={{ duration: 0.8, delay: index * 0.05, ease: "easeOut" }}
                        className={`h-full bg-gradient-to-r ${barColor} rounded-full relative`}
                      >
                        {percentage > 15 && (
                          <div className="absolute inset-0 bg-white/20 rounded-full" />
                        )}
                      </motion.div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </div>

          {/* Summary Stats */}
          <div className="grid grid-cols-3 gap-3">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              whileHover={{ y: -4 }}
              className="bg-violet-50 dark:bg-violet-500/10 p-4 rounded-[2rem] border border-violet-100/50 dark:border-violet-500/20 shadow-sm hover:shadow-md transition-all duration-300 text-center"
            >
              <div className="w-10 h-10 bg-gradient-to-br from-violet-400 to-purple-600 rounded-2xl flex items-center justify-center mx-auto mb-3 shadow-lg">
                <Route className="w-5 h-5 text-white" />
              </div>
              <p className="text-xl font-black text-gray-900 dark:text-white leading-tight">{totalTrips}</p>
              <p className="text-[10px] font-bold text-gray-500 dark:text-zinc-400 uppercase tracking-wider mt-0.5">Total Trips</p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              whileHover={{ y: -4 }}
              className="bg-emerald-50 dark:bg-emerald-500/10 p-4 rounded-[2rem] border border-emerald-100/50 dark:border-emerald-500/20 shadow-sm hover:shadow-md transition-all duration-300 text-center"
            >
              <div className="w-10 h-10 bg-gradient-to-br from-emerald-400 to-green-600 rounded-2xl flex items-center justify-center mx-auto mb-3 shadow-lg">
                <DollarSign className="w-5 h-5 text-white" />
              </div>
              <p className="text-xl font-black text-gray-900 dark:text-white leading-tight">
                {formatRwf(avgMonthlyFare)}
              </p>
              <p className="text-[10px] font-bold text-gray-500 dark:text-zinc-400 uppercase tracking-wider mt-0.5">Avg/Month</p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              whileHover={{ y: -4 }}
              className="bg-amber-50 dark:bg-amber-500/10 p-4 rounded-[2rem] border border-amber-100/50 dark:border-amber-500/20 shadow-sm hover:shadow-md transition-all duration-300 text-center"
            >
              <div className="w-10 h-10 bg-gradient-to-br from-amber-400 to-orange-600 rounded-2xl flex items-center justify-center mx-auto mb-3 shadow-lg">
                <Star className="w-5 h-5 text-white" />
              </div>
              <p className="text-xl font-black text-amber-600 dark:text-amber-400 leading-tight">
                {overallRating.toFixed(1)}
              </p>
              <p className="text-[10px] font-bold text-gray-500 dark:text-zinc-400 uppercase tracking-wider mt-0.5">Avg Rating</p>
            </motion.div>
          </div>

          {/* Top Companions */}
          {companions.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="bg-white dark:bg-zinc-900 rounded-[2.5rem] p-6 shadow-sm border border-gray-100 dark:border-zinc-800"
            >
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 bg-gradient-to-br from-blue-400 to-cyan-600 rounded-2xl flex items-center justify-center shadow-lg">
                  <Users className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-gray-900 dark:text-white">
                    {userRole === 'passenger' ? 'Top Drivers' : 'Top Passengers'}
                  </h3>
                  <p className="text-xs font-semibold text-gray-400 dark:text-zinc-500 uppercase tracking-wider">
                    Most frequent companions
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                {companions.map((companion, index) => (
                  <motion.div
                    key={companion.userId}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.1 * index }}
                    whileHover={{ scale: 1.02 }}
                    className="flex items-center justify-between p-4 bg-gray-50 dark:bg-zinc-800 rounded-2xl hover:shadow-md transition-all cursor-pointer group"
                  >
                    <div className="flex items-center gap-3 flex-1">
                      {companion.avatar ? (
                        <img 
                          src={companion.avatar} 
                          className="w-11 h-11 rounded-2xl object-cover ring-2 ring-gray-100 dark:ring-zinc-700" 
                          alt="" 
                        />
                      ) : (
                        <div className="w-11 h-11 bg-gradient-to-br from-blue-400 to-cyan-600 rounded-2xl flex items-center justify-center text-white font-bold text-sm ring-2 ring-gray-100 dark:ring-zinc-700">
                          {companion.name.charAt(0).toUpperCase()}
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-gray-900 dark:text-white text-sm truncate">
                          {companion.name}
                        </p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-xs font-semibold text-gray-500 dark:text-zinc-400">
                            {companion.trips} trip{companion.trips !== 1 ? 's' : ''}
                          </span>
                          <span className="w-1 h-1 rounded-full bg-gray-300 dark:bg-zinc-600" />
                          <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">
                            {formatRwf(companion.totalFare)}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="w-8 h-8 bg-gray-200 dark:bg-zinc-700 rounded-xl flex items-center justify-center group-hover:bg-purple-600 dark:group-hover:bg-purple-500 group-hover:text-white transition-all">
                      <ArrowUpRight className="w-4 h-4" />
                    </div>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          )}
        </>
      )}
    </div>
  );
}

import { useState, useEffect } from 'react';
import { User as FirebaseUser } from 'firebase/auth';
import { Ride, db, UserProfile } from '../lib/firebase';
import { BarChart3, TrendingUp, User as UserIcon, Loader2, AlertCircle } from 'lucide-react';
import { motion } from 'motion/react';
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
      // Get last 12 months of completed rides
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

      // Calculate monthly stats
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

        // Track companions
        const companionId = userRole === 'passenger' ? ride.riderId : ride.passengerId;
        if (companionId) {
          if (!companionMap[companionId]) {
            companionMap[companionId] = { trips: 0, totalFare: 0, profile: null };
          }
          companionMap[companionId].trips++;
          companionMap[companionId].totalFare += ride.fare || 0;
        }
      }

      // Calculate average ratings
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

      // Load companion profiles
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

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white rounded-3xl shadow-lg p-6 space-y-6"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold flex items-center gap-3">
          <BarChart3 className="w-6 h-6 text-purple-600" />
          Analytics
        </h2>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-purple-600" />
        </div>
      ) : monthlyStats.length === 0 ? (
        <div className="text-center py-12">
          <AlertCircle className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 font-medium">No trip data available yet</p>
        </div>
      ) : (
        <>
          {/* Metric Selector */}
          <div className="flex gap-3 rounded-2xl bg-gray-100 p-1">
            {['trips', 'fare', 'rating'].map((metric) => (
              <button
                key={metric}
                onClick={() => setSelectedMetric(metric as any)}
                className={`flex-1 py-2 px-3 rounded-xl font-semibold transition-all capitalize ${
                  selectedMetric === metric
                    ? 'bg-white text-gray-900 shadow-md'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                {metric === 'fare' ? 'Earnings' : metric === 'rating' ? 'Rating' : 'Trips'}
              </button>
            ))}
          </div>

          {/* Bar Chart */}
          <div className="space-y-4">
            <div className="grid gap-2">
              {monthlyStats.map((stat) => {
                let value = 0;
                let label = '';

                if (selectedMetric === 'trips') {
                  value = stat.trips;
                  label = `${stat.trips} trip${stat.trips !== 1 ? 's' : ''}`;
                } else if (selectedMetric === 'fare') {
                  value = stat.totalFare;
                  label = `$${stat.totalFare.toFixed(2)}`;
                } else {
                  value = stat.averageRating;
                  label = `${stat.averageRating.toFixed(1)} ⭐`;
                }

                const percentage = (value / maxValue) * 100;

                return (
                  <motion.div
                    key={`${stat.year}-${stat.month}`}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="space-y-1"
                  >
                    <div className="flex justify-between text-sm">
                      <span className="font-semibold text-gray-700">
                        {MONTHS_SHORT[stat.month]} {stat.year}
                      </span>
                      <span className="font-bold text-gray-900">{label}</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${percentage}%` }}
                        transition={{ duration: 0.5, delay: 0.1 }}
                        className="h-full bg-gradient-to-r from-purple-500 to-blue-500 rounded-full"
                      />
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </div>

          {/* Summary Stats */}
          <div className="grid grid-cols-3 gap-3 pt-4 border-t">
            <div className="text-center">
              <p className="text-gray-600 text-xs font-semibold uppercase">Total</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">
                {monthlyStats.reduce((sum, s) => sum + s.trips, 0)}
              </p>
              <p className="text-xs text-gray-500 mt-1">trips</p>
            </div>
            <div className="text-center">
              <p className="text-gray-600 text-xs font-semibold uppercase">Average</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">
                ${(monthlyStats.reduce((sum, s) => sum + s.totalFare, 0) / monthlyStats.length).toFixed(0)}
              </p>
              <p className="text-xs text-gray-500 mt-1">per month</p>
            </div>
            <div className="text-center">
              <p className="text-gray-600 text-xs font-semibold uppercase">Rating</p>
              <p className="text-2xl font-bold text-amber-600 mt-1">
                {(monthlyStats.reduce((sum, s) => sum + s.averageRating, 0) / monthlyStats.length).toFixed(1)}
              </p>
              <p className="text-xs text-gray-500 mt-1">average</p>
            </div>
          </div>

          {/* Top Companions */}
          {companions.length > 0 && (
            <div className="pt-4 border-t space-y-3">
              <h3 className="font-bold text-gray-900 flex items-center gap-2">
                <UserIcon className="w-4 h-4 text-blue-600" />
                Top Companions
              </h3>
              {companions.map((companion) => (
                <motion.div
                  key={companion.userId}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex items-center justify-between p-3 bg-gray-50 rounded-2xl"
                >
                  <div className="flex items-center gap-3 flex-1">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-400 to-blue-400 flex items-center justify-center text-white font-bold text-sm">
                      {companion.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1">
                      <p className="font-semibold text-gray-900 text-sm">{companion.name}</p>
                      <p className="text-xs text-gray-500">{companion.trips} trip{companion.trips !== 1 ? 's' : ''}</p>
                    </div>
                  </div>
                  <p className="font-bold text-gray-900">${companion.totalFare.toFixed(2)}</p>
                </motion.div>
              ))}
            </div>
          )}
        </>
      )}
    </motion.div>
  );
}

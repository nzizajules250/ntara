import { useState, useEffect } from 'react';
import { User as FirebaseUser } from 'firebase/auth';
import { Ride, db, getUserProfile, UserProfile } from '../lib/firebase';
import { Download, Calendar, Filter, Loader2, AlertCircle, MapPin, Clock, DollarSign } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useLanguage } from '../lib/i18n';
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
    if (profile?.firstName && profile?.lastName) return `${profile.firstName} ${profile.lastName}`;
    if (profile?.firstName) return profile.firstName;
    return uid; // Fallback to ID if no name found
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

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white rounded-3xl shadow-lg p-6 space-y-6"
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold flex items-center gap-3">
          <Calendar className="w-6 h-6 text-blue-600" />
          Trip Report
        </h2>
        <button
          onClick={() => setShowFilters(!showFilters)}
          className="p-3 rounded-2xl bg-gray-100 hover:bg-gray-200 transition-all"
        >
          <Filter className="w-5 h-5" />
        </button>
      </div>

      {/* Filters */}
      <AnimatePresence>
        {showFilters && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="space-y-4 pb-4 border-b"
          >
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Month</label>
                <select
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(Number(e.target.value))}
                  className="w-full px-4 py-3 rounded-2xl border-2 border-gray-200 focus:border-blue-500 outline-none"
                >
                  {MONTHS.map((month, idx) => (
                    <option key={idx} value={idx}>{month}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Year</label>
                <select
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(Number(e.target.value))}
                  className="w-full px-4 py-3 rounded-2xl border-2 border-gray-200 focus:border-blue-500 outline-none"
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
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-blue-50 rounded-2xl p-4 text-center">
            <p className="text-gray-600 text-sm font-semibold">Total Trips</p>
            <p className="text-3xl font-bold text-blue-600 mt-1">{trips.length}</p>
          </div>
          <div className="bg-green-50 rounded-2xl p-4 text-center">
            <p className="text-gray-600 text-sm font-semibold">Total Fare</p>
            <p className="text-3xl font-bold text-green-600 mt-1">${totalFare.toFixed(2)}</p>
          </div>
          <div className="bg-amber-50 rounded-2xl p-4 text-center">
            <p className="text-gray-600 text-sm font-semibold">Avg Rating</p>
            <p className="text-3xl font-bold text-amber-600 mt-1">{averageRating}</p>
          </div>
        </div>
      )}

      {/* Export Button */}
      <button
        onClick={exportToCSV}
        disabled={trips.length === 0 || isLoading}
        className="w-full bg-blue-600 text-white py-3 rounded-2xl font-bold hover:bg-blue-700 disabled:opacity-50 transition-all flex items-center justify-center gap-2"
      >
        <Download className="w-5 h-5" />
        Export as CSV
      </button>

      {/* Trips List */}
      <div className="space-y-3">
        {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
          </div>
        ) : trips.length === 0 ? (
          <div className="text-center py-12">
            <AlertCircle className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500 font-medium">No trips found for {MONTHS[selectedMonth]} {selectedYear}</p>
          </div>
        ) : (
          trips.map((trip) => {
            const date = trip.completedAt?.toDate ? trip.completedAt.toDate() : new Date(trip.completedAt);
            const displayName = userRole === 'passenger' 
              ? (trip.riderId ? getUserName(trip.riderId) : 'Unknown Driver')
              : (trip.passengerId ? getUserName(trip.passengerId) : 'Unknown Passenger');
              
            return (
              <motion.div
                key={trip.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="bg-gray-50 rounded-2xl p-4 border border-gray-200 hover:border-blue-300 transition-all"
              >
                <div className="flex justify-between items-start mb-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <p className="text-sm text-gray-500">{date.toLocaleDateString()} at {date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                    </div>
                    <p className="text-sm font-semibold text-gray-800 mb-2">
                      {userRole === 'passenger' ? '👨‍✈️ ' : '🧑 '}
                      {displayName}
                    </p>
                    <div className="flex items-center gap-2 mt-2 text-sm text-gray-700">
                      <MapPin className="w-4 h-4 text-green-600" />
                      <span>{trip.pickup.address}</span>
                    </div>
                    <div className="flex items-center gap-2 mt-1 text-sm text-gray-700">
                      <MapPin className="w-4 h-4 text-red-600" />
                      <span>{trip.destination.address}</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-bold text-gray-900">${trip.fare || '0'}</p>
                    {trip.riderRating && (
                      <p className="text-sm text-amber-600 font-semibold mt-1">⭐ {trip.riderRating}</p>
                    )}
                  </div>
                </div>
              </motion.div>
            );
          })
        )}
      </div>
    </motion.div>
  );
}
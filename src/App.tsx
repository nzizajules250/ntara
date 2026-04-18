/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
import { auth, getUserProfile, UserProfile } from './lib/firebase';
import { onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { Moon, Sun, Car, LogOut, History, Smartphone, Loader2, User as UserIcon } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import PassengerDashboard from './components/PassengerDashboard';
import RiderDashboard from './components/RiderDashboard';
import RideHistory from './components/RideHistory';
import ProfileView from './components/ProfileView';
import Auth from './components/Auth';
import { NotificationProvider } from './components/NotificationCenter';

export default function App() {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'dashboard' | 'history' | 'profile'>('dashboard');
  const [isDark, setIsDark] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('theme') === 'dark';
    }
    return false;
  });

  useEffect(() => {
    const root = window.document.documentElement;
    if (isDark) {
      root.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      root.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [isDark]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setUser(user);
      if (user) {
        const p = await getUserProfile(user.uid);
        setProfile(p);
      } else {
        setProfile(null);
      }
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F5F5F5] flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
      </div>
    );
  }

  if (!user || !profile) {
    return <Auth onAuthSuccess={(p) => setProfile(p)} />;
  }

  return (
    <NotificationProvider>
      <div className="min-h-screen pb-24 lg:pb-0 font-sans transition-colors duration-300">
        <nav className="bg-white dark:bg-zinc-900 border-b border-gray-100 dark:border-zinc-800 sticky top-0 z-50">
          <div className="max-w-screen-xl mx-auto px-6 h-16 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-black dark:bg-white rounded-lg flex items-center justify-center">
                <Car className="w-5 h-5 text-white dark:text-black" />
              </div>
              <span className="font-bold text-xl tracking-tight dark:text-white">SwiftRide</span>
            </div>

            <div className="flex items-center gap-2 sm:gap-4">
              <button 
                onClick={() => setIsDark(!isDark)}
                className="p-2 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded-full transition-colors text-gray-500 dark:text-gray-400"
              >
                {isDark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
              </button>

              <div className="text-right hidden sm:block">
                <p className="text-sm font-semibold dark:text-white">{profile.name}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400 capitalize">{profile.role}</p>
              </div>
              <button 
                onClick={() => setView('profile')}
                className={`transition-all active:scale-95 ${view === 'profile' ? 'ring-2 ring-black dark:ring-white ring-offset-2 dark:ring-offset-zinc-900 rounded-full' : ''}`}
              >
                {profile.avatarUrl ? (
                  <img 
                    src={profile.avatarUrl} 
                    alt={profile.name} 
                    referrerPolicy="no-referrer" 
                    className="w-9 h-9 rounded-full object-cover border border-gray-100 dark:border-zinc-800 shadow-sm" 
                  />
                ) : (
                  <div className={`p-2 rounded-full transition-colors ${view === 'profile' ? 'bg-black dark:bg-white text-white dark:text-black' : 'bg-gray-100 dark:bg-zinc-800 text-gray-500 dark:text-gray-400'}`}>
                    <UserIcon className="w-5 h-5" />
                  </div>
                )}
              </button>
            </div>
          </div>
        </nav>

        <main className="max-w-3xl mx-auto p-6">
          <AnimatePresence mode="wait">
            {view === 'dashboard' ? (
              <motion.div
                key="dashboard"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
              >
                {profile.role === 'passenger' ? (
                  <PassengerDashboard user={user} profile={profile} />
                ) : (
                  <RiderDashboard user={user} profile={profile} />
                )}
              </motion.div>
            ) : view === 'history' ? (
              <motion.div
                key="history"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
              >
                <RideHistory user={user} profile={profile} />
              </motion.div>
            ) : (
              <motion.div
                key="profile"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
              >
                <ProfileView profile={profile} />
              </motion.div>
            )}
          </AnimatePresence>
        </main>

        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-xl border border-gray-200 dark:border-zinc-800 rounded-full p-2 shadow-2xl flex items-center gap-2 z-50 overflow-hidden">
          <button 
            onClick={() => setView('dashboard')}
            className={`flex items-center gap-2 px-6 py-3 rounded-full font-medium transition-all ${view === 'dashboard' ? 'bg-black dark:bg-white text-white dark:text-black shadow-lg' : 'dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-zinc-800'}`}
          >
            <Smartphone className="w-5 h-5" />
            <span>Ride</span>
          </button>
          <button 
            onClick={() => setView('history')}
            className={`flex items-center gap-2 px-6 py-3 rounded-full font-medium transition-all ${view === 'history' ? 'bg-black dark:bg-white text-white dark:text-black shadow-lg' : 'dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-zinc-800'}`}
          >
            <History className="w-5 h-5" />
            <span>History</span>
          </button>
          <button 
            onClick={() => setView('profile')}
            className={`flex items-center gap-2 px-6 py-3 rounded-full font-medium transition-all ${view === 'profile' ? 'bg-black dark:bg-white text-white dark:text-black shadow-lg' : 'dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-zinc-800'}`}
          >
            {profile.avatarUrl ? (
              <img src={profile.avatarUrl} alt="" referrerPolicy="no-referrer" className={`w-5 h-5 rounded-full object-cover transition-all ${view === 'profile' ? 'ring-1 ring-white dark:ring-black' : ''}`} />
            ) : (
              <UserIcon className="w-5 h-5" />
            )}
            <span>Profile</span>
          </button>
        </div>
      </div>
    </NotificationProvider>
  );
}

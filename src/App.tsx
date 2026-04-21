/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
import { auth, getUserProfile, UserProfile, subscribeToUserProfile } from './lib/firebase';
import { onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { Moon, Sun, LogOut, History, Smartphone, Loader2, User as UserIcon, Download, X, HelpCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import PassengerDashboard from './components/PassengerDashboard';
import RiderDashboard from './components/RiderDashboard';
import RideHistory from './components/RideHistory';
import ProfileView from './components/ProfileView';
import HowItWorks from './components/HowItWorks';
import Auth from './components/Auth';
import { NotificationProvider } from './components/NotificationCenter';
import { LanguageProvider, useLanguage } from './lib/i18n';
import LanguageSelector from './components/LanguageSelector';

function AppContent() {
  const { language, t } = useLanguage();
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'dashboard' | 'history' | 'profile' | 'how-it-works'>('dashboard');
  const [isDark, setIsDark] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('theme') === 'dark';
    }
    return false;
  });
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showInstallPrompt, setShowInstallPrompt] = useState(false);

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

  // PWA Install Prompt Handler
  useEffect(() => {
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShowInstallPrompt(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallApp = async () => {
    if (!deferredPrompt) return;

    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    
    if (outcome === 'accepted') {
      setDeferredPrompt(null);
      setShowInstallPrompt(false);
    }
  };

  useEffect(() => {
    let unsubscribeProfile: (() => void) | null = null;

    const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
      setUser(user);
      if (user) {
        // Initial fetch
        const p = await getUserProfile(user.uid);
        setProfile(p);
        
        // Subscription for real-time updates (e.g. after editing profile)
        unsubscribeProfile = subscribeToUserProfile(user.uid, (updatedProfile) => {
          setProfile(updatedProfile);
        });
      } else {
        setProfile(null);
        if (unsubscribeProfile) {
          unsubscribeProfile();
          unsubscribeProfile = null;
        }
      }
      setLoading(false);
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeProfile) unsubscribeProfile();
    };
  }, []);

  if (!language) {
    return <LanguageSelector />;
  }

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
      <div className="min-h-screen pb-20 lg:pb-0 font-sans transition-colors duration-300">
        {/* PWA Install Prompt */}
        <AnimatePresence>
          {showInstallPrompt && deferredPrompt && (
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="fixed top-4 left-4 right-4 z-[100] bg-black text-white rounded-2xl shadow-2xl p-4 sm:max-w-md sm:left-auto sm:right-4"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <Download className="w-5 h-5 text-emerald-400" />
                    <p className="font-bold text-sm uppercase tracking-widest">Install  Ntwara</p>
                  </div>
                  <p className="text-xs text-gray-300 mb-4">Install our app for faster access  Works great on mobile!</p>
                  <div className="flex gap-2">
                    <button
                      onClick={handleInstallApp}
                      className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-black font-bold py-2 px-4 rounded-xl transition-colors text-sm"
                    >
                      Install Now
                    </button>
                    <button
                      onClick={() => setShowInstallPrompt(false)}
                      className="px-4 py-2 bg-white/10 hover:bg-white/20 rounded-xl transition-colors text-sm font-bold"
                    >
                      Later
                    </button>
                  </div>
                </div>
                <button
                  onClick={() => setShowInstallPrompt(false)}
                  className="text-gray-400 hover:text-white transition-colors flex-shrink-0"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <nav className="bg-white dark:bg-zinc-900 border-b border-gray-100 dark:border-zinc-800 sticky top-0 z-50">
          <div className="max-w-7xl mx-auto px-3 sm:px-6 h-14 sm:h-16 flex items-center justify-between">
            <button
              onClick={() => setView('dashboard')}
              className="flex items-center transition-transform hover:scale-[1.02] active:scale-[0.99]"
            >
              <img
                src="/ntwara-logo.png"
                alt="Ntwara"
                className="h-12 sm:h-14 w-auto object-contain"
              />
            </button>

            <div className="flex items-center gap-1 sm:gap-4">
              <button 
                onClick={() => setIsDark(!isDark)}
                className="p-2 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded-full transition-colors text-gray-500 dark:text-gray-400"
              >
                {isDark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
              </button>

              <div className="text-right hidden sm:block">
                <p className="text-sm font-semibold dark:text-white">{profile.name}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400 capitalize">{t(profile.role as any)}</p>
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
                    className="w-8 sm:w-9 h-8 sm:h-9 rounded-full object-cover border border-gray-100 dark:border-zinc-800 shadow-sm" 
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

        <div className="hidden lg:block max-w-4xl mx-auto px-6 pt-5">
          <div className="flex items-center justify-center gap-1 rounded-full border border-zinc-700/80 bg-zinc-900/95 p-2 text-sm text-white shadow-xl shadow-black/10 backdrop-blur-xl">
            <button 
              onClick={() => setView('dashboard')}
              className={`flex min-w-[9rem] items-center justify-center gap-2 rounded-full px-6 py-3 font-medium transition-all ${view === 'dashboard' ? 'bg-zinc-100 text-zinc-950 shadow-sm text-[11px] uppercase tracking-[0.24em]' : 'text-zinc-400 hover:bg-white/8 hover:text-white'}`}
            >
              <Smartphone className="w-5 h-5" />
              <span>{profile.role === 'passenger' ? t('passenger') : t('rider')}</span>
            </button>
            <button 
              onClick={() => setView('history')}
              className={`flex min-w-[9rem] items-center justify-center gap-2 rounded-full px-6 py-3 font-medium transition-all ${view === 'history' ? 'bg-zinc-100 text-zinc-950 shadow-sm text-[11px] uppercase tracking-[0.24em]' : 'text-zinc-400 hover:bg-white/8 hover:text-white'}`}
            >
              <History className="w-5 h-5" />
              <span>{t('history')}</span>
            </button>
            <button 
              onClick={() => setView('how-it-works')}
              className={`flex min-w-[9rem] items-center justify-center gap-2 rounded-full px-6 py-3 font-medium transition-all ${view === 'how-it-works' ? 'bg-zinc-100 text-zinc-950 shadow-sm text-[11px] uppercase tracking-[0.24em]' : 'text-zinc-400 hover:bg-white/8 hover:text-white'}`}
            >
              <HelpCircle className="w-5 h-5" />
              <span>{t('guide')}</span>
            </button>
            <button 
              onClick={() => setView('profile')}
              className={`flex min-w-[9rem] items-center justify-center gap-2 rounded-full px-6 py-3 font-medium transition-all ${view === 'profile' ? 'bg-zinc-100 text-zinc-950 shadow-sm text-[11px] uppercase tracking-[0.24em]' : 'text-zinc-400 hover:bg-white/8 hover:text-white'}`}
            >
              {profile.avatarUrl ? (
                <img src={profile.avatarUrl} alt="" referrerPolicy="no-referrer" className={`h-5 w-5 rounded-full object-cover transition-all ${view === 'profile' ? 'ring-1 ring-zinc-950' : 'ring-1 ring-transparent'}`} />
              ) : (
                <UserIcon className="w-5 h-5" />
              )}
              <span>{t('profile')}</span>
            </button>
          </div>
        </div>

        <main className="max-w-4xl mx-auto p-3 pb-24 sm:p-6 sm:pb-28 lg:pt-5 lg:pb-10">
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
            ) : view === 'how-it-works' ? (
              <motion.div
                key="how-it-works"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
              >
                <HowItWorks profile={profile} />
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

        {/* Mobile Bottom Navigation */}
        <div className="fixed bottom-0 left-0 right-0 lg:hidden bg-white dark:bg-zinc-900 border-t border-gray-200 dark:border-zinc-800 z-40">
          <div className="flex items-center justify-around h-16 px-2">
            <button 
              onClick={() => setView('dashboard')}
              className={`flex flex-col items-center justify-center py-2 px-3 rounded-lg transition-all ${view === 'dashboard' ? 'bg-black/5 dark:bg-white/10 text-black dark:text-white' : 'text-gray-500 dark:text-gray-400'}`}
            >
              <Smartphone className="w-6 h-6" />
              <span className="text-[10px] font-bold mt-1">{profile.role === 'passenger' ? t('passenger') : t('rider')}</span>
            </button>
            <button 
              onClick={() => setView('history')}
              className={`flex flex-col items-center justify-center py-2 px-3 rounded-lg transition-all ${view === 'history' ? 'bg-black/5 dark:bg-white/10 text-black dark:text-white' : 'text-gray-500 dark:text-gray-400'}`}
            >
              <History className="w-6 h-6" />
              <span className="text-[10px] font-bold mt-1">{t('history')}</span>
            </button>
            <button 
              onClick={() => setView('how-it-works')}
              className={`flex flex-col items-center justify-center py-2 px-3 rounded-lg transition-all ${view === 'how-it-works' ? 'bg-black/5 dark:bg-white/10 text-black dark:text-white' : 'text-gray-500 dark:text-gray-400'}`}
            >
              <HelpCircle className="w-6 h-6" />
              <span className="text-[10px] font-bold mt-1">{t('guide')}</span>
            </button>
            <button 
              onClick={() => setView('profile')}
              className={`flex flex-col items-center justify-center py-2 px-3 rounded-lg transition-all ${view === 'profile' ? 'bg-black/5 dark:bg-white/10 text-black dark:text-white' : 'text-gray-500 dark:text-gray-400'}`}
            >
              <UserIcon className="w-6 h-6" />
              <span className="text-[10px] font-bold mt-1">{t('profile')}</span>
            </button>
          </div>
        </div>

      </div>
    </NotificationProvider>
  );
}

export default function App() {
  return (
    <LanguageProvider>
      <AppContent />
    </LanguageProvider>
  );
}

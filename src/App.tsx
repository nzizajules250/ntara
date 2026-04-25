/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
import { auth, getUserProfile, UserProfile, subscribeToUserProfile } from './lib/firebase';
import { onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { Moon, Sun, LogOut, History, Smartphone, Loader2, User as UserIcon, Download, X, HelpCircle, Settings } from 'lucide-react';
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
import WelcomeScreen from './components/WelcomeScreen';

function AppContent() {
  const { language, t } = useLanguage();
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'dashboard' | 'history' | 'profile' | 'how-it-works'>('dashboard');
  
  // Dark mode - default to true
  const [isDark, setIsDark] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('theme');
      return saved === 'dark' || saved === null; // Default to dark
    }
    return true;
  });
  
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showInstallPrompt, setShowInstallPrompt] = useState(false);
  const [showWelcome, setShowWelcome] = useState(() => {
    if (typeof window === 'undefined') {
      return false;
    }

    const savedLanguage = localStorage.getItem('language');
    return savedLanguage ? localStorage.getItem(`welcome_seen_${savedLanguage}`) !== 'true' : false;
  });

  // Apply dark mode
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
        const p = await getUserProfile(user.uid);
        setProfile(p);
        
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

  useEffect(() => {
    if (!language) {
      setShowWelcome(false);
      return;
    }

    setShowWelcome(localStorage.getItem(`welcome_seen_${language}`) !== 'true');
  }, [language]);

  const handleWelcomeContinue = () => {
    if (language) {
      localStorage.setItem(`welcome_seen_${language}`, 'true');
    }
    setShowWelcome(false);
  };

  if (!language) {
    return <LanguageSelector />;
  }

  if (showWelcome) {
    return <WelcomeScreen onContinue={handleWelcomeContinue} />;
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
      </div>
    );
  }

  if (!user || !profile) {
    return <Auth onAuthSuccess={(p) => setProfile(p)} />;
  }

  return (
    <NotificationProvider>
      <div className="min-h-screen pb-16 font-sans transition-colors duration-300">
        {/* PWA Install Prompt */}
        <AnimatePresence>
          {showInstallPrompt && deferredPrompt && (
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="fixed top-4 left-4 right-4 z-[100] bg-black/95 backdrop-blur-xl text-white rounded-2xl shadow-2xl p-4 sm:max-w-md sm:left-auto sm:right-4 border border-white/10"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <Download className="w-5 h-5 text-orange-400" />
                    <p className="font-bold text-sm uppercase tracking-widest">Install Ntwara</p>
                  </div>
                  <p className="text-xs text-gray-300 mb-4">Install our app for faster access. Works great on mobile!</p>
                  <div className="flex gap-2">
                    <button
                      onClick={handleInstallApp}
                      className="flex-1 bg-orange-500 hover:bg-orange-600 text-white font-bold py-2 px-4 rounded-xl transition-colors text-sm"
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

        {/* Header - Logo only, no theme toggle */}
        <div className="bg-black/20 dark:bg-white/5 backdrop-blur-xl border-b border-white/10 sticky top-0 z-50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 sm:h-16 flex items-center justify-between">
            <button
              onClick={() => setView('dashboard')}
              className="flex items-center transition-transform hover:scale-[1.02] active:scale-[0.99]"
            >
              <img
                src="/ntwara-logo.png"
                alt="Ntwara"
                className="h-10 sm:h-12 w-auto object-contain brightness-0 invert"
              />
              <span className="ml-2 text-xl font-bold text-white hidden sm:inline">Ntwara</span>
            </button>

            {/* Profile button - theme toggle moved to profile */}
            <button 
              onClick={() => setView('profile')}
              className={`transition-all active:scale-95 ${
                view === 'profile' 
                  ? 'ring-2 ring-orange-500 ring-offset-2 ring-offset-black rounded-full' 
                  : ''
              }`}
            >
              {profile.avatarUrl ? (
                <img 
                  src={profile.avatarUrl} 
                  alt={profile.name} 
                  referrerPolicy="no-referrer" 
                  className="w-8 sm:w-9 h-8 sm:h-9 rounded-full object-cover border border-white/20 shadow-sm" 
                />
              ) : (
                <div className={`p-2 rounded-full transition-colors ${
                  view === 'profile' 
                    ? 'bg-orange-500 text-white' 
                    : 'bg-white/10 text-white/70'
                }`}>
                  <UserIcon className="w-5 h-5" />
                </div>
              )}
            </button>
          </div>
        </div>

        {/* Main Content - With bottom padding for menu */}
        <main className="max-w-7xl mx-auto px-3 sm:px-6 py-4 pb-24 sm:pb-6">
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

        {/* Bottom Navigation Bar - Both Mobile and Desktop */}
        <div className="fixed bottom-0 left-0 right-0 bg-black/80 dark:bg-black/90 backdrop-blur-xl border-t border-white/10 z-40 shadow-lg">
          <div className="max-w-7xl mx-auto px-2 sm:px-4">
            <div className="flex items-center justify-around h-16 sm:h-14">
              <button 
                onClick={() => setView('dashboard')}
                className={`flex flex-col items-center justify-center py-2 px-3 rounded-xl transition-all ${
                  view === 'dashboard' 
                    ? 'text-orange-500' 
                    : 'text-white/50 hover:text-white/80'
                }`}
              >
                <Smartphone className="w-5 h-5 sm:w-6 sm:h-6" />
                <span className="text-[10px] font-medium mt-1 sm:text-xs">
                  {profile.role === 'passenger' ? t('passenger') : t('rider')}
                </span>
              </button>
              
              <button 
                onClick={() => setView('history')}
                className={`flex flex-col items-center justify-center py-2 px-3 rounded-xl transition-all ${
                  view === 'history' 
                    ? 'text-orange-500' 
                    : 'text-white/50 hover:text-white/80'
                }`}
              >
                <History className="w-5 h-5 sm:w-6 sm:h-6" />
                <span className="text-[10px] font-medium mt-1 sm:text-xs">{t('history')}</span>
              </button>
              
              <button 
                onClick={() => setView('how-it-works')}
                className={`flex flex-col items-center justify-center py-2 px-3 rounded-xl transition-all ${
                  view === 'how-it-works' 
                    ? 'text-orange-500' 
                    : 'text-white/50 hover:text-white/80'
                }`}
              >
                <HelpCircle className="w-5 h-5 sm:w-6 sm:h-6" />
                <span className="text-[10px] font-medium mt-1 sm:text-xs">{t('guide')}</span>
              </button>
              
              <button 
                onClick={() => setView('profile')}
                className={`flex flex-col items-center justify-center py-2 px-3 rounded-xl transition-all ${
                  view === 'profile' 
                    ? 'text-orange-500' 
                    : 'text-white/50 hover:text-white/80'
                }`}
              >
                <UserIcon className="w-5 h-5 sm:w-6 sm:h-6" />
                <span className="text-[10px] font-medium mt-1 sm:text-xs">{t('profile')}</span>
              </button>
            </div>
            
            {/* Home Indicator for iOS */}
            <div className="pb-2 flex justify-center sm:hidden">
              <div className="w-32 h-1 bg-white/20 rounded-full" />
            </div>
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
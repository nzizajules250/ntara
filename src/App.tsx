/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
import { auth, getUserProfile, UserProfile, subscribeToUserProfile } from './lib/firebase';
import { onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { Moon, Sun, LogOut, History, Smartphone, Loader2, User as UserIcon, Download, X, HelpCircle, Sparkles, Headphones } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import PassengerDashboard from './components/PassengerDashboard';
import RiderDashboard from './components/RiderDashboard';
import RideHistory from './components/RideHistory';
import ProfileView from './components/ProfileView';
import HowItWorks from './components/HowItWorks';
import ContactPage from './components/ContactPage';
import Auth from './components/Auth';
import { NotificationProvider, NotificationBellButton } from './components/NotificationCenter';
import { LanguageProvider, useLanguage } from './lib/i18n';
import LanguageSelector from './components/LanguageSelector';
import WelcomeScreen from './components/WelcomeScreen';

function AuthenticatedAppShell({
  user,
  profile,
  view,
  setView,
  isDark,
  setIsDark,
  showInstallPrompt,
  deferredPrompt,
  handleInstallApp,
  setShowInstallPrompt,
  t
}: {
  user: FirebaseUser;
  profile: UserProfile;
  view: 'dashboard' | 'history' | 'profile' | 'how-it-works' | 'contact';
  setView: (view: 'dashboard' | 'history' | 'profile' | 'how-it-works' | 'contact') => void;
  isDark: boolean;
  setIsDark: (value: boolean) => void;
  showInstallPrompt: boolean;
  deferredPrompt: any;
  handleInstallApp: () => Promise<void>;
  setShowInstallPrompt: (value: boolean) => void;
  t: (key: any) => string;
}) {
  return (
    <NotificationProvider>
      <div className="min-h-screen pb-20 lg:pb-0 font-sans transition-colors duration-500 bg-slate-50 dark:bg-slate-950 relative overflow-hidden">
        {/* Dynamic Ambient Background */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none z-0 fixed">
          <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-purple-400/30 dark:bg-purple-600/30 rounded-full blur-[120px] mix-blend-multiply dark:mix-blend-screen animate-pulse" style={{ animationDuration: '4s' }} />
          <div className="absolute top-[20%] right-[-10%] w-[40%] h-[40%] bg-indigo-400/30 dark:bg-indigo-600/30 rounded-full blur-[100px] mix-blend-multiply dark:mix-blend-screen animate-pulse" style={{ animationDuration: '5s', animationDelay: '1s' }} />
          <div className="absolute bottom-[-20%] left-[20%] w-[60%] h-[60%] bg-blue-400/20 dark:bg-blue-600/20 rounded-full blur-[130px] mix-blend-multiply dark:mix-blend-screen animate-pulse" style={{ animationDuration: '6s', animationDelay: '2s' }} />
        </div>
        <AnimatePresence>
          {showInstallPrompt && deferredPrompt && (
            <motion.div
              initial={{ opacity: 0, y: -50, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -50, scale: 0.95 }}
              className="fixed top-4 left-4 right-4 z-[100] bg-gradient-to-br from-gray-900 to-black dark:from-zinc-800 dark:to-zinc-900 text-white rounded-[2rem] shadow-2xl p-5 sm:max-w-md sm:left-auto sm:right-4 border border-white/10"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-8 h-8 bg-gradient-to-br from-emerald-400 to-emerald-600 rounded-xl flex items-center justify-center">
                      <Download className="w-4 h-4 text-white" />
                    </div>
                    <p className="font-black text-sm uppercase tracking-wider">Install Ntwara</p>
                  </div>
                  <p className="text-xs text-gray-400 mb-4 font-medium">Install our app for faster access. Works great on mobile!</p>
                  <div className="flex gap-2">
                    <motion.button
                      whileTap={{ scale: 0.95 }}
                      onClick={handleInstallApp}
                      className="flex-1 bg-gradient-to-r from-emerald-500 to-emerald-600 text-white font-bold py-2.5 px-4 rounded-xl transition-all text-sm shadow-lg shadow-emerald-500/25"
                    >
                      Install Now
                    </motion.button>
                    <motion.button
                      whileTap={{ scale: 0.95 }}
                      onClick={() => setShowInstallPrompt(false)}
                      className="px-4 py-2.5 bg-white/10 hover:bg-white/20 rounded-xl transition-all text-sm font-bold"
                    >
                      Later
                    </motion.button>
                  </div>
                </div>
                <button onClick={() => setShowInstallPrompt(false)} className="text-gray-500 hover:text-white transition-colors flex-shrink-0 p-1">
                  <X className="w-5 h-5" />
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <nav className="bg-white/60 dark:bg-white/5 backdrop-blur-3xl border-b border-white/60 dark:border-white/10 sticky top-0 z-50 transition-colors duration-500 shadow-[0_4px_30px_rgba(0,0,0,0.1)]">
          <div className="max-w-7xl mx-auto px-3 sm:px-6 h-14 sm:h-16 flex items-center justify-between relative z-10">
            <button onClick={() => setView('dashboard')} className="flex items-center transition-transform hover:scale-[1.02] active:scale-[0.99]">
              <img src="/ntwara-logo.png" alt="Ntwara" className="h-12 sm:h-14 w-auto object-contain" />
            </button>

            <div className="flex items-center gap-1.5 sm:gap-3">
              <NotificationBellButton />
              <motion.button 
                whileTap={{ scale: 0.9 }}
                onClick={() => setIsDark(!isDark)}
                className="p-2.5 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded-xl transition-colors text-gray-500 dark:text-gray-400"
              >
                {isDark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
              </motion.button>

              <div className="text-right hidden sm:block">
                <p className="text-sm font-bold dark:text-white">{profile.name}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400 capitalize font-semibold">{t(profile.role as any)}</p>
              </div>
              <motion.button 
                whileTap={{ scale: 0.9 }}
                onClick={() => setView('profile')}
                className={`transition-all ${view === 'profile' ? 'ring-2 ring-purple-500 ring-offset-2 dark:ring-offset-zinc-900 rounded-full' : ''}`}
              >
                {profile.avatarUrl ? (
                  <img src={profile.avatarUrl} alt={profile.name} referrerPolicy="no-referrer" className="w-9 h-9 rounded-full object-cover ring-2 ring-gray-100 dark:ring-zinc-800 shadow-sm" />
                ) : (
                  <div className={`p-2 rounded-full transition-all ${view === 'profile' ? 'bg-gradient-to-br from-purple-600 to-indigo-600 text-white shadow-lg' : 'bg-gray-100 dark:bg-zinc-800 text-gray-500 dark:text-gray-400'}`}>
                    <UserIcon className="w-5 h-5" />
                  </div>
                )}
              </motion.button>
            </div>
          </div>
        </nav>

        <div className="hidden lg:block max-w-4xl mx-auto px-6 pt-5">
          <div className="flex items-center justify-center gap-2 rounded-2xl bg-white dark:bg-zinc-900 p-1.5 shadow-sm border border-gray-100 dark:border-zinc-800">
            {[
              { key: 'dashboard' as const, icon: Smartphone, label: profile.role === 'passenger' ? t('passenger') : t('rider') },
              { key: 'history' as const, icon: History, label: t('history') },
              { key: 'how-it-works' as const, icon: HelpCircle, label: t('guide') },
              { key: 'contact' as const, icon: Headphones, label: 'Contact' },
              { key: 'profile' as const, icon: profile.avatarUrl ? null : UserIcon, label: t('profile'), avatar: profile.avatarUrl }
            ].map((tab) => (
              <motion.button
                key={tab.key}
                whileTap={{ scale: 0.95 }}
                onClick={() => setView(tab.key)}
                className={`flex-1 py-3 px-5 rounded-xl font-bold text-sm flex items-center justify-center gap-2.5 transition-all ${
                  view === tab.key
                    ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-xl shadow-purple-500/25'
                    : 'text-gray-500 dark:text-zinc-400 hover:bg-gray-100 dark:hover:bg-zinc-800 hover:text-gray-700 dark:hover:text-zinc-300'
                }`}
              >
                {tab.avatar ? (
                  <img src={tab.avatar} alt="" className="w-5 h-5 rounded-full object-cover" />
                ) : tab.icon && (
                  <tab.icon className="w-5 h-5" />
                )}
                <span className="text-xs uppercase tracking-wider">{tab.label}</span>
              </motion.button>
            ))}
          </div>
        </div>

        <main className="max-w-4xl mx-auto p-3 pb-24 sm:p-6 sm:pb-28 lg:pt-5 lg:pb-10 relative z-10">
          <AnimatePresence mode="wait">
            {view === 'dashboard' ? (
              <motion.div key="dashboard" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} transition={{ duration: 0.2 }}>
                {profile.role === 'passenger' ? (
                  <PassengerDashboard user={user} profile={profile} />
                ) : (
                  <RiderDashboard user={user} profile={profile} />
                )}
              </motion.div>
            ) : view === 'history' ? (
              <motion.div key="history" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.2 }}>
                <RideHistory user={user} profile={profile} />
              </motion.div>
            ) : view === 'how-it-works' ? (
              <motion.div key="how-it-works" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} transition={{ duration: 0.2 }}>
                <HowItWorks profile={profile} />
              </motion.div>
            ) : view === 'contact' ? (
              <motion.div key="contact" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} transition={{ duration: 0.2 }}>
                <ContactPage />
              </motion.div>
            ) : (
              <motion.div key="profile" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} transition={{ duration: 0.2 }}>
                <ProfileView profile={profile} />
              </motion.div>
            )}
          </AnimatePresence>
        </main>

        <div className="fixed bottom-0 left-0 right-0 lg:hidden bg-white/60 dark:bg-white/5 backdrop-blur-3xl border-t border-white/60 dark:border-white/10 shadow-[0_-4px_30px_rgba(0,0,0,0.1)] z-40 transition-colors duration-500">
          <div className="flex items-center justify-around h-16 px-1">
            {[
              { key: 'dashboard' as const, icon: Smartphone, label: profile.role === 'passenger' ? t('passenger') : t('rider') },
              { key: 'history' as const, icon: History, label: t('history') },
              { key: 'how-it-works' as const, icon: HelpCircle, label: t('guide') },
              { key: 'contact' as const, icon: Headphones, label: 'Contact' },
              { key: 'profile' as const, icon: profile.avatarUrl ? null : UserIcon, label: t('profile'), avatar: profile.avatarUrl }
            ].map((tab) => (
              <motion.button
                key={tab.key}
                whileTap={{ scale: 0.9 }}
                onClick={() => setView(tab.key)}
                className={`flex flex-col items-center justify-center py-1 px-1.5 rounded-xl transition-all min-w-0 ${
                  view === tab.key 
                    ? 'text-purple-600 dark:text-purple-400' 
                    : 'text-gray-400 dark:text-zinc-500'
                }`}
              >
                {tab.avatar ? (
                  <img src={tab.avatar} alt="" className={`w-6 h-6 rounded-full object-cover ${view === tab.key ? 'ring-2 ring-purple-500' : ''}`} />
                ) : tab.icon && (
                  <tab.icon className={`w-5 h-5 ${view === tab.key ? 'drop-shadow-lg' : ''}`} />
                )}
                <span className={`text-[9px] font-bold mt-0.5 uppercase tracking-wider truncate max-w-[48px] ${view === tab.key ? 'text-purple-600 dark:text-purple-400' : ''}`}>
                  {tab.label}
                </span>
              </motion.button>
            ))}
          </div>
        </div>
      </div>
    </NotificationProvider>
  );
}

function AppContent() {
  const { language, t } = useLanguage();
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'dashboard' | 'history' | 'profile' | 'how-it-works' | 'contact'>('dashboard');
  const [isDark, setIsDark] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('theme') === 'dark';
    }
    return false;
  });
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showInstallPrompt, setShowInstallPrompt] = useState(false);
  const [showWelcome, setShowWelcome] = useState(() => {
    if (typeof window === 'undefined') return false;
    const savedLanguage = localStorage.getItem('language');
    return savedLanguage ? localStorage.getItem(`welcome_seen_${savedLanguage}`) !== 'true' : false;
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
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShowInstallPrompt(true);
    };
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
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
        // Only subscribe — the first snapshot delivers the profile,
        // avoiding a redundant getUserProfile() read that doubles quota.
        unsubscribeProfile = subscribeToUserProfile(user.uid, (updatedProfile) => {
          setProfile(updatedProfile);
          setLoading(false);
        });
        // Fallback: if the profile doc doesn't exist yet (brand-new user
        // before createUserProfile completes), stop loading after a timeout.
        setTimeout(() => setLoading(false), 3000);
      } else {
        setProfile(null);
        if (unsubscribeProfile) { unsubscribeProfile(); unsubscribeProfile = null; }
        setLoading(false);
      }
    });
    return () => {
      unsubscribeAuth();
      if (unsubscribeProfile) unsubscribeProfile();
    };
  }, []);

  useEffect(() => {
    if (!language) { setShowWelcome(false); return; }
    setShowWelcome(localStorage.getItem(`welcome_seen_${language}`) !== 'true');
  }, [language]);

  const handleWelcomeContinue = () => {
    if (language) localStorage.setItem(`welcome_seen_${language}`, 'true');
    setShowWelcome(false);
  };

  if (!language) return <LanguageSelector />;
  if (showWelcome) return <WelcomeScreen onContinue={handleWelcomeContinue} />;

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-zinc-950 dark:to-zinc-900 flex items-center justify-center">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
          className="w-12 h-12 rounded-2xl bg-gradient-to-br from-purple-600 to-indigo-600 flex items-center justify-center shadow-2xl"
        >
          <Loader2 className="w-7 h-7 text-white animate-spin" />
        </motion.div>
      </div>
    );
  }

  if (!user || !profile) return <Auth onAuthSuccess={(p) => setProfile(p)} />;

  return (
    <AuthenticatedAppShell
      user={user}
      profile={profile}
      view={view}
      setView={setView}
      isDark={isDark}
      setIsDark={setIsDark}
      showInstallPrompt={showInstallPrompt}
      deferredPrompt={deferredPrompt}
      handleInstallApp={handleInstallApp}
      setShowInstallPrompt={setShowInstallPrompt}
      t={t}
    />
  );
}

export default function App() {
  return (
    <LanguageProvider>
      <AppContent />
    </LanguageProvider>
  );
}

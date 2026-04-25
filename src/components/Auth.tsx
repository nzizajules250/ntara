import React, { useState } from 'react';
import { auth, createUserProfile, getUserProfile, UserProfile, UserRole, googleProvider } from '../lib/firebase';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, signInWithPopup } from 'firebase/auth';
import { Car, Smartphone, Shield, ArrowRight, Loader2, Mail, Lock, User, Phone, Calendar, ClipboardCheck, Camera, Info, Languages, X, ChevronLeft } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useLanguage } from '../lib/i18n';
import { enableBackgroundTracking } from '../lib/pushNotifications';

interface AuthProps {
  onAuthSuccess: (profile: UserProfile) => void;
}

export default function Auth({ onAuthSuccess }: AuthProps) {
  const { t } = useLanguage();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [role, setRole] = useState<UserRole>('passenger');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPhoneOverlay, setShowPhoneOverlay] = useState(false);
  const [googlePhoneNumber, setGooglePhoneNumber] = useState('');
  const [pendingGoogleUser, setPendingGoogleUser] = useState<any>(null);

  // Form State
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    password: '',
    gender: '',
    dob: '',
    vehicleType: 'car' as 'car' | 'motorcycle',
    licenseClass: '',
    vehicleModel: '',
    numberPlate: '',
    permitCardNumber: '',
    avatarUrl: ''
  });

  const formatPhoneToEmail = (phone: string) => {
    return `${phone.replace(/\+/g, '').trim()}@swiftride.app`;
  };

  const handleManualAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const email = formatPhoneToEmail(formData.phone);
      
      if (mode === 'register') {
        let user;

        try {
          const result = await createUserWithEmailAndPassword(auth, email, formData.password);
          user = result.user;
        } catch (err: any) {
          if (err?.code === 'auth/email-already-in-use') {
            const result = await signInWithEmailAndPassword(auth, email, formData.password);
            user = result.user;
          } else {
            throw err;
          }
        }

        const newProfile: UserProfile = {
          uid: user.uid,
          name: formData.name,
          email: email,
          phoneNumber: formData.phone,
          role,
          rating: 4.8,
          totalTrips: 0,
          avatarUrl: formData.avatarUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${formData.name}`,
          gender: formData.gender,
          dob: role === 'rider' ? formData.dob : undefined,
          vehicleType: role === 'rider' ? formData.vehicleType : undefined,
          licenseClass: role === 'rider' ? formData.licenseClass : undefined,
          vehicleModel: role === 'rider' ? formData.vehicleModel : undefined,
          numberPlate: role === 'rider' ? formData.numberPlate : undefined,
          permitCardNumber: role === 'rider' ? formData.permitCardNumber : undefined,
        };

        const existingProfile = await getUserProfile(user.uid);
        if (!existingProfile) {
          await createUserProfile(newProfile);
          await enableBackgroundTracking();
          onAuthSuccess(newProfile);
        } else {
          await enableBackgroundTracking();
          onAuthSuccess(existingProfile);
        }
      } else {
        const result = await signInWithEmailAndPassword(auth, email, formData.password);
        const profile = await getUserProfile(result.user.uid);
        if (profile) {
          await enableBackgroundTracking();
          onAuthSuccess(profile);
        } else {
          setError(t('profileNotFound'));
        }
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || t('authFailed'));
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleAuth = async (selectedRole: UserRole) => {
    setLoading(true);
    setError('');
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const user = result.user;
      
      const existingProfile = await getUserProfile(user.uid);
      if (!existingProfile) {
        setPendingGoogleUser({ user, selectedRole });
        setShowPhoneOverlay(true);
      } else {
        await enableBackgroundTracking();
        onAuthSuccess(existingProfile);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handlePhoneSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!googlePhoneNumber.trim() || !pendingGoogleUser) return;

    setLoading(true);
    try {
      const user = pendingGoogleUser.user;
      const newProfile: UserProfile = {
        uid: user.uid,
        email: user.email || '',
        name: user.displayName || 'User',
        role: pendingGoogleUser.selectedRole,
        phoneNumber: googlePhoneNumber,
        rating: 4.8,
        totalTrips: 0,
        avatarUrl: user.photoURL || undefined
      };
      await createUserProfile(newProfile);
      await enableBackgroundTracking();
      onAuthSuccess(newProfile);
      setShowPhoneOverlay(false);
      setGooglePhoneNumber('');
      setPendingGoogleUser(null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {/* Phone Number Overlay for Google Sign-In - iOS Bottom Sheet */}
      <AnimatePresence>
        {showPhoneOverlay && (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/50 backdrop-blur-sm"
              onClick={() => setShowPhoneOverlay(false)}
            />
            <motion.div
              initial={{ opacity: 0, y: '100%' }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="bg-white/95 dark:bg-gray-900/95 backdrop-blur-xl w-full max-w-md rounded-t-3xl sm:rounded-3xl p-6 relative z-10 shadow-2xl"
            >
              <div className="w-12 h-1 bg-gray-200 dark:bg-gray-700 rounded-full mx-auto mb-6 sm:hidden" />
              
              <div className="text-center mb-6">
                <div className="w-16 h-16 bg-orange-100 dark:bg-orange-500/20 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <Phone className="w-8 h-8 text-orange-500" />
                </div>
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">{t('phoneRequired')}</h2>
                <p className="text-sm text-gray-600 dark:text-gray-400">We need your phone number to complete your profile and enable ride notifications.</p>
              </div>

              <form onSubmit={handlePhoneSubmit} className="space-y-4">
                <div className="relative">
                  <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input 
                    type="tel"
                    required
                    autoFocus
                    placeholder={t('phoneNumber')}
                    className="w-full bg-gray-50 dark:bg-gray-800 py-4 pl-12 pr-4 rounded-xl border-none focus:ring-2 focus:ring-orange-500 outline-none font-medium text-sm text-gray-900 dark:text-white"
                    value={googlePhoneNumber}
                    onChange={e => setGooglePhoneNumber(e.target.value)}
                  />
                </div>

                {error && (
                  <motion.div 
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="p-3 bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 rounded-xl text-xs font-bold flex items-center gap-2"
                  >
                    <Info className="w-4 h-4" />
                    {error}
                  </motion.div>
                )}

                <div className="flex gap-3 pt-2">
                  <button 
                    type="button"
                    onClick={() => setShowPhoneOverlay(false)}
                    className="flex-1 py-3.5 font-semibold text-gray-600 dark:text-gray-400 active:opacity-70 transition-opacity rounded-xl"
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit"
                    disabled={loading || !googlePhoneNumber.trim()}
                    className="flex-1 bg-orange-500 text-white py-3.5 rounded-xl font-semibold active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {loading ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      <>
                        {t('continueButton')}
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Main Auth Container - No Background */}
      <div className="flex flex-col items-center justify-center p-4 sm:p-6 overflow-hidden sm:overflow-auto">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-lg bg-white/95 dark:bg-gray-900/95 backdrop-blur-sm rounded-3xl p-6 sm:p-8 shadow-2xl border border-gray-100 dark:border-gray-800 max-h-[95vh] sm:max-h-none overflow-y-auto sm:overflow-y-visible"
        >
          {/* Header */}
          <div className="text-center mb-6 sm:mb-8">
            <div className="mx-auto w-20 h-20 bg-gradient-to-br from-orange-400 to-orange-600 rounded-2xl flex items-center justify-center shadow-lg mb-4">
              <img
                src="/ntwara-logo.png"
                alt="Ntwara"
                className="h-14 w-14 object-contain brightness-0 invert"
              />
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white leading-tight">Ntwara</h1>
            <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 font-medium mt-1">{t('empoweringJourney')}</p>
          </div>

          {/* Mode Toggle */}
          <div className="flex bg-gray-100 dark:bg-gray-800 p-1 rounded-2xl mb-6 sm:mb-8 text-sm sm:text-base">
            <button 
              onClick={() => setMode('login')}
              className={`flex-1 py-2 sm:py-3 rounded-xl font-bold transition-all ${
                mode === 'login' 
                  ? 'bg-white dark:bg-gray-900 text-gray-900 dark:text-white shadow-sm' 
                  : 'text-gray-500 dark:text-gray-400'
              }`}
            >
              {t('login')}
            </button>
            <button 
              onClick={() => setMode('register')}
              className={`flex-1 py-2 sm:py-3 rounded-xl font-bold transition-all ${
                mode === 'register' 
                  ? 'bg-white dark:bg-gray-900 text-gray-900 dark:text-white shadow-sm' 
                  : 'text-gray-500 dark:text-gray-400'
              }`}
            >
              {t('register')}
            </button>
          </div>

          {/* Role Selection for Registration */}
          {mode === 'register' && (
            <div className="grid grid-cols-2 gap-2 sm:gap-3 mb-6 sm:mb-8">
              <button 
                onClick={() => setRole('passenger')}
                className={`p-3 sm:p-4 rounded-2xl flex flex-col items-center gap-2 border-2 transition-all text-xs sm:text-sm ${
                  role === 'passenger' 
                    ? 'border-orange-500 bg-orange-500 text-white shadow-lg' 
                    : 'border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50 text-gray-500 dark:text-gray-400'
                }`}
              >
                <Smartphone className="w-5 h-5 sm:w-6 sm:h-6" />
                <span className="text-[10px] sm:text-xs font-bold uppercase tracking-widest">{t('passenger')}</span>
              </button>
              <button 
                onClick={() => setRole('rider')}
                className={`p-3 sm:p-4 rounded-2xl flex flex-col items-center gap-2 border-2 transition-all text-xs sm:text-sm ${
                  role === 'rider' 
                    ? 'border-orange-500 bg-orange-500 text-white shadow-lg' 
                    : 'border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50 text-gray-500 dark:text-gray-400'
                }`}
              >
                <Shield className="w-5 h-5 sm:w-6 sm:h-6" />
                <span className="text-[10px] sm:text-xs font-bold uppercase tracking-widest">{t('rider')}</span>
              </button>
            </div>
          )}

          {/* Error Message */}
          {error && (
            <motion.div 
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              className="mb-4 sm:mb-6 p-3 sm:p-4 bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 rounded-xl text-xs font-bold flex items-center gap-2"
            >
              <Info className="w-4 h-4" />
              {error}
            </motion.div>
          )}

          {/* Auth Form */}
          <form onSubmit={handleManualAuth} className="space-y-3 sm:space-y-4">
            {mode === 'register' && (
              <div className="relative">
                <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input 
                  type="text"
                  required
                  placeholder={t('fullName')}
                  className="w-full bg-gray-50 dark:bg-gray-800 py-3 sm:py-4 pl-12 pr-4 rounded-xl border-none focus:ring-2 focus:ring-orange-500 outline-none font-medium text-sm text-gray-900 dark:text-white"
                  value={formData.name}
                  onChange={e => setFormData({...formData, name: e.target.value})}
                />
              </div>
            )}

            <div className="relative">
              <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input 
                type="tel"
                required
                placeholder={t('phoneNumber')}
                className="w-full bg-gray-50 dark:bg-gray-800 py-3 sm:py-4 pl-12 pr-4 rounded-xl border-none focus:ring-2 focus:ring-orange-500 outline-none font-medium text-sm text-gray-900 dark:text-white"
                value={formData.phone}
                onChange={e => setFormData({...formData, phone: e.target.value})}
              />
            </div>

            <div className="relative">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input 
                type="password"
                required
                placeholder={t('password')}
                className="w-full bg-gray-50 dark:bg-gray-800 py-3 sm:py-4 pl-12 pr-4 rounded-xl border-none focus:ring-2 focus:ring-orange-500 outline-none font-medium text-sm text-gray-900 dark:text-white"
                value={formData.password}
                onChange={e => setFormData({...formData, password: e.target.value})}
              />
            </div>

            {/* Passenger-specific fields */}
            {mode === 'register' && role === 'passenger' && (
              <div className="relative">
                <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <select 
                  className="w-full bg-gray-50 dark:bg-gray-800 py-3 sm:py-4 pl-12 pr-4 rounded-xl border-none focus:ring-2 focus:ring-orange-500 outline-none font-medium appearance-none text-sm text-gray-900 dark:text-white"
                  value={formData.gender}
                  onChange={e => setFormData({...formData, gender: e.target.value})}
                  required
                >
                  <option value="">{t('gender')}</option>
                  <option value="Male">{t('male')}</option>
                  <option value="Female">{t('female')}</option>
                </select>
              </div>
            )}

            {/* Rider-specific fields */}
            <AnimatePresence>
              {mode === 'register' && role === 'rider' && (
                <motion.div 
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="space-y-3 sm:space-y-4 pt-3 sm:pt-4 border-t border-gray-100 dark:border-gray-800"
                >
                  <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-gray-400 dark:text-gray-500 text-center">
                    {t('riderCredentials')}
                  </p>
                  
                  <div className="grid grid-cols-2 gap-2 sm:gap-4">
                    <div className="relative">
                      <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <select 
                        className="w-full bg-gray-50 dark:bg-gray-800 py-3 sm:py-4 pl-10 pr-4 rounded-xl border-none focus:ring-2 focus:ring-orange-500 outline-none font-medium text-xs sm:text-sm text-gray-900 dark:text-white appearance-none"
                        value={formData.gender}
                        onChange={e => setFormData({...formData, gender: e.target.value})}
                        required
                      >
                        <option value="">{t('gender')}</option>
                        <option value="Male">{t('male')}</option>
                        <option value="Female">{t('female')}</option>
                      </select>
                    </div>
                    <div className="relative">
                      <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <input 
                        type="date"
                        className="w-full bg-gray-50 dark:bg-gray-800 py-3 sm:py-4 pl-10 pr-4 rounded-xl border-none focus:ring-2 focus:ring-orange-500 outline-none font-medium text-xs sm:text-sm text-gray-900 dark:text-white"
                        value={formData.dob}
                        onChange={e => setFormData({...formData, dob: e.target.value})}
                        required
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 sm:gap-4">
                    <div className="relative">
                      <Car className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <select 
                        className="w-full bg-gray-50 dark:bg-gray-800 py-3 sm:py-4 pl-10 pr-4 rounded-xl border-none focus:ring-2 focus:ring-orange-500 outline-none font-medium text-xs sm:text-sm text-gray-900 dark:text-white appearance-none"
                        value={formData.vehicleType}
                        onChange={e => setFormData({...formData, vehicleType: e.target.value as any})}
                      >
                        <option value="car">{t('car')}</option>
                        <option value="motorcycle">{t('motorcycle')}</option>
                      </select>
                    </div>
                    <div className="relative">
                      <ClipboardCheck className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <input 
                        type="text"
                        placeholder={t('licenseClass')}
                        className="w-full bg-gray-50 dark:bg-gray-800 py-3 sm:py-4 pl-10 pr-4 rounded-xl border-none focus:ring-2 focus:ring-orange-500 outline-none font-medium text-xs sm:text-sm text-gray-900 dark:text-white"
                        value={formData.licenseClass}
                        onChange={e => setFormData({...formData, licenseClass: e.target.value})}
                        required
                      />
                    </div>
                  </div>

                  <div className="relative">
                    <Car className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input 
                      type="text"
                      placeholder={t('vehicleModelPlaceholder')}
                      className="w-full bg-gray-50 dark:bg-gray-800 py-3 sm:py-4 pl-12 pr-4 rounded-xl border-none focus:ring-2 focus:ring-orange-500 outline-none font-medium text-xs sm:text-sm text-gray-900 dark:text-white"
                      value={formData.vehicleModel}
                      onChange={e => setFormData({...formData, vehicleModel: e.target.value})}
                      required
                    />
                  </div>

                  <div className="relative">
                    <Languages className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input 
                      type="text"
                      placeholder={t('numberPlatePlaceholder')}
                      className="w-full bg-gray-50 dark:bg-gray-800 py-3 sm:py-4 pl-12 pr-4 rounded-xl border-none focus:ring-2 focus:ring-orange-500 outline-none font-medium text-xs sm:text-sm uppercase text-gray-900 dark:text-white"
                      value={formData.numberPlate}
                      onChange={e => setFormData({...formData, numberPlate: e.target.value})}
                      required
                    />
                  </div>

                  <div className="relative">
                    <ClipboardCheck className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input 
                      type="text"
                      placeholder={t('permitCardNumber') || 'Permit Card Number'}
                      className="w-full bg-gray-50 dark:bg-gray-800 py-3 sm:py-4 pl-12 pr-4 rounded-xl border-none focus:ring-2 focus:ring-orange-500 outline-none font-medium text-xs sm:text-sm text-gray-900 dark:text-white"
                      value={formData.permitCardNumber}
                      onChange={e => setFormData({...formData, permitCardNumber: e.target.value})}
                      required
                    />
                  </div>

                  <div className="relative">
                    <Camera className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input 
                      type="url"
                      placeholder={t('profilePictureUrl')}
                      className="w-full bg-gray-50 dark:bg-gray-800 py-3 sm:py-4 pl-12 pr-4 rounded-xl border-none focus:ring-2 focus:ring-orange-500 outline-none font-medium text-xs sm:text-sm text-gray-900 dark:text-white"
                      value={formData.avatarUrl}
                      onChange={e => setFormData({...formData, avatarUrl: e.target.value})}
                    />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Submit Button */}
            <button 
              type="submit"
              disabled={loading}
              className="w-full bg-orange-500 text-white py-3 sm:py-4 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-orange-600 transition-all shadow-lg shadow-orange-500/25 disabled:opacity-50 text-sm sm:text-base active:scale-95 mt-4"
            >
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : (
                <>
                  {mode === 'login' ? t('signIn') : t('createAccount')}
                  <ArrowRight className="w-5 h-5" />
                </>
              )}
            </button>
          </form>

          {/* Divider */}
          <div className="my-6 sm:my-8 flex items-center gap-4 text-gray-300 dark:text-gray-600">
            <div className="flex-1 h-px bg-gray-100 dark:bg-gray-800" />
            <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500">{t('continueWith')}</span>
            <div className="flex-1 h-px bg-gray-100 dark:bg-gray-800" />
          </div>

          {/* Google Sign In Button */}
          <button 
            onClick={() => handleGoogleAuth(role)}
            disabled={loading}
            className="w-full bg-white dark:bg-gray-800 border-2 border-gray-100 dark:border-gray-700 text-gray-600 dark:text-gray-300 py-3 sm:py-4 rounded-xl font-bold flex items-center justify-center gap-3 hover:border-orange-500 hover:text-orange-500 dark:hover:border-orange-500 dark:hover:text-orange-500 transition-all text-sm sm:text-base active:scale-95"
          >
            <img 
              src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" 
              className="w-5 h-5" 
              alt="Google" 
              referrerPolicy="no-referrer"
            />
            Continue with Google
          </button>

          {/* Terms */}
          <p className="mt-6 sm:mt-8 text-center text-xs text-gray-400 dark:text-gray-500 font-medium">
            {t('authTerms')}
          </p>
        </motion.div>
      </div>
    </>
  );
}
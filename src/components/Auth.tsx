import React, { useState } from 'react';
import { auth, createUserProfile, getUserProfile, UserProfile, UserRole, googleProvider } from '../lib/firebase';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, signInWithPopup } from 'firebase/auth';
import { Car, Smartphone, Shield, ArrowRight, Loader2, Mail, Lock, User, Phone, Calendar, ClipboardCheck, Camera, Info, Languages, X, Zap, ChevronRight, Eye, EyeOff, BadgeCheck } from 'lucide-react';
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
  const [showPassword, setShowPassword] = useState(false);

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
      {/* Phone Number Overlay for Google Sign-In */}
      <AnimatePresence>
        {showPhoneOverlay && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="w-full max-w-md bg-white dark:bg-arctic-dark rounded-[2.5rem] p-8 shadow-2xl border border-arctic-light dark:border-arctic-medium"
            >
              <div className="text-center mb-6">
                <div className="w-16 h-16 bg-gradient-to-br from-arctic-medium to-arctic-dark rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-xl shadow-arctic-medium/30">
                  <Phone className="w-8 h-8 text-white" />
                </div>
                <h2 className="text-2xl font-black text-arctic-dark dark:text-arctic-lightest mb-2">{t('phoneRequired')}</h2>
                <p className="text-sm text-arctic-medium dark:text-arctic-light font-medium">We need your phone number to complete your profile and enable ride notifications.</p>
              </div>

              <form onSubmit={handlePhoneSubmit} className="space-y-4">
                <div className="relative">
                  <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-arctic-medium dark:text-arctic-light" />
                  <input 
                    type="tel"
                    required
                    autoFocus
                    placeholder={t('phoneNumber')}
                    className="w-full bg-white dark:bg-arctic-dark py-4 pl-12 pr-4 rounded-2xl border-2 border-arctic-light dark:border-arctic-medium focus:border-arctic-medium dark:focus:border-arctic-light outline-none font-semibold text-sm text-arctic-dark dark:text-white placeholder:text-arctic-medium dark:placeholder:text-arctic-light transition-all"
                    value={googlePhoneNumber}
                    onChange={e => setGooglePhoneNumber(e.target.value)}
                  />
                </div>

                {error && (
                  <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}
                    className="p-3 bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 rounded-2xl text-xs font-bold flex items-center gap-2">
                    <Info className="w-4 h-4 flex-shrink-0" />
                    {error}
                  </motion.div>
                )}

                <motion.button 
                  type="submit"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  disabled={loading || !googlePhoneNumber.trim()}
                  className="w-full bg-gradient-to-r from-arctic-medium to-arctic-dark text-white py-4 rounded-2xl font-bold flex items-center justify-center gap-2 shadow-xl shadow-arctic-medium/25 disabled:opacity-50 transition-all"
                >
                  {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <>{t('continueButton')}<ArrowRight className="w-5 h-5" /></>}
                </motion.button>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Auth Screen */}
      <div className="min-h-screen bg-gradient-to-br from-arctic-lightest via-arctic-light to-arctic-light dark:from-arctic-dark dark:via-arctic-dark dark:to-arctic-dark flex flex-col items-center justify-center p-4 sm:p-6">
        {/* Background Decorations */}
        <div className="absolute top-0 left-0 w-72 h-72 bg-arctic-medium/10 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-0 w-72 h-72 bg-arctic-light/10 rounded-full blur-3xl" />

        <motion.div 
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="w-full max-w-lg bg-white dark:bg-arctic-dark rounded-[3rem] p-6 sm:p-8 shadow-2xl shadow-arctic-medium/10 border border-arctic-light dark:border-arctic-medium relative max-h-[95vh] overflow-y-auto"
        >
          {/* Logo & Header */}
          <div className="text-center mb-6">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", stiffness: 200, delay: 0.1 }}
              className="relative inline-block mb-4"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-arctic-medium to-arctic-dark rounded-[2rem] blur-2xl opacity-20" />
              <img
                src="/ntwara-logo.png"
                alt="Ntwara"
                className="relative h-20 sm:h-24 w-auto object-contain mx-auto"
              />
            </motion.div>
            <h1 className="text-3xl font-black text-arctic-dark dark:text-arctic-lightest">Ntwara</h1>
            <p className="text-sm text-arctic-medium dark:text-arctic-light font-semibold mt-1">{t('empoweringJourney')}</p>
          </div>

          {/* Login/Register Toggle */}
          <div className="flex bg-arctic-light dark:bg-arctic-medium p-1.5 rounded-2xl mb-6">
            <motion.button 
              whileTap={{ scale: 0.95 }}
              onClick={() => setMode('login')}
              className={`flex-1 py-3 rounded-xl font-bold text-sm transition-all ${
                mode === 'login' ? 'bg-white dark:bg-arctic-light text-arctic-dark dark:text-arctic-dark shadow-lg' : 'text-arctic-medium dark:text-arctic-dark hover:text-arctic-dark dark:hover:text-arctic-dark'
              }`}
            >
              {t('login')}
            </motion.button>
            <motion.button 
              whileTap={{ scale: 0.95 }}
              onClick={() => setMode('register')}
              className={`flex-1 py-3 rounded-xl font-bold text-sm transition-all ${
                mode === 'register' ? 'bg-white dark:bg-arctic-light text-arctic-dark dark:text-arctic-dark shadow-lg' : 'text-arctic-medium dark:text-arctic-dark hover:text-arctic-dark dark:hover:text-arctic-dark'
              }`}
            >
              {t('register')}
            </motion.button>
          </div>

          {/* Role Selection (Register mode only) */}
          {mode === 'register' && (
            <motion.div 
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              className="grid grid-cols-2 gap-3 mb-6"
            >
              <motion.button 
                whileTap={{ scale: 0.95 }}
                onClick={() => setRole('passenger')}
                className={`p-4 rounded-2xl flex flex-col items-center gap-2 border-2 transition-all ${
                  role === 'passenger' 
                    ? 'border-arctic-medium bg-arctic-lightest dark:bg-arctic-medium/10 text-arctic-dark dark:text-arctic-light shadow-lg shadow-arctic-medium/10' 
                    : 'border-arctic-light dark:border-arctic-medium bg-arctic-lightest dark:bg-arctic-medium text-arctic-medium hover:border-arctic-medium'
                }`}
              >
                <Smartphone className="w-6 h-6" />
                <span className="text-xs font-black uppercase tracking-wider">{t('passenger')}</span>
              </motion.button>
              <motion.button 
                whileTap={{ scale: 0.95 }}
                onClick={() => setRole('rider')}
                className={`p-4 rounded-2xl flex flex-col items-center gap-2 border-2 transition-all ${
                  role === 'rider' 
                    ? 'border-arctic-medium bg-arctic-lightest dark:bg-arctic-medium/10 text-arctic-dark dark:text-arctic-light shadow-lg shadow-arctic-medium/10' 
                    : 'border-arctic-light dark:border-arctic-medium bg-arctic-lightest dark:bg-arctic-medium text-arctic-medium hover:border-arctic-medium'
                }`}
              >
                <Shield className="w-6 h-6" />
                <span className="text-xs font-black uppercase tracking-wider">{t('rider')}</span>
              </motion.button>
            </motion.div>
          )}

          {/* Error Message */}
          {error && (
            <motion.div 
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              className="mb-4 p-4 bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 rounded-2xl text-xs font-bold flex items-center gap-2 border border-red-100 dark:border-red-500/20"
            >
              <Info className="w-4 h-4 flex-shrink-0" />
              {error}
            </motion.div>
          )}

          {/* Auth Form */}
          <form onSubmit={handleManualAuth} className="space-y-3">
            {mode === 'register' && (
              <div className="relative">
                <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-arctic-medium dark:text-arctic-light" />
                <input 
                  type="text"
                  required
                  placeholder={t('fullName')}
                  className="w-full bg-white dark:bg-arctic-dark py-4 pl-12 pr-4 rounded-2xl border-2 border-arctic-light dark:border-arctic-medium focus:border-arctic-medium dark:focus:border-arctic-light outline-none font-semibold text-sm text-arctic-dark dark:text-white placeholder:text-arctic-medium dark:placeholder:text-arctic-light transition-all"
                  value={formData.name}
                  onChange={e => setFormData({...formData, name: e.target.value})}
                />
              </div>
            )}

            <div className="relative">
              <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-arctic-medium dark:text-arctic-light" />
              <input 
                type="tel"
                required
                placeholder={t('phoneNumber')}
                className="w-full bg-white dark:bg-arctic-dark py-4 pl-12 pr-4 rounded-2xl border-2 border-arctic-light dark:border-arctic-medium focus:border-arctic-medium dark:focus:border-arctic-light outline-none font-semibold text-sm text-arctic-dark dark:text-white placeholder:text-arctic-medium dark:placeholder:text-arctic-light transition-all"
                value={formData.phone}
                onChange={e => setFormData({...formData, phone: e.target.value})}
              />
            </div>

            <div className="relative">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-arctic-medium dark:text-arctic-light" />
              <input 
                type={showPassword ? "text" : "password"}
                required
                placeholder={t('password')}
                className="w-full bg-white dark:bg-arctic-dark py-4 pl-12 pr-12 rounded-2xl border-2 border-arctic-light dark:border-arctic-medium focus:border-arctic-medium dark:focus:border-arctic-light outline-none font-semibold text-sm text-arctic-dark dark:text-white placeholder:text-arctic-medium dark:placeholder:text-arctic-light transition-all"
                value={formData.password}
                onChange={e => setFormData({...formData, password: e.target.value})}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-arctic-medium dark:text-arctic-light hover:text-arctic-dark dark:hover:text-white transition-colors"
              >
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>

            {mode === 'register' && role === 'passenger' && (
              <div className="relative">
                <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-arctic-medium dark:text-arctic-light" />
                <select 
                  className="w-full bg-white dark:bg-arctic-dark py-4 pl-12 pr-4 rounded-2xl border-2 border-arctic-light dark:border-arctic-medium focus:border-arctic-medium dark:focus:border-arctic-light outline-none font-semibold text-sm text-arctic-dark dark:text-white appearance-none transition-all"
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

            {/* Rider Credentials */}
            <AnimatePresence>
              {mode === 'register' && role === 'rider' && (
                <motion.div 
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="space-y-3 pt-4 border-t border-gray-100 dark:border-zinc-800"
                >
                  <div className="flex items-center gap-2 justify-center">
                    <BadgeCheck className="w-4 h-4 text-arctic-medium" />
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-arctic-medium dark:text-arctic-light">{t('riderCredentials')}</p>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-3">
                    <div className="relative">
                      <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-arctic-medium dark:text-arctic-light" />
                      <select 
                        className="w-full bg-white dark:bg-arctic-dark py-4 pl-10 pr-4 rounded-2xl border-2 border-arctic-light dark:border-arctic-medium focus:border-arctic-medium dark:focus:border-arctic-light outline-none font-semibold text-xs text-arctic-dark dark:text-white appearance-none transition-all"
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
                      <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-arctic-medium dark:text-arctic-light pointer-events-none" />
                      <input 
                        type="date"
                        className="w-full bg-white dark:bg-arctic-dark py-4 pl-10 pr-4 rounded-2xl border-2 border-arctic-light dark:border-arctic-medium focus:border-arctic-medium dark:focus:border-arctic-light outline-none font-semibold text-xs text-arctic-dark dark:text-white transition-all"
                        value={formData.dob}
                        onChange={e => setFormData({...formData, dob: e.target.value})}
                        required
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="relative">
                      <Car className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-arctic-medium dark:text-arctic-light" />
                      <select 
                        className="w-full bg-white dark:bg-arctic-dark py-4 pl-10 pr-4 rounded-2xl border-2 border-arctic-light dark:border-arctic-medium focus:border-arctic-medium dark:focus:border-arctic-light outline-none font-semibold text-xs text-arctic-dark dark:text-white appearance-none transition-all"
                        value={formData.vehicleType}
                        onChange={e => setFormData({...formData, vehicleType: e.target.value as any})}
                      >
                        <option value="car">{t('car')}</option>
                        <option value="motorcycle">{t('motorcycle')}</option>
                      </select>
                    </div>
                    <div className="relative">
                      <ClipboardCheck className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-arctic-medium dark:text-arctic-light" />
                      <input 
                        type="text"
                        placeholder={t('licenseClass')}
                        className="w-full bg-white dark:bg-arctic-dark py-4 pl-10 pr-4 rounded-2xl border-2 border-arctic-light dark:border-arctic-medium focus:border-arctic-medium dark:focus:border-arctic-light outline-none font-semibold text-xs text-arctic-dark dark:text-white placeholder:text-arctic-medium dark:placeholder:text-arctic-light transition-all"
                        value={formData.licenseClass}
                        onChange={e => setFormData({...formData, licenseClass: e.target.value})}
                        required
                      />
                    </div>
                  </div>

                  <div className="relative">
                    <Car className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-arctic-medium dark:text-arctic-light" />
                    <input 
                      type="text"
                      placeholder={t('vehicleModelPlaceholder')}
                      className="w-full bg-white dark:bg-arctic-dark py-4 pl-12 pr-4 rounded-2xl border-2 border-arctic-light dark:border-arctic-medium focus:border-arctic-medium dark:focus:border-arctic-light outline-none font-semibold text-xs text-arctic-dark dark:text-white placeholder:text-arctic-medium dark:placeholder:text-arctic-light transition-all"
                      value={formData.vehicleModel}
                      onChange={e => setFormData({...formData, vehicleModel: e.target.value})}
                      required
                    />
                  </div>

                  <div className="relative">
                    <Languages className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-arctic-medium dark:text-arctic-light" />
                    <input 
                      type="text"
                      placeholder={t('numberPlatePlaceholder')}
                      className="w-full bg-white dark:bg-arctic-dark py-4 pl-12 pr-4 rounded-2xl border-2 border-arctic-light dark:border-arctic-medium focus:border-arctic-medium dark:focus:border-arctic-light outline-none font-semibold text-xs text-arctic-dark dark:text-white uppercase placeholder:text-arctic-medium dark:placeholder:text-arctic-light transition-all"
                      value={formData.numberPlate}
                      onChange={e => setFormData({...formData, numberPlate: e.target.value})}
                      required
                    />
                  </div>

                  <div className="relative">
                    <ClipboardCheck className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-arctic-medium dark:text-arctic-light" />
                    <input 
                      type="text"
                      placeholder={t('permitCardNumber') || 'Permit Card Number'}
                      className="w-full bg-white dark:bg-arctic-dark py-4 pl-12 pr-4 rounded-2xl border-2 border-arctic-light dark:border-arctic-medium focus:border-arctic-medium dark:focus:border-arctic-light outline-none font-semibold text-xs text-arctic-dark dark:text-white placeholder:text-arctic-medium dark:placeholder:text-arctic-light transition-all"
                      value={formData.permitCardNumber}
                      onChange={e => setFormData({...formData, permitCardNumber: e.target.value})}
                      required
                    />
                  </div>

                  <div className="relative">
                    <Camera className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-arctic-medium dark:text-arctic-light" />
                    <input 
                      type="url"
                      placeholder={t('profilePictureUrl')}
                      className="w-full bg-white dark:bg-arctic-dark py-4 pl-12 pr-4 rounded-2xl border-2 border-arctic-light dark:border-arctic-medium focus:border-arctic-medium dark:focus:border-arctic-light outline-none font-semibold text-xs text-arctic-dark dark:text-white placeholder:text-arctic-medium dark:placeholder:text-arctic-light transition-all"
                      value={formData.avatarUrl}
                      onChange={e => setFormData({...formData, avatarUrl: e.target.value})}
                    />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Submit Button */}
            <motion.button 
              type="submit"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              disabled={loading}
              className="w-full bg-gradient-to-r from-arctic-medium to-arctic-dark text-white py-4 rounded-2xl font-bold flex items-center justify-center gap-2 shadow-xl shadow-arctic-medium/25 disabled:opacity-50 hover:from-arctic-dark hover:to-arctic-dark transition-all mt-4"
            >
              {loading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <>
                  {mode === 'login' ? t('signIn') : t('createAccount')}
                  <ArrowRight className="w-5 h-5" />
                </>
              )}
            </motion.button>
          </form>

          {/* Divider */}
          <div className="my-6 flex items-center gap-4 text-arctic-light dark:text-arctic-medium">
            <div className="flex-1 h-px bg-arctic-light dark:bg-arctic-medium" />
            <span className="text-[10px] font-black uppercase tracking-widest text-arctic-medium dark:text-arctic-light">{t('continueWith')}</span>
            <div className="flex-1 h-px bg-arctic-light dark:bg-arctic-medium" />
          </div>

          {/* Google Sign-In */}
          <motion.button 
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => handleGoogleAuth(role)}
            disabled={loading}
            className="w-full bg-white dark:bg-arctic-medium border-2 border-arctic-light dark:border-arctic-medium text-arctic-dark dark:text-arctic-lightest py-4 rounded-2xl font-bold flex items-center justify-center gap-3 hover:border-arctic-medium dark:hover:border-arctic-light hover:text-arctic-medium dark:hover:text-arctic-light transition-all shadow-sm"
          >
            <img 
              src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" 
              className="w-5 h-5" 
              alt="Google" 
              referrerPolicy="no-referrer"
            />
            Google
          </motion.button>

          {/* Terms */}
          <p className="mt-6 text-center text-xs text-arctic-medium dark:text-arctic-light font-medium">
            {t('authTerms')}
          </p>
        </motion.div>
      </div>
    </>
  );
}
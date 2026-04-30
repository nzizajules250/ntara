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

  const inputClasses = "w-full bg-white/40 dark:bg-white/5 py-4 pl-12 pr-4 rounded-2xl border border-white/50 dark:border-white/10 focus:border-purple-500 dark:focus:border-purple-400 focus:ring-4 focus:ring-purple-500/10 outline-none font-semibold text-sm text-slate-900 dark:text-white placeholder:text-slate-500 dark:placeholder:text-white/50 transition-all shadow-sm backdrop-blur-md";

  return (
    <>
      {/* Phone Number Overlay for Google Sign-In */}
      <AnimatePresence>
        {showPhoneOverlay && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-50 flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="w-full max-w-md bg-white/80 dark:bg-white/10 backdrop-blur-3xl rounded-[2.5rem] p-8 shadow-[0_8px_32px_0_rgba(31,38,135,0.07)] dark:shadow-[0_8px_32px_0_rgba(0,0,0,0.3)] border border-white/60 dark:border-white/20 transition-colors duration-500"
            >
              <div className="text-center mb-6">
                <div className="w-16 h-16 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-xl shadow-purple-500/30">
                  <Phone className="w-8 h-8 text-white" />
                </div>
                <h2 className="text-2xl font-black text-slate-900 dark:text-white mb-2">{t('phoneRequired')}</h2>
                <p className="text-sm text-slate-600 dark:text-white/70 font-medium">We need your phone number to complete your profile and enable ride notifications.</p>
              </div>

              <form onSubmit={handlePhoneSubmit} className="space-y-4">
                <div className="relative">
                  <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 dark:text-white/50" />
                  <input 
                    type="tel"
                    required
                    autoFocus
                    placeholder={t('phoneNumber')}
                    className={inputClasses}
                    value={googlePhoneNumber}
                    onChange={e => setGooglePhoneNumber(e.target.value)}
                  />
                </div>

                {error && (
                  <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}
                    className="p-3 bg-red-100/50 dark:bg-red-500/20 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-500/30 rounded-2xl text-xs font-bold flex items-center gap-2 backdrop-blur-md">
                    <Info className="w-4 h-4 flex-shrink-0" />
                    {error}
                  </motion.div>
                )}

                <motion.button 
                  type="submit"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  disabled={loading || !googlePhoneNumber.trim()}
                  className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 text-white py-4 rounded-2xl font-bold flex items-center justify-center gap-2 shadow-xl shadow-purple-500/25 disabled:opacity-50 transition-all"
                >
                  {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <>{t('continueButton')}<ArrowRight className="w-5 h-5" /></>}
                </motion.button>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Auth Screen */}
      <div className="min-h-screen relative overflow-hidden bg-slate-50 dark:bg-slate-950 transition-colors duration-500 flex flex-col items-center justify-center p-4 sm:p-6">
        {/* Dynamic Ambient Background */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-purple-400/30 dark:bg-purple-600/30 rounded-full blur-[120px] mix-blend-multiply dark:mix-blend-screen animate-pulse" style={{ animationDuration: '4s' }} />
          <div className="absolute top-[20%] right-[-10%] w-[40%] h-[40%] bg-indigo-400/30 dark:bg-indigo-600/30 rounded-full blur-[100px] mix-blend-multiply dark:mix-blend-screen animate-pulse" style={{ animationDuration: '5s', animationDelay: '1s' }} />
          <div className="absolute bottom-[-20%] left-[20%] w-[60%] h-[60%] bg-blue-400/20 dark:bg-blue-600/20 rounded-full blur-[130px] mix-blend-multiply dark:mix-blend-screen animate-pulse" style={{ animationDuration: '6s', animationDelay: '2s' }} />
        </div>

        <motion.div 
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="w-full max-w-lg bg-white/60 dark:bg-white/10 backdrop-blur-3xl rounded-[3rem] p-6 sm:p-8 shadow-[0_8px_32px_0_rgba(31,38,135,0.07)] dark:shadow-[0_8px_32px_0_rgba(0,0,0,0.3)] border border-white/60 dark:border-white/20 relative z-10 max-h-[95vh] overflow-y-auto transition-colors duration-500"
        >
          {/* Internal Highlight */}
          <div className="absolute inset-0 rounded-[3rem] pointer-events-none border border-white/40 dark:border-white/10 mix-blend-overlay" />

          {/* Logo & Header */}
          <div className="text-center mb-8 relative z-10">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", stiffness: 200, delay: 0.1 }}
              className="relative inline-block mb-4"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-purple-400/50 to-indigo-500/50 rounded-[2rem] blur-2xl opacity-50" />
              <img
                src="/ntwara-logo.png"
                alt="Ntwara"
                className="relative h-20 sm:h-24 w-auto object-contain mx-auto drop-shadow-xl dark:brightness-0 dark:invert transition-all duration-500"
              />
            </motion.div>
            <h1 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight drop-shadow-sm transition-colors duration-500">Ntwara</h1>
            <p className="text-sm text-slate-600 dark:text-white/70 font-medium mt-1 transition-colors duration-500">{t('empoweringJourney')}</p>
          </div>

          {/* Login/Register Toggle */}
          <div className="flex bg-white/40 dark:bg-white/5 p-1.5 rounded-2xl mb-6 backdrop-blur-md border border-white/50 dark:border-white/10 relative z-10 transition-colors duration-500">
            <motion.button 
              whileTap={{ scale: 0.95 }}
              onClick={() => setMode('login')}
              className={`flex-1 py-3 rounded-xl font-bold text-sm transition-all ${
                mode === 'login' ? 'bg-white/80 dark:bg-white/20 text-slate-900 dark:text-white shadow-sm' : 'text-slate-500 dark:text-white/50 hover:text-slate-700 dark:hover:text-white/80'
              }`}
            >
              {t('login')}
            </motion.button>
            <motion.button 
              whileTap={{ scale: 0.95 }}
              onClick={() => setMode('register')}
              className={`flex-1 py-3 rounded-xl font-bold text-sm transition-all ${
                mode === 'register' ? 'bg-white/80 dark:bg-white/20 text-slate-900 dark:text-white shadow-sm' : 'text-slate-500 dark:text-white/50 hover:text-slate-700 dark:hover:text-white/80'
              }`}
            >
              {t('register')}
            </motion.button>
          </div>

          {/* Role Selection (Register mode only) */}
          <AnimatePresence>
            {mode === 'register' && (
              <motion.div 
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="grid grid-cols-2 gap-3 mb-6 relative z-10"
              >
                <motion.button 
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setRole('passenger')}
                  className={`p-4 rounded-2xl flex flex-col items-center gap-2 border transition-all backdrop-blur-md ${
                    role === 'passenger' 
                      ? 'border-purple-500/50 bg-purple-500/10 dark:bg-purple-500/20 text-purple-700 dark:text-purple-300 shadow-sm' 
                      : 'border-white/50 dark:border-white/10 bg-white/40 dark:bg-white/5 text-slate-500 dark:text-white/50 hover:bg-white/60 dark:hover:bg-white/10'
                  }`}
                >
                  <Smartphone className="w-6 h-6" />
                  <span className="text-xs font-black uppercase tracking-wider">{t('passenger')}</span>
                </motion.button>
                <motion.button 
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setRole('rider')}
                  className={`p-4 rounded-2xl flex flex-col items-center gap-2 border transition-all backdrop-blur-md ${
                    role === 'rider' 
                      ? 'border-emerald-500/50 bg-emerald-500/10 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 shadow-sm' 
                      : 'border-white/50 dark:border-white/10 bg-white/40 dark:bg-white/5 text-slate-500 dark:text-white/50 hover:bg-white/60 dark:hover:bg-white/10'
                  }`}
                >
                  <Shield className="w-6 h-6" />
                  <span className="text-xs font-black uppercase tracking-wider">{t('rider')}</span>
                </motion.button>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Error Message */}
          <AnimatePresence>
            {error && (
              <motion.div 
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="mb-4 p-4 bg-red-100/50 dark:bg-red-500/20 text-red-600 dark:text-red-400 rounded-2xl text-xs font-bold flex items-center gap-2 border border-red-200 dark:border-red-500/30 backdrop-blur-md relative z-10"
              >
                <Info className="w-4 h-4 flex-shrink-0" />
                {error}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Auth Form */}
          <form onSubmit={handleManualAuth} className="space-y-3 relative z-10">
            <AnimatePresence>
              {mode === 'register' && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="relative">
                  <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 dark:text-white/50" />
                  <input 
                    type="text"
                    required
                    placeholder={t('fullName')}
                    className={inputClasses}
                    value={formData.name}
                    onChange={e => setFormData({...formData, name: e.target.value})}
                  />
                </motion.div>
              )}
            </AnimatePresence>

            <div className="relative">
              <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 dark:text-white/50" />
              <input 
                type="tel"
                required
                placeholder={t('phoneNumber')}
                className={inputClasses}
                value={formData.phone}
                onChange={e => setFormData({...formData, phone: e.target.value})}
              />
            </div>

            <div className="relative">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 dark:text-white/50" />
              <input 
                type={showPassword ? "text" : "password"}
                required
                placeholder={t('password')}
                className={inputClasses + " pr-12"}
                value={formData.password}
                onChange={e => setFormData({...formData, password: e.target.value})}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 dark:text-white/50 hover:text-slate-600 dark:hover:text-white transition-colors"
              >
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>

            <AnimatePresence>
              {mode === 'register' && role === 'passenger' && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="relative">
                  <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 dark:text-white/50" />
                  <select 
                    className={inputClasses + " appearance-none"}
                    value={formData.gender}
                    onChange={e => setFormData({...formData, gender: e.target.value})}
                    required
                  >
                    <option value="" className="text-slate-900 bg-white">{t('gender')}</option>
                    <option value="Male" className="text-slate-900 bg-white">{t('male')}</option>
                    <option value="Female" className="text-slate-900 bg-white">{t('female')}</option>
                  </select>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Rider Credentials */}
            <AnimatePresence>
              {mode === 'register' && role === 'rider' && (
                <motion.div 
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="space-y-3 pt-4 border-t border-white/20 dark:border-white/10"
                >
                  <div className="flex items-center gap-2 justify-center mb-2">
                    <BadgeCheck className="w-4 h-4 text-emerald-500 dark:text-emerald-400" />
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 dark:text-white/60">{t('riderCredentials')}</p>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-3">
                    <div className="relative">
                      <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 dark:text-white/50" />
                      <select 
                        className={inputClasses + " pl-10 appearance-none"}
                        value={formData.gender}
                        onChange={e => setFormData({...formData, gender: e.target.value})}
                        required
                      >
                        <option value="" className="text-slate-900 bg-white">{t('gender')}</option>
                        <option value="Male" className="text-slate-900 bg-white">{t('male')}</option>
                        <option value="Female" className="text-slate-900 bg-white">{t('female')}</option>
                      </select>
                    </div>
                    <div className="relative">
                      <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 dark:text-white/50 pointer-events-none" />
                      <input 
                        type="date"
                        className={inputClasses + " pl-10 dark:[color-scheme:dark]"}
                        value={formData.dob}
                        onChange={e => setFormData({...formData, dob: e.target.value})}
                        required
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="relative">
                      <Car className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 dark:text-white/50" />
                      <select 
                        className={inputClasses + " pl-10 appearance-none"}
                        value={formData.vehicleType}
                        onChange={e => setFormData({...formData, vehicleType: e.target.value as any})}
                      >
                        <option value="car" className="text-slate-900 bg-white">{t('car')}</option>
                        <option value="motorcycle" className="text-slate-900 bg-white">{t('motorcycle')}</option>
                      </select>
                    </div>
                    <div className="relative">
                      <ClipboardCheck className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 dark:text-white/50" />
                      <input 
                        type="text"
                        placeholder={t('licenseClass')}
                        className={inputClasses + " pl-10"}
                        value={formData.licenseClass}
                        onChange={e => setFormData({...formData, licenseClass: e.target.value})}
                        required
                      />
                    </div>
                  </div>

                  <div className="relative">
                    <Car className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 dark:text-white/50" />
                    <input 
                      type="text"
                      placeholder={t('vehicleModelPlaceholder')}
                      className={inputClasses}
                      value={formData.vehicleModel}
                      onChange={e => setFormData({...formData, vehicleModel: e.target.value})}
                      required
                    />
                  </div>

                  <div className="relative">
                    <Languages className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 dark:text-white/50" />
                    <input 
                      type="text"
                      placeholder={t('numberPlatePlaceholder')}
                      className={inputClasses + " uppercase"}
                      value={formData.numberPlate}
                      onChange={e => setFormData({...formData, numberPlate: e.target.value})}
                      required
                    />
                  </div>

                  <div className="relative">
                    <ClipboardCheck className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 dark:text-white/50" />
                    <input 
                      type="text"
                      placeholder={t('permitCardNumber') || 'Permit Card Number'}
                      className={inputClasses}
                      value={formData.permitCardNumber}
                      onChange={e => setFormData({...formData, permitCardNumber: e.target.value})}
                      required
                    />
                  </div>

                  <div className="relative">
                    <Camera className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 dark:text-white/50" />
                    <input 
                      type="url"
                      placeholder={t('profilePictureUrl')}
                      className={inputClasses}
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
              className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 text-white py-4 rounded-2xl font-bold flex items-center justify-center gap-2 shadow-xl shadow-purple-500/25 disabled:opacity-50 hover:from-purple-700 hover:to-indigo-700 transition-all mt-4"
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
          <div className="my-6 flex items-center gap-4 relative z-10">
            <div className="flex-1 h-px bg-white/30 dark:bg-white/10" />
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-white/50 transition-colors duration-500">{t('continueWith')}</span>
            <div className="flex-1 h-px bg-white/30 dark:bg-white/10" />
          </div>

          {/* Google Sign-In */}
          <motion.button 
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => handleGoogleAuth(role)}
            disabled={loading}
            className="w-full bg-white/60 dark:bg-white/5 border border-white/60 dark:border-white/10 backdrop-blur-md text-slate-900 dark:text-white py-4 rounded-2xl font-bold flex items-center justify-center gap-3 hover:bg-white/80 dark:hover:bg-white/10 transition-all shadow-sm relative z-10"
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
          <p className="mt-8 text-center text-xs text-slate-500 dark:text-white/50 font-medium relative z-10 transition-colors duration-500">
            {t('authTerms')}
          </p>
        </motion.div>
      </div>
    </>
  );
}
import React, { useState, useEffect } from 'react';
import { UserProfile, auth, db } from '../lib/firebase';
import { User, Mail, Phone, Calendar, Car, ShieldCheck, Award, LogOut, ChevronRight, Smartphone, Star, MapPin, Edit2, Zap, Heart, Siren, Save, Loader2, X, Check, Circle, ChevronLeft, Moon, Sun, Settings } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { updateDoc, doc, serverTimestamp, getDoc } from 'firebase/firestore';
import { useLanguage } from '../lib/i18n';

interface Props {
  profile: UserProfile;
}

export default function ProfileView({ profile }: Props) {
  const { t } = useLanguage();
  const [isEditingContact, setIsEditingContact] = useState(false);
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [emergencyName, setEmergencyName] = useState(profile.emergencyContact?.name || '');
  const [emergencyPhone, setEmergencyPhone] = useState(profile.emergencyContact?.phone || '');
  
  const [newName, setNewName] = useState(profile.name || '');
  const [newPhone, setNewPhone] = useState(profile.phoneNumber || '');
  const [newAvatar, setNewAvatar] = useState(profile.avatarUrl || '');
  const [newGender, setNewGender] = useState(profile.gender || '');
  const [newVehicleType, setNewVehicleType] = useState<'car' | 'motorcycle'>(profile.vehicleType || 'car');
  const [newVehicleModel, setNewVehicleModel] = useState(profile.vehicleModel || '');
  const [newNumberPlate, setNewNumberPlate] = useState(profile.numberPlate || '');
  const [newLicenseClass, setNewLicenseClass] = useState(profile.licenseClass || '');
  const [newPermitCardNumber, setNewPermitCardNumber] = useState(profile.permitCardNumber || '');
  
  const [isSaving, setIsSaving] = useState(false);
  const [favoriteDrivers, setFavoriteDrivers] = useState<UserProfile[]>([]);

  // Dark mode state
  const [isDarkMode, setIsDarkMode] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('theme') === 'dark' || localStorage.getItem('theme') === null;
    }
    return true;
  });

  // Toggle theme function
  const toggleTheme = () => {
    const newTheme = !isDarkMode;
    setIsDarkMode(newTheme);
    const root = window.document.documentElement;
    if (newTheme) {
      root.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      root.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  };

  useEffect(() => {
    setNewName(profile.name || '');
    setNewPhone(profile.phoneNumber || '');
    setNewAvatar(profile.avatarUrl || '');
    setNewGender(profile.gender || '');
    setNewVehicleType(profile.vehicleType || 'car');
    setNewVehicleModel(profile.vehicleModel || '');
    setNewNumberPlate(profile.numberPlate || '');
    setNewLicenseClass(profile.licenseClass || '');
    setNewPermitCardNumber(profile.permitCardNumber || '');
    setEmergencyName(profile.emergencyContact?.name || '');
    setEmergencyPhone(profile.emergencyContact?.phone || '');
  }, [profile]);

  useEffect(() => {
    const loadFavorites = async () => {
      if (profile.role === 'passenger' && profile.favoriteUserIds?.length) {
        try {
          const drivers = await Promise.all(
            profile.favoriteUserIds.map(uid => getDoc(doc(db, 'users', uid)))
          );
          const favoriteData = drivers
            .filter(d => d.exists())
            .map(d => ({ id: d.id, ...d.data() } as UserProfile));
          setFavoriteDrivers(favoriteData);
        } catch (error) {
          console.error('Error loading favorite drivers:', error);
        }
      }
    };
    loadFavorites();
  }, [profile]);

  const stats = [
    { label: t('rating'), value: profile.rating.toString(), icon: Star, color: 'text-orange-500' },
    { label: t('totalRides'), value: profile.totalTrips.toString(), icon: Smartphone, color: 'text-orange-500' },
    { label: t('memberSince'), value: '2026', icon: Calendar, color: 'text-orange-500' },
  ];

  const resetProfileForm = () => {
    setNewName(profile.name || '');
    setNewPhone(profile.phoneNumber || '');
    setNewAvatar(profile.avatarUrl || '');
    setNewGender(profile.gender || '');
    setNewVehicleType(profile.vehicleType || 'car');
    setNewVehicleModel(profile.vehicleModel || '');
    setNewNumberPlate(profile.numberPlate || '');
    setNewLicenseClass(profile.licenseClass || '');
    setNewPermitCardNumber(profile.permitCardNumber || '');
  };

  const closeProfileEditor = () => {
    resetProfileForm();
    setIsEditingProfile(false);
  };

  const handleSaveProfile = async () => {
    if (!newName) return;
    setIsSaving(true);
    try {
      await updateDoc(doc(db, 'users', profile.uid), {
        name: newName.trim(),
        phoneNumber: newPhone.trim(),
        avatarUrl: newAvatar.trim(),
        gender: newGender,
        ...(profile.role === 'rider' ? {
          vehicleType: newVehicleType,
          vehicleModel: newVehicleModel.trim(),
          numberPlate: newNumberPlate.trim().toUpperCase(),
          licenseClass: newLicenseClass.trim(),
          permitCardNumber: newPermitCardNumber.trim(),
        } : {}),
        updatedAt: serverTimestamp()
      });
      setIsEditingProfile(false);
    } catch (e) {
      console.error(e);
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveContact = async () => {
    if (!emergencyName || !emergencyPhone) return;
    setIsSaving(true);
    try {
      await updateDoc(doc(db, 'users', profile.uid), {
        emergencyContact: {
          name: emergencyName,
          phone: emergencyPhone
        }
      });
      setIsEditingContact(false);
    } catch (e) {
      console.error(e);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="pb-20 transition-colors duration-300">
      {/* iOS-style Header */}
      <div className="sticky top-0 z-40 bg-white/80 dark:bg-black/80 backdrop-blur-xl border-b border-gray-100 dark:border-gray-800">
        <div className="max-w-md mx-auto px-4 py-3 flex items-center justify-between">
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">Profile</h1>
          <button 
            onClick={() => {
              resetProfileForm();
              setIsEditingProfile(true);
            }}
            className="active:scale-95 transition-transform"
          >
            <Edit2 className="w-5 h-5 text-orange-500" />
          </button>
        </div>
      </div>

      <div className="max-w-md mx-auto px-4 space-y-6">
        {/* Profile Header */}
        <div className="relative mt-4">
          <div className="flex items-center gap-4">
            <div className="relative">
              {profile.avatarUrl ? (
                <img src={profile.avatarUrl} className="w-20 h-20 rounded-full object-cover border-3 border-white dark:border-gray-800 shadow-lg" alt="" />
              ) : (
                <div className="w-20 h-20 bg-gradient-to-br from-orange-400 to-orange-600 rounded-full shadow-lg flex items-center justify-center">
                  <User className="w-10 h-10 text-white" />
                </div>
              )}
              {profile.role === 'rider' && (
                <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-orange-500 rounded-full flex items-center justify-center border-2 border-white dark:border-gray-800 shadow-sm">
                  <ShieldCheck className="w-3 h-3 text-white" />
                </div>
              )}
            </div>
            <div className="flex-1">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">{profile.name}</h2>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-sm text-gray-500 dark:text-gray-400 capitalize">{t(profile.role as any)}</span>
                <span className="w-1 h-1 rounded-full bg-gray-300 dark:bg-gray-600" />
                <span className="text-sm text-gray-500 dark:text-gray-400">{profile.email}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-3 gap-3">
          {stats.map((stat, i) => (
            <div key={i} className="bg-white/90 dark:bg-gray-900/90 backdrop-blur-sm rounded-2xl p-4 shadow-sm border border-gray-100 dark:border-gray-800 text-center hover:shadow-md transition-shadow active:scale-95">
              <stat.icon className={`w-5 h-5 mx-auto ${stat.color} mb-2`} />
              <p className="text-xl font-semibold text-gray-900 dark:text-white">{stat.value}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">{stat.label}</p>
            </div>
          ))}
        </div>

        {/* Settings Section - Dark Mode Toggle */}
        <div className="space-y-3">
          <div className="flex items-center gap-2 px-2">
            <Settings className="w-3 h-3 text-gray-500 dark:text-gray-400" />
            <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
              Settings
            </h3>
          </div>
          
          <div className="bg-white/90 dark:bg-gray-900/90 backdrop-blur-sm rounded-2xl overflow-hidden shadow-sm border border-gray-100 dark:border-gray-800">
            {/* Dark Mode Toggle */}
            <div className="p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center">
                  {isDarkMode ? (
                    <Moon className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                  ) : (
                    <Sun className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                  )}
                </div>
                <div>
                  <p className="font-medium text-gray-900 dark:text-white">Dark Mode</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Switch between light and dark theme</p>
                </div>
              </div>
              <button
                onClick={toggleTheme}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  isDarkMode ? 'bg-orange-500' : 'bg-gray-300 dark:bg-gray-600'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    isDarkMode ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>
          </div>
        </div>

        {/* Account Details Section */}
        <div className="space-y-3">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 px-2">
            {t('accountDetails')}
          </h3>
          <div className="bg-white/90 dark:bg-gray-900/90 backdrop-blur-sm rounded-2xl overflow-hidden shadow-sm border border-gray-100 dark:border-gray-800 divide-y divide-gray-100 dark:divide-gray-800">
            <div className="p-4 flex items-center justify-between active:bg-gray-50 dark:active:bg-gray-800 transition-colors cursor-pointer">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-orange-50 dark:bg-orange-500/10 rounded-full flex items-center justify-center">
                  <Mail className="w-5 h-5 text-orange-500" />
                </div>
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-0.5">{t('primaryEmail')}</p>
                  <p className="font-medium text-gray-900 dark:text-white text-sm">{profile.email}</p>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-gray-400" />
            </div>
            <div className="p-4 flex items-center justify-between active:bg-gray-50 dark:active:bg-gray-800 transition-colors cursor-pointer">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-emerald-50 dark:bg-emerald-500/10 rounded-full flex items-center justify-center">
                  <Phone className="w-5 h-5 text-emerald-500" />
                </div>
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-0.5">{t('phone')}</p>
                  <p className="font-medium text-gray-900 dark:text-white text-sm">{profile.phoneNumber || t('addPhone')}</p>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-gray-400" />
            </div>
          </div>
        </div>

        {/* Emergency Contact */}
        <div className="space-y-3">
          <div className="flex items-center justify-between px-2">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
              {t('securitySafety')}
            </h3>
            {!isEditingContact && (
              <button 
                onClick={() => setIsEditingContact(true)}
                className="text-xs font-medium text-orange-500 active:opacity-70 transition-opacity"
              >
                {profile.emergencyContact ? t('editContact') : t('addContact')}
              </button>
            )}
          </div>
          
          <div className="bg-white/90 dark:bg-gray-900/90 backdrop-blur-sm rounded-2xl overflow-hidden shadow-sm border border-gray-100 dark:border-gray-800">
            <AnimatePresence mode="wait">
              {isEditingContact ? (
                <motion.div 
                  key="editing"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="p-5 space-y-4"
                >
                  <div>
                    <label className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2 block">{t('fullName')}</label>
                    <input 
                      type="text"
                      value={emergencyName}
                      onChange={(e) => setEmergencyName(e.target.value)}
                      className="w-full bg-gray-50 dark:bg-gray-800 rounded-xl px-4 py-3 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-500 transition-all"
                      placeholder="e.g. John Doe"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2 block">{t('phone')}</label>
                    <input 
                      type="tel"
                      value={emergencyPhone}
                      onChange={(e) => setEmergencyPhone(e.target.value)}
                      className="w-full bg-gray-50 dark:bg-gray-800 rounded-xl px-4 py-3 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-500 transition-all"
                      placeholder="+250..."
                    />
                  </div>
                  <div className="flex gap-3 pt-2">
                    <button 
                      onClick={handleSaveContact}
                      disabled={isSaving}
                      className="flex-1 bg-orange-500 text-white py-3 rounded-xl font-medium flex items-center justify-center gap-2 active:scale-95 transition-all disabled:opacity-50 shadow-sm"
                    >
                      {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                      {t('saveContact')}
                    </button>
                    <button 
                      onClick={() => setIsEditingContact(false)}
                      className="px-6 py-3 rounded-xl font-medium text-gray-600 dark:text-gray-400 active:bg-gray-100 dark:active:bg-gray-800 transition-all"
                    >
                      {t('cancel')}
                    </button>
                  </div>
                </motion.div>
              ) : (
                <motion.div 
                  key="viewing"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="p-4 flex items-center justify-between"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-red-50 dark:bg-red-500/10 rounded-full flex items-center justify-center">
                      <Siren className="w-6 h-6 text-red-500" />
                    </div>
                    <div>
                      {profile.emergencyContact ? (
                        <>
                          <p className="font-semibold text-gray-900 dark:text-white">{profile.emergencyContact.name}</p>
                          <p className="text-sm text-gray-500 dark:text-gray-400">{profile.emergencyContact.phone}</p>
                        </>
                      ) : (
                        <div>
                          <p className="font-semibold text-gray-400 dark:text-gray-600">No contact added</p>
                          <p className="text-xs text-gray-400 uppercase tracking-wide mt-0.5">Safety first</p>
                        </div>
                      )}
                    </div>
                  </div>
                  {profile.emergencyContact && (
                    <div className="w-8 h-8 bg-emerald-50 dark:bg-emerald-500/10 rounded-full flex items-center justify-center">
                      <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Favorite Drivers Section */}
        {profile.role === 'passenger' && favoriteDrivers.length > 0 && (
          <div className="space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 px-2">
              {t('favoriteDrivers') || 'Favorite Drivers'}
            </h3>
            <div className="bg-white/90 dark:bg-gray-900/90 backdrop-blur-sm rounded-2xl overflow-hidden shadow-sm border border-gray-100 dark:border-gray-800 divide-y divide-gray-100 dark:divide-gray-800">
              {favoriteDrivers.map((driver) => (
                <div key={driver.uid} className="p-4 flex items-center justify-between active:bg-gray-50 dark:active:bg-gray-800 transition-colors">
                  <div className="flex items-center gap-3 flex-1">
                    {driver.avatarUrl ? (
                      <img src={driver.avatarUrl} className="w-12 h-12 rounded-full object-cover" alt="" />
                    ) : (
                      <div className="w-12 h-12 bg-gray-200 dark:bg-gray-800 rounded-full flex items-center justify-center">
                        <User className="w-6 h-6 text-gray-400" />
                      </div>
                    )}
                    <div className="flex-1">
                      <p className="font-semibold text-gray-900 dark:text-white">{driver.name}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <Star className="w-3 h-3 text-orange-400 fill-orange-400" />
                        <span className="text-xs text-gray-600 dark:text-gray-400">{driver.riderRating?.toFixed(1) || 'N/A'}</span>
                      </div>
                    </div>
                  </div>
                  <a 
                    href={`tel:${driver.phoneNumber}`}
                    className="w-9 h-9 bg-orange-50 dark:bg-orange-500/10 rounded-full flex items-center justify-center active:scale-95 transition-transform"
                  >
                    <Phone className="w-4 h-4 text-orange-500" />
                  </a>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Vehicle Information for Riders */}
        {profile.role === 'rider' && (
          <div className="space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 px-2">
              {t('vehicleIntelligence')}
            </h3>
            <div className="bg-white/90 dark:bg-gray-900/90 backdrop-blur-sm rounded-2xl overflow-hidden shadow-sm border border-gray-100 dark:border-gray-800 divide-y divide-gray-100 dark:divide-gray-800">
              <div className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center">
                    <Car className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-0.5">{t('modelType')}</p>
                    <p className="font-medium text-gray-900 dark:text-white capitalize text-sm">{profile.vehicleModel} • {profile.vehicleType}</p>
                  </div>
                </div>
              </div>
              <div className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center">
                    <Zap className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-0.5">{t('registrationPlate')}</p>
                    <p className="font-medium text-gray-900 dark:text-white uppercase text-sm">{profile.numberPlate}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Badges Section */}
        {profile.badges && profile.badges.length > 0 && (
          <div className="space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 px-2">
              {t('performanceTrophies')}
            </h3>
            <div className="flex flex-wrap gap-2">
              {profile.badges.map((badge, idx) => (
                <div key={idx} className="bg-white/90 dark:bg-gray-900/90 backdrop-blur-sm px-4 py-2 rounded-full shadow-sm border border-gray-100 dark:border-gray-800 flex items-center gap-2 active:scale-95 transition-transform">
                  <Award className="w-4 h-4 text-orange-500" />
                  <span className="text-xs font-medium text-gray-700 dark:text-gray-300 uppercase tracking-tight">{badge}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Logout Button */}
        <button 
          onClick={() => auth.signOut()}
          className="w-full bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 py-4 rounded-2xl font-medium flex items-center justify-center gap-2 active:scale-95 transition-all mt-6"
        >
          <LogOut className="w-5 h-5" />
          {t('logout')}
        </button>
      </div>

      {/* Edit Profile Modal - iOS Bottom Sheet Style */}
      <AnimatePresence>
        {isEditingProfile && (
          <div className="fixed inset-0 z-50">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/50 backdrop-blur-sm"
              onClick={closeProfileEditor}
            />
            <motion.div 
              initial={{ opacity: 0, y: '100%' }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="absolute bottom-0 left-0 right-0 bg-white/95 dark:bg-gray-950/95 backdrop-blur-xl rounded-t-3xl shadow-xl max-h-[90vh] overflow-y-auto"
            >
              <div className="sticky top-0 bg-white/95 dark:bg-gray-950/95 backdrop-blur-xl border-b border-gray-100 dark:border-gray-800 px-5 py-4 flex items-center justify-between">
                <button 
                  onClick={closeProfileEditor}
                  className="w-10 h-10 rounded-full flex items-center justify-center active:bg-gray-100 dark:active:bg-gray-800 transition-colors"
                >
                  <ChevronLeft className="w-6 h-6 text-gray-600 dark:text-gray-400" />
                </button>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{t('editProfile')}</h3>
                <button 
                  onClick={handleSaveProfile}
                  disabled={isSaving || !newName}
                  className="text-orange-500 font-medium disabled:opacity-50 active:scale-95 transition-transform"
                >
                  {isSaving ? <Loader2 className="w-5 h-5 animate-spin" /> : t('saveChanges')}
                </button>
              </div>

              <div className="p-5 space-y-5">
                <div>
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">{t('fullName')}</label>
                  <input 
                    type="text"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    className="w-full bg-gray-50 dark:bg-gray-900 rounded-xl px-4 py-3 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500 transition-all"
                    placeholder={t('fullName')}
                  />
                </div>

                <div>
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">{t('phone')}</label>
                  <input 
                    type="tel"
                    value={newPhone}
                    onChange={(e) => setNewPhone(e.target.value)}
                    className="w-full bg-gray-50 dark:bg-gray-900 rounded-xl px-4 py-3 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500 transition-all"
                    placeholder="+250..."
                  />
                </div>

                <div>
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">{t('gender')}</label>
                  <select
                    value={newGender}
                    onChange={(e) => setNewGender(e.target.value)}
                    className="w-full bg-gray-50 dark:bg-gray-900 rounded-xl px-4 py-3 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500 transition-all"
                  >
                    <option value="">{t('gender')}</option>
                    <option value="male">{t('male')}</option>
                    <option value="female">{t('female')}</option>
                  </select>
                </div>

                <div>
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">{t('profilePhotoUrl')}</label>
                  <div className="flex gap-3">
                    <input 
                      type="url"
                      value={newAvatar}
                      onChange={(e) => setNewAvatar(e.target.value)}
                      className="flex-1 bg-gray-50 dark:bg-gray-900 rounded-xl px-4 py-3 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500 transition-all"
                      placeholder="https://..."
                    />
                    {newAvatar && (
                      <img src={newAvatar} className="w-12 h-12 rounded-full object-cover border-2 border-gray-200 dark:border-gray-800" alt="Preview" />
                    )}
                  </div>
                </div>

                {profile.role === 'rider' && (
                  <div className="space-y-4 pt-2">
                    <div className="h-px bg-gray-100 dark:bg-gray-800" />
                    <div>
                      <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">{t('vehicleTypeLabel')}</label>
                      <select
                        value={newVehicleType}
                        onChange={(e) => setNewVehicleType(e.target.value as 'car' | 'motorcycle')}
                        className="w-full bg-gray-50 dark:bg-gray-900 rounded-xl px-4 py-3 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500 transition-all"
                      >
                        <option value="car">{t('car')}</option>
                        <option value="motorcycle">{t('motorcycle')}</option>
                      </select>
                    </div>

                    <div>
                      <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">{t('vehicleModel')}</label>
                      <input
                        type="text"
                        value={newVehicleModel}
                        onChange={(e) => setNewVehicleModel(e.target.value)}
                        className="w-full bg-gray-50 dark:bg-gray-900 rounded-xl px-4 py-3 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500 transition-all"
                        placeholder={t('vehicleModelPlaceholder')}
                      />
                    </div>

                    <div>
                      <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">{t('registrationPlate')}</label>
                      <input
                        type="text"
                        value={newNumberPlate}
                        onChange={(e) => setNewNumberPlate(e.target.value)}
                        className="w-full bg-gray-50 dark:bg-gray-900 rounded-xl px-4 py-3 text-gray-900 dark:text-white uppercase focus:outline-none focus:ring-2 focus:ring-orange-500 transition-all"
                        placeholder={t('numberPlatePlaceholder')}
                      />
                    </div>

                    <div>
                      <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">{t('licenseClass')}</label>
                      <input
                        type="text"
                        value={newLicenseClass}
                        onChange={(e) => setNewLicenseClass(e.target.value)}
                        className="w-full bg-gray-50 dark:bg-gray-900 rounded-xl px-4 py-3 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500 transition-all"
                        placeholder={t('licenseClass')}
                      />
                    </div>

                    <div>
                      <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">{t('permitCardNumber')}</label>
                      <input
                        type="text"
                        value={newPermitCardNumber}
                        onChange={(e) => setNewPermitCardNumber(e.target.value)}
                        className="w-full bg-gray-50 dark:bg-gray-900 rounded-xl px-4 py-3 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500 transition-all"
                        placeholder={t('permitCardNumber')}
                      />
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
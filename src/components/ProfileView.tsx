import React, { useState, useEffect } from 'react';
import { UserProfile, auth, db } from '../lib/firebase';
import { User, Mail, Phone, Calendar, Car, ShieldCheck, Award, LogOut, ChevronRight, Smartphone, Star, MapPin, Edit2, Zap, Heart, Siren, Save, Loader2, X, Camera, CreditCard, Flag } from 'lucide-react';
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
    { 
      label: t('rating'), 
      value: profile.rating.toString(), 
      icon: Star, 
      color: 'text-amber-500',
      bgColor: 'bg-amber-50 dark:bg-amber-500/10',
      iconBg: 'bg-amber-100 dark:bg-amber-500/20'
    },
    { 
      label: t('totalRides'), 
      value: profile.totalTrips.toString(), 
      icon: Flag, 
      color: 'text-blue-500',
      bgColor: 'bg-blue-50 dark:bg-blue-500/10',
      iconBg: 'bg-blue-100 dark:bg-blue-500/20'
    },
    { 
      label: t('memberSince'), 
      value: '2026', 
      icon: Calendar, 
      color: 'text-emerald-500',
      bgColor: 'bg-emerald-50 dark:bg-emerald-500/10',
      iconBg: 'bg-emerald-100 dark:bg-emerald-500/20'
    },
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
    <div className="space-y-6 pb-12">
      {/* Enhanced Header with Gradient */}
      <div className="relative">
        <div className="h-40 bg-gradient-to-br from-violet-600 via-purple-600 to-indigo-700 dark:from-violet-900 dark:via-purple-900 dark:to-indigo-950 rounded-[3rem] overflow-hidden shadow-2xl shadow-purple-500/20">
          {/* Animated gradient overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent" />
          <div className="absolute inset-0 opacity-30">
            <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2 blur-3xl" />
            <div className="absolute bottom-0 left-0 w-48 h-48 bg-white/10 rounded-full translate-y-1/2 -translate-x-1/2 blur-3xl" />
          </div>
        </div>
        
        <div className="px-6 -mt-16">
          <div className="flex items-end justify-between">
            <motion.div 
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: "spring", stiffness: 200, damping: 20 }}
              className="relative"
            >
              {profile.avatarUrl ? (
                <img 
                  src={profile.avatarUrl} 
                  className="w-28 h-28 rounded-[2rem] border-4 border-white dark:border-zinc-950 shadow-2xl object-cover ring-4 ring-purple-500/20" 
                  alt="" 
                />
              ) : (
                <div className="w-28 h-28 bg-gradient-to-br from-gray-200 to-gray-300 dark:from-zinc-800 dark:to-zinc-700 rounded-[2rem] border-4 border-white dark:border-zinc-950 shadow-2xl flex items-center justify-center ring-4 ring-purple-500/20">
                  <User className="w-12 h-12 text-gray-400 dark:text-gray-500" />
                </div>
              )}
              {profile.role === 'rider' && (
                <motion.div 
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: 0.3, type: "spring", stiffness: 300 }}
                  className="absolute -bottom-2 -right-2 w-10 h-10 bg-gradient-to-br from-emerald-400 to-emerald-600 rounded-2xl flex items-center justify-center border-4 border-white dark:border-zinc-950 shadow-xl"
                >
                  <ShieldCheck className="w-5 h-5 text-white" />
                </motion.div>
              )}
            </motion.div>
            
            <motion.button 
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.2 }}
              onClick={() => {
                resetProfileForm();
                setIsEditingProfile(true);
              }}
              className="bg-white/90 backdrop-blur-sm dark:bg-white text-gray-900 px-5 py-2.5 rounded-2xl shadow-xl border border-white/20 font-bold text-sm flex items-center gap-2 hover:bg-white transition-all active:scale-95"
            >
              <Edit2 className="w-4 h-4" />
              {t('editProfile')}
            </motion.button>
          </div>

          <div className="mt-5">
            <h1 className="text-3xl font-black tracking-tight text-gray-900 dark:text-white leading-tight">{profile.name}</h1>
            <p className="text-gray-500 dark:text-zinc-400 font-semibold flex items-center gap-2 mt-0.5">
              <span className="capitalize">{t(profile.role as any)}</span>
              <span className="w-1.5 h-1.5 rounded-full bg-gray-300 dark:bg-zinc-600" />
              <span className="text-sm">{profile.email}</span>
            </p>
          </div>
        </div>
      </div>

      {/* Enhanced Stats Grid */}
      <div className="grid grid-cols-3 gap-3 px-1">
        {stats.map((stat, i) => (
          <motion.div 
            key={i}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 * i }}
            whileHover={{ y: -4, transition: { duration: 0.2 } }}
            className={`${stat.bgColor} p-5 rounded-[2rem] border border-gray-100/50 dark:border-zinc-800/50 shadow-sm hover:shadow-md transition-all duration-300 text-center space-y-2`}
          >
            <div className={`w-10 h-10 ${stat.iconBg} rounded-2xl flex items-center justify-center mx-auto`}>
              <stat.icon className={`w-5 h-5 ${stat.color}`} />
            </div>
            <p className={`text-2xl font-black ${stat.color} leading-tight`}>{stat.value}</p>
            <p className="text-[10px] text-gray-500 dark:text-zinc-400 font-bold uppercase tracking-wider">{stat.label}</p>
          </motion.div>
        ))}
      </div>

      {/* Main Info Sections */}
      <div className="space-y-5">
        {/* Account Details Section */}
        <div className="space-y-3">
          <div className="flex items-center justify-between px-2">
            <h3 className="text-xs font-black uppercase tracking-[0.15em] text-gray-400 dark:text-zinc-500">{t('accountDetails')}</h3>
          </div>
          
          <div className="bg-white dark:bg-zinc-900 rounded-[2.5rem] overflow-hidden border border-gray-100 dark:border-zinc-800 shadow-sm">
            <motion.div 
              whileHover={{ backgroundColor: 'rgba(0,0,0,0.02)' }}
              className="p-5 flex items-center gap-4 transition-colors cursor-pointer"
            >
              <div className="w-12 h-12 bg-gradient-to-br from-blue-400 to-blue-600 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-500/20">
                <Mail className="w-5 h-5 text-white" />
              </div>
              <div className="flex-1">
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-0.5">{t('primaryEmail')}</p>
                <p className="font-bold text-gray-900 dark:text-white text-sm">{profile.email}</p>
              </div>
              <ChevronRight className="w-5 h-5 text-gray-300 dark:text-zinc-600" />
            </motion.div>
            
            <div className="h-px bg-gray-50 dark:bg-zinc-800" />
            
            <motion.div 
              whileHover={{ backgroundColor: 'rgba(0,0,0,0.02)' }}
              className="p-5 flex items-center gap-4 transition-colors cursor-pointer"
            >
              <div className="w-12 h-12 bg-gradient-to-br from-emerald-400 to-emerald-600 rounded-2xl flex items-center justify-center shadow-lg shadow-emerald-500/20">
                <Phone className="w-5 h-5 text-white" />
              </div>
              <div className="flex-1">
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-0.5">{t('phone')}</p>
                <p className="font-bold text-gray-900 dark:text-white text-sm">{profile.phoneNumber || t('addPhone')}</p>
              </div>
              <ChevronRight className="w-5 h-5 text-gray-300 dark:text-zinc-600" />
            </motion.div>
            
            {profile.gender && (
              <>
                <div className="h-px bg-gray-50 dark:bg-zinc-800" />
                <motion.div 
                  whileHover={{ backgroundColor: 'rgba(0,0,0,0.02)' }}
                  className="p-5 flex items-center gap-4 transition-colors cursor-pointer"
                >
                  <div className="w-12 h-12 bg-gradient-to-br from-pink-400 to-rose-600 rounded-2xl flex items-center justify-center shadow-lg shadow-pink-500/20">
                    <User className="w-5 h-5 text-white" />
                  </div>
                  <div className="flex-1">
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-0.5">{t('gender')}</p>
                    <p className="font-bold text-gray-900 dark:text-white text-sm capitalize">{profile.gender}</p>
                  </div>
                  <ChevronRight className="w-5 h-5 text-gray-300 dark:text-zinc-600" />
                </motion.div>
              </>
            )}
          </div>
        </div>

        {/* Emergency Contact Section */}
        <div className="space-y-3">
          <div className="flex items-center justify-between px-2">
            <h3 className="text-xs font-black uppercase tracking-[0.15em] text-gray-400 dark:text-zinc-500">{t('securitySafety')}</h3>
            {!isEditingContact && (
              <button 
                onClick={() => setIsEditingContact(true)}
                className="text-xs font-bold text-purple-600 dark:text-purple-400 hover:underline"
              >
                {profile.emergencyContact ? t('editContact') : t('addContact')}
              </button>
            )}
          </div>
          
          <div className="bg-white dark:bg-zinc-900 rounded-[2.5rem] overflow-hidden border border-gray-100 dark:border-zinc-800 shadow-sm">
            <AnimatePresence mode="wait">
              {isEditingContact ? (
                <motion.div 
                  key="editing"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="p-6 space-y-5"
                >
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-wider px-1">{t('fullName')}</label>
                    <input 
                      type="text"
                      value={emergencyName}
                      onChange={(e) => setEmergencyName(e.target.value)}
                      className="w-full bg-gray-50 dark:bg-zinc-800 border-2 border-transparent focus:border-purple-500 dark:focus:border-purple-400 rounded-2xl px-5 py-3.5 font-semibold text-gray-900 dark:text-white transition-all outline-none placeholder:text-gray-400"
                      placeholder="e.g. John Doe"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-wider px-1">{t('phone')}</label>
                    <input 
                      type="text"
                      value={emergencyPhone}
                      onChange={(e) => setEmergencyPhone(e.target.value)}
                      className="w-full bg-gray-50 dark:bg-zinc-800 border-2 border-transparent focus:border-purple-500 dark:focus:border-purple-400 rounded-2xl px-5 py-3.5 font-semibold text-gray-900 dark:text-white transition-all outline-none placeholder:text-gray-400"
                      placeholder="+250..."
                    />
                  </div>
                  <div className="flex gap-3 pt-2">
                    <button 
                      onClick={handleSaveContact}
                      disabled={isSaving}
                      className="flex-1 bg-gradient-to-r from-purple-600 to-indigo-600 text-white py-4 rounded-2xl font-bold flex items-center justify-center gap-2 hover:from-purple-700 hover:to-indigo-700 disabled:opacity-50 shadow-xl shadow-purple-500/25 transition-all active:scale-[0.98]"
                    >
                      {isSaving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                      {t('saveContact')}
                    </button>
                    <button 
                      onClick={() => setIsEditingContact(false)}
                      className="px-6 py-4 rounded-2xl font-bold text-gray-500 dark:text-zinc-400 hover:bg-gray-50 dark:hover:bg-zinc-800 transition-all text-sm"
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
                  className="p-5 flex items-center gap-4"
                >
                  <div className="w-12 h-12 bg-gradient-to-br from-red-400 to-red-600 rounded-2xl flex items-center justify-center shadow-lg shadow-red-500/20">
                    <Siren className="w-6 h-6 text-white" />
                  </div>
                  <div className="flex-1">
                    {profile.emergencyContact ? (
                      <>
                        <p className="font-bold text-gray-900 dark:text-white text-sm">{profile.emergencyContact.name}</p>
                        <p className="text-gray-500 dark:text-zinc-400 font-semibold text-xs mt-0.5">{profile.emergencyContact.phone}</p>
                      </>
                    ) : (
                      <div>
                        <p className="font-bold text-gray-400 dark:text-zinc-500 text-sm">No emergency contact</p>
                        <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider mt-0.5">Add for safety</p>
                      </div>
                    )}
                  </div>
                  {profile.emergencyContact && (
                    <div className="w-10 h-10 bg-emerald-50 dark:bg-emerald-500/10 rounded-full flex items-center justify-center">
                      <ShieldCheck className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
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
            <h3 className="text-xs font-black uppercase tracking-[0.15em] text-gray-400 dark:text-zinc-500 px-2">
              {t('favoriteDrivers') || 'Favorite Drivers'}
            </h3>
            <div className="bg-white dark:bg-zinc-900 rounded-[2.5rem] overflow-hidden border border-gray-100 dark:border-zinc-800 shadow-sm divide-y divide-gray-50 dark:divide-zinc-800">
              {favoriteDrivers.map((driver) => (
                <motion.div 
                  key={driver.uid} 
                  whileHover={{ backgroundColor: 'rgba(0,0,0,0.01)' }}
                  className="p-5 flex items-center gap-4 transition-colors"
                >
                  {driver.avatarUrl ? (
                    <img src={driver.avatarUrl} className="w-12 h-12 rounded-2xl object-cover ring-2 ring-gray-100 dark:ring-zinc-800" alt="" />
                  ) : (
                    <div className="w-12 h-12 bg-gradient-to-br from-amber-400 to-orange-600 rounded-2xl flex items-center justify-center">
                      <User className="w-6 h-6 text-white" />
                    </div>
                  )}
                  <div className="flex-1">
                    <p className="font-bold text-gray-900 dark:text-white text-sm">{driver.name}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <Star className="w-4 h-4 text-amber-400 fill-amber-400" />
                      <span className="text-xs font-bold text-gray-600 dark:text-zinc-400">{driver.riderRating?.toFixed(1) || 'N/A'}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <a 
                      href={`tel:${driver.phoneNumber}`}
                      className="w-10 h-10 bg-emerald-50 dark:bg-emerald-500/10 rounded-xl flex items-center justify-center text-emerald-600 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-500/20 transition-all"
                    >
                      <Phone className="w-5 h-5" />
                    </a>
                    <Heart className="w-5 h-5 text-red-500 fill-red-500" />
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        )}

        {/* Vehicle Info for Riders */}
        {profile.role === 'rider' && (
          <div className="space-y-3">
            <h3 className="text-xs font-black uppercase tracking-[0.15em] text-gray-400 dark:text-zinc-500 px-2">{t('vehicleIntelligence')}</h3>
            <div className="bg-white dark:bg-zinc-900 rounded-[2.5rem] overflow-hidden border border-gray-100 dark:border-zinc-800 shadow-sm divide-y divide-gray-50 dark:divide-zinc-800">
              <motion.div whileHover={{ backgroundColor: 'rgba(0,0,0,0.02)' }} className="p-5 flex items-center gap-4 transition-colors">
                <div className="w-12 h-12 bg-gradient-to-br from-slate-400 to-slate-600 rounded-2xl flex items-center justify-center shadow-lg shadow-slate-500/20">
                  <Car className="w-5 h-5 text-white" />
                </div>
                <div>
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-0.5">{t('modelType')}</p>
                  <p className="font-bold text-gray-900 dark:text-white text-sm capitalize">{profile.vehicleModel} • {profile.vehicleType}</p>
                </div>
              </motion.div>
              
              <motion.div whileHover={{ backgroundColor: 'rgba(0,0,0,0.02)' }} className="p-5 flex items-center gap-4 transition-colors">
                <div className="w-12 h-12 bg-gradient-to-br from-amber-400 to-yellow-600 rounded-2xl flex items-center justify-center shadow-lg shadow-amber-500/20">
                  <CreditCard className="w-5 h-5 text-white" />
                </div>
                <div>
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-0.5">{t('registrationPlate')}</p>
                  <p className="font-bold text-gray-900 dark:text-white text-sm uppercase tracking-wider">{profile.numberPlate}</p>
                </div>
              </motion.div>
            </div>
          </div>
        )}

        {/* Badges Section */}
        {profile.badges && profile.badges.length > 0 && (
          <div className="space-y-3">
            <h3 className="text-xs font-black uppercase tracking-[0.15em] text-gray-400 dark:text-zinc-500 px-2">{t('performanceTrophies')}</h3>
            <div className="grid grid-cols-2 gap-3">
              {profile.badges.map((badge, idx) => (
                <motion.div 
                  key={idx}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: idx * 0.1 }}
                  whileHover={{ scale: 1.05 }}
                  className="bg-white dark:bg-zinc-900 p-4 rounded-3xl border border-gray-100 dark:border-zinc-800 shadow-sm flex items-center gap-3 hover:shadow-md transition-all"
                >
                  <div className="w-10 h-10 bg-gradient-to-br from-amber-400 to-orange-500 rounded-2xl flex items-center justify-center shadow-lg shadow-amber-500/20">
                    <Award className="w-5 h-5 text-white" />
                  </div>
                  <span className="text-xs font-bold text-gray-700 dark:text-zinc-300">{badge}</span>
                </motion.div>
              ))}
            </div>
          </div>
        )}

        {/* Logout Button */}
        <motion.button 
          whileHover={{ scale: 1.01 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => auth.signOut()}
          className="w-full mt-8 bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 py-5 rounded-[2.5rem] font-bold flex items-center justify-center gap-3 hover:bg-red-100 dark:hover:bg-red-500/20 transition-all shadow-sm border border-red-100/50 dark:border-red-500/20"
        >
          <LogOut className="w-5 h-5" />
          {t('logout')}
        </motion.button>
      </div>

      {/* Edit Profile Modal */}
      <AnimatePresence>
        {isEditingProfile && (
          <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-6">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
              onClick={closeProfileEditor}
            />
            <motion.div 
              initial={{ opacity: 0, y: 100, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 100, scale: 0.95 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="bg-white dark:bg-zinc-950 w-full max-w-lg rounded-t-[3rem] sm:rounded-[3rem] p-8 sm:p-10 relative z-10 shadow-2xl max-h-[90vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between mb-8">
                <div>
                  <h3 className="text-2xl font-black text-gray-900 dark:text-white">{t('editProfile')}</h3>
                  <p className="text-gray-500 text-xs font-bold uppercase tracking-wider mt-1">{t('personalIdentity')}</p>
                </div>
                <button 
                  onClick={closeProfileEditor}
                  className="w-10 h-10 bg-gray-100 dark:bg-zinc-800 rounded-2xl flex items-center justify-center text-gray-400 hover:bg-gray-200 dark:hover:bg-zinc-700 transition-all"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-5">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-wider px-1">{t('fullName')}</label>
                  <input 
                    type="text"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    className="w-full bg-gray-50 dark:bg-zinc-900 border-2 border-transparent focus:border-purple-500 dark:focus:border-purple-400 rounded-2xl px-5 py-3.5 font-semibold text-gray-900 dark:text-white transition-all outline-none placeholder:text-gray-400"
                    placeholder={t('fullName')}
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-wider px-1">{t('phone')}</label>
                  <input 
                    type="tel"
                    value={newPhone}
                    onChange={(e) => setNewPhone(e.target.value)}
                    className="w-full bg-gray-50 dark:bg-zinc-900 border-2 border-transparent focus:border-purple-500 dark:focus:border-purple-400 rounded-2xl px-5 py-3.5 font-semibold text-gray-900 dark:text-white transition-all outline-none placeholder:text-gray-400"
                    placeholder="+250..."
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-wider px-1">{t('gender')}</label>
                  <select
                    value={newGender}
                    onChange={(e) => setNewGender(e.target.value)}
                    className="w-full bg-gray-50 dark:bg-zinc-900 border-2 border-transparent focus:border-purple-500 dark:focus:border-purple-400 rounded-2xl px-5 py-3.5 font-semibold text-gray-900 dark:text-white transition-all outline-none"
                  >
                    <option value="">{t('gender')}</option>
                    <option value="male">{t('male')}</option>
                    <option value="female">{t('female')}</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-wider px-1">{t('profilePhotoUrl')}</label>
                  <div className="flex gap-3">
                    <input 
                      type="url"
                      value={newAvatar}
                      onChange={(e) => setNewAvatar(e.target.value)}
                      className="flex-1 bg-gray-50 dark:bg-zinc-900 border-2 border-transparent focus:border-purple-500 dark:focus:border-purple-400 rounded-2xl px-5 py-3.5 font-semibold text-gray-900 dark:text-white transition-all outline-none placeholder:text-gray-400"
                      placeholder="https://..."
                    />
                    {newAvatar && (
                      <div className="relative">
                        <img src={newAvatar} className="w-14 h-14 rounded-2xl object-cover ring-2 ring-gray-100 dark:ring-zinc-800" alt="Preview" />
                        <div className="absolute -top-1 -right-1 w-5 h-5 bg-emerald-500 rounded-full border-2 border-white dark:border-zinc-950 flex items-center justify-center">
                          <Camera className="w-3 h-3 text-white" />
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {profile.role === 'rider' && (
                  <div className="space-y-5 rounded-[2rem] border-2 border-dashed border-gray-200 dark:border-zinc-800 bg-gray-50/50 dark:bg-zinc-900/50 p-6">
                    <div>
                      <p className="text-xs font-black uppercase tracking-[0.2em] text-gray-400 dark:text-zinc-500">
                        {t('vehicleIntelligence')}
                      </p>
                    </div>

                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-gray-400 uppercase tracking-wider px-1">{t('vehicleTypeLabel')}</label>
                      <select
                        value={newVehicleType}
                        onChange={(e) => setNewVehicleType(e.target.value as 'car' | 'motorcycle')}
                        className="w-full bg-white dark:bg-zinc-950 border-2 border-transparent focus:border-purple-500 dark:focus:border-purple-400 rounded-2xl px-5 py-3.5 font-semibold text-gray-900 dark:text-white transition-all outline-none"
                      >
                        <option value="car">{t('car')}</option>
                        <option value="motorcycle">{t('motorcycle')}</option>
                      </select>
                    </div>

                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-gray-400 uppercase tracking-wider px-1">{t('vehicleModel')}</label>
                      <input
                        type="text"
                        value={newVehicleModel}
                        onChange={(e) => setNewVehicleModel(e.target.value)}
                        className="w-full bg-white dark:bg-zinc-950 border-2 border-transparent focus:border-purple-500 dark:focus:border-purple-400 rounded-2xl px-5 py-3.5 font-semibold text-gray-900 dark:text-white transition-all outline-none placeholder:text-gray-400"
                        placeholder={t('vehicleModelPlaceholder')}
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-gray-400 uppercase tracking-wider px-1">{t('registrationPlate')}</label>
                      <input
                        type="text"
                        value={newNumberPlate}
                        onChange={(e) => setNewNumberPlate(e.target.value)}
                        className="w-full bg-white dark:bg-zinc-950 border-2 border-transparent focus:border-purple-500 dark:focus:border-purple-400 rounded-2xl px-5 py-3.5 font-semibold uppercase text-gray-900 dark:text-white transition-all outline-none placeholder:text-gray-400"
                        placeholder={t('numberPlatePlaceholder')}
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-gray-400 uppercase tracking-wider px-1">{t('licenseClass')}</label>
                      <input
                        type="text"
                        value={newLicenseClass}
                        onChange={(e) => setNewLicenseClass(e.target.value)}
                        className="w-full bg-white dark:bg-zinc-950 border-2 border-transparent focus:border-purple-500 dark:focus:border-purple-400 rounded-2xl px-5 py-3.5 font-semibold text-gray-900 dark:text-white transition-all outline-none placeholder:text-gray-400"
                        placeholder={t('licenseClass')}
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-gray-400 uppercase tracking-wider px-1">{t('permitCardNumber')}</label>
                      <input
                        type="text"
                        value={newPermitCardNumber}
                        onChange={(e) => setNewPermitCardNumber(e.target.value)}
                        className="w-full bg-white dark:bg-zinc-950 border-2 border-transparent focus:border-purple-500 dark:focus:border-purple-400 rounded-2xl px-5 py-3.5 font-semibold text-gray-900 dark:text-white transition-all outline-none placeholder:text-gray-400"
                        placeholder={t('permitCardNumber')}
                      />
                    </div>
                  </div>
                )}

                <div className="flex gap-3 pt-6">
                  <button 
                    onClick={handleSaveProfile}
                    disabled={isSaving || !newName}
                    className="flex-1 bg-gradient-to-r from-purple-600 to-indigo-600 text-white py-4 rounded-2xl font-bold flex items-center justify-center gap-2 hover:from-purple-700 hover:to-indigo-700 disabled:opacity-50 shadow-xl shadow-purple-500/25 transition-all active:scale-[0.98]"
                  >
                    {isSaving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                    {t('saveChanges')}
                  </button>
                  <button
                    onClick={closeProfileEditor}
                    type="button"
                    className="px-6 py-4 rounded-2xl font-bold text-sm text-gray-500 transition-all hover:bg-gray-50 dark:text-zinc-400 dark:hover:bg-zinc-900"
                  >
                    {t('cancel')}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
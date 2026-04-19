import React, { useState, useEffect } from 'react';
import { UserProfile, auth, db } from '../lib/firebase';
import { User, Mail, Phone, Calendar, Car, ShieldCheck, Award, LogOut, ChevronRight, Smartphone, Star, MapPin, Edit2, Zap, Heart, Siren, Save, Loader2, X } from 'lucide-react';
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
  
  const [isSaving, setIsSaving] = useState(false);
  const [favoriteDrivers, setFavoriteDrivers] = useState<UserProfile[]>([]);

  // Update local state when profile prop changes
  useEffect(() => {
    setNewName(profile.name || '');
    setNewPhone(profile.phoneNumber || '');
    setNewAvatar(profile.avatarUrl || '');
    setEmergencyName(profile.emergencyContact?.name || '');
    setEmergencyPhone(profile.emergencyContact?.phone || '');
  }, [profile]);

  // Load favorite drivers if passenger
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
    { label: t('rating'), value: profile.rating.toString(), icon: Star, color: 'text-amber-500' },
    { label: t('totalRides'), value: profile.totalTrips.toString(), icon: Smartphone, color: 'text-blue-500' },
    { label: t('memberSince'), value: '2026', icon: Calendar, color: 'text-emerald-500' },
  ];

  const handleSaveProfile = async () => {
    if (!newName) return;
    setIsSaving(true);
    try {
      await updateDoc(doc(db, 'users', profile.uid), {
        name: newName,
        phoneNumber: newPhone,
        avatarUrl: newAvatar,
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
    <div className="space-y-8 pb-12 transition-colors duration-300">
      {/* Header */}
      <div className="relative">
        <div className="h-32 bg-black dark:bg-zinc-800 rounded-[2.5rem] overflow-hidden shadow-2xl">
          <div className="absolute inset-0 opacity-20" style={{ background: 'radial-gradient(circle at 20% 50%, #fff 0%, transparent 100%)' }} />
        </div>
        
        <div className="px-6 -mt-12">
          <div className="flex items-end justify-between">
            <div className="relative">
              {profile.avatarUrl ? (
                <img src={profile.avatarUrl} className="w-24 h-24 rounded-3xl border-4 border-[#F5F5F5] dark:border-zinc-950 shadow-xl" alt="" />
              ) : (
                <div className="w-24 h-24 bg-gray-200 dark:bg-zinc-800 rounded-3xl border-4 border-[#F5F5F5] dark:border-zinc-950 shadow-xl flex items-center justify-center">
                  <User className="w-10 h-10 text-gray-400" />
                </div>
              )}
              {profile.role === 'rider' && (
                <div className="absolute -bottom-2 -right-2 w-8 h-8 bg-black dark:bg-emerald-500 rounded-xl flex items-center justify-center border-2 border-[#F5F5F5] dark:border-zinc-950 shadow-lg">
                  <ShieldCheck className="w-4 h-4 text-white" />
                </div>
              )}
            </div>
            <button 
              onClick={() => setIsEditingProfile(true)}
              className="bg-black dark:bg-white text-white dark:text-black px-4 py-2 rounded-2xl shadow-lg border border-white/10 font-bold text-xs flex items-center gap-2 hover:opacity-90 transition-all active:scale-95"
            >
              <Edit2 className="w-3.5 h-3.5" />
              {t('editProfile')}
            </button>
          </div>

          <div className="mt-6">
            <h1 className="text-3xl font-black tracking-tight text-gray-900 dark:text-white">{profile.name}</h1>
            <p className="text-gray-500 dark:text-zinc-400 font-bold capitalize flex items-center gap-2 mt-1">
              {t(profile.role as any)} 
              <span className="w-1 h-1 rounded-full bg-gray-300 dark:bg-zinc-700" /> 
              {profile.email}
            </p>
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-3 gap-4">
        {stats.map((stat, i) => (
          <div key={i} className="bg-white dark:bg-zinc-900 p-5 rounded-[2rem] border border-gray-100 dark:border-zinc-800 shadow-sm text-center space-y-1">
            <stat.icon className={`w-5 h-5 mx-auto ${stat.color}`} />
            <p className="text-2xl font-black text-gray-900 dark:text-white leading-tight">{stat.value}</p>
            <p className="text-[10px] text-gray-400 dark:text-zinc-500 font-black uppercase tracking-widest">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Main Info */}
      <div className="space-y-6">
        {/* Basic Info Section */}
        <div className="space-y-4">
          <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 px-6">{t('accountDetails')}</h3>
          <div className="bg-white dark:bg-zinc-900 rounded-[2.5rem] overflow-hidden border border-gray-100 dark:border-zinc-800 shadow-sm divide-y divide-gray-50 dark:divide-zinc-800">
            <div className="p-6 flex items-center justify-between group hover:bg-gray-50 dark:hover:bg-zinc-800/50 transition-colors">
              <div className="flex items-center gap-5">
                <div className="w-12 h-12 bg-blue-50 dark:bg-blue-500/10 rounded-2xl flex items-center justify-center text-blue-500 shadow-sm">
                  <Mail className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-0.5">{t('primaryEmail')}</p>
                  <p className="font-bold text-gray-900 dark:text-white">{profile.email}</p>
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-gray-200 dark:text-zinc-700" />
            </div>
            <div className="p-6 flex items-center justify-between group hover:bg-gray-50 dark:hover:bg-zinc-800/50 transition-colors">
              <div className="flex items-center gap-5">
                <div className="w-12 h-12 bg-emerald-50 dark:bg-emerald-500/10 rounded-2xl flex items-center justify-center text-emerald-500 shadow-sm">
                  <Phone className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-0.5">{t('phone')}</p>
                  <p className="font-bold text-gray-900 dark:text-white">{profile.phoneNumber || t('addPhone')}</p>
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-gray-200 dark:text-zinc-700" />
            </div>
          </div>
        </div>

        {/* Emergency Contact */}
        <div className="space-y-4">
          <div className="flex items-center justify-between px-6">
            <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400">{t('securitySafety')}</h3>
            {!isEditingContact && (
              <button 
                onClick={() => setIsEditingContact(true)}
                className="text-[10px] font-black uppercase tracking-widest text-emerald-600 dark:text-emerald-400 hover:underline"
              >
                {profile.emergencyContact ? t('editContact') : t('addContact')}
              </button>
            )}
          </div>
          <div className="bg-white dark:bg-zinc-900 rounded-[2.5rem] overflow-hidden border border-gray-100 dark:border-zinc-800 shadow-sm transition-all">
            <AnimatePresence mode="wait">
              {isEditingContact ? (
                <motion.div 
                  key="editing"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="p-8 space-y-6"
                >
                  <div className="space-y-3">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1">{t('fullName')}</label>
                    <input 
                      type="text"
                      value={emergencyName}
                      onChange={(e) => setEmergencyName(e.target.value)}
                      className="w-full bg-gray-50 dark:bg-zinc-800 border-2 border-transparent focus:border-black dark:focus:border-white rounded-2xl px-6 py-4 font-bold text-gray-900 dark:text-white transition-all outline-none"
                      placeholder="e.g. John Doe"
                    />
                  </div>
                  <div className="space-y-3">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1">{t('phone')}</label>
                    <input 
                      type="text"
                      value={emergencyPhone}
                      onChange={(e) => setEmergencyPhone(e.target.value)}
                      className="w-full bg-gray-50 dark:bg-zinc-800 border-2 border-transparent focus:border-black dark:focus:border-white rounded-2xl px-6 py-4 font-bold text-gray-900 dark:text-white transition-all outline-none"
                      placeholder="+250..."
                    />
                  </div>
                  <div className="flex gap-4 pt-2">
                    <button 
                      onClick={handleSaveContact}
                      disabled={isSaving}
                      className="flex-1 bg-black dark:bg-white text-white dark:text-black py-5 rounded-2xl font-black flex items-center justify-center gap-3 hover:opacity-90 disabled:opacity-50 shadow-xl transition-all active:scale-[0.98]"
                    >
                      {isSaving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                      {t('saveContact')}
                    </button>
                    <button 
                      onClick={() => setIsEditingContact(false)}
                      className="px-8 py-5 rounded-2xl font-bold text-gray-500 dark:text-zinc-400 hover:bg-gray-50 dark:hover:bg-zinc-800 transition-all font-black text-xs uppercase"
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
                  className="p-6 flex items-center justify-between"
                >
                  <div className="flex items-center gap-5">
                    <div className="w-14 h-14 bg-red-50 dark:bg-red-500/10 rounded-2xl flex items-center justify-center text-red-500 shadow-inner">
                      <Siren className="w-7 h-7" />
                    </div>
                    <div>
                      {profile.emergencyContact ? (
                        <>
                          <p className="text-lg font-black text-gray-900 dark:text-white leading-tight">{profile.emergencyContact.name}</p>
                          <p className="text-gray-500 dark:text-zinc-400 font-bold">{profile.emergencyContact.phone}</p>
                        </>
                      ) : (
                        <div>
                          <p className="text-lg font-black text-gray-400 dark:text-zinc-600 leading-tight">No contact added</p>
                          <p className="text-xs text-gray-400 font-bold uppercase tracking-widest mt-1">Safety first</p>
                        </div>
                      )}
                    </div>
                  </div>
                  {profile.emergencyContact && (
                    <div className="w-12 h-12 bg-emerald-50 dark:bg-emerald-500/10 rounded-full flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                      <ShieldCheck className="w-6 h-6" />
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Favorite Drivers Section (for passengers only) */}
        {profile.role === 'passenger' && favoriteDrivers.length > 0 && (
          <div className="space-y-4">
            <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 px-6">{t('favoriteDrivers') || 'Favorite Drivers'}</h3>
            <div className="bg-white dark:bg-zinc-900 rounded-[2.5rem] overflow-hidden border border-gray-100 dark:border-zinc-800 shadow-sm">
              <div className="divide-y divide-gray-50 dark:divide-zinc-800">
                {favoriteDrivers.map((driver) => (
                  <div key={driver.uid} className="p-5 flex items-center justify-between group hover:bg-gray-50 dark:hover:bg-zinc-800/50 transition-colors">
                    <div className="flex items-center gap-4 flex-1">
                      {driver.avatarUrl ? (
                        <img src={driver.avatarUrl} className="w-12 h-12 rounded-2xl object-cover border-2 border-gray-100 dark:border-zinc-800" alt="" />
                      ) : (
                        <div className="w-12 h-12 bg-gray-200 dark:bg-zinc-800 rounded-2xl flex items-center justify-center">
                          <User className="w-6 h-6 text-gray-400" />
                        </div>
                      )}
                      <div className="flex-1">
                        <p className="font-bold text-gray-900 dark:text-white">{driver.name}</p>
                        <div className="flex items-center gap-2">
                          <Star className="w-4 h-4 text-amber-400 fill-amber-400" />
                          <span className="text-xs font-bold text-gray-600 dark:text-zinc-400">{driver.riderRating?.toFixed(1) || 'N/A'}</span>
                          {driver.badges && driver.badges.length > 0 && (
                            <div className="flex gap-1">
                              {driver.badges.slice(0, 2).map((badge, i) => (
                                <span key={i} className="inline-block px-2 py-0.5 bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-300 text-[9px] font-black rounded-lg">
                                  {badge.charAt(0)}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <a 
                        href={`tel:${driver.phoneNumber}`}
                        className="w-10 h-10 bg-emerald-50 dark:bg-emerald-500/10 rounded-xl flex items-center justify-center text-emerald-600 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-500/20 transition-all"
                      >
                        <Phone className="w-5 h-5" />
                      </a>
                      <Heart className="w-5 h-5 text-red-500 fill-red-500" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {profile.role === 'rider' && (
          <div className="space-y-4">
            <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 px-6">{t('vehicleIntelligence')}</h3>
            <div className="bg-white dark:bg-zinc-900 rounded-[2.5rem] overflow-hidden border border-gray-100 dark:border-zinc-800 shadow-sm divide-y divide-gray-50 dark:divide-zinc-800">
              <div className="p-6 flex items-center justify-between group hover:bg-gray-50 dark:hover:bg-zinc-800/50 transition-colors">
                <div className="flex items-center gap-5">
                  <div className="w-12 h-12 bg-zinc-50 dark:bg-zinc-800 rounded-2xl flex items-center justify-center text-zinc-400 dark:text-zinc-500 shadow-sm">
                    <Car className="w-6 h-6" />
                  </div>
                  <div>
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-0.5">{t('modelType')}</p>
                    <p className="font-bold text-gray-900 dark:text-white capitalize">{profile.vehicleModel} • {profile.vehicleType}</p>
                  </div>
                </div>
                <ChevronRight className="w-5 h-5 text-gray-200 dark:text-zinc-700" />
              </div>
              <div className="p-6 flex items-center justify-between group hover:bg-gray-50 dark:hover:bg-zinc-800/50 transition-colors">
                <div className="flex items-center gap-5">
                  <div className="w-12 h-12 bg-zinc-50 dark:bg-zinc-800 rounded-2xl flex items-center justify-center text-zinc-400 dark:text-zinc-500 shadow-sm">
                    <Zap className="w-6 h-6" />
                  </div>
                  <div>
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-0.5">{t('registrationPlate')}</p>
                    <p className="font-bold text-gray-900 dark:text-white uppercase tracking-wider">{profile.numberPlate}</p>
                  </div>
                </div>
                <ChevronRight className="w-5 h-5 text-gray-200 dark:text-zinc-700" />
              </div>
            </div>
          </div>
        )}

        {profile.badges && profile.badges.length > 0 && (
          <div className="space-y-4">
            <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 px-6">{t('performanceTrophies')}</h3>
            <div className="grid grid-cols-2 gap-3 px-2">
              {profile.badges.map((badge, idx) => (
                <div key={idx} className="bg-white dark:bg-zinc-900 px-5 py-4 rounded-3xl border border-gray-100 dark:border-zinc-800 shadow-sm flex items-center gap-3">
                  <div className="w-8 h-8 bg-amber-50 dark:bg-amber-500/10 rounded-xl flex items-center justify-center text-amber-500">
                    <Award className="w-5 h-5" />
                  </div>
                  <span className="text-xs font-black text-gray-700 dark:text-zinc-300 uppercase tracking-tight">{badge}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <button 
          onClick={() => auth.signOut()}
          className="w-full mt-12 bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 py-6 rounded-[2.5rem] font-black flex items-center justify-center gap-3 hover:bg-red-100 dark:hover:bg-red-500/20 transition-all active:scale-[0.98] shadow-sm border border-red-100/20"
        >
          <LogOut className="w-6 h-6" />
          {t('logout')}
        </button>
      </div>

      <AnimatePresence>
        {isEditingProfile && (
          <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-6">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
              onClick={() => setIsEditingProfile(false)}
            />
            <motion.div 
              initial={{ opacity: 0, y: 100 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 100 }}
              className="bg-white dark:bg-zinc-950 w-full max-w-lg rounded-t-[3rem] sm:rounded-[3rem] p-8 sm:p-10 relative z-10 shadow-2xl max-h-[90vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between mb-8">
                <div>
                  <h3 className="text-2xl font-black text-gray-900 dark:text-white">{t('editProfile')}</h3>
                  <p className="text-gray-500 text-xs font-bold uppercase tracking-widest mt-1">{t('personalIdentity')}</p>
                </div>
                <button 
                  onClick={() => setIsEditingProfile(false)}
                  className="w-10 h-10 bg-gray-100 dark:bg-zinc-800 rounded-2xl flex items-center justify-center text-gray-400"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1">Full Name</label>
                  <input 
                    type="text"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    className="w-full bg-gray-50 dark:bg-zinc-900 border-2 border-transparent focus:border-black dark:focus:border-white rounded-2xl px-6 py-4 font-bold text-gray-900 dark:text-white transition-all outline-none"
                    placeholder="Enter your name"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1">Phone Number</label>
                  <input 
                    type="tel"
                    value={newPhone}
                    onChange={(e) => setNewPhone(e.target.value)}
                    className="w-full bg-gray-50 dark:bg-zinc-900 border-2 border-transparent focus:border-black dark:focus:border-white rounded-2xl px-6 py-4 font-bold text-gray-900 dark:text-white transition-all outline-none"
                    placeholder="+250..."
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1">Avatar URL</label>
                  <div className="flex gap-4">
                    <input 
                      type="url"
                      value={newAvatar}
                      onChange={(e) => setNewAvatar(e.target.value)}
                      className="flex-1 bg-gray-50 dark:bg-zinc-900 border-2 border-transparent focus:border-black dark:focus:border-white rounded-2xl px-6 py-4 font-bold text-gray-900 dark:text-white transition-all outline-none"
                      placeholder="https://..."
                    />
                    {newAvatar && (
                      <img src={newAvatar} className="w-14 h-14 rounded-2xl object-cover border-2 border-gray-100 dark:border-zinc-800" alt="Preview" />
                    )}
                  </div>
                </div>

                <div className="flex gap-4 pt-6">
                  <button 
                    onClick={handleSaveProfile}
                    disabled={isSaving || !newName}
                    className="flex-1 bg-black dark:bg-white text-white dark:text-black py-5 rounded-2xl font-black flex items-center justify-center gap-3 hover:opacity-90 disabled:opacity-50 shadow-xl transition-all"
                  >
                    {isSaving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                    {t('saveChanges')}
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

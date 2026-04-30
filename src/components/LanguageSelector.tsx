import React from 'react';
import { motion } from 'motion/react';
import { useLanguage } from '../lib/i18n';
import { Language } from '../constants/translations';
import { Languages, ChevronRight, Globe, Sparkles, Check } from 'lucide-react';

export default function LanguageSelector() {
  const { setLanguage } = useLanguage();

  const langs = [
    { code: 'en' as Language, name: 'English', native: 'English', flag: '🇬🇧' },
    { code: 'fr' as Language, name: 'French', native: 'Français', flag: '🇫🇷' },
    { code: 'rw' as Language, name: 'Kinyarwanda', native: 'Ikinyarwanda', flag: '🇷🇼' },
  ];

  return (
    <div className="min-h-screen relative overflow-hidden bg-slate-50 dark:bg-slate-950 transition-colors duration-500 flex items-center justify-center p-4 sm:p-6">
      {/* Dynamic Ambient Background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-purple-400/30 dark:bg-purple-600/30 rounded-full blur-[120px] mix-blend-multiply dark:mix-blend-screen animate-pulse" style={{ animationDuration: '4s' }} />
        <div className="absolute top-[20%] right-[-10%] w-[40%] h-[40%] bg-indigo-400/30 dark:bg-indigo-600/30 rounded-full blur-[100px] mix-blend-multiply dark:mix-blend-screen animate-pulse" style={{ animationDuration: '5s', animationDelay: '1s' }} />
        <div className="absolute bottom-[-20%] left-[20%] w-[60%] h-[60%] bg-blue-400/20 dark:bg-blue-600/20 rounded-full blur-[130px] mix-blend-multiply dark:mix-blend-screen animate-pulse" style={{ animationDuration: '6s', animationDelay: '2s' }} />
      </div>

      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        className="w-full max-w-md relative z-10"
      >
        {/* Premium Glassmorphism Card */}
        <div className="rounded-[3rem] bg-white/60 dark:bg-white/10 backdrop-blur-3xl border border-white/60 dark:border-white/20 shadow-[0_8px_32px_0_rgba(31,38,135,0.07)] dark:shadow-[0_8px_32px_0_rgba(0,0,0,0.3)] p-8 sm:p-10 relative overflow-hidden transition-colors duration-500">
          
          {/* Internal Reflection / Highlight */}
          <div className="absolute inset-0 rounded-[3rem] pointer-events-none border border-white/40 dark:border-white/10 mix-blend-overlay" />
          
          {/* Logo Section */}
          <div className="text-center space-y-6 relative z-10">
            <motion.div
              initial={{ scale: 0, rotate: -180 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: "spring", stiffness: 200, delay: 0.2, duration: 0.8 }}
              className="relative inline-block"
            >
              <div className="absolute inset-0 bg-gradient-to-tr from-purple-400 to-blue-400 dark:from-purple-500 dark:to-blue-500 rounded-[2rem] blur-xl opacity-50" />
              <div className="relative mx-auto flex h-24 w-24 items-center justify-center rounded-[2rem] bg-white/40 dark:bg-white/10 backdrop-blur-md border border-white/60 dark:border-white/30 shadow-2xl transition-colors duration-500">
                <img
                  src="/ntwara-logo.png"
                  alt="Ntwara"
                  className="h-16 w-16 object-contain dark:brightness-0 dark:invert drop-shadow-md transition-all duration-500"
                />
              </div>
            </motion.div>

            <div>
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="inline-flex items-center gap-2 bg-white/60 dark:bg-white/10 backdrop-blur-sm border border-white/60 dark:border-white/10 px-5 py-2.5 rounded-full mb-4 shadow-lg transition-colors duration-500"
              >
                <Globe className="w-4 h-4 text-purple-600 dark:text-purple-300" />
                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-purple-900 dark:text-white">Choose Language</span>
              </motion.div>
              <motion.h1
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.35 }}
                className="text-3xl sm:text-4xl font-black tracking-tight text-slate-900 dark:text-white drop-shadow-sm transition-colors duration-500"
              >
                Welcome to Ntwara
              </motion.h1>
              <motion.p
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
                className="text-slate-500 dark:text-white/60 font-semibold text-sm sm:text-base mt-3 transition-colors duration-500"
              >
                Select your preferred language to continue
              </motion.p>
            </div>
          </div>

          {/* Language Options */}
          <div className="space-y-4 mt-10 relative z-10">
            {langs.map((lang, idx) => (
              <motion.button
                key={lang.code}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.5 + idx * 0.1, duration: 0.4 }}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => setLanguage(lang.code)}
                className="w-full group relative overflow-hidden rounded-[1.5rem] bg-white/40 dark:bg-white/5 hover:bg-white/80 dark:hover:bg-white/10 border border-white/50 dark:border-white/10 backdrop-blur-md transition-all duration-300 shadow-lg hover:shadow-purple-500/10 dark:hover:shadow-purple-500/20"
              >
                <div className="relative flex items-center justify-between p-5 transition-all">
                  <div className="flex items-center gap-5">
                    <div className="text-4xl drop-shadow-md group-hover:scale-110 transition-transform duration-300">{lang.flag}</div>
                    <div className="text-left">
                      <p className="font-black text-xl text-slate-800 dark:text-white tracking-tight transition-colors duration-300">
                        {lang.native}
                      </p>
                      <p className="text-xs text-slate-500 dark:text-white/50 font-bold tracking-wider uppercase mt-0.5 group-hover:text-slate-700 dark:group-hover:text-white/70 transition-colors duration-300">
                        {lang.name}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-10 h-10 rounded-full bg-white/60 dark:bg-white/10 group-hover:bg-white/90 dark:group-hover:bg-white flex items-center justify-center transition-all duration-300 shadow-sm dark:shadow-inner border border-white/50 dark:border-transparent">
                      <ChevronRight className="w-5 h-5 text-slate-400 dark:text-white/50 group-hover:text-purple-600 group-hover:translate-x-0.5 transition-all duration-300" />
                    </div>
                  </div>
                </div>
              </motion.button>
            ))}
          </div>

          {/* Footer */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.9 }}
            className="text-center space-y-4 mt-10 relative z-10"
          >
            <div className="flex items-center justify-center gap-2 text-[10px] sm:text-xs text-slate-500 dark:text-white/40 font-semibold bg-white/40 dark:bg-black/20 w-fit mx-auto px-4 py-2 rounded-full border border-white/50 dark:border-white/5 transition-colors duration-500">
              <Sparkles className="w-3.5 h-3.5 text-purple-500 dark:text-purple-400" />
              <span>You can change this later in settings</span>
              <Sparkles className="w-3.5 h-3.5 text-purple-500 dark:text-purple-400" />
            </div>
            <div className="flex items-center justify-center gap-5 text-[10px] font-black text-slate-400 dark:text-white/30 uppercase tracking-[0.2em] transition-colors duration-500">
              <span className="flex items-center gap-1.5">
                <Check className="w-3.5 h-3.5 text-emerald-500 dark:text-emerald-400" />
                Fast
              </span>
              <span className="flex items-center gap-1.5">
                <Check className="w-3.5 h-3.5 text-emerald-500 dark:text-emerald-400" />
                Secure
              </span>
              <span className="flex items-center gap-1.5">
                <Check className="w-3.5 h-3.5 text-emerald-500 dark:text-emerald-400" />
                Reliable
              </span>
            </div>
          </motion.div>
        </div>
      </motion.div>
    </div>
  );
}
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
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 flex items-center justify-center p-4 sm:p-6">
      {/* Background decorations */}
      <div className="absolute top-0 left-0 w-64 h-64 bg-sky-500/10 rounded-full blur-3xl" />
      <div className="absolute bottom-0 right-0 w-64 h-64 bg-violet-500/10 rounded-full blur-3xl" />

      <motion.div 
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="w-full max-w-md bg-white dark:bg-slate-900 rounded-[3rem] p-8 sm:p-10 shadow-2xl shadow-purple-500/10 border border-slate-200 dark:border-slate-800 space-y-8 relative"
      >
        {/* Logo Section */}
        <div className="text-center space-y-5">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", stiffness: 200, delay: 0.2 }}
            className="relative inline-block"
          >
            <div className="absolute inset-0 bg-gradient-to-r from-purple-600 to-indigo-600 rounded-[2rem] blur-2xl opacity-20" />
            <div className="relative mx-auto flex h-24 w-24 items-center justify-center rounded-[2rem] bg-gradient-to-br from-purple-600 to-indigo-600 shadow-2xl shadow-purple-500/30">
              <img
                src="/ntwara-logo.png"
                alt="Ntwara"
                className="h-16 w-16 object-contain brightness-0 invert"
              />
            </div>
          </motion.div>

          <div>
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="inline-flex items-center gap-2 bg-purple-100 dark:bg-purple-500/10 text-purple-600 dark:text-purple-400 px-4 py-2 rounded-full mb-3"
            >
              <Globe className="w-4 h-4" />
              <span className="text-[10px] font-black uppercase tracking-[0.2em]">Choose Language</span>
            </motion.div>
            <motion.h1
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.35 }}
              className="text-3xl font-black tracking-tight text-gray-900 dark:text-white"
            >
              Welcome to Ntwara
            </motion.h1>
            <motion.p
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="text-gray-500 dark:text-slate-400 font-semibold text-sm mt-2"
            >
              Select your preferred language to continue
            </motion.p>
          </div>
        </div>

        {/* Language Options */}
        <div className="space-y-3">
          {langs.map((lang, idx) => (
            <motion.button
              key={lang.code}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.5 + idx * 0.1 }}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => setLanguage(lang.code)}
              className="w-full group relative overflow-hidden rounded-2xl transition-all duration-300"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-purple-600 to-indigo-600 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              <div className="relative flex items-center justify-between p-5 bg-gray-50 dark:bg-slate-800 group-hover:bg-transparent border-2 border-transparent group-hover:border-purple-400/30 rounded-2xl transition-all">
                <div className="flex items-center gap-4">
                  <div className="text-3xl">{lang.flag}</div>
                  <div className="text-left">
                    <p className="font-black text-lg text-gray-900 dark:text-white group-hover:text-white transition-colors">
                      {lang.native}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-slate-400 group-hover:text-white/70 font-semibold transition-colors">
                      {lang.name}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-white dark:bg-slate-700 group-hover:bg-white/20 flex items-center justify-center transition-all shadow-sm">
                    <ChevronRight className="w-5 h-5 text-gray-400 group-hover:text-white group-hover:translate-x-0.5 transition-all" />
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
          className="text-center space-y-3"
        >
          <div className="flex items-center justify-center gap-2 text-xs text-gray-400 dark:text-slate-500 font-medium">
            <Sparkles className="w-3.5 h-3.5 text-purple-400" />
            <span>You can change this later in settings</span>
            <Sparkles className="w-3.5 h-3.5 text-purple-400" />
          </div>
          <div className="flex items-center justify-center gap-4 text-[10px] font-bold text-gray-300 dark:text-slate-600 uppercase tracking-wider">
            <span className="flex items-center gap-1">
              <Check className="w-3 h-3 text-emerald-500" />
              Fast
            </span>
            <span className="flex items-center gap-1">
              <Check className="w-3 h-3 text-emerald-500" />
              Secure
            </span>
            <span className="flex items-center gap-1">
              <Check className="w-3 h-3 text-emerald-500" />
              Reliable
            </span>
          </div>
        </motion.div>
      </motion.div>
    </div>
  );
}
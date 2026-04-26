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
    <div className="min-h-screen bg-gradient-to-br from-arctic-lightest via-arctic-light to-arctic-light dark:from-arctic-dark dark:via-arctic-dark dark:to-arctic-dark flex items-center justify-center p-4 sm:p-6">
      {/* Background decorations */}
      <div className="absolute top-0 left-0 w-64 h-64 bg-arctic-medium/10 rounded-full blur-3xl" />
      <div className="absolute bottom-0 right-0 w-64 h-64 bg-arctic-light/10 rounded-full blur-3xl" />

      <motion.div 
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="w-full max-w-md bg-white dark:bg-arctic-dark rounded-[3rem] p-8 sm:p-10 shadow-2xl shadow-arctic-medium/10 border border-arctic-light dark:border-arctic-medium space-y-8 relative"
      >
        {/* Logo Section */}
        <div className="text-center space-y-5">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", stiffness: 200, delay: 0.2 }}
            className="relative inline-block"
          >
            <div className="absolute inset-0 bg-gradient-to-r from-arctic-medium to-arctic-dark rounded-[2rem] blur-2xl opacity-30" />
            <div className="relative mx-auto flex h-24 w-24 items-center justify-center rounded-[2rem] bg-gradient-to-br from-arctic-medium to-arctic-dark shadow-2xl shadow-arctic-medium/30">
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
              className="inline-flex items-center gap-2 bg-arctic-light dark:bg-arctic-medium/10 text-arctic-dark dark:text-arctic-light px-4 py-2 rounded-full mb-3"
            >
              <Globe className="w-4 h-4" />
              <span className="text-[10px] font-black uppercase tracking-[0.2em]">Choose Language</span>
            </motion.div>
            <motion.h1
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.35 }}
              className="text-3xl font-black tracking-tight text-arctic-dark dark:text-arctic-lightest"
            >
              Welcome to Ntwara
            </motion.h1>
            <motion.p
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="text-arctic-medium dark:text-arctic-light font-semibold text-sm mt-2"
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
              <div className="absolute inset-0 bg-gradient-to-r from-arctic-medium to-arctic-dark opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              <div className="relative flex items-center justify-between p-5 bg-arctic-lightest dark:bg-arctic-medium group-hover:bg-transparent border-2 border-transparent group-hover:border-arctic-light/30 rounded-2xl transition-all">
                <div className="flex items-center gap-4">
                  <div className="text-3xl">{lang.flag}</div>
                  <div className="text-left">
                    <p className="font-black text-lg text-arctic-dark dark:text-arctic-lightest group-hover:text-white transition-colors">
                      {lang.native}
                    </p>
                    <p className="text-xs text-arctic-medium dark:text-arctic-light group-hover:text-white/70 font-semibold transition-colors">
                      {lang.name}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-arctic-light dark:bg-arctic-light/20 group-hover:bg-white/20 flex items-center justify-center transition-all">
                    <ChevronRight className="w-5 h-5 text-arctic-medium dark:text-arctic-light group-hover:text-white group-hover:translate-x-0.5 transition-all" />
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
          <div className="flex items-center justify-center gap-2 text-xs text-arctic-medium dark:text-arctic-light font-medium">
            <Sparkles className="w-3.5 h-3.5 text-arctic-medium" />
            <span>You can change this later in settings</span>
            <Sparkles className="w-3.5 h-3.5 text-arctic-medium" />
          </div>
          <div className="flex items-center justify-center gap-4 text-[10px] font-bold text-arctic-light dark:text-arctic-light/50 uppercase tracking-wider">
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
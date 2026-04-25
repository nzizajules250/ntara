import React from 'react';
import { motion } from 'motion/react';
import { useLanguage } from '../lib/i18n';
import { Language } from '../constants/translations';
import { Languages, ChevronRight } from 'lucide-react';

export default function LanguageSelector() {
  const { setLanguage } = useLanguage();

  const langs = [
    { code: 'en' as Language, name: 'English', native: 'English' },
    { code: 'fr' as Language, name: 'French', native: 'Français' },
    { code: 'rw' as Language, name: 'Kinyarwanda', native: 'Ikinyarwanda' },
  ];

  return (
    <div className="min-h-screen bg-[#F5F5F5] flex items-center justify-center p-6">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md bg-white rounded-[3rem] p-8 sm:p-12 shadow-2xl space-y-10"
      >
        <div className="text-center space-y-4">
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-[2rem] bg-black shadow-xl shadow-black/10">
            <img
              src="/ntwara-logo.png"
              alt="Ntwara"
              className="h-20 w-20 object-contain"
            />
          </div>
          <div>
            <h1 className="text-3xl font-black tracking-tight text-gray-900">Ntwara</h1>
            <p className="text-gray-400 font-bold uppercase tracking-widest text-[10px] mt-2">Choose your experience</p>
          </div>
        </div>

        <div className="space-y-4">
          {langs.map((lang, idx) => (
            <motion.button
              key={lang.code}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: idx * 0.1 }}
              onClick={() => setLanguage(lang.code)}
              className="w-full bg-gray-50 hover:bg-black hover:text-white group p-6 rounded-3xl flex items-center justify-between transition-all duration-300"
            >
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-2xl bg-white group-hover:bg-white/10 flex items-center justify-center shadow-sm">
                  <Languages className="w-5 h-5 text-gray-400 group-hover:text-white" />
                </div>
                <div className="text-left">
                  <p className="font-bold text-lg">{lang.native}</p>
                  <p className="text-xs text-gray-400 group-hover:text-white/60 font-medium">{lang.name}</p>
                </div>
              </div>
              <ChevronRight className="w-6 h-6 text-gray-300 group-hover:text-white transition-transform group-hover:translate-x-1" />
            </motion.button>
          ))}
        </div>

        <p className="text-center text-xs text-gray-400 font-medium">
          You can change this later in your profile settings.
        </p>
      </motion.div>
    </div>
  );
}

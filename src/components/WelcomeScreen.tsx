import { motion } from 'motion/react';
import { ArrowRight, BadgeCheck, MapPinned, Radio, ShieldCheck, Sparkles, Star, Users, Navigation, Globe } from 'lucide-react';
import { useLanguage } from '../lib/i18n';

interface WelcomeScreenProps {
  onContinue: () => void;
}

const languageNames = {
  en: 'English',
  fr: 'Francais',
  rw: 'Ikinyarwanda',
} as const;

export default function WelcomeScreen({ onContinue }: WelcomeScreenProps) {
  const { language, t } = useLanguage();

  const highlights = [
    {
      icon: MapPinned,
      title: t('welcomeFeatureOneTitle'),
      description: t('welcomeFeatureOneBody'),
      iconBg: 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400',
    },
    {
      icon: Radio,
      title: t('welcomeFeatureTwoTitle'),
      description: t('welcomeFeatureTwoBody'),
      iconBg: 'bg-purple-100 dark:bg-purple-500/20 text-purple-600 dark:text-purple-400',
    },
    {
      icon: ShieldCheck,
      title: t('welcomeFeatureThreeTitle'),
      description: t('welcomeFeatureThreeBody'),
      iconBg: 'bg-blue-100 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400',
    },
  ];

  const currentLanguage = language ? languageNames[language] : languageNames.en;

  return (
    <div className="relative min-h-screen overflow-hidden bg-slate-50 dark:bg-slate-950 transition-colors duration-500">
      {/* Dynamic Ambient Background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-purple-400/30 dark:bg-purple-600/30 rounded-full blur-[120px] mix-blend-multiply dark:mix-blend-screen animate-pulse" style={{ animationDuration: '4s' }} />
        <div className="absolute top-[20%] right-[-10%] w-[40%] h-[40%] bg-indigo-400/30 dark:bg-indigo-600/30 rounded-full blur-[100px] mix-blend-multiply dark:mix-blend-screen animate-pulse" style={{ animationDuration: '5s', animationDelay: '1s' }} />
        <div className="absolute bottom-[-20%] left-[20%] w-[60%] h-[60%] bg-blue-400/20 dark:bg-blue-600/20 rounded-full blur-[130px] mix-blend-multiply dark:mix-blend-screen animate-pulse" style={{ animationDuration: '6s', animationDelay: '2s' }} />
      </div>

      <div className="relative mx-auto flex min-h-screen max-w-7xl items-center justify-center px-4 py-8 sm:px-6 lg:px-8 z-10">
        <div className="grid w-full gap-8 lg:grid-cols-2 items-center">
          
          {/* Left Column - Main Content */}
          <motion.section
            initial={{ opacity: 0, x: -30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8, ease: "easeOut" }}
            className="flex flex-col justify-center space-y-8"
          >
            {/* Top Badges */}
            <div className="flex flex-wrap items-center gap-3">
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="flex items-center gap-2 rounded-full bg-white/60 dark:bg-white/10 border border-white/60 dark:border-white/20 px-4 py-2 text-xs font-black uppercase tracking-widest text-purple-900 dark:text-white shadow-lg backdrop-blur-md transition-colors duration-500"
              >
                <Sparkles className="h-4 w-4 text-purple-500 dark:text-purple-400" />
                {t('welcomeBadge')}
              </motion.div>
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="flex items-center gap-2 rounded-full bg-indigo-50 dark:bg-indigo-500/20 border border-indigo-200 dark:border-indigo-500/30 px-4 py-2 text-xs font-bold text-indigo-700 dark:text-indigo-300 backdrop-blur-md transition-colors duration-500"
              >
                <Globe className="h-4 w-4" />
                {currentLanguage}
              </motion.div>
            </div>

            <div className="space-y-6 max-w-xl">
              {/* Logo */}
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.4 }}
                className="flex items-center justify-start relative"
              >
                <div className="absolute -inset-4 bg-gradient-to-tr from-purple-400/50 to-blue-400/50 dark:from-purple-600/20 dark:to-blue-600/20 rounded-full blur-2xl opacity-50" />
                <div className="relative h-24 w-24 flex items-center justify-center bg-white/60 dark:bg-white/10 backdrop-blur-md rounded-[2rem] border border-white/60 dark:border-white/20 shadow-2xl transition-colors duration-500">
                  <img
                    src="/ntwara-logo.png"
                    alt="Ntwara"
                    className="h-16 w-16 object-contain dark:brightness-0 dark:invert drop-shadow-md transition-all duration-500"
                  />
                </div>
              </motion.div>

              {/* Title & Description */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 }}
                className="space-y-4"
              >
                <h1 className="text-5xl font-black tracking-tight text-slate-900 dark:text-white sm:text-6xl lg:text-7xl drop-shadow-lg transition-colors duration-500">
                  {t('welcome')}
                  <span className="block mt-2 text-transparent bg-clip-text bg-gradient-to-r from-purple-600 to-indigo-600 dark:from-purple-400 dark:to-indigo-400 drop-shadow-md">
                    {t('welcomeHighlight') || 'To The Future.'}
                  </span>
                </h1>
                <p className="text-lg leading-relaxed text-slate-600 dark:text-white/70 font-medium max-w-md transition-colors duration-500">
                  {t('welcomeIntro')}
                </p>
              </motion.div>

              {/* Tags */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.6 }}
                className="flex flex-wrap gap-3"
              >
                {[
                  { label: t('passenger'), icon: Users },
                  { label: t('rider'), icon: Navigation },
                  { label: t('liveTracking'), icon: Radio },
                ].map(({ label, icon: Icon }) => (
                  <span
                    key={label}
                    className="inline-flex items-center gap-2 rounded-xl bg-white/40 dark:bg-white/5 border border-white/60 dark:border-white/10 px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-white/80 shadow-lg backdrop-blur-md transition-colors duration-500"
                  >
                    <Icon className="w-4 h-4 text-purple-600 dark:text-purple-400 transition-colors duration-500" />
                    {label}
                  </span>
                ))}
              </motion.div>

              {/* Continue Button */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.7 }}
                className="pt-6"
              >
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={onContinue}
                  className="group relative inline-flex w-full items-center justify-center gap-3 overflow-hidden rounded-[1.5rem] bg-white/60 dark:bg-white/10 backdrop-blur-xl border border-white/60 dark:border-white/20 px-8 py-5 text-sm font-black uppercase tracking-widest text-slate-900 dark:text-white shadow-[0_8px_32px_0_rgba(31,38,135,0.07)] dark:shadow-[0_8px_32px_0_rgba(0,0,0,0.3)] hover:shadow-purple-500/20 dark:hover:shadow-purple-500/30 transition-all sm:w-auto sm:min-w-[16rem]"
                >
                  <span className="absolute inset-0 bg-gradient-to-r from-purple-200/50 to-indigo-200/50 dark:from-purple-600/50 dark:to-indigo-600/50 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                  <span className="relative z-10 flex items-center gap-3">
                    {t('continueButton')}
                    <ArrowRight className="h-5 w-5 group-hover:translate-x-1 transition-transform" />
                  </span>
                </motion.button>
              </motion.div>
            </div>
          </motion.section>

          {/* Right Column - Features */}
          <motion.aside
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8, delay: 0.2, ease: "easeOut" }}
            className="flex flex-col gap-6"
          >
            {/* Header Card */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="relative overflow-hidden rounded-[2.5rem] bg-white/60 dark:bg-white/10 backdrop-blur-3xl p-8 shadow-[0_8px_32px_0_rgba(31,38,135,0.07)] dark:shadow-[0_8px_32px_0_rgba(0,0,0,0.3)] border border-white/60 dark:border-white/20 transition-colors duration-500"
            >
              <div className="absolute inset-0 rounded-[2.5rem] pointer-events-none border border-white/40 dark:border-white/10 mix-blend-overlay" />
              <div className="absolute top-0 right-0 w-48 h-48 bg-purple-200/50 dark:bg-purple-500/20 rounded-bl-full blur-3xl" />
              
              <div className="relative z-10">
                <div className="flex items-center gap-2 mb-4">
                  <BadgeCheck className="h-6 w-6 text-emerald-600 dark:text-emerald-400 drop-shadow-md transition-colors duration-500" />
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-700 dark:text-emerald-400 transition-colors duration-500">
                    {t('welcomeSummaryTitle')}
                  </p>
                </div>
                <h2 className="text-3xl font-black tracking-tight text-slate-900 dark:text-white sm:text-4xl drop-shadow-sm transition-colors duration-500">
                  {t('welcomeJourneyTitle')}
                </h2>
                <p className="mt-4 text-base leading-relaxed text-slate-600 dark:text-white/70 font-medium transition-colors duration-500">
                  {t('welcomeJourneyBody')}
                </p>
              </div>
            </motion.div>

            {/* Feature Cards */}
            <div className="grid gap-4">
              {highlights.map(({ icon: Icon, title, description, iconBg }, index) => (
                <motion.div
                  key={title}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.5 + index * 0.1 }}
                  whileHover={{ scale: 1.02 }}
                  className="rounded-[2rem] bg-white/40 dark:bg-white/5 p-5 shadow-lg border border-white/50 dark:border-white/10 backdrop-blur-md transition-all group hover:bg-white/80 dark:hover:bg-white/10"
                >
                  <div className="flex items-center gap-5">
                    <div className={`flex-shrink-0 w-14 h-14 ${iconBg} bg-opacity-20 rounded-2xl flex items-center justify-center shadow-inner group-hover:scale-110 transition-transform`}>
                      <Icon className="h-6 w-6" />
                    </div>
                    <div>
                      <h3 className="text-lg font-black tracking-tight text-slate-900 dark:text-white transition-colors duration-500">
                        {title}
                      </h3>
                      <p className="mt-1 text-xs sm:text-sm text-slate-500 dark:text-white/60 font-medium transition-colors duration-500">
                        {description}
                      </p>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>

            {/* Bottom Stats */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.9 }}
              className="flex items-center justify-center gap-6 rounded-[2rem] bg-white/40 dark:bg-white/5 backdrop-blur-md p-6 border border-white/50 dark:border-white/10 transition-colors duration-500"
            >
              <div className="text-center">
                <div className="flex items-center justify-center gap-1 text-amber-400 mb-2 drop-shadow-md">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} className="h-5 w-5 fill-current" />
                  ))}
                </div>
                <p className="text-xs sm:text-sm font-bold text-slate-700 dark:text-white/80 uppercase tracking-widest transition-colors duration-500">
                  {t('welcomeTrustedBy') || 'Trusted by thousands'}
                </p>
              </div>
            </motion.div>
          </motion.aside>
        </div>
      </div>
    </div>
  );
}
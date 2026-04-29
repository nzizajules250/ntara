import { motion } from 'motion/react';
import { ArrowRight, BadgeCheck, Languages, MapPinned, Radio, ShieldCheck, Sparkles, Zap, Star, Users, Navigation, Globe, Heart } from 'lucide-react';
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
      iconBg: 'bg-gradient-to-br from-sky-400 to-blue-600',
      glowColor: 'shadow-sky-500/30',
    },
    {
      icon: Radio,
      title: t('welcomeFeatureTwoTitle'),
      description: t('welcomeFeatureTwoBody'),
      iconBg: 'bg-gradient-to-br from-emerald-400 to-teal-600',
      glowColor: 'shadow-emerald-500/30',
    },
    {
      icon: ShieldCheck,
      title: t('welcomeFeatureThreeTitle'),
      description: t('welcomeFeatureThreeBody'),
      iconBg: 'bg-gradient-to-br from-violet-400 to-purple-600',
      glowColor: 'shadow-violet-500/30',
    },
  ];

  const currentLanguage = language ? languageNames[language] : languageNames.en;

  return (
    <div className="relative min-h-screen overflow-hidden bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-950 text-white">
      {/* Animated Background Orbs */}
      <div className="absolute inset-0">
        <div className="absolute top-0 left-0 w-[500px] h-[500px] bg-sky-500/20 rounded-full blur-[120px] animate-pulse" />
        <div className="absolute bottom-0 right-0 w-[500px] h-[500px] bg-violet-500/20 rounded-full blur-[120px] animate-pulse" style={{ animationDelay: '1s' }} />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-indigo-500/10 rounded-full blur-[150px]" />
      </div>

      {/* Subtle Grid Pattern */}
      <div className="absolute inset-0 opacity-[0.03]">
        <div className="h-full w-full" style={{
          backgroundImage: `linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)`,
          backgroundSize: '60px 60px'
        }} />
      </div>

      <div className="relative mx-auto flex min-h-screen max-w-7xl items-center px-4 py-8 sm:px-6 lg:px-8">
        <div className="grid w-full gap-6 lg:grid-cols-[1.2fr_0.88fr] lg:gap-8">
          
          {/* Left Column - Main Content */}
          <motion.section
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: "easeOut" }}
            className="rounded-[3rem] border border-white/10 bg-white/[0.03] p-6 shadow-2xl shadow-black/30 backdrop-blur-2xl sm:p-10"
          >
            {/* Top Badges */}
            <div className="mb-8 flex flex-wrap items-center gap-3">
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.2 }}
                className="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-black uppercase tracking-[0.22em] text-white"
              >
                <Sparkles className="h-4 w-4 text-sky-400" />
                {t('welcomeBadge')}
              </motion.div>
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.3 }}
                className="flex items-center gap-2 rounded-full border border-sky-400/20 bg-sky-400/10 px-4 py-2 text-xs font-bold text-sky-200"
              >
                <Globe className="h-4 w-4" />
                {currentLanguage}
              </motion.div>
            </div>

            <div className="max-w-2xl space-y-6">
              {/* Logo */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
                className="flex items-center justify-center sm:justify-start"
              >
                <div className="relative">
                  <div className="absolute inset-0 bg-gradient-to-r from-sky-500 to-violet-500 rounded-[2rem] blur-2xl opacity-20" />
                  <img
                    src="/ntwara-logo.png"
                    alt="Ntwara"
                    className="relative h-32 w-32 sm:h-40 sm:w-40 object-contain"
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
                <h1 className="text-4xl font-black tracking-tight text-white sm:text-5xl lg:text-6xl">
                  {t('welcome')}
                  <span className="block text-transparent bg-clip-text bg-gradient-to-r from-sky-400 via-blue-400 to-violet-400">
                    {t('welcomeHighlight') || ''}
                  </span>
                </h1>
                <p className="max-w-xl text-base leading-7 text-slate-300 sm:text-lg font-medium">
                  {t('welcomeIntro')}
                </p>
              </motion.div>

              {/* Summary Card */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.6 }}
                className="rounded-[2rem] border border-white/10 bg-gradient-to-br from-white/[0.03] to-white/[0.08] p-6 shadow-xl backdrop-blur-sm"
              >
                <div className="mb-3 flex items-center gap-2 text-sm font-black uppercase tracking-[0.2em] text-sky-300">
                  <BadgeCheck className="h-5 w-5" />
                  {t('welcomeSummaryTitle')}
                </div>
                <p className="text-sm leading-7 text-slate-300 sm:text-base font-medium">
                  {t('welcomeSummaryBody')}
                </p>
              </motion.div>

              {/* Tags */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.7 }}
                className="flex flex-wrap gap-2"
              >
                {[
                  { label: t('passenger'), icon: Users },
                  { label: t('rider'), icon: Navigation },
                  { label: t('liveTracking'), icon: Radio },
                ].map(({ label, icon: Icon }) => (
                  <span
                    key={label}
                    className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-bold uppercase tracking-[0.15em] text-slate-300 hover:bg-white/10 hover:border-white/20 transition-colors cursor-default"
                  >
                    <Icon className="w-3.5 h-3.5" />
                    {label}
                  </span>
                ))}
              </motion.div>

              {/* Continue Button */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.8 }}
                className="pt-4"
              >
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={onContinue}
                  className="group relative inline-flex w-full items-center justify-center gap-3 overflow-hidden rounded-[1.5rem] bg-gradient-to-r from-sky-500 via-blue-600 to-violet-600 px-8 py-5 text-sm font-black uppercase tracking-[0.22em] text-white shadow-2xl shadow-sky-500/25 transition-all sm:w-auto sm:min-w-[16rem]"
                >
                  <span className="absolute inset-0 bg-gradient-to-r from-violet-500 via-purple-500 to-sky-500 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                  <span className="relative z-10 flex items-center gap-3">
                    {t('continueButton')}
                    <ArrowRight className="h-5 w-5 group-hover:translate-x-1 transition-transform" />
                  </span>
                </motion.button>
                <p className="mt-4 text-sm text-slate-400 font-medium text-center sm:text-left">
                  {t('welcomeContinueHint')}
                </p>
              </motion.div>
            </div>
          </motion.section>

          {/* Right Column - Features */}
          <motion.aside
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6, delay: 0.2, ease: "easeOut" }}
            className="flex flex-col gap-4 rounded-[3rem] border border-white/10 bg-white/[0.03] p-5 backdrop-blur-2xl sm:p-6"
          >
            {/* Header Card */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="rounded-[2rem] bg-gradient-to-br from-indigo-600 via-purple-600 to-violet-700 p-6 shadow-2xl shadow-purple-500/20"
            >
              <div className="flex items-center gap-2 mb-3">
                <Zap className="h-5 w-5 text-sky-300" />
                <p className="text-xs font-black uppercase tracking-[0.24em] text-sky-200">
                  {t('welcomeSummaryTitle')}
                </p>
              </div>
              <h2 className="text-2xl font-black tracking-tight text-white sm:text-3xl">
                {t('welcomeJourneyTitle')}
              </h2>
              <p className="mt-3 text-sm leading-7 text-white/70 font-medium">
                {t('welcomeJourneyBody')}
              </p>
            </motion.div>

            {/* Feature Cards */}
            <div className="grid gap-3">
              {highlights.map(({ icon: Icon, title, description, iconBg, glowColor }, index) => (
                <motion.div
                  key={title}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.5 + index * 0.1 }}
                  whileHover={{ y: -2 }}
                  className="rounded-[2rem] border border-white/10 bg-white/[0.03] p-5 shadow-lg backdrop-blur-sm hover:bg-white/[0.06] hover:border-white/20 transition-all group"
                >
                  <div className="flex items-start gap-4">
                    <div className={`flex-shrink-0 w-12 h-12 ${iconBg} rounded-2xl flex items-center justify-center shadow-lg ${glowColor}`}>
                      <Icon className="h-5 w-5 text-white" />
                    </div>
                    <div>
                      <h3 className="text-lg font-black tracking-tight text-white group-hover:text-sky-300 transition-colors">
                        {title}
                      </h3>
                      <p className="mt-1.5 text-sm leading-6 text-slate-300 font-medium">
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
              className="rounded-[2rem] border border-white/10 bg-gradient-to-br from-white/[0.03] to-white/[0.06] p-5 text-center"
            >
              <div className="flex items-center justify-center gap-1.5 text-sky-400 mb-2">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} className="h-4 w-4 fill-current" />
                ))}
              </div>
              <p className="text-sm font-bold text-white">
                {t('welcomeTrustedBy') || 'Trusted by thousands of riders'}
              </p>
              <p className="text-xs text-slate-400 mt-1 font-medium">
                {t('welcomeJoinToday') || 'Join today and start riding'}
              </p>
              <Heart className="h-4 w-4 text-rose-400 mx-auto mt-2" />
            </motion.div>
          </motion.aside>
        </div>
      </div>
    </div>
  );
}
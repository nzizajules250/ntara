import { motion } from 'motion/react';
import { ArrowRight, BadgeCheck, Languages, MapPinned, Radio, ShieldCheck, Sparkles } from 'lucide-react';
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
    },
    {
      icon: Radio,
      title: t('welcomeFeatureTwoTitle'),
      description: t('welcomeFeatureTwoBody'),
    },
    {
      icon: ShieldCheck,
      title: t('welcomeFeatureThreeTitle'),
      description: t('welcomeFeatureThreeBody'),
    },
  ];

  const currentLanguage = language ? languageNames[language] : languageNames.en;

  return (
    <div className="relative min-h-screen overflow-hidden bg-slate-950 text-white">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(14,165,233,0.32),_transparent_32%),radial-gradient(circle_at_bottom_right,_rgba(34,197,94,0.25),_transparent_28%),linear-gradient(160deg,_#020617_0%,_#0f172a_42%,_#f8fafc_42%,_#eef2ff_100%)]" />
      <div className="absolute left-[-6rem] top-20 h-48 w-48 rounded-full bg-white/10 blur-3xl" />
      <div className="absolute bottom-16 right-[-4rem] h-56 w-56 rounded-full bg-emerald-400/20 blur-3xl" />

      <div className="relative mx-auto flex min-h-screen max-w-7xl items-center px-5 py-10 sm:px-8 lg:px-10">
        <div className="grid w-full gap-6 lg:grid-cols-[1.2fr_0.88fr]">
          <motion.section
            initial={{ opacity: 0, y: 28 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55 }}
            className="rounded-[2rem] border border-white/10 bg-slate-950/70 p-7 shadow-2xl shadow-black/30 backdrop-blur-xl sm:p-10"
          >
            <div className="mb-8 flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-3 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-semibold uppercase tracking-[0.22em] text-slate-200">
                <Sparkles className="h-4 w-4 text-cyan-300" />
                {t('welcomeBadge')}
              </div>
              <div className="flex items-center gap-2 rounded-full border border-cyan-300/20 bg-cyan-400/10 px-4 py-2 text-xs font-medium text-cyan-100">
                <Languages className="h-4 w-4" />
                {currentLanguage}
              </div>
            </div>

            <div className="max-w-2xl space-y-5">
              <div className="flex h-18 w-18 items-center justify-center rounded-[1.6rem] bg-black shadow-lg shadow-cyan-500/10">
                <img
                  src="/ntwara-logo.png"
                  alt="Ntwara"
                  className="h-40 w-40 object-contain"
                />
              </div>

              <div className="space-y-4">
                <h1 className="text-4xl font-black tracking-tight text-white sm:text-5xl lg:text-6xl">
                  {t('welcome')}
                </h1>
                <p className="max-w-xl text-base leading-7 text-slate-300 sm:text-lg">
                  {t('welcomeIntro')}
                </p>
              </div>

              <div className="rounded-[1.75rem] border border-white/10 bg-white/5 p-5 text-slate-100 shadow-xl shadow-black/10">
                <div className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.2em] text-cyan-200">
                  <BadgeCheck className="h-4 w-4" />
                  {t('welcomeSummaryTitle')}
                </div>
                <p className="text-sm leading-7 text-slate-300 sm:text-base">
                  {t('welcomeSummaryBody')}
                </p>
              </div>

              <div className="flex flex-wrap gap-3 text-xs font-semibold uppercase tracking-[0.2em] text-slate-300">
                <span className="rounded-full border border-white/10 bg-white/5 px-4 py-2">{t('passenger')}</span>
                <span className="rounded-full border border-white/10 bg-white/5 px-4 py-2">{t('rider')}</span>
                <span className="rounded-full border border-white/10 bg-white/5 px-4 py-2">{t('liveTracking')}</span>
              </div>

              <div className="pt-3">
                <button
                  onClick={onContinue}
                  className="inline-flex w-full items-center justify-center gap-3 rounded-[1.4rem] bg-gradient-to-r from-cyan-400 via-sky-400 to-emerald-400 px-6 py-4 text-sm font-black uppercase tracking-[0.22em] text-slate-950 transition-transform duration-300 hover:scale-[1.01] active:scale-[0.99] sm:w-auto sm:min-w-[15rem]"
                >
                  {t('continueButton')}
                  <ArrowRight className="h-5 w-5" />
                </button>
                <p className="mt-4 text-sm text-slate-400">
                  {t('welcomeContinueHint')}
                </p>
              </div>
            </div>
          </motion.section>

          <motion.aside
            initial={{ opacity: 0, x: 28 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.55, delay: 0.08 }}
            className="flex flex-col gap-4 rounded-[2rem] border border-slate-200/70 bg-white/90 p-5 text-slate-900 shadow-2xl shadow-slate-900/10 backdrop-blur-xl sm:p-6"
          >
            <div className="rounded-[1.5rem] bg-slate-950 px-5 py-6 text-white">
              <p className="text-xs font-bold uppercase tracking-[0.24em] text-cyan-200">
                {t('welcomeSummaryTitle')}
              </p>
              <h2 className="mt-3 text-2xl font-black tracking-tight sm:text-3xl">
                {t('welcomeJourneyTitle')}
              </h2>
              <p className="mt-3 text-sm leading-7 text-slate-300">
                {t('welcomeJourneyBody')}
              </p>
            </div>

            <div className="grid gap-4">
              {highlights.map(({ icon: Icon, title, description }, index) => (
                <motion.div
                  key={title}
                  initial={{ opacity: 0, y: 18 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.14 + index * 0.1 }}
                  className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-lg shadow-slate-200/60"
                >
                  <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-950 text-cyan-300">
                    <Icon className="h-5 w-5" />
                  </div>
                  <h3 className="text-lg font-bold tracking-tight text-slate-950">
                    {title}
                  </h3>
                  <p className="mt-2 text-sm leading-7 text-slate-600">
                    {description}
                  </p>
                </motion.div>
              ))}
            </div>
          </motion.aside>
        </div>
      </div>
    </div>
  );
}

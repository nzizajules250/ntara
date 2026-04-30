import { useState } from 'react';
import {
  MapPin, Phone, Clock, CheckCircle2, AlertCircle, Star, CreditCard, Navigation,
  User as UserIcon, Eye, Heart, Zap, Shield, ChevronDown, ChevronUp, Car, Bike,
  Smartphone, Settings, Users, TrendingUp, Award, Bell, DollarSign, Map as MapIcon,
  Headphones, Accessibility, Sparkles, ArrowRight, BookOpen, Lightbulb, LifeBuoy,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useLanguage } from '../lib/i18n';
import { UserProfile } from '../lib/firebase';

interface Props {
  profile: UserProfile;
}

const HowItWorks = ({ profile }: Props) => {
  const { t } = useLanguage();
  const [expandedSection, setExpandedSection] = useState<string | null>(null);
  const [selectedGuide, setSelectedGuide] = useState<'passenger' | 'driver'>(
    profile.role === 'passenger' ? 'passenger' : 'driver'
  );

  const passengerSteps = [
    {
      id: 'open-app',
      title: t('openAppSetLocation'),
      description: t('openAppDescription'),
      icon: MapPin,
      details: [
        t('enableLocationServices'),
        t('detectedPickupLocation'),
        t('adjustPickupLocationManually'),
      ],
      color: 'from-blue-500 to-blue-600',
    },
    {
      id: 'enter-destination',
      title: t('enterDestination'),
      description: t('enterDestinationDesc'),
      icon: Navigation,
      details: [
        t('searchDestinationByTyping'),
        t('viewEstimatedTrip'),
        t('seeEstimatedFare'),
        t('chooseVehicleType'),
      ],
      color: 'from-purple-500 to-purple-600',
    },
    {
      id: 'request-ride',
      title: t('requestRideStep'),
      description: t('requestRideDesc'),
      icon: Zap,
      details: [
        t('requestGoesLive'),
        t('driversSeesDetails'),
        t('systemFindsMatch'),
        t('canCancelAnytime'),
      ],
      color: 'from-orange-500 to-orange-600',
    },
    {
      id: 'driver-found',
      title: t('driverFoundHeading'),
      description: t('driverFoundDesc'),
      icon: Smartphone,
      details: [
        t('seeDriverLocation'),
        t('liveETAShowing'),
        t('driverVehicleDetails'),
        t('callOrMessageDriver'),
        t('realtimeTracking'),
      ],
      color: 'from-green-500 to-green-600',
    },
    {
      id: 'confirm-arrival',
      title: t('confirmDriverArrival'),
      description: t('confirmDriverArrivalDesc'),
      icon: CheckCircle2,
      details: [
        t('lookForVehicleDetails'),
        t('tapConfirmArrival'),
        t('driverSeesReady'),
        t('noNeedToWaitInside'),
      ],
      color: 'from-teal-500 to-teal-600',
    },
    {
      id: 'trip-started',
      title: t('tripStartedEnjoy'),
      description: t('tripStartedDesc'),
      icon: Heart,
      details: [
        t('seeRealtimeRoute'),
        t('viewLiveETA'),
        t('tripUpdatingRealtime'),
        t('stayConnectedDriver'),
      ],
      color: 'from-pink-500 to-pink-600',
    },
    {
      id: 'arrived',
      title: t('tripComplete'),
      description: t('tripCompleteDesc'),
      icon: Star,
      details: [
        t('fareCalculatedAuto'),
        t('paymentProcessed'),
        t('rateDriver'),
        t('addOptionalFeedback'),
        t('rideHistorySaved'),
      ],
      color: 'from-indigo-500 to-indigo-600',
    },
  ];

  const riderSteps = [
    {
      id: 'activate-online',
      title: t('activateOnlineStatus'),
      description: t('activateOnlineDesc'),
      icon: Zap,
      details: [
        t('toggleOnlineOffline'),
        t('setAvailabilityRadius'),
        t('locationSharedWithPassengers'),
        t('toggleOfflineAnytime'),
      ],
      color: 'from-green-500 to-green-600',
    },
    {
      id: 'receive-requests',
      title: t('receiveRideRequests'),
      description: t('receiveRequestsDesc'),
      icon: Bell,
      details: [
        t('getNotificationsRequests'),
        t('seePassengerLocation'),
        t('viewEstimatedEarnings'),
        t('seePassengerRating'),
        t('thirtySecondWindow'),
      ],
      color: 'from-blue-500 to-blue-600',
    },
    {
      id: 'accept-ride',
      title: t('acceptHeadingPickup'),
      description: t('acceptHeadingDesc'),
      icon: Navigation,
      details: [
        t('tapAcceptRide'),
        t('getTurnByTurn'),
        t('passengerSeesHeading'),
        t('gpsLocationUpdates'),
        t('passengerCanCall'),
      ],
      color: 'from-orange-500 to-orange-600',
    },
    {
      id: 'arrive-pickup',
      title: t('arriveAtPickup'),
      description: t('arriveAtPickupDesc'),
      icon: CheckCircle2,
      details: [
        t('locationSharedPassenger'),
        t('appShowsArrived'),
        t('passengerConfirmsArrival'),
        t('waitTimeTracked'),
        t('sendMessageOrCall'),
      ],
      color: 'from-teal-500 to-teal-600',
    },
    {
      id: 'start-trip',
      title: t('passengerConfirmsStart'),
      description: t('passengerConfirmsDesc'),
      icon: Smartphone,
      details: [
        t('passengerTapsStart'),
        t('tripTimerBegins'),
        t('receiveNavigationDest'),
        t('realtimeTrafficUpdates'),
        t('tripStatusVisible'),
      ],
      color: 'from-purple-500 to-purple-600',
    },
    {
      id: 'complete-trip',
      title: t('completeTrip'),
      description: t('completeTripDesc'),
      icon: DollarSign,
      details: [
        t('navigateToDestination'),
        t('tapCompleteRide'),
        t('fareCalculatedSettled'),
        t('moneyInWallet'),
        t('seeTripSummary'),
      ],
      color: 'from-indigo-500 to-indigo-600',
    },
    {
      id: 'receive-rating',
      title: t('getRatedEarnAchievements'),
      description: t('getRatedDesc'),
      icon: Award,
      details: [
        t('passengerRatesService'),
        t('averageRatingDisplayed'),
        t('maintainHighRatings'),
        t('earnAchievementBadges'),
        t('topRatedMoreRequests'),
      ],
      color: 'from-pink-500 to-pink-600',
    },
  ];

  const features = {
    passenger: [
      { icon: MapPin, title: t('realTimeTracking'), description: t('seeDriverLocationRealtime') },
      { icon: Shield, title: t('safeAndSecure'), description: t('allDriversVerified') },
      { icon: CreditCard, title: t('easyPayment'), description: t('multiplePaymentOptions') },
      { icon: Users, title: t('ratedDrivers'), description: t('seeDriverRatings') },
      { icon: Clock, title: t('saveTime'), description: t('noNeedToCall') },
      { icon: Smartphone, title: t('inAppChat'), description: t('communicateWithDriver') },
    ],
    rider: [
      { icon: TrendingUp, title: t('flexibleEarnings'), description: t('workOwnSchedule') },
      { icon: MapIcon, title: t('smartRouting'), description: t('optimizedRoutesEfficiency') },
      { icon: Award, title: t('performanceRewards'), description: t('earnBonusesAchievements') },
      { icon: Bell, title: t('realTimeRideRequests'), description: t('seeRequestsRealtime') },
      { icon: Shield, title: t('driverProtection'), description: t('insuranceCoverageSupport') },
      { icon: Headphones, title: t('supportTeamAvailable'), description: t('helpAlwaysAvailable') },
    ],
  };

  const tips = {
    passenger: [
      { title: t('setAccurateLocation'), description: t('accurateLocationTip'), icon: MapPin },
      { title: t('beReadyOnTime'), description: t('beReadyTip'), icon: Clock },
      { title: t('addEmergencyContacts'), description: t('emergencyContactsTip'), icon: Heart },
      { title: t('rateHonestly'), description: t('rateHonestlyTip'), icon: Star },
    ],
    rider: [
      { title: t('keepProfileUpdated'), description: t('profileUpdateTip'), icon: UserIcon },
      { title: t('maintainHighRating'), description: t('professionalServiceTip'), icon: Award },
      { title: t('knowTheArea'), description: t('familiarityTip'), icon: MapIcon },
      { title: t('communicateWell'), description: t('communicationTip'), icon: Headphones },
    ],
  };

  const isPassengerGuide = selectedGuide === 'passenger';
  const steps = isPassengerGuide ? passengerSteps : riderSteps;
  const userFeatures = isPassengerGuide ? features.passenger : features.rider;
  const userTips = isPassengerGuide ? tips.passenger : tips.rider;

  return (
    <div className="min-h-screen py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-10"
        >
          <div className="relative inline-block mb-6">
            <div className="absolute inset-0 bg-gradient-to-r from-purple-600 to-indigo-600 rounded-[2rem] blur-2xl opacity-20" />
            <div className="relative w-20 h-20 bg-gradient-to-br from-purple-600 to-indigo-600 rounded-[2rem] flex items-center justify-center mx-auto shadow-2xl shadow-purple-500/30">
              <BookOpen className="w-10 h-10 text-white" />
            </div>
          </div>
          <h1 className="text-4xl sm:text-5xl font-black text-gray-900 dark:text-white mb-3">
            {isPassengerGuide ? t('howToRequestRide') : t('howToEarnWithSwiftRide')}
          </h1>
          <p className="text-lg text-gray-500 dark:text-zinc-400 max-w-2xl mx-auto font-semibold">
            {isPassengerGuide ? t('followSteps') : t('startEarning')}
          </p>
        </motion.div>

        {/* Guide Switcher */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="mb-10"
        >
          <p className="mb-3 text-center text-xs font-black uppercase tracking-[0.2em] text-gray-400 dark:text-zinc-500">
            {t('switchGuide')}
          </p>
          <div className="mx-auto flex w-full max-w-md rounded-2xl bg-white/60 dark:bg-white/5 backdrop-blur-3xl border border-white/60 dark:border-white/10 shadow-[0_8px_32px_0_rgba(31,38,135,0.05)] p-1.5 transition-colors duration-500">
            {[
              { value: 'passenger' as const, label: t('passenger'), icon: Users },
              { value: 'driver' as const, label: t('driver'), icon: Car },
            ].map(({ value, label, icon: Icon }) => (
              <motion.button
                key={value}
                whileTap={{ scale: 0.95 }}
                onClick={() => { setExpandedSection(null); setSelectedGuide(value); }}
                className={`flex-1 rounded-xl px-4 py-3 font-bold text-sm transition-all flex items-center justify-center gap-2 ${
                  selectedGuide === value
                    ? 'bg-white dark:bg-zinc-700 text-gray-900 dark:text-white shadow-lg'
                    : 'text-gray-500 dark:text-zinc-400 hover:text-gray-700 dark:hover:text-zinc-300'
                }`}
              >
                <Icon className="h-5 w-5" />
                {label}
              </motion.button>
            ))}
          </div>
        </motion.div>

        {/* Steps */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="space-y-3 mb-16"
        >
          {steps.map((step, index) => {
            const Icon = step.icon;
            const isExpanded = expandedSection === step.id;

            return (
              <motion.div
                key={step.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
              >
                <button
                  onClick={() => setExpandedSection(isExpanded ? null : step.id)}
                  className="w-full text-left"
                >
                  <div className={`bg-white/60 dark:bg-white/10 backdrop-blur-3xl rounded-[2rem] p-5 shadow-[0_8px_32px_0_rgba(31,38,135,0.05)] hover:shadow-lg transition-all duration-500 border ${
                    isExpanded 
                      ? 'border-purple-300 dark:border-purple-500 ring-2 ring-purple-500/20' 
                      : 'border-white/60 dark:border-white/20'
                  }`}>
                    <div className="flex items-start gap-4">
                      {/* Step Number */}
                      <div className={`flex-shrink-0 w-12 h-12 bg-gradient-to-br ${step.color} rounded-2xl flex items-center justify-center text-white font-black text-lg shadow-lg`}>
                        {index + 1}
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <Icon className="w-5 h-5 text-gray-400 dark:text-zinc-500" />
                          <h3 className="text-lg font-black text-gray-900 dark:text-white">
                            {step.title}
                          </h3>
                        </div>
                        <p className="text-sm text-gray-500 dark:text-zinc-400 font-semibold">{step.description}</p>
                      </div>

                      {/* Expand Icon */}
                      <div className={`flex-shrink-0 w-8 h-8 rounded-xl flex items-center justify-center transition-all ${
                        isExpanded ? 'bg-purple-100 dark:bg-purple-500/10 text-purple-600 dark:text-purple-400' : 'bg-gray-100 dark:bg-zinc-800 text-gray-400'
                      }`}>
                        {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                      </div>
                    </div>

                    {/* Expanded Details */}
                    <AnimatePresence>
                      {isExpanded && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          transition={{ duration: 0.3 }}
                          className="mt-5 pt-5 border-t border-gray-100 dark:border-zinc-800"
                        >
                          <ul className="space-y-2.5">
                            {step.details.map((detail, i) => (
                              <motion.li
                                key={i}
                                initial={{ opacity: 0, x: -10 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: i * 0.05 }}
                                className="flex items-start gap-3"
                              >
                                <div className={`flex-shrink-0 w-6 h-6 bg-gradient-to-br ${step.color} rounded-lg flex items-center justify-center mt-0.5`}>
                                  <CheckCircle2 className="w-3.5 h-3.5 text-white" />
                                </div>
                                <span className="text-sm text-gray-600 dark:text-zinc-300 leading-relaxed font-semibold">
                                  {detail}
                                </span>
                              </motion.li>
                            ))}
                          </ul>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </button>
              </motion.div>
            );
          })}
        </motion.div>

        {/* Features Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="mb-16"
        >
          <div className="text-center mb-8">
            <div className="inline-flex items-center gap-2 bg-purple-100 dark:bg-purple-500/10 text-purple-600 dark:text-purple-400 px-4 py-2 rounded-full text-xs font-black uppercase tracking-wider mb-4">
              <Sparkles className="w-4 h-4" />
              Features
            </div>
            <h2 className="text-3xl font-black text-gray-900 dark:text-white">
              {isPassengerGuide ? t('whyChooseSwiftRide') : t('whyDriveWithSwiftRide')}
            </h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {userFeatures.map((feature, index) => {
              const Icon = feature.icon;
              return (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.4 + index * 0.05 }}
                  whileHover={{ y: -4 }}
                  className="bg-white/60 dark:bg-white/10 backdrop-blur-3xl rounded-[2rem] p-6 shadow-[0_8px_32px_0_rgba(31,38,135,0.05)] hover:shadow-lg transition-all duration-500 border border-white/60 dark:border-white/20"
                >
                  <div className="w-12 h-12 bg-gradient-to-br from-purple-100 to-indigo-100 dark:from-purple-500/10 dark:to-indigo-500/10 rounded-2xl flex items-center justify-center mb-4 shadow-lg">
                    <Icon className="w-6 h-6 text-purple-600 dark:text-purple-400" />
                  </div>
                  <h3 className="font-black text-gray-900 dark:text-white mb-2">{feature.title}</h3>
                  <p className="text-sm text-gray-500 dark:text-zinc-400 font-semibold leading-relaxed">{feature.description}</p>
                </motion.div>
              );
            })}
          </div>
        </motion.div>

        {/* Tips Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="mb-16"
        >
          <div className="text-center mb-8">
            <div className="inline-flex items-center gap-2 bg-amber-100 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 px-4 py-2 rounded-full text-xs font-black uppercase tracking-wider mb-4">
              <Lightbulb className="w-4 h-4" />
              Pro Tips
            </div>
            <h2 className="text-3xl font-black text-gray-900 dark:text-white">
              {t('tipsAndBestPractices')}
            </h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {userTips.map((tip, index) => {
              const Icon = tip.icon;
              return (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, x: index % 2 === 0 ? -20 : 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.5 + index * 0.1 }}
                  whileHover={{ y: -2 }}
                  className="bg-gradient-to-br from-amber-50 to-yellow-50 dark:from-amber-500/5 dark:to-yellow-500/5 rounded-[2rem] p-6 border border-amber-200 dark:border-amber-500/20"
                >
                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 bg-amber-100 dark:bg-amber-500/10 rounded-xl flex items-center justify-center flex-shrink-0">
                      <Icon className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                    </div>
                    <div>
                      <h3 className="font-black text-gray-900 dark:text-white mb-1">{tip.title}</h3>
                      <p className="text-sm text-gray-600 dark:text-zinc-300 font-semibold leading-relaxed">{tip.description}</p>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </motion.div>

        {/* Safety & Support */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          className="mb-16"
        >
          <div className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-500/5 dark:to-indigo-500/5 rounded-[2.5rem] p-8 border border-blue-200 dark:border-blue-500/20">
            <div className="flex items-start gap-5">
              <div className="w-14 h-14 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl flex items-center justify-center flex-shrink-0 shadow-xl shadow-blue-500/25">
                <Shield className="w-7 h-7 text-white" />
              </div>
              <div className="flex-1">
                <h3 className="text-xl font-black text-gray-900 dark:text-white mb-2">{t('safetyAndSupport')}</h3>
                <p className="text-gray-600 dark:text-zinc-300 mb-5 font-semibold">{t('yourSafetyPriority')}</p>
                <ul className="space-y-3">
                  <li className="flex items-center gap-3 text-sm text-gray-700 dark:text-zinc-200 font-semibold">
                    <CheckCircle2 className="w-5 h-5 text-blue-500 flex-shrink-0" />
                    {t('emergencySupport24_7')}
                  </li>
                  <li className="flex items-center gap-3 text-sm text-gray-700 dark:text-zinc-200 font-semibold">
                    <CheckCircle2 className="w-5 h-5 text-blue-500 flex-shrink-0" />
                    {t('tripInsuranceCoverage')}
                  </li>
                  <li className="flex items-center gap-3 text-sm text-gray-700 dark:text-zinc-200 font-semibold">
                    <CheckCircle2 className="w-5 h-5 text-blue-500 flex-shrink-0" />
                    {t('realtimeLocationSharing')}
                  </li>
                  <li className="flex items-center gap-3 text-sm text-gray-700 dark:text-zinc-200 font-semibold">
                    <CheckCircle2 className="w-5 h-5 text-blue-500 flex-shrink-0" />
                    {t('userVerificationChecks')}
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </motion.div>

        {/* CTA */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7 }}
          className="text-center"
        >
          <div className="relative overflow-hidden bg-gradient-to-br from-purple-600 via-purple-600 to-indigo-700 dark:from-purple-900 dark:via-purple-900 dark:to-indigo-950 rounded-[3rem] p-10 shadow-2xl shadow-purple-500/20">
            <div className="absolute inset-0 opacity-20">
              <div className="absolute top-0 right-0 w-48 h-48 bg-white rounded-full -translate-y-1/2 translate-x-1/2 blur-3xl" />
              <div className="absolute bottom-0 left-0 w-32 h-32 bg-white rounded-full translate-y-1/2 -translate-x-1/2 blur-3xl" />
            </div>
            <div className="relative z-10">
              <div className="inline-flex items-center gap-2 bg-white/20 backdrop-blur-sm px-4 py-2 rounded-full mb-6">
                <Zap className="w-4 h-4 text-white" />
                <span className="text-xs font-black text-white uppercase tracking-wider">Get Started Today</span>
              </div>
              <h3 className="text-3xl font-black text-white mb-3">{t('readyToGetStarted')}</h3>
              <p className="text-white/70 font-semibold mb-8 max-w-md mx-auto">
                {isPassengerGuide ? t('requestFirstRide') : t('startEarningToday')}
              </p>
              <div className="flex gap-3 justify-center flex-wrap">
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className="px-8 py-4 bg-white text-purple-700 font-black rounded-2xl shadow-xl shadow-black/10 hover:bg-gray-50 transition-all flex items-center gap-2"
                >
                  {isPassengerGuide ? t('requestARide') : t('becomeADriver')}
                  <ArrowRight className="w-5 h-5" />
                </motion.button>
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className="px-8 py-4 bg-white/20 backdrop-blur-sm text-white font-bold rounded-2xl hover:bg-white/30 transition-all flex items-center gap-2"
                >
                  <LifeBuoy className="w-5 h-5" />
                  {t('needHelp')}
                </motion.button>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default HowItWorks;
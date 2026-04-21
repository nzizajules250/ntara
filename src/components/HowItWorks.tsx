import { useState } from 'react';
import {
  MapPin,
  Phone,
  Clock,
  CheckCircle2,
  AlertCircle,
  Star,
  CreditCard,
  Navigation,
  User as UserIcon,
  Eye,
  Heart,
  Zap,
  Shield,
  ChevronDown,
  ChevronUp,
  Car,
  Bike,
  Smartphone,
  Settings,
  Users,
  TrendingUp,
  Award,
  Bell,
  DollarSign,
  Map as MapIcon,
  Headphones,
  Accessibility,
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
  const [selectedVehicle, setSelectedVehicle] = useState<'car' | 'motorcycle'>('car');

  const isPassenger = profile.role === 'passenger';

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
      {
        icon: MapPin,
        title: t('realTimeTracking'),
        description: t('seeDriverLocationRealtime'),
      },
      {
        icon: Shield,
        title: t('safeAndSecure'),
        description: t('allDriversVerified'),
      },
      {
        icon: CreditCard,
        title: t('easyPayment'),
        description: t('multiplePaymentOptions'),
      },
      {
        icon: Users,
        title: t('ratedDrivers'),
        description: t('seeDriverRatings'),
      },
      {
        icon: Clock,
        title: t('saveTime'),
        description: t('noNeedToCall'),
      },
      {
        icon: Smartphone,
        title: t('inAppChat'),
        description: t('communicateWithDriver'),
      },
    ],
    rider: [
      {
        icon: TrendingUp,
        title: t('flexibleEarnings'),
        description: t('workOwnSchedule'),
      },
      {
        icon: MapIcon,
        title: t('smartRouting'),
        description: t('optimizedRoutesEfficiency'),
      },
      {
        icon: Award,
        title: t('performanceRewards'),
        description: t('earnBonusesAchievements'),
      },
      {
        icon: Bell,
        title: t('realTimeRideRequests'),
        description: t('seeRequestsRealtime'),
      },
      {
        icon: Shield,
        title: t('driverProtection'),
        description: t('insuranceCoverageSupport'),
      },
      {
        icon: Headphones,
        title: t('supportTeamAvailable'),
        description: t('helpAlwaysAvailable'),
      },
    ],
  };

  const tips = {
    passenger: [
      {
        title: t('setAccurateLocation'),
        description: t('accurateLocationTip'),
        icon: MapPin,
      },
      {
        title: t('beReadyOnTime'),
        description: t('beReadyTip'),
        icon: Clock,
      },
      {
        title: t('addEmergencyContacts'),
        description: t('emergencyContactsTip'),
        icon: Heart,
      },
      {
        title: t('rateHonestly'),
        description: t('rateHonestlyTip'),
        icon: Star,
      },
    ],
    rider: [
      {
        title: t('keepProfileUpdated'),
        description: t('profileUpdateTip'),
        icon: UserIcon,
      },
      {
        title: t('maintainHighRating'),
        description: t('professionalServiceTip'),
        icon: Award,
      },
      {
        title: t('knowTheArea'),
        description: t('familiarityTip'),
        icon: MapIcon,
      },
      {
        title: t('communicateWell'),
        description: t('communicationTip'),
        icon: Headphones,
      },
    ],
  };

  const steps = isPassenger ? passengerSteps : riderSteps;
  const userFeatures = isPassenger ? features.passenger : features.rider;
  const userTips = isPassenger ? tips.passenger : tips.rider;

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-zinc-950 dark:to-zinc-900 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-12"
        >
          <div className="flex items-center justify-center gap-3 mb-4">
            <Accessibility className="w-8 h-8 text-emerald-500" />
            <h1 className="text-4xl sm:text-5xl font-bold text-gray-900 dark:text-white">
              {isPassenger ? t('howToRequestRide') : t('howToEarnWithSwiftRide')}
            </h1>
          </div>
          <p className="text-lg text-gray-600 dark:text-gray-300 max-w-2xl mx-auto">
            {isPassenger ? t('followSteps') : t('startEarning')}
          </p>
        </motion.div>

        {/* Vehicle Type Selector for Riders */}
        {!isPassenger && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="mb-12"
          >
            <div className="flex gap-4 justify-center">
              {[
                { type: 'car' as const, label: 'Car', icon: Car },
                { type: 'motorcycle' as const, label: 'Motorcycle', icon: Bike },
              ].map(({ type, label, icon: Icon }) => (
                <button
                  key={type}
                  onClick={() => setSelectedVehicle(type)}
                  className={`px-6 py-3 rounded-xl font-semibold transition-all flex items-center gap-2 ${
                    selectedVehicle === type
                      ? 'bg-emerald-500 text-white shadow-lg'
                      : 'bg-white dark:bg-zinc-800 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-zinc-700'
                  }`}
                >
                  <Icon className="w-5 h-5" />
                  {label}
                </button>
              ))}
            </div>
          </motion.div>
        )}

        {/* Steps */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2, staggerChildren: 0.1 }}
          className="space-y-4 mb-16"
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
                className="group"
              >
                <button
                  onClick={() => setExpandedSection(isExpanded ? null : step.id)}
                  className="w-full"
                >
                  <div className="bg-white dark:bg-zinc-800 rounded-2xl p-6 shadow-md hover:shadow-lg transition-shadow border border-gray-100 dark:border-zinc-700">
                    <div className="flex items-start gap-4">
                      {/* Step Number Circle */}
                      <div className={`flex-shrink-0 w-12 h-12 rounded-full bg-gradient-to-br ${step.color} flex items-center justify-center text-white font-bold text-lg`}>
                        {index + 1}
                      </div>

                      {/* Content */}
                      <div className="flex-1 text-left">
                        <div className="flex items-center gap-2 mb-2">
                          <Icon className={`w-5 h-5 text-gray-600 dark:text-gray-400`} />
                          <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                            {step.title}
                          </h3>
                        </div>
                        <p className="text-gray-600 dark:text-gray-400">{step.description}</p>
                      </div>

                      {/* Expand Icon */}
                      <div className="flex-shrink-0">
                        {isExpanded ? (
                          <ChevronUp className="w-6 h-6 text-gray-400" />
                        ) : (
                          <ChevronDown className="w-6 h-6 text-gray-400" />
                        )}
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
                          className="mt-6 pt-6 border-t border-gray-100 dark:border-zinc-700"
                        >
                          <ul className="space-y-3">
                            {step.details.map((detail, i) => (
                              <motion.li
                                key={i}
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: i * 0.1 }}
                                className="flex items-start gap-3"
                              >
                                <div className={`flex-shrink-0 w-6 h-6 rounded-full bg-gradient-to-br ${step.color} flex items-center justify-center mt-0.5`}>
                                  <CheckCircle2 className="w-4 h-4 text-white" />
                                </div>
                                <span className="text-gray-700 dark:text-gray-300 leading-relaxed">
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
          <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-8 text-center">
            {isPassenger ? t('whyChooseSwiftRide') : t('whyDriveWithSwiftRide')}
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {userFeatures.map((feature, index) => {
              const Icon = feature.icon;
              return (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.4 + index * 0.05 }}
                  className="bg-white dark:bg-zinc-800 rounded-2xl p-6 shadow-md hover:shadow-lg transition-all hover:scale-105 border border-gray-100 dark:border-zinc-700"
                >
                  <div className="flex items-start gap-4">
                    <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
                      <Icon className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
                    </div>
                    <div>
                      <h3 className="font-bold text-gray-900 dark:text-white mb-2">
                        {feature.title}
                      </h3>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        {feature.description}
                      </p>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </motion.div>

        {/* Tips & Best Practices */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="mb-16"
        >
          <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-8 text-center">
            {t('tipsAndBestPractices')}
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {userTips.map((tip, index) => {
              const Icon = tip.icon;
              return (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, x: index % 2 === 0 ? -20 : 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.5 + index * 0.1 }}
                  className="bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-900/20 dark:to-teal-900/20 rounded-2xl p-6 border border-emerald-200 dark:border-emerald-800"
                >
                  <div className="flex items-start gap-4">
                    <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-emerald-500/20 flex items-center justify-center">
                      <Icon className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                    </div>
                    <div>
                      <h3 className="font-bold text-gray-900 dark:text-white mb-2">
                        {tip.title}
                      </h3>
                      <p className="text-sm text-gray-700 dark:text-gray-300">
                        {tip.description}
                      </p>
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
          className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-2xl p-8 border border-blue-200 dark:border-blue-800"
        >
          <div className="flex items-start gap-4 mb-6">
            <Shield className="w-6 h-6 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-1" />
            <div>
              <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
                {t('safetyAndSupport')}
              </h3>
              <p className="text-gray-700 dark:text-gray-300 mb-4">
                {t('yourSafetyPriority')}
              </p>
              <ul className="space-y-2 text-sm text-gray-700 dark:text-gray-300">
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-blue-600 dark:text-blue-400 flex-shrink-0" />
                  {t('emergencySupport24_7')}
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-blue-600 dark:text-blue-400 flex-shrink-0" />
                  {t('tripInsuranceCoverage')}
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-blue-600 dark:text-blue-400 flex-shrink-0" />
                  {t('realtimeLocationSharing')}
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-blue-600 dark:text-blue-400 flex-shrink-0" />
                  {t('userVerificationChecks')}
                </li>
              </ul>
            </div>
          </div>
        </motion.div>

        {/* CTA */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7 }}
          className="mt-12 text-center"
        >
          <div className="bg-white dark:bg-zinc-800 rounded-2xl p-8 border border-gray-100 dark:border-zinc-700">
            <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
              {t('readyToGetStarted')}
            </h3>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              {isPassenger ? t('requestFirstRide') : t('startEarningToday')}
            </p>
            <div className="flex gap-4 justify-center flex-wrap">
              <button className="px-8 py-3 bg-emerald-500 hover:bg-emerald-600 text-white font-bold rounded-xl transition-colors">
                {isPassenger ? t('requestARide') : t('becomeADriver')}
              </button>
              <button className="px-8 py-3 bg-gray-200 dark:bg-zinc-700 hover:bg-gray-300 dark:hover:bg-zinc-600 text-gray-900 dark:text-white font-bold rounded-xl transition-colors">
                {t('needHelp')}
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default HowItWorks;

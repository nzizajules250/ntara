import React, { useState, useEffect, createContext, useContext, ReactNode } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Bell, X, CheckCircle2, AlertCircle, Info, Car, Navigation2, Zap, Clock } from 'lucide-react';
import { requestNotificationPermission, sendPushNotification } from '../lib/pushNotifications';

export type NotificationType = 'info' | 'success' | 'warning' | 'error' | 'ride_request' | 'ride_accepted';

export interface AppNotification {
  id: string;
  title: string;
  message: string;
  type: NotificationType;
  timestamp: Date;
  actions?: Array<{
    label: string;
    onClick: () => void;
    style?: 'primary' | 'secondary';
  }>;
}

interface NotificationContextType {
  notifications: AppNotification[];
  addNotification: (title: string, message: string, type: NotificationType, actions?: AppNotification['actions']) => void;
  removeNotification: (id: string) => void;
  clearAllNotifications: () => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export function useNotifications() {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
}

export function NotificationProvider({ children }: { children: ReactNode }) {
  const [notifications, setNotifications] = useState<AppNotification[]>([]);

  const addNotification = (title: string, message: string, type: NotificationType, actions?: AppNotification['actions']) => {
    const id = Math.random().toString(36).substring(2, 9);
    const newNotification: AppNotification = {
      id,
      title,
      message,
      type,
      timestamp: new Date(),
      actions,
    };
    setNotifications((prev) => [newNotification, ...prev]);

    // Send native push notification
    sendPushNotification(title, { body: message });

    // Auto-remove after 6 seconds (unless it has actions)
    if (!actions) {
      setTimeout(() => {
        removeNotification(id);
      }, 6000);
    }
  };

  const removeNotification = (id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  };

  const clearAllNotifications = () => {
    setNotifications([]);
  };

  useEffect(() => {
    requestNotificationPermission();
  }, []);

  return (
    <NotificationContext.Provider value={{ notifications, addNotification, removeNotification, clearAllNotifications }}>
      {children}
      <NotificationOverlay notifications={notifications} removeNotification={removeNotification} />
      <NotificationBell notifications={notifications} />
    </NotificationContext.Provider>
  );
}

// Notification Bell Component
function NotificationBell({ notifications }: { notifications: AppNotification[] }) {
  const [isOpen, setIsOpen] = useState(false);
  const unreadCount = notifications.length;

  return (
    <>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 rounded-full bg-white/90 dark:bg-gray-900/90 backdrop-blur-sm shadow-lg border border-gray-100 dark:border-gray-800 hover:shadow-xl transition-all active:scale-95"
      >
        <Bell className="w-5 h-5 text-gray-700 dark:text-gray-300" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 w-5 h-5 bg-orange-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center shadow-lg">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      <AnimatePresence>
        {isOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[150] bg-black/50 backdrop-blur-sm"
              onClick={() => setIsOpen(false)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: -20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: -20 }}
              className="fixed top-16 right-4 z-[160] w-80 max-w-[calc(100vw-2rem)] bg-white/95 dark:bg-gray-900/95 backdrop-blur-xl rounded-2xl shadow-2xl border border-gray-100 dark:border-gray-800 overflow-hidden"
            >
              <div className="p-4 border-b border-gray-100 dark:border-gray-800 flex justify-between items-center">
                <h3 className="font-semibold text-gray-900 dark:text-white">Notifications</h3>
                {notifications.length > 0 && (
                  <button
                    onClick={() => {
                      // Clear all notifications logic would go here
                      setIsOpen(false);
                    }}
                    className="text-xs text-orange-500 font-medium hover:underline"
                  >
                    Clear all
                  </button>
                )}
              </div>
              <div className="max-h-96 overflow-y-auto">
                {notifications.length === 0 ? (
                  <div className="p-8 text-center">
                    <Bell className="w-8 h-8 text-gray-300 dark:text-gray-600 mx-auto mb-2" />
                    <p className="text-sm text-gray-500 dark:text-gray-400">No notifications</p>
                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">New notifications will appear here</p>
                  </div>
                ) : (
                  <div className="divide-y divide-gray-100 dark:divide-gray-800">
                    {notifications.map((notification) => (
                      <div key={notification.id} className="p-4 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                        <div className="flex gap-3">
                          <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                            notification.type === 'success' ? 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600' :
                            notification.type === 'error' ? 'bg-red-100 dark:bg-red-500/20 text-red-600' :
                            notification.type === 'warning' ? 'bg-amber-100 dark:bg-amber-500/20 text-amber-600' :
                            notification.type === 'ride_request' ? 'bg-orange-100 dark:bg-orange-500/20 text-orange-600' :
                            'bg-blue-100 dark:bg-blue-500/20 text-blue-600'
                          }`}>
                            {notification.type === 'success' && <CheckCircle2 className="w-5 h-5" />}
                            {notification.type === 'error' && <AlertCircle className="w-5 h-5" />}
                            {notification.type === 'info' && <Info className="w-5 h-5" />}
                            {notification.type === 'ride_request' && <Car className="w-5 h-5" />}
                            {notification.type === 'ride_accepted' && <Navigation2 className="w-5 h-5" />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-gray-900 dark:text-white">{notification.title}</p>
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{notification.message}</p>
                            <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-1 flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {formatTime(notification.timestamp)}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}

function formatTime(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins} min ago`;
  if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
  return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
}

function NotificationOverlay({ notifications, removeNotification }: { notifications: AppNotification[], removeNotification: (id: string) => void }) {
  return (
    <div className="fixed inset-0 z-[200] pointer-events-none flex flex-col items-end justify-end p-4 sm:p-6 gap-3 sm:gap-4">
      <AnimatePresence>
        {notifications.slice(0, 5).map((notification, index) => (
          <motion.div
            key={notification.id}
            initial={{ opacity: 0, x: 50, scale: 0.9 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.2 } }}
            transition={{ delay: index * 0.05 }}
            className="pointer-events-auto w-full sm:w-96"
          >
            <div className="bg-white/95 dark:bg-gray-900/95 backdrop-blur-xl rounded-2xl shadow-2xl border border-gray-100 dark:border-gray-800 overflow-hidden flex flex-col">
              {/* Progress bar for auto-dismiss */}
              {!notification.actions && (
                <motion.div
                  initial={{ width: '100%' }}
                  animate={{ width: '0%' }}
                  transition={{ duration: 6, ease: 'linear' }}
                  className="h-0.5 bg-orange-500/50"
                />
              )}
              
              <div className="flex">
                <div className={`w-1 ${
                  notification.type === 'success' ? 'bg-emerald-500' :
                  notification.type === 'error' ? 'bg-red-500' :
                  notification.type === 'warning' ? 'bg-amber-500' :
                  notification.type === 'ride_request' ? 'bg-orange-500' :
                  notification.type === 'ride_accepted' ? 'bg-orange-500' :
                  'bg-blue-500'
                }`} />
                
                <div className="p-4 flex-1 flex gap-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                    notification.type === 'success' ? 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600' :
                    notification.type === 'error' ? 'bg-red-100 dark:bg-red-500/20 text-red-600' :
                    notification.type === 'warning' ? 'bg-amber-100 dark:bg-amber-500/20 text-amber-600' :
                    notification.type === 'ride_request' ? 'bg-orange-100 dark:bg-orange-500/20 text-orange-600' :
                    'bg-blue-100 dark:bg-blue-500/20 text-blue-600'
                  }`}>
                    {notification.type === 'success' && <CheckCircle2 className="w-5 h-5" />}
                    {notification.type === 'error' && <AlertCircle className="w-5 h-5" />}
                    {notification.type === 'info' && <Info className="w-5 h-5" />}
                    {notification.type === 'ride_request' && <Car className="w-5 h-5" />}
                    {notification.type === 'ride_accepted' && <Navigation2 className="w-5 h-5" />}
                    {notification.type === 'warning' && <AlertCircle className="w-5 h-5" />}
                  </div>

                  <div className="flex-1 min-w-0">
                    <h4 className="text-sm font-semibold text-gray-900 dark:text-white leading-tight mb-1">{notification.title}</h4>
                    <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed font-medium">{notification.message}</p>
                  </div>

                  <button 
                    onClick={() => removeNotification(notification.id)}
                    className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg h-fit text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors flex-shrink-0"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {notification.actions && notification.actions.length > 0 && (
                <div className="border-t border-gray-100 dark:border-gray-800 p-3 flex gap-2">
                  {notification.actions.map((action, idx) => (
                    <button
                      key={idx}
                      onClick={() => {
                        action.onClick();
                        removeNotification(notification.id);
                      }}
                      className={`px-4 py-2 rounded-xl font-semibold text-sm transition-all active:scale-95 flex-1 ${
                        action.style === 'primary'
                          ? 'bg-orange-500 text-white hover:bg-orange-600 shadow-lg shadow-orange-500/25'
                          : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
                      }`}
                    >
                      {action.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
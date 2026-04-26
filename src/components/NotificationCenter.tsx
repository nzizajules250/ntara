import React, { useState, useEffect, createContext, useContext, ReactNode } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Bell, X, CheckCircle2, AlertCircle, Info, Car, Navigation2, Volume2 } from 'lucide-react';
import { requestNotificationPermission, sendPushNotification, playNotificationSound } from '../lib/pushNotifications';

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
  persistent?: boolean;
}

interface NotificationContextType {
  notifications: AppNotification[];
  addNotification: (title: string, message: string, type: NotificationType, actions?: AppNotification['actions'], persistent?: boolean) => void;
  removeNotification: (id: string) => void;
  clearAll: () => void;
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
  const [unreadCount, setUnreadCount] = useState(0);

  const addNotification = (
    title: string,
    message: string,
    type: NotificationType,
    actions?: AppNotification['actions'],
    persistent?: boolean
  ) => {
    const id = Math.random().toString(36).substring(2, 9);
    const newNotification: AppNotification = {
      id,
      title,
      message,
      type,
      timestamp: new Date(),
      actions,
      persistent
    };
    
    setNotifications((prev) => [newNotification, ...prev]);
    setUnreadCount((prev) => prev + 1);

    // Send native push notification
    sendPushNotification(title, {
      body: message,
      requireInteraction: !!actions || persistent,
      sound: true
    });

    // Play notification sound
    playNotificationSound(
      type === 'ride_request' ? 'ride_request' :
      type === 'ride_accepted' ? 'ride_accepted' :
      type === 'success' ? 'success' :
      type === 'error' ? 'error' :
      'success'
    );

    // Auto-remove after time (unless persistent or has actions)
    if (!actions && !persistent) {
      setTimeout(() => {
        removeNotification(id);
      }, 6000);
    }
  };

  const removeNotification = (id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  };

  const clearAll = () => {
    setNotifications([]);
    setUnreadCount(0);
  };

  useEffect(() => {
    requestNotificationPermission();
  }, []);

  return (
    <NotificationContext.Provider value={{ notifications, addNotification, removeNotification, clearAll }}>
      {children}
      <NotificationOverlay 
        notifications={notifications}
        unreadCount={unreadCount}
        removeNotification={removeNotification}
        clearAll={clearAll}
      />
    </NotificationContext.Provider>
  );
}

function NotificationOverlay({
  notifications,
  unreadCount,
  removeNotification,
  clearAll
}: {
  notifications: AppNotification[];
  unreadCount: number;
  removeNotification: (id: string) => void;
  clearAll: () => void;
}) {
  const [showAll, setShowAll] = useState(false);

  return (
    <>
      {/* Notification Bell Icon (Top-right corner) */}
      {unreadCount > 0 && (
        <motion.button
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="fixed top-4 right-4 z-[300] bg-white rounded-full p-3 shadow-xl border border-gray-200 hover:shadow-2xl transition-all"
          onClick={() => setShowAll(!showAll)}
        >
          <Bell className="w-6 h-6 text-red-500" />
          <motion.span
            initial={{ scale: 0.8 }}
            animate={{ scale: 1 }}
            className="absolute -top-2 -right-2 bg-red-500 text-white text-xs font-bold rounded-full w-6 h-6 flex items-center justify-center"
          >
            {unreadCount}
          </motion.span>
        </motion.button>
      )}

      {/* Notification Drawer */}
      <AnimatePresence>
        {showAll && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowAll(false)}
              className="fixed inset-0 bg-black/20 z-[280]"
            />

            {/* Notification Panel */}
            <motion.div
              initial={{ x: 400, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: 400, opacity: 0 }}
              className="fixed top-0 right-0 z-[290] h-screen w-full sm:w-96 bg-white shadow-2xl overflow-y-auto"
            >
              <div className="sticky top-0 bg-gradient-to-b from-white to-transparent p-4 border-b border-gray-100">
                <div className="flex items-center justify-between mb-2">
                  <h2 className="text-lg font-bold text-gray-900">Notifications</h2>
                  <button
                    onClick={() => setShowAll(false)}
                    className="p-1 hover:bg-gray-100 rounded-lg transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
                {notifications.length > 0 && (
                  <button
                    onClick={clearAll}
                    className="text-xs text-blue-600 hover:text-blue-700 font-semibold"
                  >
                    Clear all
                  </button>
                )}
              </div>

              {notifications.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-gray-500 p-4">
                  <Bell className="w-12 h-12 mb-2 opacity-50" />
                  <p className="text-sm font-medium">No notifications</p>
                </div>
              ) : (
                <div className="divide-y divide-gray-100">
                  {notifications.map((notification) => (
                    <NotificationItem
                      key={notification.id}
                      notification={notification}
                      onRemove={removeNotification}
                    />
                  ))}
                </div>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Inline Notifications (Bottom-right) */}
      <div className="fixed bottom-0 right-0 z-[250] pointer-events-none flex flex-col items-end justify-end p-4 sm:p-6 gap-4 sm:gap-4 max-h-screen overflow-hidden">
        <AnimatePresence>
          {notifications.slice(0, 3).map((notification) => (
            <motion.div
              key={notification.id}
              initial={{ opacity: 0, x: 400, y: 20 }}
              animate={{ opacity: 1, x: 0, y: 0 }}
              exit={{ opacity: 0, x: 400, y: 20 }}
              className="pointer-events-auto w-full sm:w-96"
            >
              <NotificationItem
                notification={notification}
                onRemove={removeNotification}
                inline
              />
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </>
  );
}

function NotificationItem({
  notification,
  onRemove,
  inline
}: {
  notification: AppNotification;
  onRemove: (id: string) => void;
  inline?: boolean;
}) {
  const getColors = () => {
    switch (notification.type) {
      case 'success':
        return { bg: 'bg-emerald-50', border: 'bg-emerald-500', icon: 'text-emerald-600', iconBg: 'bg-emerald-50' };
      case 'error':
        return { bg: 'bg-red-50', border: 'bg-red-500', icon: 'text-red-600', iconBg: 'bg-red-50' };
      case 'warning':
        return { bg: 'bg-amber-50', border: 'bg-amber-500', icon: 'text-amber-600', iconBg: 'bg-amber-50' };
      case 'ride_request':
        return { bg: 'bg-black/5', border: 'bg-black', icon: 'text-black', iconBg: 'bg-black/10' };
      case 'ride_accepted':
        return { bg: 'bg-blue-50', border: 'bg-blue-500', icon: 'text-blue-600', iconBg: 'bg-blue-50' };
      default:
        return { bg: 'bg-blue-50', border: 'bg-blue-500', icon: 'text-blue-600', iconBg: 'bg-blue-50' };
    }
  };

  const colors = getColors();

  return (
    <div className={`${colors.bg} rounded-2xl shadow-lg border border-gray-100 overflow-hidden flex flex-col`}>
      <div className="flex">
        <div className={`w-1.5 ${colors.border}`} />

        <div className="p-3 sm:p-4 flex-1 flex gap-3 sm:gap-4">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${colors.iconBg}`}>
            {notification.type === 'success' && <CheckCircle2 className={`w-5 h-5 ${colors.icon}`} />}
            {notification.type === 'error' && <AlertCircle className={`w-5 h-5 ${colors.icon}`} />}
            {notification.type === 'info' && <Info className={`w-5 h-5 ${colors.icon}`} />}
            {notification.type === 'ride_request' && <Car className={`w-5 h-5 ${colors.icon}`} />}
            {notification.type === 'ride_accepted' && <Navigation2 className={`w-5 h-5 ${colors.icon}`} />}
            {notification.type === 'warning' && <AlertCircle className={`w-5 h-5 ${colors.icon}`} />}
          </div>

          <div className="flex-1 min-w-0">
            <h4 className="text-sm font-bold text-gray-900 leading-none mb-1">{notification.title}</h4>
            <p className="text-xs text-gray-600 leading-relaxed font-medium">{notification.message}</p>
          </div>

          <button
            onClick={() => onRemove(notification.id)}
            className="p-1 hover:bg-gray-200/50 rounded-lg h-fit text-gray-400 transition-colors flex-shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {notification.actions && notification.actions.length > 0 && (
        <div className="border-t border-gray-200 p-3 sm:p-4 flex gap-2 flex-col sm:flex-row">
          {notification.actions.map((action, idx) => (
            <button
              key={idx}
              onClick={() => {
                action.onClick();
                onRemove(notification.id);
              }}
              className={`px-4 py-2 rounded-xl font-semibold text-sm transition-all ${
                action.style === 'primary'
                  ? 'bg-black text-white hover:bg-gray-800'
                  : 'bg-gray-200/50 text-gray-900 hover:bg-gray-300/50'
              } flex-1 sm:flex-auto`}
            >
              {action.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

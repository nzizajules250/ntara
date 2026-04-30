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
  unreadCount: number;
  addNotification: (title: string, message: string, type: NotificationType, actions?: AppNotification['actions'], persistent?: boolean) => void;
  removeNotification: (id: string) => void;
  clearAll: () => void;
  isPanelOpen: boolean;
  openPanel: () => void;
  closePanel: () => void;
  togglePanel: () => void;
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
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const unreadCount = notifications.length;

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
  };

  const openPanel = () => setIsPanelOpen(true);
  const closePanel = () => setIsPanelOpen(false);
  const togglePanel = () => setIsPanelOpen((prev) => !prev);

  useEffect(() => {
    requestNotificationPermission();
  }, []);

  return (
    <NotificationContext.Provider value={{ notifications, unreadCount, addNotification, removeNotification, clearAll, isPanelOpen, openPanel, closePanel, togglePanel }}>
      {children}
      <NotificationOverlay 
        notifications={notifications}
        unreadCount={unreadCount}
        removeNotification={removeNotification}
        clearAll={clearAll}
        isPanelOpen={isPanelOpen}
        closePanel={closePanel}
      />
    </NotificationContext.Provider>
  );
}

export function NotificationBellButton({ className = '' }: { className?: string }) {
  const { unreadCount, togglePanel } = useNotifications();

  return (
    <motion.button
      whileTap={{ scale: 0.92 }}
      onClick={togglePanel}
      className={`relative p-2.5 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded-xl transition-colors text-gray-500 dark:text-gray-400 ${className}`}
      aria-label="Open notifications"
    >
      <Bell className="w-5 h-5" />
      {unreadCount > 0 && (
        <span className="absolute -top-1 -right-1 min-w-5 h-5 px-1 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center shadow-lg">
          {unreadCount > 99 ? '99+' : unreadCount}
        </span>
      )}
    </motion.button>
  );
}

function NotificationOverlay({
  notifications,
  unreadCount,
  removeNotification,
  clearAll,
  isPanelOpen,
  closePanel
}: {
  notifications: AppNotification[];
  unreadCount: number;
  removeNotification: (id: string) => void;
  clearAll: () => void;
  isPanelOpen: boolean;
  closePanel: () => void;
}) {
  return (
    <>
      {/* Notification Drawer */}
      <AnimatePresence>
        {isPanelOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={closePanel}
              className="fixed inset-0 bg-black/20 z-[280]"
            />

            {/* Notification Panel */}
            <motion.div
              initial={{ x: 400, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: 400, opacity: 0 }}
              className="fixed top-0 right-0 z-[290] h-screen w-full overflow-y-auto bg-white shadow-2xl dark:bg-zinc-950 dark:shadow-black/40 sm:w-96"
            >
              <div className="sticky top-0 border-b border-gray-100 bg-gradient-to-b from-white to-transparent p-4 dark:border-zinc-800 dark:from-zinc-950">
                <div className="flex items-center justify-between mb-2">
                  <h2 className="text-lg font-bold text-gray-900 dark:text-white">Notifications</h2>
                  <button
                    onClick={closePanel}
                    className="rounded-lg p-1 transition-colors hover:bg-gray-100 dark:hover:bg-zinc-800"
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
                <div className="flex h-full flex-col items-center justify-center p-4 text-gray-500 dark:text-zinc-400">
                  <Bell className="w-12 h-12 mb-2 opacity-50" />
                  <p className="text-sm font-medium">No notifications</p>
                </div>
              ) : (
                <div className="divide-y divide-gray-100 dark:divide-zinc-800">
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
        return { bg: 'bg-emerald-50 dark:bg-emerald-500/10', border: 'bg-emerald-500', icon: 'text-emerald-600 dark:text-emerald-400', iconBg: 'bg-emerald-50 dark:bg-emerald-500/10' };
      case 'error':
        return { bg: 'bg-red-50 dark:bg-red-500/10', border: 'bg-red-500', icon: 'text-red-600 dark:text-red-400', iconBg: 'bg-red-50 dark:bg-red-500/10' };
      case 'warning':
        return { bg: 'bg-amber-50 dark:bg-amber-500/10', border: 'bg-amber-500', icon: 'text-amber-600 dark:text-amber-400', iconBg: 'bg-amber-50 dark:bg-amber-500/10' };
      case 'ride_request':
        return { bg: 'bg-black/5 dark:bg-white/5', border: 'bg-black dark:bg-white', icon: 'text-black dark:text-white', iconBg: 'bg-black/10 dark:bg-white/10' };
      case 'ride_accepted':
        return { bg: 'bg-blue-50 dark:bg-blue-500/10', border: 'bg-blue-500', icon: 'text-blue-600 dark:text-blue-400', iconBg: 'bg-blue-50 dark:bg-blue-500/10' };
      default:
        return { bg: 'bg-blue-50 dark:bg-blue-500/10', border: 'bg-blue-500', icon: 'text-blue-600 dark:text-blue-400', iconBg: 'bg-blue-50 dark:bg-blue-500/10' };
    }
  };

  const colors = getColors();

  return (
    <div className={`${colors.bg} flex flex-col overflow-hidden rounded-2xl border border-gray-100 shadow-lg dark:border-zinc-800`}>
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
            <h4 className="mb-1 leading-none text-sm font-bold text-gray-900 dark:text-white">{notification.title}</h4>
            <p className="text-xs font-medium leading-relaxed text-gray-600 dark:text-zinc-300">{notification.message}</p>
          </div>

          <button
            onClick={() => onRemove(notification.id)}
            className="h-fit flex-shrink-0 rounded-lg p-1 text-gray-400 transition-colors hover:bg-gray-200/50 dark:text-zinc-500 dark:hover:bg-zinc-800/80"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {notification.actions && notification.actions.length > 0 && (
        <div className="flex flex-col gap-2 border-t border-gray-200 p-3 dark:border-zinc-800 sm:flex-row sm:p-4">
          {notification.actions.map((action, idx) => (
            <button
              key={idx}
              onClick={() => {
                action.onClick();
                onRemove(notification.id);
              }}
              className={`px-4 py-2 rounded-xl font-semibold text-sm transition-all ${
                action.style === 'primary'
                  ? 'bg-black text-white hover:bg-gray-800 dark:bg-white dark:text-black dark:hover:bg-zinc-200'
                  : 'bg-gray-200/50 text-gray-900 hover:bg-gray-300/50 dark:bg-zinc-800 dark:text-white dark:hover:bg-zinc-700'
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

import React, { useState, useEffect, createContext, useContext, ReactNode } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Bell, X, CheckCircle2, AlertCircle, Info, Car, Navigation2 } from 'lucide-react';
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

    // Auto-remove after 5 seconds (unless it has actions)
    if (!actions) {
      setTimeout(() => {
        removeNotification(id);
      }, 5000);
    }
  };

  const removeNotification = (id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  };

  useEffect(() => {
    requestNotificationPermission();
  }, []);

  return (
    <NotificationContext.Provider value={{ notifications, addNotification, removeNotification }}>
      {children}
      <NotificationOverlay notifications={notifications} removeNotification={removeNotification} />
    </NotificationContext.Provider>
  );
}

function NotificationOverlay({ notifications, removeNotification }: { notifications: AppNotification[], removeNotification: (id: string) => void }) {
  return (
    <div className="fixed inset-0 z-[200] pointer-events-none flex flex-col items-end justify-end p-4 sm:p-6 gap-4 sm:gap-4">
      <AnimatePresence>
        {notifications.map((notification) => (
          <motion.div
            key={notification.id}
            initial={{ opacity: 0, x: 50, scale: 0.9 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.2 } }}
            className="pointer-events-auto w-full sm:w-auto sm:max-w-sm"
          >
            <div className="bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden flex flex-col">
              <div className="flex">
                <div className={`w-1.5 ${
                  notification.type === 'success' ? 'bg-emerald-500' :
                  notification.type === 'error' ? 'bg-red-500' :
                  notification.type === 'warning' ? 'bg-amber-500' :
                  notification.type === 'ride_request' ? 'bg-black' :
                  'bg-blue-500'
                }`} />
                
                <div className="p-3 sm:p-4 flex-1 flex gap-3 sm:gap-4">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                    notification.type === 'success' ? 'bg-emerald-50 text-emerald-600' :
                    notification.type === 'error' ? 'bg-red-50 text-red-600' :
                    notification.type === 'warning' ? 'bg-amber-50 text-amber-600' :
                    notification.type === 'ride_request' ? 'bg-black text-white' :
                    'bg-blue-50 text-blue-600'
                  }`}>
                    {notification.type === 'success' && <CheckCircle2 className="w-5 h-5" />}
                    {notification.type === 'error' && <AlertCircle className="w-5 h-5" />}
                    {notification.type === 'info' && <Info className="w-5 h-5" />}
                    {notification.type === 'ride_request' && <Car className="w-5 h-5" />}
                    {notification.type === 'ride_accepted' && <Navigation2 className="w-5 h-5" />}
                    {notification.type === 'warning' && <AlertCircle className="w-5 h-5" />}
                  </div>

                  <div className="flex-1 min-w-0">
                    <h4 className="text-sm font-bold text-gray-900 leading-none mb-1">{notification.title}</h4>
                    <p className="text-xs text-gray-500 leading-relaxed font-medium">{notification.message}</p>
                  </div>

                  <button 
                    onClick={() => removeNotification(notification.id)}
                    className="p-1 hover:bg-gray-50 rounded-lg h-fit text-gray-400 transition-colors flex-shrink-0"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {notification.actions && notification.actions.length > 0 && (
                <div className="border-t border-gray-100 p-3 sm:p-4 flex gap-2 flex-col sm:flex-row">
                  {notification.actions.map((action, idx) => (
                    <button
                      key={idx}
                      onClick={() => {
                        action.onClick();
                        removeNotification(notification.id);
                      }}
                      className={`px-4 py-2 rounded-xl font-semibold text-sm transition-all ${
                        action.style === 'primary'
                          ? 'bg-black text-white hover:bg-gray-800'
                          : 'bg-gray-100 text-gray-900 hover:bg-gray-200'
                      } flex-1 sm:flex-auto`}
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

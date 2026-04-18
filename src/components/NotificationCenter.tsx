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
}

interface NotificationContextType {
  notifications: AppNotification[];
  addNotification: (title: string, message: string, type: NotificationType) => void;
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

  const addNotification = (title: string, message: string, type: NotificationType) => {
    const id = Math.random().toString(36).substring(2, 9);
    const newNotification: AppNotification = {
      id,
      title,
      message,
      type,
      timestamp: new Date(),
    };
    setNotifications((prev) => [newNotification, ...prev]);

    // Send native push notification
    sendPushNotification(title, { body: message });

    // Auto-remove after 5 seconds
    setTimeout(() => {
      removeNotification(id);
    }, 5000);
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
    <div className="fixed top-6 right-6 z-[200] space-y-4 w-full max-w-sm pointer-events-none">
      <AnimatePresence>
        {notifications.map((notification) => (
          <motion.div
            key={notification.id}
            initial={{ opacity: 0, x: 50, scale: 0.9 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.2 } }}
            className="pointer-events-auto"
          >
            <div className="bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden flex">
              <div className={`w-1.5 ${
                notification.type === 'success' ? 'bg-emerald-500' :
                notification.type === 'error' ? 'bg-red-500' :
                notification.type === 'warning' ? 'bg-amber-500' :
                notification.type === 'ride_request' ? 'bg-black' :
                'bg-blue-500'
              }`} />
              
              <div className="p-4 flex-1 flex gap-4">
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

                <div className="flex-1">
                  <h4 className="text-sm font-bold text-gray-900 leading-none mb-1">{notification.title}</h4>
                  <p className="text-xs text-gray-500 leading-relaxed font-medium">{notification.message}</p>
                </div>

                <button 
                  onClick={() => removeNotification(notification.id)}
                  className="p-1 hover:bg-gray-50 rounded-lg h-fit text-gray-400 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}

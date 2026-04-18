/**
 * Browser Push Notifications Helper
 */

export async function requestNotificationPermission(): Promise<boolean> {
  if (!("Notification" in window)) {
    console.warn("This browser does not support desktop notifications");
    return false;
  }

  if (Notification.permission === "granted") {
    return true;
  }

  if (Notification.permission !== "denied") {
    const permission = await Notification.requestPermission();
    return permission === "granted";
  }

  return false;
}

export function sendPushNotification(title: string, options?: NotificationOptions) {
  if (!("Notification" in window)) return;
  
  if (Notification.permission === "granted") {
    try {
      new Notification(title, {
        icon: '/favicon.ico', // Default icon if available
        ...options
      });
    } catch (e) {
      console.error("Error sending notification", e);
    }
  }
}

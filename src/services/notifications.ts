export async function requestNotificationPermission(): Promise<boolean> {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return false;
  }
  try {
    const permission = await Notification.requestPermission();
    return permission === 'granted';
  } catch (e) {
    return false;
  }
}

export function isNotificationGranted(): boolean {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return false;
  }
  return Notification.permission === 'granted';
}

export function sendPushNotification(title: string, options?: NotificationOptions) {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return;
  }

  if (Notification.permission === 'granted') {
    try {
      new Notification(title, {
        icon: '/pwa-192x192.png',
        badge: '/icon.svg',
        ...options,
      });
    } catch (e) {
      // Notification constructor might be disabled in some contexts
    }
  }
}

export function triggerEventReminder(eventName: string, timeStr: string) {
  sendPushNotification(`⚡ HyperPulse Event Alert!`, {
    body: `"${eventName}" starts in ${timeStr}. Jump in to claim bonus XP & rankings!`,
  });
}

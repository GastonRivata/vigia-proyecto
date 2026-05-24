import { toast } from 'sonner';

export type NotificationType = 'info' | 'success' | 'warning' | 'error';

export interface NotificationOptions {
  type?: NotificationType;
  title: string;
  message?: string;
  important?: boolean; // If true, attempts to show OS-level notification
}

export const loadNotificationSettings = () => {
  try {
    const saved = localStorage.getItem('leia_notifications');
    if (saved) return JSON.parse(saved);
  } catch (e) {
    console.error("Failed to load settings", e);
  }
  return { os_enabled: false, sound: true };
};

export const saveNotificationSettings = (settings: { os_enabled: boolean; sound: boolean }) => {
  localStorage.setItem('leia_notifications', JSON.stringify(settings));
};

export const notify = (options: NotificationOptions) => {
  const { type = 'info', title, message, important = false } = options;

  // 1. In-app notification (Sonner)
  const toastOptions = message ? { description: message } : undefined;
  
  switch (type) {
    case 'success':
      toast.success(title, toastOptions);
      break;
    case 'warning':
      toast.warning(title, toastOptions);
      break;
    case 'error':
      toast.error(title, toastOptions);
      break;
    default:
      toast.info(title, toastOptions);
  }

  // 2. Play sound if enabled (customizable)
  const settings = loadNotificationSettings();
  if (settings.sound) {
    // We could play a small beep here if we had an audio file
    // const audio = new Audio('/beep.mp3'); 
    // audio.play().catch(() => {});
  }

  // 3. OS-level notification for important data
  if (important && settings.os_enabled) {
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification(`VIGIA - ${title}`, { 
        body: message || '',
        // icon: '/logo.png' // Add an icon if available in public folder
      });
    }
  }
};

export const requestOsNotificationPermission = async () => {
  if (!('Notification' in window)) {
    toast.error('API no soportada', { description: 'Tu navegador no soporta notificaciones de sistema (Windows/Mac).' });
    return false;
  }

  if (Notification.permission === 'granted') {
    return true;
  }

  if (Notification.permission !== 'denied') {
    const permission = await Notification.requestPermission();
    if (permission === 'granted') {
      toast.success('Permiso Concedido', { description: 'Ahora recibirás alertas a nivel sistema.'});
      return true;
    } else {
      toast.warning('Permiso Denegado', { description: 'No podremos enviar notificaciones de sistema.'});
    }
  } else {
    toast.error('Bloqueado', { description: 'Las notificaciones están bloqueadas en la configuración de tu navegador.'});
  }

  return false;
};

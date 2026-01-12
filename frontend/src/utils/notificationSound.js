/**
 * Notification Sound Service
 * Plays audio alerts for in-app notifications and browser notifications
 */

// Sound configuration
const SOUNDS = {
  hotLead: {
    frequency: [800, 1000, 1200],
    duration: 150,
    type: 'triangle'
  },
  success: {
    frequency: [523, 659, 784],
    duration: 100,
    type: 'sine'
  },
  alert: {
    frequency: [440, 550, 440],
    duration: 200,
    type: 'square'
  },
  message: {
    frequency: [600, 800],
    duration: 80,
    type: 'sine'
  }
};

// Audio context singleton
let audioContext = null;

const getAudioContext = () => {
  if (!audioContext) {
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
  }
  return audioContext;
};

/**
 * Play a notification sound using Web Audio API
 * @param {string} type - Sound type: 'hotLead', 'success', 'alert', 'message'
 */
export const playNotificationSound = async (type = 'message') => {
  try {
    const ctx = getAudioContext();
    
    // Resume context if suspended (browser autoplay policy)
    if (ctx.state === 'suspended') {
      await ctx.resume();
    }
    
    const sound = SOUNDS[type] || SOUNDS.message;
    const { frequency, duration, type: waveType } = sound;
    
    // Create gain node for volume control
    const gainNode = ctx.createGain();
    gainNode.connect(ctx.destination);
    gainNode.gain.setValueAtTime(0.3, ctx.currentTime);
    
    // Play frequency sequence
    frequency.forEach((freq, index) => {
      const oscillator = ctx.createOscillator();
      oscillator.type = waveType;
      oscillator.frequency.setValueAtTime(freq, ctx.currentTime);
      oscillator.connect(gainNode);
      
      const startTime = ctx.currentTime + (index * duration / 1000);
      const endTime = startTime + (duration / 1000);
      
      oscillator.start(startTime);
      oscillator.stop(endTime);
      
      // Fade out
      gainNode.gain.setValueAtTime(0.3, startTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, endTime);
    });
    
    return true;
  } catch (error) {
    console.warn('Sound playback failed:', error);
    return false;
  }
};

/**
 * Request browser notification permission
 */
export const requestNotificationPermission = async () => {
  if (!('Notification' in window)) {
    console.warn('Browser does not support notifications');
    return 'unsupported';
  }
  
  if (Notification.permission === 'granted') {
    return 'granted';
  }
  
  if (Notification.permission !== 'denied') {
    const permission = await Notification.requestPermission();
    return permission;
  }
  
  return Notification.permission;
};

/**
 * Show browser notification with sound
 * @param {Object} options - Notification options
 */
export const showBrowserNotification = async ({
  title,
  body,
  icon = '/icon-192.png',
  tag = 'taillights-notification',
  sound = 'message',
  requireInteraction = false,
  data = {}
}) => {
  // Play sound
  if (sound) {
    await playNotificationSound(sound);
  }
  
  // Check permission
  const permission = await requestNotificationPermission();
  if (permission !== 'granted') {
    console.warn('Notification permission not granted');
    return null;
  }
  
  // Create notification
  const notification = new Notification(title, {
    body,
    icon,
    tag,
    requireInteraction,
    data,
    badge: '/icon-192.png',
    vibrate: [200, 100, 200],
  });
  
  // Handle click
  notification.onclick = (event) => {
    event.preventDefault();
    window.focus();
    notification.close();
    
    // Handle action based on data
    if (data.type === 'hot_lead' && data.customerId) {
      // Navigate to customer or trigger action
      window.dispatchEvent(new CustomEvent('notification-action', { 
        detail: { type: 'hot_lead', customerId: data.customerId }
      }));
    }
  };
  
  return notification;
};

/**
 * Show hot lead notification
 */
export const showHotLeadNotification = async (customerName, vehicleInterest) => {
  return showBrowserNotification({
    title: '🔥 Hot Lead Alert!',
    body: `${customerName} is interested in ${vehicleInterest}`,
    sound: 'hotLead',
    requireInteraction: true,
    data: { type: 'hot_lead', customerName, vehicleInterest }
  });
};

/**
 * Show status change notification
 */
export const showStatusChangeNotification = async (customerName, newStatus) => {
  return showBrowserNotification({
    title: '📊 Lead Status Updated',
    body: `${customerName}'s status changed to ${newStatus}`,
    sound: 'alert',
    data: { type: 'status_change', customerName, newStatus }
  });
};

/**
 * Show success notification
 */
export const showSuccessNotification = async (message) => {
  return showBrowserNotification({
    title: '✅ Success',
    body: message,
    sound: 'success',
    data: { type: 'success' }
  });
};

// Sound preferences stored in localStorage
const SOUND_PREFS_KEY = 'taillights_sound_preferences';

export const getSoundPreferences = () => {
  try {
    const stored = localStorage.getItem(SOUND_PREFS_KEY);
    return stored ? JSON.parse(stored) : {
      enabled: true,
      volume: 0.5,
      hotLeadSound: true,
      statusChangeSound: true,
      messageSound: true
    };
  } catch {
    return { enabled: true, volume: 0.5, hotLeadSound: true, statusChangeSound: true, messageSound: true };
  }
};

export const setSoundPreferences = (prefs) => {
  try {
    localStorage.setItem(SOUND_PREFS_KEY, JSON.stringify(prefs));
    return true;
  } catch {
    return false;
  }
};

export default {
  playNotificationSound,
  requestNotificationPermission,
  showBrowserNotification,
  showHotLeadNotification,
  showStatusChangeNotification,
  showSuccessNotification,
  getSoundPreferences,
  setSoundPreferences
};

/**
 * Notification Sound Service - Real Car Sound Profiles
 * 'Merica: Aggressive muscle car drift
 * Euro: Sports car revving  
 * JDM: Turbo blow-off valve (stututu)
 */

// Sound profile configuration with real audio files
const SOUND_PROFILES = {
  merica: {
    name: "'Merica",
    description: "Aggressive Muscle Car",
    icon: "🇺🇸",
    file: "/sounds/merica.wav"
  },
  euro: {
    name: "Euro",
    description: "Sports Car Revving",
    icon: "🇮🇹",
    file: "/sounds/euro.wav"
  },
  jdm: {
    name: "JDM",
    description: "Turbo Blow-Off Valve",
    icon: "🇯🇵",
    file: "/sounds/jdm.wav"
  }
};

// Audio cache to avoid re-loading
const audioCache = {};

/**
 * Preload audio files for faster playback
 */
export const preloadSounds = () => {
  Object.entries(SOUND_PROFILES).forEach(([key, profile]) => {
    if (!audioCache[key]) {
      const audio = new Audio(profile.file);
      audio.preload = 'auto';
      audioCache[key] = audio;
    }
  });
};

/**
 * Play notification sound based on selected profile
 * @param {string} profile - 'merica', 'euro', or 'jdm'
 */
export const playNotificationSound = async (profile = null) => {
  try {
    const prefs = getSoundPreferences();
    if (!prefs.enabled) return false;
    
    const selectedProfile = profile || prefs.profile || 'merica';
    const soundProfile = SOUND_PROFILES[selectedProfile];
    
    if (!soundProfile) return false;
    
    // Use cached audio or create new
    let audio = audioCache[selectedProfile];
    if (!audio) {
      audio = new Audio(soundProfile.file);
      audioCache[selectedProfile] = audio;
    }
    
    // Reset to beginning if already playing
    audio.currentTime = 0;
    audio.volume = prefs.volume || 0.7;
    
    await audio.play();
    return true;
  } catch (error) {
    console.warn('Sound playback failed:', error);
    return false;
  }
};

/**
 * Get available sound profiles
 */
export const getSoundProfiles = () => {
  return Object.entries(SOUND_PROFILES).map(([key, value]) => ({
    id: key,
    name: value.name,
    description: value.description,
    icon: value.icon
  }));
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
 */
export const showBrowserNotification = async ({
  title,
  body,
  icon = '/icon-192.png',
  tag = 'superchargd-notification',
  playSound = true,
  requireInteraction = false,
  data = {}
}) => {
  const prefs = getSoundPreferences();
  
  if (playSound && prefs.enabled) {
    await playNotificationSound(prefs.profile);
  }
  
  const permission = await requestNotificationPermission();
  if (permission !== 'granted') {
    return null;
  }
  
  const notification = new Notification(title, {
    body,
    icon,
    tag,
    requireInteraction,
    data,
    badge: '/icon-192.png',
    vibrate: [200, 100, 200],
  });
  
  notification.onclick = (event) => {
    event.preventDefault();
    window.focus();
    notification.close();
    
    if (data.type === 'hot_lead' && data.customerId) {
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
    playSound: true,
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
    playSound: true,
    data: { type: 'status_change', customerName, newStatus }
  });
};

// Sound preferences stored in localStorage
const SOUND_PREFS_KEY = 'superchargd_sound_preferences';

export const getSoundPreferences = () => {
  try {
    const stored = localStorage.getItem(SOUND_PREFS_KEY);
    return stored ? JSON.parse(stored) : {
      enabled: true,
      profile: 'merica',
      volume: 0.7
    };
  } catch {
    return { enabled: true, profile: 'merica', volume: 0.7 };
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

// Preload sounds on module load
if (typeof window !== 'undefined') {
  preloadSounds();
}

export default {
  playNotificationSound,
  getSoundProfiles,
  preloadSounds,
  requestNotificationPermission,
  showBrowserNotification,
  showHotLeadNotification,
  showStatusChangeNotification,
  getSoundPreferences,
  setSoundPreferences
};

/**
 * Notification Sound Service - Car Sound Profiles
 * 'Merica: CT5 Blackwing cold start
 * Euro: Ferrari 458 redlining  
 * JDM: GT-R Godzilla downshifting
 */

// Sound profile configuration
const SOUND_PROFILES = {
  merica: {
    name: "'Merica",
    description: "2025 CT5 Blackwing Cold Start",
    icon: "🇺🇸",
    // Deep V8 rumble with cold start pops
    generate: (ctx) => {
      const duration = 1.2;
      const now = ctx.currentTime;
      
      // Main V8 rumble - low frequency
      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const gain = ctx.createGain();
      const distortion = ctx.createWaveShaper();
      
      // Create distortion curve for grit
      const curve = new Float32Array(256);
      for (let i = 0; i < 256; i++) {
        const x = (i * 2) / 256 - 1;
        curve[i] = Math.tanh(x * 3);
      }
      distortion.curve = curve;
      
      osc1.type = 'sawtooth';
      osc1.frequency.setValueAtTime(55, now); // Low V8 idle
      osc1.frequency.setValueAtTime(80, now + 0.3);
      osc1.frequency.setValueAtTime(65, now + 0.6);
      
      osc2.type = 'square';
      osc2.frequency.setValueAtTime(110, now);
      osc2.frequency.setValueAtTime(160, now + 0.3);
      osc2.frequency.setValueAtTime(130, now + 0.6);
      
      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(0.4, now + 0.1);
      gain.gain.setValueAtTime(0.5, now + 0.3);
      gain.gain.linearRampToValueAtTime(0.3, now + 0.8);
      gain.gain.linearRampToValueAtTime(0, now + duration);
      
      osc1.connect(distortion);
      osc2.connect(distortion);
      distortion.connect(gain);
      gain.connect(ctx.destination);
      
      osc1.start(now);
      osc2.start(now);
      osc1.stop(now + duration);
      osc2.stop(now + duration);
      
      // Cold start pops
      [0.15, 0.4, 0.7].forEach((time) => {
        const pop = ctx.createOscillator();
        const popGain = ctx.createGain();
        pop.type = 'square';
        pop.frequency.setValueAtTime(80 + Math.random() * 40, now + time);
        popGain.gain.setValueAtTime(0.3, now + time);
        popGain.gain.exponentialRampToValueAtTime(0.01, now + time + 0.08);
        pop.connect(popGain);
        popGain.connect(ctx.destination);
        pop.start(now + time);
        pop.stop(now + time + 0.1);
      });
    }
  },
  
  euro: {
    name: "Euro",
    description: "Ferrari 458 Redlining",
    icon: "🇮🇹",
    // High-pitched V8 scream with harmonics
    generate: (ctx) => {
      const duration = 1.5;
      const now = ctx.currentTime;
      
      // Main high-rev tone
      const oscillators = [];
      const harmonics = [1, 2, 3, 4, 5];
      const baseFreq = 280; // High RPM base
      
      const masterGain = ctx.createGain();
      masterGain.gain.setValueAtTime(0, now);
      masterGain.gain.linearRampToValueAtTime(0.25, now + 0.2);
      masterGain.gain.setValueAtTime(0.35, now + 0.5);
      masterGain.gain.linearRampToValueAtTime(0.4, now + 1.0);
      masterGain.gain.linearRampToValueAtTime(0, now + duration);
      masterGain.connect(ctx.destination);
      
      harmonics.forEach((h, i) => {
        const osc = ctx.createOscillator();
        const oscGain = ctx.createGain();
        
        osc.type = 'sawtooth';
        // Rising frequency - redlining
        osc.frequency.setValueAtTime(baseFreq * h, now);
        osc.frequency.linearRampToValueAtTime(baseFreq * h * 1.3, now + 1.0);
        osc.frequency.setValueAtTime(baseFreq * h * 1.35, now + 1.2);
        
        oscGain.gain.setValueAtTime(0.5 / (i + 1), now);
        
        osc.connect(oscGain);
        oscGain.connect(masterGain);
        osc.start(now);
        osc.stop(now + duration);
        oscillators.push(osc);
      });
      
      // Add some "flutter" at redline
      const flutter = ctx.createOscillator();
      const flutterGain = ctx.createGain();
      flutter.type = 'sine';
      flutter.frequency.setValueAtTime(15, now);
      flutterGain.gain.setValueAtTime(0.1, now + 0.8);
      flutter.connect(flutterGain);
      flutterGain.connect(masterGain);
      flutter.start(now + 0.8);
      flutter.stop(now + duration);
    }
  },
  
  jdm: {
    name: "JDM",
    description: "GT-R Godzilla Downshift",
    icon: "🇯🇵",
    // Turbo spool with rev match and flutter
    generate: (ctx) => {
      const duration = 1.3;
      const now = ctx.currentTime;
      
      const masterGain = ctx.createGain();
      masterGain.gain.setValueAtTime(0.3, now);
      masterGain.gain.linearRampToValueAtTime(0, now + duration);
      masterGain.connect(ctx.destination);
      
      // Main engine tone - inline 6 character
      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      
      osc1.type = 'sawtooth';
      // Downshift: high to low then rev match
      osc1.frequency.setValueAtTime(400, now);
      osc1.frequency.linearRampToValueAtTime(200, now + 0.3);
      osc1.frequency.linearRampToValueAtTime(350, now + 0.5); // Rev match
      osc1.frequency.linearRampToValueAtTime(250, now + 1.0);
      
      osc2.type = 'triangle';
      osc2.frequency.setValueAtTime(200, now);
      osc2.frequency.linearRampToValueAtTime(100, now + 0.3);
      osc2.frequency.linearRampToValueAtTime(175, now + 0.5);
      osc2.frequency.linearRampToValueAtTime(125, now + 1.0);
      
      const engineGain = ctx.createGain();
      engineGain.gain.setValueAtTime(0.4, now);
      
      osc1.connect(engineGain);
      osc2.connect(engineGain);
      engineGain.connect(masterGain);
      
      osc1.start(now);
      osc2.start(now);
      osc1.stop(now + duration);
      osc2.stop(now + duration);
      
      // Turbo flutter/blow-off at downshift
      const turboFlutter = () => {
        const noise = ctx.createOscillator();
        const noiseGain = ctx.createGain();
        const filter = ctx.createBiquadFilter();
        
        noise.type = 'sawtooth';
        noise.frequency.setValueAtTime(2000, now + 0.25);
        noise.frequency.exponentialRampToValueAtTime(500, now + 0.5);
        
        filter.type = 'bandpass';
        filter.frequency.setValueAtTime(1500, now + 0.25);
        filter.Q.setValueAtTime(5, now + 0.25);
        
        noiseGain.gain.setValueAtTime(0.2, now + 0.25);
        noiseGain.gain.exponentialRampToValueAtTime(0.01, now + 0.5);
        
        noise.connect(filter);
        filter.connect(noiseGain);
        noiseGain.connect(masterGain);
        
        noise.start(now + 0.25);
        noise.stop(now + 0.55);
      };
      
      turboFlutter();
      
      // Stutter/pops
      [0.55, 0.65, 0.75].forEach((time) => {
        const pop = ctx.createOscillator();
        const popGain = ctx.createGain();
        pop.type = 'square';
        pop.frequency.setValueAtTime(150 + Math.random() * 50, now + time);
        popGain.gain.setValueAtTime(0.15, now + time);
        popGain.gain.exponentialRampToValueAtTime(0.01, now + time + 0.05);
        pop.connect(popGain);
        popGain.connect(masterGain);
        pop.start(now + time);
        pop.stop(now + time + 0.08);
      });
    }
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
 * Play notification sound based on selected profile
 * @param {string} profile - 'merica', 'euro', or 'jdm'
 */
export const playNotificationSound = async (profile = null) => {
  try {
    const ctx = getAudioContext();
    
    if (ctx.state === 'suspended') {
      await ctx.resume();
    }
    
    const prefs = getSoundPreferences();
    if (!prefs.enabled) return false;
    
    const selectedProfile = profile || prefs.profile || 'merica';
    const soundProfile = SOUND_PROFILES[selectedProfile];
    
    if (soundProfile && soundProfile.generate) {
      soundProfile.generate(ctx);
      return true;
    }
    
    return false;
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
  tag = 'taillights-notification',
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
const SOUND_PREFS_KEY = 'taillights_sound_preferences';

export const getSoundPreferences = () => {
  try {
    const stored = localStorage.getItem(SOUND_PREFS_KEY);
    return stored ? JSON.parse(stored) : {
      enabled: true,
      profile: 'merica', // Default to 'Merica
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

export default {
  playNotificationSound,
  getSoundProfiles,
  requestNotificationPermission,
  showBrowserNotification,
  showHotLeadNotification,
  showStatusChangeNotification,
  getSoundPreferences,
  setSoundPreferences
};

/**
 * Sound Profile Manager
 * Plays sounds ONLY for:
 * 1. Customer successfully added
 * 2. Eject (Print) successfully used
 * 3. Sport mode activated/deactivated
 */

const SOUND_PROFILES = {
  spanish: {
    name: 'Spanish 🇪🇸',
    customerAdded: '/sounds/jdm.wav',
    eject: '/sounds/jdm.wav',
    sportMode: '/sounds/jdm.wav'
  },
  french: {
    name: 'French 🇫🇷',
    customerAdded: '/sounds/euro.wav',
    eject: '/sounds/euro.wav',
    sportMode: '/sounds/euro.wav'
  },
  korean: {
    name: 'Korean 🇰🇷',
    customerAdded: '/sounds/merica.wav',
    eject: '/sounds/merica.wav',
    sportMode: '/sounds/merica.wav'
  }
};

const DEFAULT_PROFILE = 'spanish';

// Get current sound profile from localStorage
export const getSoundProfile = () => {
  return localStorage.getItem('soundProfile') || DEFAULT_PROFILE;
};

// Set sound profile
export const setSoundProfile = (profile) => {
  if (SOUND_PROFILES[profile]) {
    localStorage.setItem('soundProfile', profile);
    return true;
  }
  return false;
};

// Get all available sound profiles
export const getSoundProfiles = () => {
  return Object.keys(SOUND_PROFILES).map(key => ({
    id: key,
    name: SOUND_PROFILES[key].name
  }));
};

// Play sound for specific event
const playSound = (soundPath, volume = 0.7) => {
  try {
    const audio = new Audio(soundPath);
    audio.volume = volume;
    audio.play().catch(() => {});
  } catch {
    // Sound initialization failed - silent
  }
};

// Play customer added sound
export const playCustomerAddedSound = () => {
  const profile = getSoundProfile();
  const soundPath = SOUND_PROFILES[profile]?.customerAdded;
  if (soundPath) {
    playSound(soundPath, 0.6);
  }
};

// Play eject/print sound
export const playEjectSound = () => {
  const profile = getSoundProfile();
  const soundPath = SOUND_PROFILES[profile]?.eject;
  if (soundPath) {
    playSound(soundPath, 0.7);
  }
};

// Play sport mode toggle sound
export const playSportModeSound = () => {
  const profile = getSoundProfile();
  const soundPath = SOUND_PROFILES[profile]?.sportMode;
  if (soundPath) {
    playSound(soundPath, 0.8);
  }
};

// Legacy exports for compatibility (no-ops now)
export const playNotificationSound = () => {}; // Removed
export const requestNotificationPermission = () => Promise.resolve('granted'); // Stub
export const getSoundPreferences = () => ({ enabled: true, profile: getSoundProfile() });
export const setSoundPreferences = (prefs) => {
  if (prefs.profile) setSoundProfile(prefs.profile);
};

export default {
  getSoundProfile,
  setSoundProfile,
  getSoundProfiles,
  playCustomerAddedSound,
  playEjectSound,
  playSportModeSound,
  playNotificationSound, // Legacy
  requestNotificationPermission, // Legacy
  getSoundPreferences,
  setSoundPreferences
};

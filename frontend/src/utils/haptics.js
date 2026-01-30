/**
 * Haptic Feedback Utility
 * Enterprise-grade tactile feedback for mobile interactions
 */

// Check if vibration API is supported
const isVibrationSupported = typeof navigator !== 'undefined' && 'vibrate' in navigator;

// Check if we're on iOS (uses different haptic approach)
const isIOS = typeof navigator !== 'undefined' && /iPhone|iPad|iPod/.test(navigator.userAgent);

/**
 * Haptic Feedback Types
 * Different vibration patterns for different interactions
 */
export const HapticType = {
  LIGHT: 'light',      // Quick tap feedback
  MEDIUM: 'medium',    // Standard interaction
  HEAVY: 'heavy',      // Important action
  SUCCESS: 'success',  // Successful operation
  WARNING: 'warning',  // Warning/caution
  ERROR: 'error',      // Error/failure
  SELECTION: 'selection', // Item selection
};

// Vibration patterns in milliseconds
const vibrationPatterns = {
  [HapticType.LIGHT]: [10],
  [HapticType.MEDIUM]: [25],
  [HapticType.HEAVY]: [50],
  [HapticType.SUCCESS]: [15, 50, 25],
  [HapticType.WARNING]: [30, 30, 30],
  [HapticType.ERROR]: [50, 50, 50, 50],
  [HapticType.SELECTION]: [5],
};

/**
 * Trigger haptic feedback
 * @param {string} type - Type of haptic feedback
 */
export const triggerHaptic = (type = HapticType.LIGHT) => {
  // Skip if haptics are disabled in preferences
  const hapticEnabled = localStorage.getItem('hapticEnabled') !== 'false';
  if (!hapticEnabled) return;

  try {
    if (isVibrationSupported) {
      const pattern = vibrationPatterns[type] || vibrationPatterns[HapticType.LIGHT];
      navigator.vibrate(pattern);
    }
    
    // For iOS, try to use AudioContext for a subtle click
    // This provides feedback even when vibration isn't available
    if (isIOS && type === HapticType.SELECTION) {
      playClickSound();
    }
  } catch {
    // Silently fail - haptics are non-critical
  }
};

/**
 * Play a subtle click sound for iOS devices
 */
const playClickSound = () => {
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    
    const context = new AudioContext();
    const oscillator = context.createOscillator();
    const gainNode = context.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(context.destination);
    
    oscillator.frequency.value = 1000;
    oscillator.type = 'sine';
    
    gainNode.gain.setValueAtTime(0.02, context.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.001, context.currentTime + 0.02);
    
    oscillator.start(context.currentTime);
    oscillator.stop(context.currentTime + 0.02);
    
    // Clean up
    setTimeout(() => context.close(), 100);
  } catch (e) {
    // Silently fail
  }
};

/**
 * Quick haptic triggers for common interactions
 */
export const haptics = {
  tap: () => triggerHaptic(HapticType.LIGHT),
  button: () => triggerHaptic(HapticType.MEDIUM),
  heavy: () => triggerHaptic(HapticType.HEAVY),
  success: () => triggerHaptic(HapticType.SUCCESS),
  warning: () => triggerHaptic(HapticType.WARNING),
  error: () => triggerHaptic(HapticType.ERROR),
  select: () => triggerHaptic(HapticType.SELECTION),
};

/**
 * Haptic-enabled button wrapper
 * Use this for buttons that need haptic feedback
 */
export const withHaptic = (onClick, type = HapticType.MEDIUM) => {
  return (e) => {
    triggerHaptic(type);
    if (onClick) onClick(e);
  };
};

/**
 * Get/Set haptic preferences
 */
export const getHapticEnabled = () => {
  return localStorage.getItem('hapticEnabled') !== 'false';
};

export const setHapticEnabled = (enabled) => {
  localStorage.setItem('hapticEnabled', String(enabled));
};

export default haptics;

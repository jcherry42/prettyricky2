/**
 * Capacitor Native Bridge
 * Initializes native capabilities for iOS/Android builds
 */

import { Capacitor } from '@capacitor/core';
import { SplashScreen } from '@capacitor/splash-screen';
import { StatusBar, Style } from '@capacitor/status-bar';
import { Keyboard, KeyboardResize } from '@capacitor/keyboard';
import { PushNotifications } from '@capacitor/push-notifications';

// Check if running in native app context
export const isNative = Capacitor.isNativePlatform();
export const platform = Capacitor.getPlatform();

/**
 * Initialize native capabilities
 */
export const initializeNative = async () => {
  if (!isNative) {
    logger.debug('Running in web mode - native features disabled');
    return;
  }
  
  logger.info(`Running on ${platform} - initializing native features`);
  
  try {
    // Hide splash screen after app loads
    await SplashScreen.hide();
    
    // Configure status bar
    await StatusBar.setStyle({ style: Style.Dark });
    await StatusBar.setBackgroundColor({ color: '#0d0d0d' });
    
    // Configure keyboard behavior
    await Keyboard.setResizeMode({ mode: KeyboardResize.Body });
    
    // Request push notification permissions
    await requestPushPermissions();
    
    logger.info('Native initialization complete');
  } catch (error) {
    logger.error('Native initialization error:', error);
  }
};

/**
 * Request push notification permissions and register
 */
export const requestPushPermissions = async () => {
  if (!isNative) return { granted: false };
  
  try {
    let permStatus = await PushNotifications.checkPermissions();
    
    if (permStatus.receive === 'prompt') {
      permStatus = await PushNotifications.requestPermissions();
    }
    
    if (permStatus.receive === 'granted') {
      await PushNotifications.register();
      
      // Listen for registration success
      PushNotifications.addListener('registration', (token) => {
        logger.info('Push registration success');
        sendTokenToBackend(token.value);
      });
      
      // Listen for push notification received
      PushNotifications.addListener('pushNotificationReceived', () => {
        logger.debug('Push notification received');
      });
      
      // Listen for push notification action (tap)
      PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
        logger.debug('Push notification action performed');
        handlePushAction(action);
      });
      
      return { granted: true };
    }
    
    return { granted: false };
  } catch (error) {
    logger.error('Push notification setup error:', error);
    return { granted: false, error };
  }
};

/**
 * Send push token to backend for storage
 */
const sendTokenToBackend = async (token) => {
  const API_URL = import.meta.env.VITE_BACKEND_URL;
  if (!API_URL || !token) return;
  
  try {
    await fetch(`${API_URL}/api/notifications/register-device`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token,
        platform,
        timestamp: new Date().toISOString(),
      }),
    });
    logger.info('Push token registered with backend');
  } catch (error) {
    logger.error('Failed to register push token:', error);
  }
};

/**
 * Handle push notification action (when user taps notification)
 */
const handlePushAction = (action) => {
  const data = action.notification.data;
  
  // Navigate based on notification type
  if (data?.type === 'hot_lead') {
    // Navigate to customer details or respond mode
    window.location.hash = `#customer/${data.customer_id}`;
  } else if (data?.type === 'status_change') {
    // Navigate to analytics
    window.location.hash = '#analytics';
  }
};

/**
 * Update status bar style based on theme
 */
export const updateStatusBarTheme = async (isDark) => {
  if (!isNative) return;
  
  try {
    await StatusBar.setStyle({ style: isDark ? Style.Dark : Style.Light });
    await StatusBar.setBackgroundColor({ 
      color: isDark ? '#0d0d0d' : '#f5f5f5' 
    });
  } catch (error) {
    logger.error('Status bar update error:', error);
  }
};

/**
 * Get device info for debugging
 */
export const getDeviceInfo = () => ({
  isNative,
  platform,
  webViewVersion: Capacitor.isNativePlatform() ? 'native' : 'web',
});

export default {
  isNative,
  platform,
  initializeNative,
  requestPushPermissions,
  updateStatusBarTheme,
  getDeviceInfo,
};

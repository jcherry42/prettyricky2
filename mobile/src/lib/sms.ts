/**
 * SMS / iMessage Integration
 * Uses expo-sms for native composer integration.
 * Opens the device's native Messages app (iMessage on iOS, SMS on Android).
 */

import * as SMS from 'expo-sms';
import { errorMessage } from './errors';
import { Alert, Linking, Platform } from 'react-native';

/**
 * Check if SMS is available on the device.
 * @returns {Promise<boolean>}
 */
export async function isSmsAvailable() {
  try {
    return await SMS.isAvailableAsync();
  } catch {
    return false;
  }
}

/**
 * Open native SMS composer with pre-filled message.
 * Uses expo-sms which opens iMessage on iOS or the default SMS app on Android.
 *
 * @param {Object} options
 * @param {string|string[]} options.recipients - Phone number(s) to send to
 * @param {string} options.message - Pre-filled message body
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export async function sendSms({ recipients, message }: { recipients: string | string[]; message: string }) {
  try {
    const available = await SMS.isAvailableAsync();

    if (!available) {
      // Fallback: try sms: URL scheme
      const numbers = Array.isArray(recipients) ? recipients.join(',') : recipients;
      const smsUrl = Platform.select({
        ios: `sms:${numbers}&body=${encodeURIComponent(message)}`,
        android: `sms:${numbers}?body=${encodeURIComponent(message)}`,
        default: `sms:${numbers}?body=${encodeURIComponent(message)}`,
      });

      const canOpen = await Linking.canOpenURL(smsUrl);
      if (canOpen) {
        await Linking.openURL(smsUrl);
        return { success: true };
      }

      return {
        success: false,
        error: 'SMS is not available on this device',
      };
    }

    // Use expo-sms native composer
    const recipientList = Array.isArray(recipients) ? recipients : [recipients];

    const { result } = await SMS.sendSMSAsync(recipientList, message);

    // result: 'sent' | 'cancelled' | 'unknown'
    return {
      success: result === 'sent' || result === 'unknown', // 'unknown' on Android means composer opened
      cancelled: result === 'cancelled',
      result,
    };
  } catch (e: unknown) {
    return {
      success: false,
      error: errorMessage(e) || 'Failed to open SMS composer',
    };
  }
}

/**
 * Send a quick text to a customer.
 * Pre-fills the native composer with the customer's phone number and message.
 *
 * @param {string} phone - Customer phone number
 * @param {string} message - Message body
 * @returns {Promise<{success: boolean}>}
 */
export async function textCustomer(phone: string, message: string = '') {
  if (!phone || phone === '—') {
    Alert.alert('No Phone Number', 'This customer does not have a phone number on file.');
    return { success: false, error: 'No phone number' };
  }

  // Clean the phone number (remove formatting)
  const cleanPhone = phone.replace(/[^\d+]/g, '');

  return sendSms({
    recipients: cleanPhone,
    message,
  });
}

/**
 * Send Tower Talk AI response as SMS.
 * Opens native composer with the AI-generated message.
 *
 * @param {string} text - The AI response or translated text to send
 * @param {string} [customerPhone] - Optional customer phone to pre-fill recipient
 * @returns {Promise<{success: boolean}>}
 */
export async function sendTowerTalkSms(text: string, customerPhone: string = '') {
  if (!text || !text.trim()) {
    Alert.alert('Empty Message', 'There is no message to send.');
    return { success: false, error: 'Empty message' };
  }

  const recipients = customerPhone ? customerPhone.replace(/[^\d+]/g, '') : '';

  return sendSms({
    recipients: recipients || [],
    message: text.trim(),
  });
}

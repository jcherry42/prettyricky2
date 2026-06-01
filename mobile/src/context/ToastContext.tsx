/**
 * Toast Context
 * Global toast/notification system for success/failure/info messages.
 * Designo-styled with gold accents and glass morphism.
 */

import React, { createContext, useContext, useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, Animated, Easing } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '../theme/colors';
import { impactLight, notificationSuccess, notificationError } from '../lib/haptics';

const ToastContext = createContext<ToastContextValue | null>(null);

const TOAST_DURATION = 3000;

const TOAST_CONFIG = {
  success: {
    icon: 'checkmark-circle',
    color: colors.green,
    borderColor: 'rgba(52,199,89,0.40)',
    bgColor: 'rgba(52,199,89,0.10)',
    haptic: notificationSuccess,
  },
  error: {
    icon: 'alert-circle',
    color: colors.red,
    borderColor: 'rgba(255,59,48,0.40)',
    bgColor: 'rgba(255,59,48,0.10)',
    haptic: notificationError,
  },
  info: {
    icon: 'information-circle',
    color: colors.blue,
    borderColor: 'rgba(0,122,255,0.40)',
    bgColor: 'rgba(0,122,255,0.10)',
    haptic: impactLight,
  },
  warning: {
    icon: 'warning',
    color: colors.gold,
    borderColor: 'rgba(214,178,94,0.40)',
    bgColor: 'rgba(214,178,94,0.10)',
    haptic: impactLight,
  },
  offline: {
    icon: 'cloud-offline',
    color: '#FF9500',
    borderColor: 'rgba(255,149,0,0.40)',
    bgColor: 'rgba(255,149,0,0.10)',
    haptic: impactLight,
  },
  sync: {
    icon: 'sync',
    color: '#00CCFF',
    borderColor: 'rgba(0,204,255,0.40)',
    bgColor: 'rgba(0,204,255,0.10)',
    haptic: impactLight,
  },
};

type ToastType = 'success' | 'error' | 'info' | 'warning' | 'offline' | 'sync';

interface ToastItem {
  id: string;
  type: ToastType;
  message: string;
  title?: string;
  duration?: number;
}

interface ToastOptions {
  title?: string;
  duration?: number;
}

interface ToastContextValue {
  showToast: (type: ToastType, message: string, options?: ToastOptions) => void;
  showSuccess: (message: string, options?: ToastOptions) => void;
  showError: (message: string, options?: ToastOptions) => void;
  showInfo: (message: string, options?: ToastOptions) => void;
  showWarning: (message: string, options?: ToastOptions) => void;
  showOffline: (message: string, options?: ToastOptions) => void;
  showSync: (message: string, options?: ToastOptions) => void;
}

function ToastView({ toast, onDismiss }: { toast: ToastItem; onDismiss: () => void }) {
  const anim = useRef(new Animated.Value(0)).current;
  const insets = useSafeAreaInsets();
  const config = TOAST_CONFIG[toast.type] || TOAST_CONFIG.info;

  useEffect(() => {
    // Slide in
    Animated.spring(anim, { toValue: 1, friction: 8, tension: 100, useNativeDriver: true }).start();

    // Auto dismiss
    const timer = setTimeout(() => {
      Animated.timing(anim, { toValue: 0, duration: 300, easing: Easing.in(Easing.ease), useNativeDriver: true }).start(() => {
        onDismiss();
      });
    }, toast.duration || TOAST_DURATION);

    // Haptic feedback
    config.haptic?.();

    return () => clearTimeout(timer);
  }, []);

  const translateY = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [-80, 0],
  });

  const opacity = anim.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [0, 0.8, 1],
  });

  return (
    <Animated.View
      style={[
        styles.toast,
        {
          top: insets.top + 8,
          borderColor: config.borderColor,
          backgroundColor: config.bgColor,
          transform: [{ translateY }],
          opacity,
        },
      ]}
    >
      <Ionicons name={config.icon as any} size={18} color={config.color} />
      <View style={styles.toastContent}>
        {toast.title && <Text style={[styles.toastTitle, { color: config.color }]}>{toast.title}</Text>}
        <Text style={styles.toastMessage} numberOfLines={2}>{toast.message}</Text>
      </View>
    </Animated.View>
  );
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const showToast = useCallback((type: ToastType, message: string, options: ToastOptions = {}) => {
    const id = `${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
    setToasts((prev) => [...prev.slice(-2), { id, type, message, ...options }]);
  }, []);

  const showSuccess = useCallback((message: string, options?: ToastOptions) => showToast('success', message, options), [showToast]);
  const showError = useCallback((message: string, options?: ToastOptions) => showToast('error', message, options), [showToast]);
  const showInfo = useCallback((message: string, options?: ToastOptions) => showToast('info', message, options), [showToast]);
  const showWarning = useCallback((message: string, options?: ToastOptions) => showToast('warning', message, options), [showToast]);
  const showOffline = useCallback((message: string, options?: ToastOptions) => showToast('offline', message || 'You are offline', options), [showToast]);
  const showSync = useCallback((message: string, options?: ToastOptions) => showToast('sync', message || 'Syncing queued operations...', options), [showToast]);

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const value = useMemo(
    () => ({ showToast, showSuccess, showError, showInfo, showWarning, showOffline, showSync }),
    [showToast, showSuccess, showError, showInfo, showWarning, showOffline, showSync]
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      {/* Toast container */}
      <View style={styles.container} pointerEvents="box-none">
        {toasts.map((toast) => (
          <ToastView key={toast.id} toast={toast} onDismiss={() => dismiss(toast.id)} />
        ))}
      </View>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 9999,
    alignItems: 'center',
  },
  toast: {
    position: 'absolute',
    left: 16,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    backgroundColor: 'rgba(10,12,16,0.95)',
    shadowColor: '#000',
    shadowOpacity: 0.5,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 10,
  },
  toastContent: {
    flex: 1,
    gap: 2,
  },
  toastTitle: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  toastMessage: {
    color: colors.textDim,
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 16,
  },
});

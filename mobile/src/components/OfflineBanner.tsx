/**
 * Offline Banner — animated status bar with offline/syncing/done states.
 *
 * Shows when:
 *   - Device is offline (red pulsing banner with queue count)
 *   - Syncing queued requests after reconnecting (blue with progress)
 *   - Sync complete (green flash, auto-hides after 2s)
 *   - Online with pending items that failed to sync (gold with retry button)
 *
 * Tap the banner to manually trigger a sync when items are queued.
 */

import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNetwork } from '../context/NetworkContext';
import { colors } from '../theme/colors';

export function OfflineBanner() {
  const { isOnline, syncStatus, queueCount, triggerSync } = useNetwork();
  const insets = useSafeAreaInsets();
  const slideAnim = useRef(new Animated.Value(-80)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const progressAnim = useRef(new Animated.Value(0)).current;

  const offline = !isOnline;
  const syncing = isOnline && syncStatus === 'syncing';
  const done = isOnline && syncStatus === 'done';
  const hasPending = isOnline && queueCount > 0 && syncStatus === 'idle';

  const visible = offline || syncing || done || hasPending;

  // Slide in/out
  useEffect(() => {
    Animated.spring(slideAnim, {
      toValue: visible ? 0 : -80,
      friction: 10,
      tension: 80,
      useNativeDriver: true,
    }).start();
  }, [visible, slideAnim]);

  // Pulse when offline
  useEffect(() => {
    if (offline) {
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 0.6, duration: 1200, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 1200, useNativeDriver: true }),
        ])
      );
      pulse.start();
      return () => pulse.stop();
    } else {
      pulseAnim.setValue(1);
    }
  }, [offline, pulseAnim]);

  // Sync progress bar animation
  useEffect(() => {
    if (syncing) {
      Animated.timing(progressAnim, {
        toValue: 1,
        duration: 2000,
        useNativeDriver: false,
      }).start();
    } else {
      progressAnim.setValue(0);
    }
  }, [syncing, progressAnim]);

  if (!visible) return null;

  // Banner color scheme
  const borderColor = offline
    ? 'rgba(255,45,45,0.30)'
    : syncing
    ? 'rgba(0,204,255,0.30)'
    : done
    ? 'rgba(64,255,155,0.30)'
    : 'rgba(214,178,94,0.25)';

  const bgColor = offline
    ? 'rgba(255,45,45,0.08)'
    : syncing
    ? 'rgba(0,204,255,0.08)'
    : done
    ? 'rgba(64,255,155,0.08)'
    : 'rgba(214,178,94,0.06)';

  const accentColor = offline
    ? colors.red
    : syncing
    ? colors.electricBlue
    : done
    ? colors.green
    : colors.gold;

  const iconName = offline
    ? 'cloud-offline'
    : syncing
    ? 'sync'
    : done
    ? 'checkmark-circle'
    : 'alert-circle-outline';

  const label = offline
    ? 'NO CONNECTION'
    : syncing
    ? 'SYNCING...'
    : done
    ? 'ALL SYNCED'
    : `${queueCount} PENDING`;

  return (
    <Animated.View
      testID="offline-banner"
      style={[
        styles.banner,
        {
          top: insets.top + 4,
          transform: [{ translateY: slideAnim }],
          borderColor,
          backgroundColor: bgColor,
          shadowColor: accentColor,
        },
      ]}
    >
      <Pressable
        testID="offline-banner-action"
        onPress={hasPending ? triggerSync : undefined}
        accessibilityRole={hasPending ? 'button' : 'summary'}
        accessibilityLabel={
          offline
            ? `Offline. ${queueCount} request${queueCount === 1 ? '' : 's'} queued`
            : syncing
            ? `Syncing ${queueCount} queued request${queueCount === 1 ? '' : 's'}`
            : done
            ? 'All queued requests synced'
            : `${queueCount} pending request${queueCount === 1 ? '' : 's'} — tap to sync now`
        }
        accessibilityHint={hasPending ? 'Retries any queued network calls' : undefined}
        style={styles.inner}
        android_ripple={hasPending ? { color: colors.goldGlow } : undefined}
      >
        {/* Icon */}
        <Animated.View style={{ opacity: offline ? pulseAnim : 1 }}>
          <Ionicons name={iconName} size={16} color={accentColor} />
        </Animated.View>

        {/* Label */}
        <Text style={[styles.label, { color: accentColor }]} testID="offline-banner-label">
          {label}
        </Text>

        {/* Queue count badge (offline or pending) */}
        {(offline || hasPending) && queueCount > 0 && (
          <View style={[styles.queueBadge, { backgroundColor: `${accentColor}18` }]}>
            <Text style={[styles.queueCount, { color: accentColor }]} testID="offline-queue-count">
              {queueCount}
            </Text>
            <Text style={[styles.queueSuffix, { color: `${accentColor}BB` }]}>
              queued
            </Text>
          </View>
        )}

        {/* Retry button when items are pending */}
        {hasPending && (
          <View style={[styles.retryBtn, { borderColor: `${accentColor}44` }]}>
            <Ionicons name="refresh" size={12} color={accentColor} />
            <Text style={[styles.retryLabel, { color: accentColor }]}>SYNC</Text>
          </View>
        )}
      </Pressable>

      {/* Sync progress bar */}
      {syncing && (
        <View style={styles.progressTrack}>
          <Animated.View
            style={[
              styles.progressBar,
              {
                backgroundColor: colors.electricBlue,
                width: progressAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: ['0%', '100%'],
                }),
              },
            ]}
          />
        </View>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  banner: {
    position: 'absolute',
    left: 12,
    right: 12,
    zIndex: 998,
    borderRadius: 12,
    borderWidth: 1,
    shadowOpacity: 0.3,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    overflow: 'hidden',
  },
  inner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  label: {
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1.8,
    flex: 1,
  },
  queueBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  queueCount: {
    fontSize: 12,
    fontWeight: '900',
  },
  queueSuffix: {
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  retryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    backgroundColor: 'rgba(214,178,94,0.06)',
  },
  retryLabel: {
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1.2,
  },
  progressTrack: {
    height: 2,
    backgroundColor: 'rgba(0,204,255,0.15)',
  },
  progressBar: {
    height: 2,
    borderRadius: 1,
  },
});

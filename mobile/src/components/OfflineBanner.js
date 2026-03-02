/**
 * Offline Banner Component
 * Animated banner that slides in when device goes offline.
 * Shows queue count and sync status.
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
  const slideAnim = useRef(new Animated.Value(-60)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!isOnline) {
      // Slide in
      Animated.spring(slideAnim, { toValue: 0, friction: 8, tension: 60, useNativeDriver: true }).start();
      // Pulse animation
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 0.7, duration: 1000, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 1000, useNativeDriver: true }),
        ])
      ).start();
    } else {
      // Slide out
      Animated.timing(slideAnim, { toValue: -60, duration: 300, useNativeDriver: true }).start();
      pulseAnim.stopAnimation();
    }
  }, [isOnline, slideAnim, pulseAnim]);

  const showSyncing = isOnline && syncStatus === 'syncing';
  const showSyncDone = isOnline && syncStatus === 'done';

  // Don't render if online and not syncing
  if (isOnline && syncStatus === 'idle') return null;

  return (
    <Animated.View
      style={[
        styles.banner,
        {
          top: insets.top,
          transform: [{ translateY: !isOnline ? slideAnim : 0 }],
        },
        showSyncing && styles.bannerSyncing,
        showSyncDone && styles.bannerDone,
      ]}
    >
      {!isOnline ? (
        <>
          <Animated.View style={{ opacity: pulseAnim }}>
            <Ionicons name="cloud-offline" size={16} color="#FF9500" />
          </Animated.View>
          <Text style={styles.bannerText}>OFFLINE MODE</Text>
          {queueCount > 0 && (
            <View style={styles.queueBadge}>
              <Text style={styles.queueCount}>{queueCount}</Text>
              <Text style={styles.queueLabel}>queued</Text>
            </View>
          )}
        </>
      ) : showSyncing ? (
        <>
          <Ionicons name="sync" size={16} color="#00CCFF" />
          <Text style={[styles.bannerText, { color: '#00CCFF' }]}>SYNCING...</Text>
        </>
      ) : showSyncDone ? (
        <>
          <Ionicons name="checkmark-circle" size={16} color={colors.green} />
          <Text style={[styles.bannerText, { color: colors.green }]}>SYNC COMPLETE</Text>
        </>
      ) : null}

      {/* Manual sync button when online with queued items */}
      {isOnline && queueCount > 0 && syncStatus !== 'syncing' && (
        <Pressable onPress={triggerSync} style={styles.syncBtn}>
          <Ionicons name="sync" size={12} color={colors.gold} />
        </Pressable>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  banner: {
    position: 'absolute',
    left: 16,
    right: 16,
    zIndex: 998,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,149,0,0.30)',
    backgroundColor: 'rgba(255,149,0,0.08)',
  },
  bannerSyncing: {
    borderColor: 'rgba(0,204,255,0.30)',
    backgroundColor: 'rgba(0,204,255,0.08)',
  },
  bannerDone: {
    borderColor: 'rgba(52,199,89,0.30)',
    backgroundColor: 'rgba(52,199,89,0.08)',
  },
  bannerText: {
    color: '#FF9500',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 2,
    flex: 1,
  },
  queueBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: 'rgba(255,149,0,0.15)',
  },
  queueCount: {
    color: '#FF9500',
    fontSize: 12,
    fontWeight: '900',
  },
  queueLabel: {
    color: 'rgba(255,149,0,0.70)',
    fontSize: 9,
    fontWeight: '700',
  },
  syncBtn: {
    width: 28,
    height: 28,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(214,178,94,0.30)',
    backgroundColor: 'rgba(214,178,94,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});

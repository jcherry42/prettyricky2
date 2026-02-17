/**
 * Network Status Indicator
 * Small dot indicator for network connectivity in headers.
 */

import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNetwork } from '../context/NetworkContext';
import { colors } from '../theme/colors';
import { impactLight } from '../lib/haptics';

export function NetworkStatusDot({ showLabel = false }) {
  const { isOnline, queueCount, syncStatus, triggerSync } = useNetwork();

  const dotColor = isOnline ? colors.green : '#FF9500';
  const label = isOnline
    ? syncStatus === 'syncing' ? 'SYNCING' : 'ONLINE'
    : 'OFFLINE';

  return (
    <Pressable
      onPress={() => {
        if (isOnline && queueCount > 0) {
          impactLight();
          triggerSync();
        }
      }}
      style={styles.container}
      accessibilityRole="button"
      accessibilityLabel={`Network status: ${label}`}
    >
      <View style={[styles.dot, { backgroundColor: dotColor }]} />
      {showLabel && <Text style={[styles.label, { color: dotColor }]}>{label}</Text>}
      {queueCount > 0 && (
        <View style={styles.queueBadge}>
          <Text style={styles.queueText}>{queueCount}</Text>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  label: {
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 1,
  },
  queueBadge: {
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: 'rgba(255,149,0,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  queueText: {
    color: '#FF9500',
    fontSize: 9,
    fontWeight: '900',
  },
});

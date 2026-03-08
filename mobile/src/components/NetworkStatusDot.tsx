/**
 * Network Status Indicator
 * Shows network + WebSocket connectivity with a dual-dot indicator.
 */

import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { useNetwork } from '../context/NetworkContext';
import { useWebSocket } from '../context/WebSocketContext';
import { colors } from '../theme/colors';
import { impactLight } from '../lib/haptics';

export function NetworkStatusDot({ showLabel = false }: { showLabel?: boolean }) {
  const { isOnline, queueCount, syncStatus, triggerSync } = useNetwork();
  const { connected: wsConnected } = useWebSocket();

  const netColor = isOnline ? colors.green : '#FF9500';
  const wsColor = wsConnected ? colors.green : 'rgba(255,255,255,0.2)';
  const label = isOnline
    ? syncStatus === 'syncing' ? 'SYNCING' : wsConnected ? 'LIVE' : 'ONLINE'
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
      accessibilityLabel={`Network: ${isOnline ? 'online' : 'offline'}, Realtime: ${wsConnected ? 'connected' : 'disconnected'}`}
    >
      <View style={styles.dotGroup}>
        <View style={[styles.dot, { backgroundColor: netColor }]} />
        <View style={[styles.dotSmall, { backgroundColor: wsColor }]} />
      </View>
      {showLabel && <Text style={[styles.label, { color: netColor }]}>{label}</Text>}
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
  dotGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    shadowOpacity: 0.9,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 0 },
  },
  dotSmall: {
    width: 4,
    height: 4,
    borderRadius: 2,
    shadowOpacity: 0.6,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 0 },
  },
  label: {
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 1.5,
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

import React, { memo } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { colors } from '../theme/colors';
import { type } from '../theme/typography';
import { impactLight } from '../lib/haptics';

const STATUS_CONFIG = {
  new:         { label: 'NEW',         color: colors.blue,   icon: 'star' },
  contacted:   { label: 'CONTACTED',   color: colors.gold,   icon: 'call' },
  appointment: { label: 'APPOINTMENT', color: colors.green,  icon: 'calendar' },
  negotiating: { label: 'NEGOTIATING', color: '#FF9500',     icon: 'chatbubbles' },
  sold:        { label: 'SOLD',        color: colors.green,  icon: 'checkmark-circle' },
  lost:        { label: 'LOST',        color: colors.red,    icon: 'close-circle' },
};

/**
 * Static quilted-leather accent — rendered once, never re-created.
 * Using a fixed array so no Array.from() on every render.
 */
const QUILT_INDICES = [0, 1, 2, 3, 4];

const QuiltPattern = memo(function QuiltPattern() {
  return (
    <View style={styles.quiltedPattern} pointerEvents="none">
      {QUILT_INDICES.map((i) => (
        <View
          key={`ql-${i}`}
          style={[styles.quiltLine, { top: i * 24, transform: [{ rotate: '45deg' }] }]}
        />
      ))}
      {QUILT_INDICES.map((i) => (
        <View
          key={`qr-${i}`}
          style={[styles.quiltLine, { top: i * 24, transform: [{ rotate: '-45deg' }] }]}
        />
      ))}
    </View>
  );
});

export const CustomerCard = memo(function CustomerCard({ customer, onPress }) {
  const status = customer?.lead_status || 'new';
  const statusConfig = STATUS_CONFIG[status] || STATUS_CONFIG.new;

  const name = `${customer?.first_name || ''} ${customer?.last_name || ''}`.trim() || 'Unknown Customer';
  const phone = customer?.phone || 'No phone';
  const email = customer?.email || '';

  const handlePress = () => {
    impactLight();
    onPress?.(customer);
  };

  return (
    <Pressable
      onPress={handlePress}
      style={({ pressed }) => [styles.container, pressed && styles.pressed]}
      accessibilityRole="button"
      accessibilityLabel={`Customer ${name}`}
    >
      <LinearGradient
        colors={['rgba(255,255,255,0.08)', 'rgba(255,255,255,0.04)']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.gradient}
      >
        {/* Quilted leather pattern */}
        <QuiltPattern />

        {/* Status badge */}
        <View style={[styles.statusBadge, { backgroundColor: statusConfig.color }]}>
          <Ionicons name={statusConfig.icon} size={10} color="#000" />
          <Text style={styles.statusText}>{statusConfig.label}</Text>
        </View>

        {/* Customer info */}
        <View style={styles.content}>
          <Text style={styles.name} numberOfLines={1}>{name}</Text>
          <View style={styles.infoRow}>
            <Ionicons name="call" size={12} color={colors.textDim} />
            <Text style={styles.info} numberOfLines={1}>{phone}</Text>
          </View>
          {email ? (
            <View style={styles.infoRow}>
              <Ionicons name="mail" size={12} color={colors.textDim} />
              <Text style={styles.info} numberOfLines={1}>{email}</Text>
            </View>
          ) : null}
        </View>

        {/* Chevron */}
        <View style={styles.chevron}>
          <Ionicons name="chevron-forward" size={20} color={colors.gold} />
        </View>

        {/* Contrast stitching */}
        <View style={styles.stitchingTop} />
        <View style={styles.stitchingBottom} />
      </LinearGradient>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  container: {
    marginHorizontal: 16,
    marginVertical: 6,
    borderRadius: 12,
    overflow: 'hidden',
  },
  pressed: {
    opacity: 0.7,
  },
  gradient: {
    padding: 14,
    borderWidth: 1,
    borderColor: colors.stroke,
    borderRadius: 12,
    position: 'relative',
    overflow: 'hidden',
  },
  quiltedPattern: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    overflow: 'hidden',
  },
  quiltLine: {
    position: 'absolute',
    left: -50,
    right: -50,
    height: 0.5,
    backgroundColor: 'rgba(214,178,94,0.05)',
  },
  statusBadge: {
    position: 'absolute',
    top: 10,
    right: 10,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    zIndex: 2,
  },
  statusText: {
    ...type.label,
    fontSize: 9,
    color: '#000',
    fontWeight: '700',
  },
  content: {
    flex: 1,
    paddingRight: 40,
    zIndex: 1,
  },
  name: {
    ...type.h2,
    color: colors.text,
    marginBottom: 6,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
  },
  info: {
    ...type.bodyDim,
    color: colors.textDim,
    flex: 1,
  },
  chevron: {
    position: 'absolute',
    right: 12,
    top: '50%',
    marginTop: -10,
    zIndex: 2,
  },
  stitchingTop: {
    position: 'absolute',
    top: 4, left: 8, right: 8,
    height: 1,
    backgroundColor: colors.contrastStitching,
    opacity: 0.15,
  },
  stitchingBottom: {
    position: 'absolute',
    bottom: 4, left: 8, right: 8,
    height: 1,
    backgroundColor: colors.contrastStitching,
    opacity: 0.15,
  },
});

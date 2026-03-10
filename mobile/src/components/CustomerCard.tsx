import React, { memo, useRef } from 'react';
import { View, Text, StyleSheet, Pressable, Animated } from 'react-native';
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

/**
 * Avatar — initials circle with status-keyed gradient.
 */
function Avatar({ name, color }) {
  const initials = (name || '')
    .split(' ')
    .filter(Boolean)
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <View style={styles.avatarWrap}>
      {/* Outer glow ring */}
      <View style={[styles.avatarGlow, { shadowColor: color, borderColor: `${color}40` }]} />
      <LinearGradient
        colors={[`${color}30`, `${color}12`]}
        style={styles.avatarCircle}
      >
        <Text style={[styles.avatarText, { color }]}>{initials || '?'}</Text>
      </LinearGradient>
    </View>
  );
}

interface CustomerCardProps {
  customer: any;
  onPress?: (customer: any) => void;
}

export const CustomerCard = memo(function CustomerCard({ customer, onPress }: CustomerCardProps) {
  const status = customer?.lead_status || 'new';
  const statusConfig = STATUS_CONFIG[status] || STATUS_CONFIG.new;
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const name = `${customer?.first_name || ''} ${customer?.last_name || ''}`.trim() || 'Unknown Customer';
  const phone = customer?.phone || 'No phone';
  const email = customer?.email || '';

  const handlePressIn = () => {
    Animated.spring(scaleAnim, {
      toValue: 0.975,
      friction: 8,
      tension: 200,
      useNativeDriver: true,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      friction: 4,
      tension: 160,
      useNativeDriver: true,
    }).start();
  };

  const handlePress = () => {
    impactLight();
    onPress?.(customer);
  };

  return (
    <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
      <Pressable
        onPress={handlePress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        style={styles.container}
        accessibilityRole="button"
        accessibilityLabel={`Customer ${name}`}
      >
        <LinearGradient
          colors={['rgba(255,255,255,0.06)', 'rgba(255,255,255,0.02)', 'rgba(0,0,0,0.10)']}
          locations={[0, 0.45, 1]}
          start={{ x: 0.1, y: 0 }}
          end={{ x: 0.9, y: 1 }}
          style={styles.gradient}
        >
          {/* Glass base layer */}
          <View style={[StyleSheet.absoluteFill, { borderRadius: 14, backgroundColor: 'rgba(20,24,32,0.82)' }]} />
          {/* Top specular highlight */}
          <View style={{ position: 'absolute', top: 3, left: '15%', right: '15%', height: 5, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.10)' }} />
          {/* Quilted leather pattern */}
          <QuiltPattern />

          {/* Status-colored left edge accent */}
          <View style={[styles.edgeAccent, { backgroundColor: statusConfig.color }]} />

          <View style={styles.cardBody}>
            {/* Avatar */}
            <Avatar name={name} color={statusConfig.color} />

            {/* Customer info */}
            <View style={styles.content}>
              <View style={styles.nameRow}>
                <Text style={styles.name} numberOfLines={1}>{name}</Text>
                {/* Status badge */}
                <View style={[styles.statusBadge, { backgroundColor: `${statusConfig.color}20`, borderColor: `${statusConfig.color}40` }]}>
                  <Ionicons name={statusConfig.icon} size={9} color={statusConfig.color} />
                  <Text style={[styles.statusText, { color: statusConfig.color }]}>{statusConfig.label}</Text>
                </View>
              </View>

              <View style={styles.infoRow}>
                <Ionicons name="call" size={11} color={colors.textMute} />
                <Text style={styles.info} numberOfLines={1}>{phone}</Text>
              </View>
              {email ? (
                <View style={styles.infoRow}>
                  <Ionicons name="mail" size={11} color={colors.textMute} />
                  <Text style={styles.info} numberOfLines={1}>{email}</Text>
                </View>
              ) : null}
            </View>

            {/* Chevron */}
            <View style={styles.chevron}>
              <Ionicons name="chevron-forward" size={18} color={colors.goldDim} />
            </View>
          </View>

          {/* Contrast stitching */}
          <View style={styles.stitchingTop} />
          <View style={styles.stitchingBottom} />
        </LinearGradient>
      </Pressable>
    </Animated.View>
  );
});

const styles = StyleSheet.create({
  container: {
    marginHorizontal: 16,
    marginVertical: 5,
    borderRadius: 14,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.60,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 8 },
    elevation: 12,
  },
  gradient: {
    paddingVertical: 14,
    paddingRight: 14,
    paddingLeft: 4,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    borderRadius: 14,
    position: 'relative',
    overflow: 'hidden',
    backgroundColor: 'rgba(10,14,20,0.70)',
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
    backgroundColor: 'rgba(214,178,94,0.04)',
  },
  edgeAccent: {
    position: 'absolute',
    left: 0,
    top: 8,
    bottom: 8,
    width: 3,
    borderRadius: 2,
    opacity: 0.7,
  },
  cardBody: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 10,
    zIndex: 1,
  },
  avatarWrap: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  avatarGlow: {
    position: 'absolute',
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    shadowOpacity: 0.6,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 0 },
  },
  avatarCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 15,
    letterSpacing: 0.5,
  },
  content: {
    flex: 1,
    paddingRight: 8,
    zIndex: 1,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 5,
    gap: 8,
  },
  name: {
    ...type.subtitle,
    color: colors.text,
    flex: 1,
  },
  statusBadge: {
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    borderWidth: 1,
  },
  statusText: {
    ...type.overline,
    fontSize: 9,
    fontWeight: '800',
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 3,
  },
  info: {
    ...type.caption,
    color: colors.textDim,
    flex: 1,
  },
  chevron: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(214,178,94,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(214,178,94,0.10)',
  },
  stitchingTop: {
    position: 'absolute',
    top: 4, left: 10, right: 10,
    height: 0.5,
    backgroundColor: colors.contrastStitching,
    opacity: 0.14,
  },
  stitchingBottom: {
    position: 'absolute',
    bottom: 4, left: 10, right: 10,
    height: 0.5,
    backgroundColor: colors.contrastStitching,
    opacity: 0.14,
  },
});

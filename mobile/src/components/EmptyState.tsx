/**
 * EmptyState — reusable no-data placeholder with icon, headline, description,
 * and optional call-to-action. Used by dashboard, list screens, and history views.
 *
 * Keep visual density LOW: dealership-floor users need to instantly recognize
 * "nothing to see here yet" without misreading a loading state or an error.
 */

import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme/colors';

type IonIconName = keyof typeof Ionicons.glyphMap;

interface EmptyStateProps {
  icon?: IonIconName;
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  compact?: boolean;
  testID?: string;
}

export function EmptyState({
  icon = 'file-tray-outline',
  title,
  description,
  actionLabel,
  onAction,
  compact = false,
  testID = 'empty-state',
}: EmptyStateProps) {
  return (
    <View
      style={[styles.container, compact && styles.compact]}
      accessibilityRole="text"
      accessibilityLabel={`${title}. ${description || ''}`}
      testID={testID}
    >
      <View style={styles.iconWrap}>
        <Ionicons name={icon} size={compact ? 28 : 40} color={colors.textMute} />
      </View>
      <Text style={[styles.title, compact && styles.titleCompact]}>{title}</Text>
      {description ? (
        <Text style={[styles.desc, compact && styles.descCompact]}>{description}</Text>
      ) : null}
      {actionLabel && onAction ? (
        <Pressable
          onPress={onAction}
          accessibilityRole="button"
          accessibilityLabel={actionLabel}
          hitSlop={12}
          style={({ pressed }) => [styles.actionBtn, pressed && { opacity: 0.7 }]}
          testID={`${testID}-action`}
        >
          <Text style={styles.actionText}>{actionLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 32,
    paddingHorizontal: 24,
  },
  compact: {
    paddingVertical: 18,
  },
  iconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(214,178,94,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(214,178,94,0.12)',
    marginBottom: 14,
  },
  title: {
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0.4,
    color: colors.text,
    textAlign: 'center',
    marginBottom: 6,
  },
  titleCompact: {
    fontSize: 13,
    marginBottom: 4,
  },
  desc: {
    fontSize: 12,
    lineHeight: 17,
    color: colors.textMute,
    textAlign: 'center',
    maxWidth: 280,
  },
  descCompact: {
    fontSize: 11,
    lineHeight: 15,
  },
  actionBtn: {
    marginTop: 14,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(214,178,94,0.35)',
    backgroundColor: 'rgba(214,178,94,0.10)',
  },
  actionText: {
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1.5,
    color: colors.gold,
  },
});

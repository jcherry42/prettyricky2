import React from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { colors } from '../theme/colors';
import { type } from '../theme/typography';
import { impactLight, impactMedium } from '../lib/haptics';

function MenuRow({ icon, iconColor, title, subtitle, onPress }) {
  return (
    <Pressable
      onPress={() => {
        impactMedium();
        onPress?.();
      }}
      style={({ pressed }) => [styles.row, pressed && { opacity: 0.85, transform: [{ scale: 0.99 }] }]}
      accessibilityRole="button"
    >
      <View style={[styles.rowIconWrap, { borderColor: `${iconColor}55`, backgroundColor: `${iconColor}14` }]}>
        <Ionicons name={icon} size={18} color={iconColor} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.rowTitle} numberOfLines={1}>{title}</Text>
        <Text style={styles.rowSubtitle} numberOfLines={2}>{subtitle}</Text>
      </View>
      <Ionicons name="chevron-forward" size={16} color={colors.textMute} />
    </Pressable>
  );
}

export function CustomerEntryMenuModal({ visible, onClose, onAddCustomer, onLicenseScans }) {
  return (
    <Modal visible={visible} animationType="fade" transparent presentationStyle="overFullScreen" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />

        <View style={styles.sheetWrap}>
          <LinearGradient
            colors={['rgba(20,24,30,0.92)', 'rgba(8,10,12,0.96)']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.sheet}
          >
            <View style={styles.header}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Ionicons name="bluetooth" size={16} color={colors.blue} />
                <Text style={styles.headerTitle}>CUSTOMER ENTRY</Text>
              </View>
              <Pressable
                onPress={() => {
                  impactLight();
                  onClose?.();
                }}
                style={({ pressed }) => [styles.closeBtn, pressed && { opacity: 0.85 }]}
                accessibilityRole="button"
                accessibilityLabel="Close customer entry menu"
              >
                <Ionicons name="close" size={16} color={colors.text} />
              </Pressable>
            </View>

            <View style={{ height: 10 }} />

            <MenuRow
              icon="person-add"
              iconColor={colors.gold}
              title="Add Customer"
              subtitle="Full customer profile (name, phone, email, status, notes)."
              onPress={onAddCustomer}
            />

            <View style={{ height: 10 }} />

            <MenuRow
              icon="id-card-outline"
              iconColor={colors.blue}
              title="License Scans"
              subtitle="View recent license scans and Bluetooth entries."
              onPress={onLicenseScans}
            />
          </LinearGradient>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.62)',
    justifyContent: 'flex-end',
  },
  sheetWrap: {
    paddingHorizontal: 14,
    paddingBottom: 22,
  },
  sheet: {
    borderRadius: 22,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    padding: 14,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerTitle: {
    color: colors.text,
    ...type.label,
    fontSize: 12,
    letterSpacing: 2.0,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    backgroundColor: 'rgba(0,0,0,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    backgroundColor: 'rgba(0,0,0,0.28)',
  },
  rowIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowTitle: {
    color: colors.text,
    ...type.label,
    fontSize: 12,
    letterSpacing: 1.2,
  },
  rowSubtitle: {
    marginTop: 2,
    color: colors.textMute,
    fontSize: 12,
    lineHeight: 16,
  },
});

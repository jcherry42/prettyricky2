import React from 'react';
import { Modal, View, Text, StyleSheet, Pressable, ScrollView, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { colors } from '../theme/colors';
import { type } from '../theme/typography';
import { impactMedium, notificationSuccess } from '../lib/haptics';

const STATUS_CONFIG = {
  new: { label: 'NEW', color: colors.blue },
  contacted: { label: 'CONTACTED', color: colors.gold },
  appointment: { label: 'APPOINTMENT', color: colors.green },
  negotiating: { label: 'NEGOTIATING', color: '#FF9500' },
  sold: { label: 'SOLD', color: colors.green },
  lost: { label: 'LOST', color: colors.red },
};

export function CustomerDetailModal({ visible, customer, onClose, onEdit, onDelete }) {
  if (!customer) return null;

  const name = `${customer.first_name || ''} ${customer.last_name || ''}`.trim();
  const status = customer.lead_status || 'new';
  const statusConfig = STATUS_CONFIG[status] || STATUS_CONFIG.new;

  const handleDelete = () => {
    impactMedium();
    Alert.alert(
      'Delete Customer',
      `Are you sure you want to delete ${name}? This action cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            notificationSuccess();
            onDelete?.(customer);
          },
        },
      ]
    );
  };

  const handleEdit = () => {
    impactMedium();
    onEdit?.(customer);
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <LinearGradient colors={[colors.bg0, colors.bg1]} style={styles.container}>
        {/* Header with wood bezel effect */}
        <LinearGradient
          colors={[colors.woodBurrWalnut, colors.woodBurrWalnutLight]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.header}
        >
          <Pressable onPress={onClose} style={styles.closeButton}>
            <Ionicons name="close" size={28} color={colors.text} />
          </Pressable>
          <Text style={styles.headerTitle}>Customer Details</Text>
          <View style={{ width: 28 }} />
        </LinearGradient>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {/* Status Badge */}
          <View style={[styles.statusBadgeLarge, { backgroundColor: statusConfig.color }]}>
            <Text style={styles.statusLabel}>{statusConfig.label}</Text>
          </View>

          {/* Name */}
          <Text style={styles.customerName}>{name || 'Unknown Customer'}</Text>

          {/* Info sections */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>CONTACT INFORMATION</Text>
            <InfoRow icon="call" label="Phone" value={customer.phone || '—'} />
            <InfoRow icon="mail" label="Email" value={customer.email || '—'} />
            <InfoRow icon="location" label="Address" value={customer.address || '—'} />
          </View>

          {customer.vehicle_interest && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>VEHICLE INTEREST</Text>
              <InfoRow icon="car" label="Vehicle" value={customer.vehicle_interest} />
            </View>
          )}

          {customer.notes && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>NOTES</Text>
              <Text style={styles.notesText}>{customer.notes}</Text>
            </View>
          )}

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>METADATA</Text>
            <InfoRow icon="calendar" label="Created" value={new Date(customer.created_at || Date.now()).toLocaleDateString()} />
            <InfoRow icon="pricetag" label="Customer ID" value={customer.customer_id || '—'} />
          </View>

          {/* Action buttons */}
          <View style={styles.actions}>
            <Pressable
              onPress={handleEdit}
              style={({ pressed }) => [styles.actionButton, styles.editButton, pressed && styles.pressed]}
            >
              <Ionicons name="pencil" size={20} color={colors.text} />
              <Text style={styles.actionButtonText}>Edit Customer</Text>
            </Pressable>

            <Pressable
              onPress={handleDelete}
              style={({ pressed }) => [styles.actionButton, styles.deleteButton, pressed && styles.pressed]}
            >
              <Ionicons name="trash" size={20} color={colors.red} />
              <Text style={[styles.actionButtonText, { color: colors.red }]}>Delete Customer</Text>
            </Pressable>
          </View>

          <View style={{ height: 40 }} />
        </ScrollView>
      </LinearGradient>
    </Modal>
  );
}

function InfoRow({ icon, label, value }) {
  return (
    <View style={styles.infoRow}>
      <Ionicons name={icon} size={16} color={colors.gold} />
      <Text style={styles.infoLabel}>{label}:</Text>
      <Text style={styles.infoValue} numberOfLines={2}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 60,
    paddingBottom: 16,
    paddingHorizontal: 16,
    borderBottomWidth: 2,
    borderBottomColor: colors.gold,
  },
  closeButton: {
    padding: 4,
  },
  headerTitle: {
    ...type.h1,
    color: colors.text,
  },
  content: {
    flex: 1,
    padding: 20,
  },
  statusBadgeLarge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    marginBottom: 16,
  },
  statusLabel: {
    ...type.label,
    fontSize: 12,
    color: '#000',
    fontWeight: '700',
  },
  customerName: {
    ...type.h1,
    fontSize: 28,
    color: colors.text,
    marginBottom: 24,
  },
  section: {
    marginBottom: 24,
    padding: 16,
    backgroundColor: colors.panel,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.stroke,
  },
  sectionTitle: {
    ...type.label,
    fontSize: 11,
    color: colors.gold,
    marginBottom: 12,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 10,
    gap: 8,
  },
  infoLabel: {
    ...type.body,
    color: colors.textDim,
    width: 80,
  },
  infoValue: {
    ...type.body,
    color: colors.text,
    flex: 1,
  },
  notesText: {
    ...type.body,
    color: colors.text,
    lineHeight: 20,
  },
  actions: {
    gap: 12,
    marginTop: 8,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
  },
  editButton: {
    backgroundColor: colors.panel2,
    borderColor: colors.stroke2,
  },
  deleteButton: {
    backgroundColor: 'rgba(255,45,45,0.1)',
    borderColor: colors.red,
  },
  actionButtonText: {
    ...type.body,
    fontFamily: 'SpaceGrotesk_600SemiBold',
    color: colors.text,
  },
  pressed: {
    opacity: 0.6,
  },
});

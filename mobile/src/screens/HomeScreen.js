import React, { useEffect, useRef, useState, useCallback } from 'react';
import { View, Text, StyleSheet, Pressable, FlatList, Animated, TextInput, ActivityIndicator, RefreshControl } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Screen } from '../components/Screen';
import { CustomerCard } from '../components/CustomerCard';
import { CustomerDetailModal } from '../components/CustomerDetailModal';
import { CustomerFormModal } from '../components/CustomerFormModal';
import { QuickAddButton } from '../components/QuickAddButton';
import { useTaillightFlash } from '../context/TaillightFlashContext';
import { useAppSettings } from '../context/AppSettingsContext';
import { useCustomers } from '../context/CustomerContext';
import { useToast } from '../context/ToastContext';
import { SportModeButton } from '../components/SportModeButton';
import { useAmbientLighting } from '../hooks/useAmbientLighting';
import { ChromeAccent } from '../components/DesignoTextures';
import { colors } from '../theme/colors';
import { type } from '../theme/typography';
import { impactMedium } from '../lib/haptics';

/* ---------- Ambient light strip ---------- */
function AmbientStrip({ active, color }) {
  const anim = useRef(new Animated.Value(0.12)).current;

  useEffect(() => {
    if (active) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(anim, { toValue: 0.45, duration: 2200, useNativeDriver: true }),
          Animated.timing(anim, { toValue: 0.12, duration: 2200, useNativeDriver: true }),
        ])
      ).start();
    } else {
      anim.stopAnimation();
      anim.setValue(0.06);
    }
  }, [active, anim]);

  return (
    <Animated.View style={[styles.ambientStrip, { backgroundColor: color, opacity: anim }]} />
  );
}

export function HomeScreen() {
  const { triggerFlash } = useTaillightFlash();
  const { settings } = useAppSettings();
  const { customers, loading, error, fetchCustomers, createCustomer, updateCustomer, deleteCustomer } = useCustomers();
  const { isEnabled: ambientEnabled, currentColor: ambientColor, opacity: ambientOpacity } = useAmbientLighting();
  const toast = useToast();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showFormModal, setShowFormModal] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  const sportActive = Boolean(settings.sportMode);
  // Use ambient lighting color if active, otherwise fallback to SPORT/default
  const stripColor = ambientEnabled && ambientColor
    ? `${ambientColor}${Math.round(ambientOpacity * 5 * 255).toString(16).padStart(2, '0')}`
    : sportActive ? 'rgba(255,80,0,0.60)' : 'rgba(0,212,255,0.40)';

  // Load customers on mount
  useEffect(() => {
    fetchCustomers().catch(() => {
      // Silent fail - error state handled by context
    });
  }, [fetchCustomers]);

  // Filter customers based on search
  const filteredCustomers = customers.filter((customer) => {
    if (!searchQuery.trim()) return true;
    const query = searchQuery.toLowerCase();
    const name = `${customer.first_name || ''} ${customer.last_name || ''}`.toLowerCase();
    const phone = customer.phone || '';
    const email = customer.email || '';
    return name.includes(query) || phone.includes(query) || email.includes(query);
  });

  const handleCustomerPress = (customer) => {
    setSelectedCustomer(customer);
    setShowDetailModal(true);
  };

  const handleAddNew = () => {
    setEditingCustomer(null);
    setShowFormModal(true);
  };

  const handleEdit = (customer) => {
    setShowDetailModal(false);
    setEditingCustomer(customer);
    setShowFormModal(true);
  };

  const handleDelete = async (customer) => {
    try {
      await deleteCustomer(customer.customer_id);
      setShowDetailModal(false);
    } catch (error) {
      alert(`Failed to delete customer: ${error.message}`);
    }
  };

  const handleSave = async (customerData, existingCustomer) => {
    try {
      if (existingCustomer) {
        await updateCustomer(existingCustomer.customer_id, customerData);
      } else {
        await createCustomer(customerData);
      }
    } catch (error) {
      throw error;
    }
  };

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await fetchCustomers();
    } finally {
      setRefreshing(false);
    }
  }, [fetchCustomers]);

  const renderCustomer = ({ item }) => (
    <CustomerCard customer={item} onPress={handleCustomerPress} />
  );

  const renderHeader = () => (
    <View>
      {/* Header clearance */}
      <View style={{ height: 56 }} />

      <AmbientStrip active color={stripColor} />

      {/* SPORT button */}
      <View style={styles.sportRow}>
        <SportModeButton />
      </View>

      <AmbientStrip active color={stripColor} />

      {/* Chrome accent divider */}
      <ChromeAccent style={{ marginHorizontal: 16, marginBottom: 8 }} />

      {/* Search bar with wood bezel styling */}
      <View style={styles.searchContainer}>
        <LinearGradient
          colors={[colors.woodBurrWalnut, colors.woodBurrWalnutLight]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.searchBezel}
        >
          <View style={styles.searchInputContainer}>
            <Ionicons name="search" size={18} color={colors.gold} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search customers..."
              placeholderTextColor={colors.textMute}
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
            {searchQuery.length > 0 && (
              <Pressable onPress={() => setSearchQuery('')}>
                <Ionicons name="close-circle" size={18} color={colors.textMute} />
              </Pressable>
            )}
          </View>
        </LinearGradient>
      </View>

      {/* Header with customer count */}
      <View style={styles.listHeader}>
        <Text style={styles.listTitle}>CUSTOMERS</Text>
        <View style={styles.countBadge}>
          <Text style={styles.countText}>{filteredCustomers.length}</Text>
        </View>
      </View>
    </View>
  );

  const renderEmpty = () => {
    if (loading) {
      return (
        <View style={styles.emptyContainer}>
          <ActivityIndicator size="large" color={colors.gold} />
          <Text style={styles.emptyText}>Loading customers...</Text>
        </View>
      );
    }

    if (error) {
      return (
        <View style={styles.emptyContainer}>
          <Ionicons name="alert-circle" size={48} color={colors.red} />
          <Text style={styles.emptyText}>Failed to load customers</Text>
          <Text style={styles.emptySubtext}>{error}</Text>
          <Pressable onPress={handleRefresh} style={styles.retryButton}>
            <Text style={styles.retryButtonText}>Retry</Text>
          </Pressable>
        </View>
      );
    }

    if (searchQuery && filteredCustomers.length === 0) {
      return (
        <View style={styles.emptyContainer}>
          <Ionicons name="search" size={48} color={colors.textMute} />
          <Text style={styles.emptyText}>No customers found</Text>
          <Text style={styles.emptySubtext}>Try a different search term</Text>
        </View>
      );
    }

    if (customers.length === 0) {
      return (
        <View style={styles.emptyContainer}>
          <Ionicons name="people" size={48} color={colors.textMute} />
          <Text style={styles.emptyText}>No customers yet</Text>
          <Text style={styles.emptySubtext}>Tap the + button to add your first customer</Text>
        </View>
      );
    }

    return null;
  };

  return (
    <Pressable style={{ flex: 1 }} onPress={triggerFlash}>
      <Screen>
        <FlatList
          data={filteredCustomers}
          renderItem={renderCustomer}
          keyExtractor={(item) => item.customer_id || item.id}
          ListHeaderComponent={renderHeader}
          ListEmptyComponent={renderEmpty}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={colors.gold}
              colors={[colors.gold]}
            />
          }
        />

        {/* QuickAdd button */}
        <QuickAddButton onPress={handleAddNew} />

        {/* Customer Detail Modal */}
        <CustomerDetailModal
          visible={showDetailModal}
          customer={selectedCustomer}
          onClose={() => setShowDetailModal(false)}
          onEdit={handleEdit}
          onDelete={handleDelete}
        />

        {/* Customer Form Modal */}
        <CustomerFormModal
          visible={showFormModal}
          customer={editingCustomer}
          onClose={() => setShowFormModal(false)}
          onSave={handleSave}
        />
      </Screen>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  listContent: {
    paddingBottom: 160,
  },
  sportRow: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 28,
  },
  ambientStrip: {
    width: '100%',
    height: 1,
    borderRadius: 1,
  },
  searchContainer: {
    marginHorizontal: 16,
    marginTop: 20,
    marginBottom: 16,
    borderRadius: 12,
    overflow: 'hidden',
  },
  searchBezel: {
    padding: 3,
    borderRadius: 12,
  },
  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.panel,
    borderRadius: 9,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
  },
  searchInput: {
    ...type.body,
    flex: 1,
    color: colors.text,
    fontSize: 14,
  },
  listHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginHorizontal: 16,
    marginBottom: 12,
    marginTop: 8,
  },
  listTitle: {
    ...type.label,
    fontSize: 11,
    color: colors.gold,
  },
  countBadge: {
    backgroundColor: colors.gold,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  countText: {
    ...type.label,
    fontSize: 11,
    color: colors.bg0,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 80,
    paddingHorizontal: 40,
  },
  emptyText: {
    ...type.h2,
    color: colors.textDim,
    marginTop: 16,
    textAlign: 'center',
  },
  emptySubtext: {
    ...type.body,
    color: colors.textMute,
    marginTop: 8,
    textAlign: 'center',
  },
  retryButton: {
    marginTop: 20,
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: colors.panel2,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.stroke2,
  },
  retryButtonText: {
    ...type.body,
    fontFamily: 'SpaceGrotesk_600SemiBold',
    color: colors.text,
  },
});

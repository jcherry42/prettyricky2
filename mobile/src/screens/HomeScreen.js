import React, { useCallback, useEffect, useMemo, useRef, useState, memo } from 'react';
import { View, Text, StyleSheet, Pressable, FlatList, Animated, TextInput, ActivityIndicator, RefreshControl, Keyboard } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Screen } from '../components/Screen';
import { CustomerCard } from '../components/CustomerCard';
import { CustomerDetailModal } from '../components/CustomerDetailModal';
import { CustomerFormModal } from '../components/CustomerFormModal';
import { QuickCompose } from '../components/QuickCompose';
import { EmergencyButton } from '../components/EmergencyButton';
import { EmergencyInquiryModal } from '../components/EmergencyInquiryModal';
import { useTaillightFlash } from '../context/TaillightFlashContext';
import { useAppSettings } from '../context/AppSettingsContext';
import { useCustomers } from '../context/CustomerContext';
import { useToast } from '../context/ToastContext';
import { SportModeButton } from '../components/SportModeButton';
import { ChromeAccent } from '../components/DesignoTextures';
import { NetworkStatusDot } from '../components/NetworkStatusDot';
import { CustomerListSkeleton } from '../components/LoadingSkeleton';
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

/* --------------------------------------------------------------------------
 * HomeListHeader — defined OUTSIDE HomeScreen so its identity is STABLE.
 * FlatList reconciles by component type: a new function reference on every
 * HomeScreen render would cause the header (and QuickCompose inside it) to
 * unmount/remount, losing all state and keyboard focus.
 * -------------------------------------------------------------------------- */
const HomeListHeader = memo(function HomeListHeader({
  filteredCount,
  searchQuery,
  onSearchChange,
  stripColor,
}) {
  return (
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
              onChangeText={onSearchChange}
              returnKeyType="search"
              autoCorrect={false}
              autoCapitalize="none"
              clearButtonMode="while-editing"
              onSubmitEditing={Keyboard.dismiss}
            />
          </View>
        </LinearGradient>
      </View>

      {/* Header with customer count + network status */}
      <View style={styles.listHeader}>
        <Text style={styles.listTitle}>CUSTOMERS</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <NetworkStatusDot />
          <View style={styles.countBadge}>
            <Text style={styles.countText}>{filteredCount}</Text>
          </View>
        </View>
      </View>

      {/* QuickCompose box — stable mount, no remount on parent re-render */}
      <QuickCompose />
    </View>
  );
});

export function HomeScreen() {
  const { triggerFlash } = useTaillightFlash();
  const { settings } = useAppSettings();
  const { customers, loading, error, fetchCustomers, createCustomer, updateCustomer, deleteCustomer } = useCustomers();
  const toast = useToast();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showFormModal, setShowFormModal] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [emergencyModalVisible, setEmergencyModalVisible] = useState(false);

  // Remove ambient lighting subscription from HomeScreen \u2014 AmbientLightingSystem
  // overlay handles the visual effect. HomeScreen stays fully memoized.
  const sportActive = Boolean(settings.sportMode);
  const stripColor = sportActive ? 'rgba(255,80,0,0.60)' : 'rgba(0,212,255,0.40)';
  // Load customers on mount
  useEffect(() => {
    fetchCustomers().catch(() => {});
  }, [fetchCustomers]);

  // Filter customers \u2014 memoized so it only recomputes when inputs change
  const filteredCustomers = useMemo(() => {
    if (!searchQuery.trim()) return customers;
    const query = searchQuery.toLowerCase();
    return customers.filter((c) => {
      const name = `${c.first_name || ''} ${c.last_name || ''}`.toLowerCase();
      const phone = String(c.phone || '');
      const email = String(c.email || '');
      return name.includes(query) || phone.includes(query) || email.includes(query);
    });
  }, [customers, searchQuery]);

  const handleCustomerPress = useCallback((customer) => {
    setSelectedCustomer(customer);
    setShowDetailModal(true);
  }, []);

  const handleAddNew = useCallback(() => {
    setEditingCustomer(null);
    setShowFormModal(true);
  }, []);

  // Exposed to RootNavigator so the Bluetooth "Customer Entry" menu can open this form.
  useEffect(() => {
    globalThis.__sc_open_new_customer = handleAddNew;
    return () => {
      if (globalThis.__sc_open_new_customer === handleAddNew) {
        globalThis.__sc_open_new_customer = null;
      }
    };
  }, [handleAddNew]);

  const handleEdit = (customer) => {
    setShowDetailModal(false);
    setEditingCustomer(customer);
    setShowFormModal(true);
  };

  const handleDelete = async (customer) => {
    try {
      await deleteCustomer(customer.customer_id || customer.id);
      setShowDetailModal(false);
      toast.showSuccess('Customer deleted');
    } catch (e) {
      toast.showError(`Delete failed: ${e.message}`);
    }
  };

  const handleSave = async (customerData, existingCustomer) => {
    try {
      if (existingCustomer) {
        await updateCustomer(existingCustomer.customer_id || existingCustomer.id, customerData);
        toast.showSuccess('Customer updated');
      } else {
        await createCustomer(customerData);
        toast.showSuccess('Customer created');
      }
    } catch (e) {
      if (e._queued) {
        toast.showOffline('Saved offline - will sync when connected');
      } else {
        toast.showError(`Save failed: ${e.message}`);
      }
      throw e;
    }
  };

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await fetchCustomers();
    } catch (e) {
      if (e.message?.includes('offline')) {
        toast.showOffline('Showing cached customers');
      }
    } finally {
      setRefreshing(false);
    }
  }, [fetchCustomers, toast]);

  const renderCustomer = ({ item }) => (
    <CustomerCard customer={item} onPress={handleCustomerPress} />
  );

  // Use a stable render function that references the memoized HomeListHeader component.
  // Do NOT define the header content inline — that creates a new component type on every
  // render, causing FlatList to unmount/remount QuickCompose and lose all state & focus.
  const renderHeader = useCallback(() => (
    <HomeListHeader
      filteredCount={filteredCustomers.length}
      searchQuery={searchQuery}
      onSearchChange={setSearchQuery}
      stripColor={stripColor}
    />
  ), [filteredCustomers.length, searchQuery, stripColor]);

  const renderEmpty = () => {
    if (loading) {
      return <CustomerListSkeleton count={5} />;
    }

    if (error) {
      return (
        <View style={styles.emptyContainer}>
          <Ionicons name="alert-circle" size={48} color={colors.red} />
          <Text style={styles.emptyText}>Failed to load customers</Text>
          <Text style={styles.emptySubtext}>{error}</Text>
          <Pressable
            onPress={handleRefresh}
            style={styles.retryButton}
            accessibilityRole="button"
            accessibilityLabel="Retry loading customers"
          >
            <Ionicons name="refresh" size={14} color={colors.gold} />
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

  // CustomerCard: marginVertical 6 * 2 + padding 14 * 2 + content ~50px = ~94px total
  const CARD_HEIGHT = 94;
  const getItemLayout = useCallback((_data, index) => ({
    length: CARD_HEIGHT,
    offset: CARD_HEIGHT * index,
    index,
  }), []);

  const renderCustomerMemo = useCallback(({ item }) => (
    <CustomerCard customer={item} onPress={handleCustomerPress} />
  ), [handleCustomerPress]);

  return (
    // Replaced outer Pressable with View — the Pressable was calling Keyboard.dismiss()
    // on EVERY tap anywhere on screen, including inside QuickCompose, preventing the
    // TextInput from staying focused. Keyboard dismissal is handled by the FlatList's
    // keyboardDismissMode="on-drag" below, which is the correct UX.
    <View style={{ flex: 1 }} onTouchEnd={triggerFlash}>
      <Screen>
        <FlatList
          data={filteredCustomers}
          renderItem={renderCustomerMemo}
          keyExtractor={(item) => item.customer_id || item.id || item._id || String(item.name || '')}
          getItemLayout={getItemLayout}
          ListHeaderComponent={renderHeader}
          ListEmptyComponent={renderEmpty}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.listContent}
          removeClippedSubviews
          maxToRenderPerBatch={10}
          updateCellsBatchingPeriod={50}
          windowSize={5}
          initialNumToRender={10}
          keyboardDismissMode="on-drag"
          keyboardShouldPersistTaps="handled"
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={colors.gold}
              colors={[colors.gold]}
            />
          }
        />

        {/* Emergency Button */}
        <EmergencyButton onPress={() => setEmergencyModalVisible(true)} />

        {/* Emergency Inquiry Modal */}
        <EmergencyInquiryModal
          visible={emergencyModalVisible}
          onClose={() => setEmergencyModalVisible(false)}
        />

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
    </View>
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
    backgroundColor: 'rgba(0,0,0,0.38)',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
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

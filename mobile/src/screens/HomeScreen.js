import React, { useCallback, useEffect, useMemo, useRef, useState, memo } from 'react';
import { View, Text, StyleSheet, Pressable, FlatList, Animated, TextInput, RefreshControl, Keyboard } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Screen } from '../components/Screen';
import { CustomerCard } from '../components/CustomerCard';
import { CustomerDetailModal } from '../components/CustomerDetailModal';
import { CustomerFormModal } from '../components/CustomerFormModal';
import { QuickCompose } from '../components/QuickCompose';
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
import { TAB_BAR_CONTENT_HEIGHT } from '../navigation/RootNavigator';

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
 * Only contains static/slow-changing content (branding, SPORT button,
 * QuickCompose). The search bar is rendered OUTSIDE FlatList to prevent
 * keyboard dismissal on every keystroke (a known React Native issue when
 * a TextInput lives inside ListHeaderComponent).
 * -------------------------------------------------------------------------- */
const HomeListHeader = memo(function HomeListHeader({ stripColor }) {
  return (
    <View>
      <AmbientStrip active color={stripColor} />

      {/* SPORT button with subtle top branding */}
      <View style={styles.sportRow}>
        <View style={styles.brandMark}>
          <View style={styles.brandLine} />
          <Text style={styles.brandText}>SUPERCHARG'D</Text>
          <View style={styles.brandLine} />
        </View>
        <View style={{ height: 16 }} />
        <SportModeButton />
      </View>

      <AmbientStrip active color={stripColor} />

      {/* Chrome accent divider */}
      <ChromeAccent style={{ marginHorizontal: 16, marginBottom: 10 }} />

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
  const insets = useSafeAreaInsets();

  // Dynamic bottom padding: tab bar + safe area + floating cluster/buttons + breathing room
  const listBottomPadding = TAB_BAR_CONTENT_HEIGHT + Math.max(insets.bottom, 4) + 82 + 12;

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showFormModal, setShowFormModal] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  // Emergency modal state now lives in RootNavigator

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

  // renderHeader only depends on stripColor now — never re-creates due to typing
  const renderHeader = useCallback(() => (
    <HomeListHeader stripColor={stripColor} />
  ), [stripColor]);

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
        {/* ── Search bar lives OUTSIDE FlatList so its TextInput never unmounts.
            Placing it inside ListHeaderComponent caused the keyboard to dismiss
            on every keystroke because searchQuery dep re-created the render fn. ── */}
        {/* The tab header is transparent. Screen already accounts for status bar height.
            This extra clearance is for the header content (BrandTaillights, ~52px). */}
        <View style={{ height: 52 }} />
        <View style={styles.searchContainer}>
          <LinearGradient
            colors={[colors.woodBurrWalnut, colors.woodBurrWalnutLight, colors.woodBurrWalnut]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.searchBezel}
          >
            <View style={styles.searchInputContainer}>
              <Ionicons name="search" size={16} color={colors.gold} />
              <TextInput
                style={styles.searchInput}
                placeholder="Search customers..."
                placeholderTextColor={colors.textGhost || colors.textMute}
                value={searchQuery}
                onChangeText={setSearchQuery}
                returnKeyType="search"
                autoCorrect={false}
                autoCapitalize="none"
                clearButtonMode="while-editing"
                onSubmitEditing={Keyboard.dismiss}
              />
            </View>
          </LinearGradient>
        </View>

        {/* Customer count row */}
        <View style={styles.listHeader}>
          <View style={styles.listTitleRow}>
            <View style={styles.goldDot} />
            <Text style={styles.listTitle}>CUSTOMERS</Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <NetworkStatusDot />
            <View style={styles.countBadge}>
              <Text style={styles.countText}>{filteredCustomers.length}</Text>
            </View>
          </View>
        </View>

        <FlatList
          data={filteredCustomers}
          renderItem={renderCustomerMemo}
          keyExtractor={(item) => item.customer_id || item.id || item._id || String(item.name || '')}
          getItemLayout={getItemLayout}
          ListHeaderComponent={renderHeader}
          ListEmptyComponent={renderEmpty}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[styles.listContent, { paddingBottom: listBottomPadding }]}
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

        {/* Emergency Inquiry Modal — moved to RootNavigator */}

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
    paddingBottom: 0, // Overridden dynamically in render via useSafeAreaInsets
  },
  sportRow: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 24,
  },
  brandMark: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    opacity: 0.6,
  },
  brandLine: {
    width: 28,
    height: 1,
    backgroundColor: colors.gold,
    opacity: 0.4,
  },
  brandText: {
    ...type.overline,
    fontSize: 8,
    color: colors.gold,
    letterSpacing: 3,
    opacity: 0.7,
  },
  ambientStrip: {
    width: '100%',
    height: 1,
    borderRadius: 1,
  },
  searchContainer: {
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 16,
    borderRadius: 14,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.4,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
  },
  searchBezel: {
    padding: 3,
    borderRadius: 14,
  },
  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.50)',
    borderRadius: 11,
    paddingHorizontal: 14,
    paddingVertical: 11,
    gap: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
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
  listTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  goldDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.gold,
    shadowColor: colors.gold,
    shadowOpacity: 0.6,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 0 },
  },
  listTitle: {
    ...type.overline,
    fontSize: 10,
    color: colors.gold,
    letterSpacing: 2,
  },
  countBadge: {
    backgroundColor: colors.gold,
    paddingHorizontal: 11,
    paddingVertical: 4,
    borderRadius: 8,
    shadowColor: colors.gold,
    shadowOpacity: 0.3,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 0 },
  },
  countText: {
    ...type.overline,
    fontSize: 10,
    color: colors.bg0,
    letterSpacing: 0.5,
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
    ...type.caption,
    color: colors.textMute,
    marginTop: 8,
    textAlign: 'center',
    lineHeight: 18,
  },
  retryButton: {
    marginTop: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: colors.panel2,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.stroke2,
  },
  retryButtonText: {
    ...type.label,
    fontSize: 11,
    color: colors.text,
  },
});

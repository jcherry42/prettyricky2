import React, { useCallback, useEffect, useMemo, useState, memo } from 'react';
import { errorMessage } from '../lib/errors';
import { View, Text, StyleSheet, Pressable, FlatList, TextInput, RefreshControl, Keyboard } from 'react-native';
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
import { on } from '../lib/events';
import { useCustomers, type CustomerRecord } from '../context/CustomerContext';
import { useLingo } from '../context/ModeContext';
import { useToast } from '../context/ToastContext';
import { useSession } from '../context/SessionContext';
import { SportModeButton } from '../components/SportModeButton';
import { ChromeAccent } from '../components/DesignoTextures';
import { NetworkStatusDot } from '../components/NetworkStatusDot';
import { CustomerListSkeleton } from '../components/LoadingSkeleton';
import { colors } from '../theme/colors';
import { type } from '../theme/typography';
import { TAB_BAR_CONTENT_HEIGHT } from '../navigation/layout';

/* --------------------------------------------------------------------------
 * HomeListHeader — defined OUTSIDE HomeScreen so its identity is STABLE.
 * Only contains static/slow-changing content (branding, SPORT button,
 * QuickCompose). The search bar is rendered OUTSIDE FlatList to prevent
 * keyboard dismissal on every keystroke (a known React Native issue when
 * a TextInput lives inside ListHeaderComponent).
 * -------------------------------------------------------------------------- */
const HomeListHeader = memo(function HomeListHeader({ serviceMode: _serviceMode }: { serviceMode: boolean }) {
  return (
    <View>
      {/* SPORT button with subtle top branding */}
      <View style={styles.sportRow}>
        <View style={styles.brandMark}>
          <View style={styles.brandLine} />
          <Text style={styles.brandText}>Sport Mode</Text>
          <View style={styles.brandLine} />
        </View>
        <View style={{ height: 16 }} />
        <SportModeButton />
      </View>

      {/* Chrome accent divider */}
      <ChromeAccent style={{ marginHorizontal: 16, marginBottom: 10 }} />

      {/* QuickCompose box — stable mount, no remount on parent re-render */}
      <QuickCompose />
    </View>
  );
});

export function HomeScreen() {
  const lingo = useLingo();
  const { triggerFlash } = useTaillightFlash();
  const { settings } = useAppSettings();
  const { customers, loading, error, fetchCustomers, createCustomer, updateCustomer, deleteCustomer } = useCustomers();
  const toast = useToast();
  const session = useSession();
  const insets = useSafeAreaInsets();

  // Dynamic bottom padding: tab bar + safe area + floating cluster/buttons + breathing room
  const listBottomPadding = TAB_BAR_CONTENT_HEIGHT + Math.max(insets.bottom, 4) + 82 + 12;

  // Restore search query and selected customer from session
  const [searchQuery, setSearchQueryLocal] = useState(session.searchQuery || '');
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerRecord | null>(session.activeCustomer || null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showFormModal, setShowFormModal] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<CustomerRecord | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  // Sync search query to session
  const setSearchQuery = useCallback((q: string) => {
    setSearchQueryLocal(q);
    session.setSearchQuery(q);
  }, [session]);
  // Emergency modal state now lives in RootNavigator

  // Load customers on mount
  useEffect(() => {
    fetchCustomers().catch(() => {});
  }, [fetchCustomers]);

  // Filter customers \u2014 memoized so it only recomputes when inputs change
  const filteredCustomers = useMemo(() => {
    if (!searchQuery.trim()) return customers;
    const query = searchQuery.toLowerCase();
    return customers.filter((c: CustomerRecord) => {
      const name = `${c.first_name || ''} ${c.last_name || ''}`.toLowerCase();
      const phone = String(c.phone || '');
      const email = String(c.email || '');
      return name.includes(query) || phone.includes(query) || email.includes(query);
    });
  }, [customers, searchQuery]);

  const handleCustomerPress = useCallback((customer: CustomerRecord) => {
    setSelectedCustomer(customer);
    session.setActiveCustomer(customer);
    setShowDetailModal(true);
  }, [session]);

  const handleAddNew = useCallback(() => {
    setEditingCustomer(null);
    setShowFormModal(true);
  }, []);

  // Exposed to RootNavigator via event bus (replaces globalThis pattern)
  useEffect(() => on('openNewCustomer', handleAddNew), [handleAddNew]);

  const handleEdit = (customer: CustomerRecord) => {
    setShowDetailModal(false);
    setEditingCustomer(customer);
    setShowFormModal(true);
  };

  const handleDelete = async (customer: CustomerRecord) => {
    try {
      await deleteCustomer((customer.customer_id || customer.id) as string);
      setShowDetailModal(false);
      toast.showSuccess('Customer deleted');
    } catch (e: unknown) {
      toast.showError(`Delete failed: ${errorMessage(e)}`);
    }
  };

  const handleSave = async (customerData: Partial<CustomerRecord>, existingCustomer: CustomerRecord | null) => {
    try {
      if (existingCustomer) {
        await updateCustomer((existingCustomer.customer_id || existingCustomer.id) as string, customerData);
        toast.showSuccess('Customer updated');
      } else {
        await createCustomer(customerData);
        toast.showSuccess('Customer created');
      }
    } catch (e: unknown) {
      if ((e as { _queued?: boolean })._queued) {
        toast.showOffline('Saved offline - will sync when connected');
      } else {
        toast.showError(`Save failed: ${errorMessage(e)}`);
      }
      throw e;
    }
  };

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await fetchCustomers();
    } catch (e: unknown) {
      if (errorMessage(e).includes('offline')) {
        toast.showOffline('Showing cached customers');
      }
    } finally {
      setRefreshing(false);
    }
  }, [fetchCustomers, toast]);

  const serviceMode = Boolean(settings.serviceMode);

  // renderHeader — stable identity, only re-created when serviceMode flips
  const renderHeader = useCallback(() => (
    <HomeListHeader serviceMode={serviceMode} />
  ), [serviceMode]);

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
        </View>
      );
    }

    return null;
  };

  // CustomerCard: marginVertical 6 * 2 + padding 14 * 2 + content ~50px = ~94px total
  const CARD_HEIGHT = 94;
  const getItemLayout = useCallback((_data: ArrayLike<CustomerRecord> | null | undefined, index: number) => ({
    length: CARD_HEIGHT,
    offset: CARD_HEIGHT * index,
    index,
  }), []);

  const renderCustomerMemo = useCallback(({ item }: { item: CustomerRecord }) => (
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
            colors={['rgba(40,25,12,0.85)', 'rgba(30,18,8,0.85)', 'rgba(40,25,12,0.85)']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.searchBezel}
          >
            <View style={styles.searchInputContainer}>
              <Ionicons name="search" size={16} color={colors.gold} />
              <TextInput
                style={styles.searchInput}
                placeholder={`Search ${lingo.customerPlural.toLowerCase()}...`}
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
            <Text style={styles.listTitle}>{lingo.customerPlural.toUpperCase()}</Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <NetworkStatusDot />
            <View style={styles.countBadge}>
              <Text style={styles.countText}>{filteredCustomers.length}</Text>
            </View>
          </View>
        </View>

        {/* Thin chrome bezel — boundary beneath the Customers label */}
        <ChromeAccent style={styles.listHeaderBezel} />

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
  searchContainer: {
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 16,
    borderRadius: 14,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.5,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
  },
  searchBezel: {
    padding: 3,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    shadowColor: '#000',
    shadowOpacity: 0.50,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 4 },
  },
  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(20,24,32,0.82)',
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
    marginBottom: 10,
    marginTop: 8,
  },
  listHeaderBezel: {
    marginHorizontal: 16,
    marginBottom: 12,
    width: undefined,
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

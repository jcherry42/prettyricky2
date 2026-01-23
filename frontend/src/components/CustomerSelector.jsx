import React, { useState, useEffect, useCallback, useRef } from 'react';
import { User, ChevronRight, Search, Car, X, Phone, Flame, Star, Loader2 } from 'lucide-react';
import { useSales } from '../context/SalesContext';
import { NoCustomers, NoSearchResults } from './ui/EmptyStates';
import { SkeletonCustomerItem } from './ui/LoadingStates';
import haptics from '../utils/haptics';
import { announceToScreenReader } from '../utils/accessibility';

// Theme-aware color helpers
const getThemeColors = (theme) => ({
  isDark: theme === 'dark',
  // Primary accent
  accent: theme === 'dark' ? '#FF9F43' : '#B8860B',
  accentRgba: (alpha) => theme === 'dark' 
    ? `rgba(255, 159, 67, ${alpha})` 
    : `rgba(184, 134, 11, ${alpha})`,
  // Text colors
  textPrimary: theme === 'dark' ? 'rgba(255, 240, 220, 0.95)' : '#3D2914',
  textSecondary: theme === 'dark' ? 'rgba(255, 200, 150, 0.7)' : '#6B5344',
  textMuted: theme === 'dark' ? 'rgba(255, 200, 150, 0.5)' : '#8B7355',
  textLabel: theme === 'dark' ? 'rgba(255, 200, 150, 0.6)' : '#7B6347',
  // Background
  inputBg: theme === 'dark' 
    ? 'linear-gradient(180deg, rgba(0, 0, 0, 0.4) 0%, rgba(0, 0, 0, 0.25) 100%)'
    : 'linear-gradient(180deg, rgba(255, 255, 255, 0.9) 0%, rgba(250, 248, 245, 0.95) 100%)',
  inputBorder: theme === 'dark' ? 'rgba(255, 140, 0, 0.15)' : 'rgba(180, 140, 80, 0.3)',
  hoverBg: theme === 'dark' 
    ? 'linear-gradient(90deg, rgba(255, 140, 0, 0.08) 0%, transparent 100%)'
    : 'linear-gradient(90deg, rgba(184, 134, 11, 0.08) 0%, transparent 100%)',
  // Status colors
  hotBg: theme === 'dark' ? 'rgba(255, 68, 68, 0.25)' : 'rgba(220, 38, 38, 0.15)',
  hotBorder: theme === 'dark' ? 'rgba(255, 68, 68, 0.4)' : 'rgba(220, 38, 38, 0.3)',
  hotGlow: theme === 'dark' ? '0 0 15px rgba(255, 68, 68, 0.2)' : '0 0 10px rgba(220, 38, 38, 0.1)',
  hotText: theme === 'dark' ? '#ff6b6b' : '#dc2626',
});

/**
 * Enterprise-Grade Customer Selector
 * Features:
 * - Debounced search
 * - Skeleton loading states
 * - Empty state illustrations
 * - Priority sorting
 * - Accessibility support
 * - Haptic feedback
 */
export const CustomerSelector = () => {
  const { customers, selectedCustomer, selectCustomer, getVehicleById, loading, theme } = useSales();
  const colors = getThemeColors(theme);
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const searchInputRef = useRef(null);
  const listRef = useRef(null);
  const debounceTimerRef = useRef(null);

  // Debounce search input - using ref to avoid lint warning
  useEffect(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    
    if (search !== debouncedSearch) {
      // Set searching state outside the timeout
      const shouldSetSearching = !!search;
      
      debounceTimerRef.current = setTimeout(() => {
        setDebouncedSearch(search);
        setIsSearching(false);
      }, 200);
      
      // Only set searching if there's a change pending - use requestAnimationFrame to avoid sync setState in effect
      if (shouldSetSearching) {
        requestAnimationFrame(() => setIsSearching(true));
      }
    }
    
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [search, debouncedSearch]);

  // Focus search input when opened
  useEffect(() => {
    if (isOpen && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [isOpen]);

  const filteredCustomers = customers.filter(c => {
    const name = c.name || `${c.firstName || ''} ${c.lastName || ''}`.trim();
    const searchLower = debouncedSearch.toLowerCase();
    return name.toLowerCase().includes(searchLower) ||
           (c.phone || '').includes(debouncedSearch) ||
           (c.email || '').toLowerCase().includes(searchLower);
  });

  // Sort by status priority (hot first) then by recent activity
  const sortedCustomers = [...filteredCustomers].sort((a, b) => {
    const statusPriority = { hot: 0, warm: 1, new: 2, cold: 3 };
    const aPriority = statusPriority[(a.status || a.lead_status || 'new').toLowerCase()] ?? 4;
    const bPriority = statusPriority[(b.status || b.lead_status || 'new').toLowerCase()] ?? 4;
    return aPriority - bPriority;
  });

  const handleSelect = useCallback((customer) => {
    haptics.select();
    selectCustomer(customer);
    setIsOpen(false);
    setSearch('');
    setDebouncedSearch('');
    announceToScreenReader(`Selected ${customer.name || customer.firstName}`);
  }, [selectCustomer]);

  const handleOpen = useCallback(() => {
    haptics.tap();
    setIsOpen(true);
    announceToScreenReader('Customer selector opened');
  }, []);

  const handleClose = useCallback(() => {
    haptics.tap();
    setIsOpen(false);
    setSearch('');
    setDebouncedSearch('');
  }, []);

  const handleClearSearch = useCallback(() => {
    setSearch('');
    setDebouncedSearch('');
    searchInputRef.current?.focus();
  }, []);

  // Keyboard navigation
  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Escape') {
      handleClose();
    } else if (e.key === 'ArrowDown' && listRef.current) {
      e.preventDefault();
      const firstItem = listRef.current.querySelector('button');
      firstItem?.focus();
    }
  }, [handleClose]);

  const getCustomerName = (customer) => {
    return customer.name || `${customer.firstName || ''} ${customer.lastName || ''}`.trim();
  };

  const getVehicleInfo = (customer) => {
    if (customer.vehicleInterest) {
      const vehicle = getVehicleById(customer.vehicleInterest);
      if (vehicle) return `${vehicle.year} ${vehicle.make} ${vehicle.model}`;
      return customer.vehicleInterest;
    }
    if (customer.vehicle_of_interest) return customer.vehicle_of_interest;
    return null;
  };

  const getStatusBadge = (status) => {
    const statusMap = {
      hot: { label: 'HOT', class: 'badge-hot', icon: Flame },
      warm: { label: 'WARM', class: 'badge-warm', icon: Star },
      cold: { label: 'COLD', class: 'badge-cold', icon: null },
      new: { label: 'NEW', class: 'badge-new', icon: null },
    };
    return statusMap[status?.toLowerCase()] || statusMap.new;
  };

  const formatPhone = (phone) => {
    if (!phone) return null;
    const cleaned = phone.replace(/\D/g, '');
    if (cleaned.length === 10) {
      return `(${cleaned.slice(0,3)}) ${cleaned.slice(3,6)}-${cleaned.slice(6)}`;
    }
    return phone;
  };

  // Loading state
  if (loading) {
    return (
      <div className="infotainment-panel overflow-hidden">
        <div className="p-4 space-y-3">
          <SkeletonCustomerItem />
        </div>
      </div>
    );
  }

  if (isOpen) {
    return (
      <div 
        className="infotainment-panel overflow-hidden animate-fade-in"
        role="dialog"
        aria-label="Select customer"
        onKeyDown={handleKeyDown}
      >
        {/* Search header - luxury auto style */}
        <div className="infotainment-header p-4">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: colors.accentRgba(0.6) }} />
            <input
              ref={searchInputRef}
              type="text"
              placeholder="Search by name, phone, or email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-11 pr-11 py-3 rounded-xl text-sm"
              style={{
                background: colors.inputBg,
                border: `1px solid ${colors.inputBorder}`,
                color: colors.textPrimary,
                outline: 'none'
              }}
              autoFocus
              data-testid="customer-search-input"
              aria-label="Search customers"
            />
            {search ? (
              <button
                onClick={handleClearSearch}
                className="absolute right-12 top-1/2 -translate-y-1/2 w-7 h-7 rounded-lg flex items-center justify-center"
                style={{ background: colors.isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)', color: colors.textMuted }}
                aria-label="Clear search"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            ) : null}
            <button
              onClick={handleClose}
              className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-lg flex items-center justify-center transition-colors"
              style={{ background: colors.isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)', color: colors.textMuted }}
              data-testid="close-customer-search"
              aria-label="Close customer selector"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="flex items-center justify-between mt-2 px-1">
            <p className="text-xs" style={{ color: colors.textMuted, fontFamily: "'Bebas Neue', sans-serif", letterSpacing: '0.08em' }}>
              {sortedCustomers.length} CUSTOMER{sortedCustomers.length !== 1 ? 'S' : ''} • SORTED BY PRIORITY
            </p>
            {isSearching && (
              <div className="flex items-center gap-1.5 text-xs" style={{ color: colors.accentRgba(0.7) }}>
                <Loader2 className="w-3 h-3 animate-spin" />
                Searching...
              </div>
            )}
          </div>
        </div>

        {/* Customer list - luxury scrollbar */}
        <div 
          ref={listRef}
          className="max-h-80 overflow-y-auto luxury-scrollbar"
          role="listbox"
          aria-label="Customer list"
        >
          {customers.length === 0 ? (
            <NoCustomers />
          ) : sortedCustomers.length === 0 ? (
            <NoSearchResults query={debouncedSearch} onClear={handleClearSearch} />
          ) : (
            sortedCustomers.map((customer, index) => {
              const name = getCustomerName(customer);
              const vehicle = getVehicleInfo(customer);
              const status = getStatusBadge(customer.status || customer.lead_status);
              const phone = formatPhone(customer.phone);
              const StatusIcon = status.icon;
              
              return (
                <React.Fragment key={customer.id}>
                  <button
                    onClick={() => handleSelect(customer)}
                    className="w-full p-4 flex items-center gap-4 text-left transition-all focus:outline-none"
                    style={{
                      background: 'transparent',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = 'linear-gradient(90deg, rgba(255, 140, 0, 0.08) 0%, transparent 100%)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = 'transparent';
                    }}
                    data-testid={`customer-${customer.id}`}
                    data-index={index}
                    role="option"
                    aria-selected={selectedCustomer?.id === customer.id}
                  >
                    {/* Avatar with status indicator - gauge cluster style */}
                    <div className="relative">
                      <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
                           style={{
                             background: status.label === 'HOT' 
                               ? 'linear-gradient(135deg, rgba(255, 68, 68, 0.25) 0%, rgba(200, 40, 40, 0.2) 100%)'
                               : 'linear-gradient(135deg, rgba(255, 140, 0, 0.2) 0%, rgba(200, 100, 0, 0.15) 100%)',
                             border: status.label === 'HOT'
                               ? '1px solid rgba(255, 68, 68, 0.4)'
                               : '1px solid rgba(255, 140, 0, 0.25)',
                             boxShadow: status.label === 'HOT'
                               ? '0 0 15px rgba(255, 68, 68, 0.2)'
                               : '0 0 12px rgba(255, 140, 0, 0.12)'
                           }}>
                        <User className="w-5 h-5" style={{ color: status.label === 'HOT' ? '#ff6b6b' : '#FF9F43' }} />
                      </div>
                      {status.label === 'HOT' && (
                        <div className="absolute -top-1 -right-1 w-4 h-4 rounded-full flex items-center justify-center" 
                             style={{ background: 'linear-gradient(135deg, #ff4444 0%, #cc2222 100%)', boxShadow: '0 0 8px rgba(255, 68, 68, 0.5)' }}>
                          <Flame className="w-2.5 h-2.5 text-white" />
                        </div>
                      )}
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold truncate" style={{ color: 'rgba(255, 240, 220, 0.95)' }}>
                          {name}
                        </span>
                        <span 
                          className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded flex items-center"
                          style={{
                            background: status.label === 'HOT' ? 'rgba(255, 68, 68, 0.2)' : 'rgba(255, 140, 0, 0.15)',
                            color: status.label === 'HOT' ? '#ff6b6b' : '#FF9F43',
                            border: `1px solid ${status.label === 'HOT' ? 'rgba(255, 68, 68, 0.3)' : 'rgba(255, 140, 0, 0.25)'}`
                          }}
                        >
                          {StatusIcon && <StatusIcon className="w-2.5 h-2.5 mr-0.5" />}
                          {status.label}
                        </span>
                      </div>
                      
                      {vehicle && (
                        <p className="text-sm truncate mt-0.5 flex items-center gap-1.5" style={{ color: 'rgba(255, 200, 150, 0.7)' }}>
                          <Car className="w-3.5 h-3.5 flex-shrink-0" style={{ color: 'rgba(255, 140, 0, 0.6)' }} />
                          {vehicle}
                        </p>
                      )}
                      
                      {phone && (
                        <p className="text-xs mt-0.5 flex items-center gap-1.5" style={{ color: 'rgba(255, 200, 150, 0.5)' }}>
                          <Phone className="w-3 h-3 flex-shrink-0" />
                          {phone}
                        </p>
                      )}
                    </div>
                    
                    <ChevronRight className="w-5 h-5 flex-shrink-0" style={{ color: 'rgba(255, 140, 0, 0.4)' }} />
                  </button>
                  
                  {index < sortedCustomers.length - 1 && (
                    <div className="infotainment-divider mx-4" />
                  )}
                </React.Fragment>
              );
            })
          )}
        </div>
      </div>
    );
  }

  // Closed state - selector button - luxury infotainment style
  const name = selectedCustomer ? getCustomerName(selectedCustomer) : null;
  const vehicle = selectedCustomer ? getVehicleInfo(selectedCustomer) : null;
  const status = selectedCustomer ? getStatusBadge(selectedCustomer.status || selectedCustomer.lead_status) : null;
  const StatusIcon = status?.icon;

  return (
    <button
      onClick={handleOpen}
      className="infotainment-panel w-full flex items-center gap-4 p-4 luxury-transition"
      data-testid="customer-selector"
      aria-haspopup="listbox"
      aria-label={selectedCustomer ? `Selected: ${name}. Click to change.` : 'Select a customer'}
      style={{
        cursor: 'pointer'
      }}
    >
      {selectedCustomer ? (
        <>
          {/* Avatar with ambient glow - gauge cluster style */}
          <div className="relative">
            <div className="w-14 h-14 rounded-xl flex items-center justify-center flex-shrink-0"
                 style={{
                   background: status?.label === 'HOT'
                     ? 'linear-gradient(135deg, rgba(255, 68, 68, 0.3) 0%, rgba(200, 40, 40, 0.25) 100%)'
                     : 'linear-gradient(135deg, rgba(255, 140, 0, 0.25) 0%, rgba(200, 100, 0, 0.2) 100%)',
                   border: status?.label === 'HOT'
                     ? '1px solid rgba(255, 68, 68, 0.5)'
                     : '1px solid rgba(255, 140, 0, 0.35)',
                   boxShadow: status?.label === 'HOT'
                     ? '0 0 20px rgba(255, 68, 68, 0.25), inset 0 0 15px rgba(255, 68, 68, 0.1)'
                     : '0 0 20px rgba(255, 140, 0, 0.2), inset 0 0 15px rgba(255, 140, 0, 0.1)'
                 }}>
              <User className="w-6 h-6" style={{ color: status?.label === 'HOT' ? '#ff6b6b' : '#FF9F43' }} />
            </div>
            {status?.label === 'HOT' && (
              <div className="absolute -top-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center animate-pulse"
                   style={{ background: 'linear-gradient(135deg, #ff4444 0%, #cc2222 100%)', boxShadow: '0 0 12px rgba(255, 68, 68, 0.6)' }}>
                <Flame className="w-3 h-3 text-white" />
              </div>
            )}
          </div>
          
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-bold text-lg truncate" style={{ color: '#FF9F43', textShadow: '0 0 12px rgba(255, 159, 67, 0.4)', fontFamily: "'Bebas Neue', sans-serif", letterSpacing: '0.05em' }}>
                {name}
              </span>
              <span 
                className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded flex items-center"
                style={{
                  background: status?.label === 'HOT' ? 'rgba(255, 68, 68, 0.2)' : 'rgba(255, 140, 0, 0.15)',
                  color: status?.label === 'HOT' ? '#ff6b6b' : '#FF9F43',
                  border: `1px solid ${status?.label === 'HOT' ? 'rgba(255, 68, 68, 0.3)' : 'rgba(255, 140, 0, 0.25)'}`
                }}
              >
                {StatusIcon && <StatusIcon className="w-2.5 h-2.5 mr-0.5" />}
                {status?.label}
              </span>
            </div>
            
            {vehicle && (
              <p className="text-sm truncate mt-1 flex items-center gap-1.5" style={{ color: 'rgba(255, 200, 150, 0.7)' }}>
                <Car className="w-4 h-4" style={{ color: 'rgba(255, 140, 0, 0.7)' }} />
                {vehicle}
              </p>
            )}
          </div>
          
          <ChevronRight className="w-6 h-6 flex-shrink-0" style={{ color: '#FF9F43' }} />
        </>
      ) : (
        <>
          <div className="w-14 h-14 rounded-xl flex items-center justify-center flex-shrink-0"
               style={{
                 background: 'linear-gradient(135deg, rgba(255, 140, 0, 0.1) 0%, rgba(200, 100, 0, 0.08) 100%)',
                 border: '1px solid rgba(255, 140, 0, 0.15)'
               }}>
            <User className="w-6 h-6" style={{ color: 'rgba(255, 140, 0, 0.5)' }} />
          </div>
          
          <div className="flex-1">
            <p className="font-semibold text-lg" style={{ color: 'rgba(255, 200, 150, 0.85)', fontFamily: "'Bebas Neue', sans-serif", letterSpacing: '0.08em' }}>SELECT CUSTOMER</p>
            <p className="text-sm" style={{ color: 'rgba(255, 200, 150, 0.5)' }}>Tap to choose a prospect</p>
          </div>
          
          <ChevronRight className="w-6 h-6 flex-shrink-0" style={{ color: 'rgba(255, 140, 0, 0.4)' }} />
        </>
      )}
    </button>
  );
};

export default CustomerSelector;

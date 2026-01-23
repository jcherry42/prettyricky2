import React, { useState, useEffect, useCallback, useRef } from 'react';
import { User, ChevronRight, Search, Car, X, Phone, Flame, Star, Loader2 } from 'lucide-react';
import { useSales } from '../context/SalesContext';
import { NoCustomers, NoSearchResults } from './ui/EmptyStates';
import { SkeletonCustomerItem } from './ui/LoadingStates';
import haptics from '../utils/haptics';
import { announceToScreenReader } from '../utils/accessibility';

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
  const { customers, selectedCustomer, selectCustomer, getVehicleById, loading } = useSales();
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
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'rgba(255, 140, 0, 0.6)' }} />
            <input
              ref={searchInputRef}
              type="text"
              placeholder="Search by name, phone, or email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-11 pr-11 py-3 rounded-xl text-sm"
              style={{
                background: 'linear-gradient(180deg, rgba(0, 0, 0, 0.4) 0%, rgba(0, 0, 0, 0.25) 100%)',
                border: '1px solid rgba(255, 140, 0, 0.15)',
                color: '#fff',
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
                style={{ background: 'rgba(255, 255, 255, 0.05)', color: 'rgba(255, 200, 150, 0.6)' }}
                aria-label="Clear search"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            ) : null}
            <button
              onClick={handleClose}
              className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-lg flex items-center justify-center transition-colors"
              style={{ background: 'rgba(255, 255, 255, 0.05)', color: 'rgba(255, 200, 150, 0.6)' }}
              data-testid="close-customer-search"
              aria-label="Close customer selector"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="flex items-center justify-between mt-2 px-1">
            <p className="text-xs" style={{ color: 'rgba(255, 200, 150, 0.5)', fontFamily: "'Bebas Neue', sans-serif", letterSpacing: '0.08em' }}>
              {sortedCustomers.length} CUSTOMER{sortedCustomers.length !== 1 ? 'S' : ''} • SORTED BY PRIORITY
            </p>
            {isSearching && (
              <div className="flex items-center gap-1.5 text-xs" style={{ color: 'rgba(255, 140, 0, 0.7)' }}>
                <Loader2 className="w-3 h-3 animate-spin" />
                Searching...
              </div>
            )}
          </div>
        </div>

        {/* Customer list */}
        <div 
          ref={listRef}
          className="max-h-80 overflow-y-auto hide-scrollbar"
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
                    className="w-full p-4 flex items-center gap-4 text-left hover:bg-muted/20 transition-colors focus:bg-muted/30 focus:outline-none"
                    data-testid={`customer-${customer.id}`}
                    data-index={index}
                    role="option"
                    aria-selected={selectedCustomer?.id === customer.id}
                  >
                    {/* Avatar with status indicator */}
                    <div className="relative">
                      <div className="w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0"
                           style={{
                             background: status.label === 'HOT' 
                               ? 'linear-gradient(135deg, hsla(15, 80%, 45%, 0.4) 0%, hsla(25, 70%, 35%, 0.3) 100%)'
                               : 'linear-gradient(135deg, hsla(35, 50%, 35%, 0.3) 0%, hsla(25, 40%, 25%, 0.2) 100%)',
                             border: status.label === 'HOT'
                               ? '1px solid hsla(15, 70%, 50%, 0.4)'
                               : '1px solid hsla(40, 40%, 30%, 0.3)'
                           }}>
                        <User className="w-5 h-5 text-primary" />
                      </div>
                      {status.label === 'HOT' && (
                        <div className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full flex items-center justify-center">
                          <Flame className="w-2.5 h-2.5 text-white" />
                        </div>
                      )}
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-foreground truncate">
                          {name}
                        </span>
                        <span className={status.class}>
                          {StatusIcon && <StatusIcon className="w-2.5 h-2.5 mr-0.5" />}
                          {status.label}
                        </span>
                      </div>
                      
                      {vehicle && (
                        <p className="text-sm text-muted-foreground truncate mt-0.5 flex items-center gap-1.5">
                          <Car className="w-3.5 h-3.5 flex-shrink-0" />
                          {vehicle}
                        </p>
                      )}
                      
                      {phone && (
                        <p className="text-xs text-muted-foreground/70 mt-0.5 flex items-center gap-1.5">
                          <Phone className="w-3 h-3 flex-shrink-0" />
                          {phone}
                        </p>
                      )}
                    </div>
                    
                    <ChevronRight className="w-5 h-5 text-muted-foreground flex-shrink-0" />
                  </button>
                  
                  {index < sortedCustomers.length - 1 && (
                    <div className="h-px bg-border/30 ml-20" />
                  )}
                </React.Fragment>
              );
            })
          )}
        </div>
      </div>
    );
  }

  // Closed state - selector button
  const name = selectedCustomer ? getCustomerName(selectedCustomer) : null;
  const vehicle = selectedCustomer ? getVehicleInfo(selectedCustomer) : null;
  const status = selectedCustomer ? getStatusBadge(selectedCustomer.status || selectedCustomer.lead_status) : null;
  const StatusIcon = status?.icon;

  return (
    <button
      onClick={handleOpen}
      className="selector-btn w-full flex items-center gap-4"
      data-testid="customer-selector"
      aria-haspopup="listbox"
      aria-label={selectedCustomer ? `Selected: ${name}. Click to change.` : 'Select a customer'}
    >
      {selectedCustomer ? (
        <>
          {/* Avatar with ambient glow */}
          <div className="relative">
            <div className="w-14 h-14 rounded-full flex items-center justify-center flex-shrink-0 ambient-gold"
                 style={{
                   background: status?.label === 'HOT'
                     ? 'linear-gradient(135deg, hsla(15, 80%, 50%, 0.5) 0%, hsla(25, 70%, 35%, 0.4) 100%)'
                     : 'linear-gradient(135deg, hsla(35, 60%, 45%, 0.4) 0%, hsla(25, 50%, 30%, 0.3) 100%)',
                   border: status?.label === 'HOT'
                     ? '1px solid hsla(15, 70%, 55%, 0.5)'
                     : '1px solid hsla(40, 60%, 50%, 0.3)'
                 }}>
              <User className="w-6 h-6 text-primary" />
            </div>
            {status?.label === 'HOT' && (
              <div className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center animate-pulse">
                <Flame className="w-3 h-3 text-white" />
              </div>
            )}
          </div>
          
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-bold text-lg text-foreground truncate">
                {name}
              </span>
              <span className={status?.class}>
                {StatusIcon && <StatusIcon className="w-2.5 h-2.5 mr-0.5" />}
                {status?.label}
              </span>
            </div>
            
            {vehicle && (
              <p className="text-sm text-muted-foreground truncate mt-1 flex items-center gap-1.5">
                <Car className="w-4 h-4 text-primary/70" />
                {vehicle}
              </p>
            )}
          </div>
          
          <ChevronRight className="w-6 h-6 text-primary flex-shrink-0" />
        </>
      ) : (
        <>
          <div className="w-14 h-14 rounded-full flex items-center justify-center flex-shrink-0"
               style={{
                 background: 'hsla(220, 10%, 15%, 0.8)',
                 border: '1px solid hsla(220, 8%, 25%, 0.5)'
               }}>
            <User className="w-6 h-6 text-muted-foreground" />
          </div>
          
          <div className="flex-1">
            <p className="font-semibold text-lg text-foreground">Select Customer</p>
            <p className="text-sm text-muted-foreground">Tap to choose a prospect</p>
          </div>
          
          <ChevronRight className="w-6 h-6 text-muted-foreground flex-shrink-0" />
        </>
      )}
    </button>
  );
};

export default CustomerSelector;

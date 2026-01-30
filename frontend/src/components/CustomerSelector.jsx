import React, { useState, useMemo, memo } from 'react';
import { ChevronRight, Search, X } from 'lucide-react';
import { useSales } from '../context/SalesContext';

/**
 * CustomerSelector - 2027 Tesla-Inspired Design
 * Clean card-based selection with vibrant accents
 */
const CustomerSelector = () => {
  const { customers, selectedCustomer, selectCustomer } = useSales();
  const [searchQuery, setSearchQuery] = useState('');
  const [showAllCustomers, setShowAllCustomers] = useState(false);

  // Filter customers by search query
  const filteredCustomers = useMemo(() => {
    if (!searchQuery.trim()) return customers;
    
    const query = searchQuery.toLowerCase();
    return customers.filter(customer => 
      customer.name?.toLowerCase().includes(query) ||
      customer.email?.toLowerCase().includes(query) ||
      customer.phone?.toLowerCase().includes(query)
    );
  }, [customers, searchQuery]);

  // Show only first 5 or all based on toggle
  const displayedCustomers = showAllCustomers 
    ? filteredCustomers 
    : filteredCustomers.slice(0, 5);

  const handleSelectCustomer = (customer) => {
    selectCustomer(customer);
    setShowAllCustomers(false);
  };

  // Get initials for avatar
  const getInitials = (name) => {
    if (!name) return '?';
    const parts = name.split(' ');
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  };

  // Get status color
  const getStatusColor = (status) => {
    const colors = {
      new: 'bg-gradient-to-r from-cyan-500 to-blue-500',
      contacted: 'bg-gradient-to-r from-purple-500 to-pink-500',
      qualified: 'bg-gradient-to-r from-green-500 to-emerald-500',
      appointment: 'bg-gradient-to-r from-orange-500 to-red-500',
    };
    return colors[status] || 'bg-gradient-to-r from-gray-500 to-gray-600';
  };

  return (
    <div className="space-y-3 tesla-animate-in">
      {/* Search Bar - Tesla Style */}
      {(showAllCustomers || searchQuery) && (
        <div className="relative tesla-fade-in">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search customers..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-12 pr-12 py-4 rounded-2xl bg-white dark:bg-zinc-900 border-2 border-gray-200 dark:border-zinc-800 focus:border-[#00D9FF] focus:outline-none transition-all text-gray-900 dark:text-white placeholder:text-gray-400"
            aria-label="Search customers"
            data-testid="customer-search-input"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-4 top-1/2 -translate-y-1/2 p-1 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded-full transition-colors"
              aria-label="Clear search"
              data-testid="clear-search-btn"
            >
              <X className="w-5 h-5 text-gray-400" />
            </button>
          )}
        </div>
      )}

      {/* Selected Customer Display - Premium Card */}
      {selectedCustomer && !showAllCustomers ? (
        <div 
          onClick={() => setShowAllCustomers(true)}
          className="tesla-customer-selector cursor-pointer"
        >
          <div className="tesla-customer-header">
            <div className={`tesla-customer-avatar ${getStatusColor(selectedCustomer.lead_status)}`}>
              {getInitials(selectedCustomer.name)}
            </div>
            <div className="tesla-customer-info">
              <h3 className="tesla-customer-name">{selectedCustomer.name}</h3>
              <p className="tesla-customer-meta">
                {selectedCustomer.phone || selectedCustomer.email}
                {selectedCustomer.vehicleOfInterest && ` • ${selectedCustomer.vehicleOfInterest}`}
              </p>
            </div>
            <ChevronRight className="w-6 h-6 tesla-chevron" />
          </div>
        </div>
      ) : (
        <>
          {/* Customer List - Tesla Cards */}
          {!selectedCustomer && (
            <div className="text-center py-8">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-r from-[#00D9FF] to-[#B84FFF] mb-4">
                <Search className="w-8 h-8 text-white" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
                SELECT CUSTOMER
              </h3>
              <p className="text-gray-600 dark:text-gray-400">
                Tap to choose a prospect
              </p>
            </div>
          )}
          
          <div className="space-y-2">
            {displayedCustomers.map((customer) => (
              <div
                key={customer.id}
                onClick={() => handleSelectCustomer(customer)}
                className="tesla-card cursor-pointer"
                role="button"
                tabIndex={0}
                aria-label={`Select ${customer.name}`}
                data-testid={`customer-card-${customer.id}`}
                onKeyDown={(e) => e.key === 'Enter' && handleSelectCustomer(customer)}
              >
                <div className="flex items-center gap-4">
                  <div className={`w-12 h-12 rounded-full flex items-center justify-center ${getStatusColor(customer.lead_status)} text-white font-semibold shadow-lg`}>
                    {getInitials(customer.name)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="font-semibold text-gray-900 dark:text-white truncate">
                      {customer.name}
                    </h4>
                    <p className="text-sm text-gray-600 dark:text-gray-400 truncate">
                      {customer.phone || customer.email}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {customer.lead_status && (
                      <span className="px-3 py-1 rounded-full text-xs font-medium bg-gradient-to-r from-gray-100 to-gray-200 dark:from-zinc-800 dark:to-zinc-700 text-gray-700 dark:text-gray-300">
                        {customer.lead_status}
                      </span>
                    )}
                    <ChevronRight className="w-5 h-5 text-gray-400" />
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Show More/Less Button */}
          {filteredCustomers.length > 5 && (
            <button
              onClick={() => setShowAllCustomers(!showAllCustomers)}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-[#00D9FF]/10 to-[#B84FFF]/10 hover:from-[#00D9FF]/20 hover:to-[#B84FFF]/20 border border-[#00D9FF]/30 text-[#00D9FF] font-medium transition-all"
              aria-label={showAllCustomers ? 'Show fewer customers' : `Show all ${filteredCustomers.length} customers`}
              data-testid="show-more-customers-btn"
            >
              {showAllCustomers 
                ? 'Show Less' 
                : `Show All ${filteredCustomers.length} Customers`}
            </button>
          )}

          {filteredCustomers.length === 0 && searchQuery && (
            <div className="text-center py-8">
              <p className="text-gray-600 dark:text-gray-400">
                No customers found matching &quot;{searchQuery}&quot;
              </p>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default memo(CustomerSelector);

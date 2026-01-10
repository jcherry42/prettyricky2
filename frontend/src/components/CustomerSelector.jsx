import React, { useState } from 'react';
import { User, ChevronRight, Search, Car, X, Phone } from 'lucide-react';
import { useSales } from '../context/SalesContext';

export const CustomerSelector = () => {
  const { customers, selectedCustomer, selectCustomer, getVehicleById } = useSales();
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');

  const filteredCustomers = customers.filter(c => {
    const name = c.name || `${c.firstName || ''} ${c.lastName || ''}`.trim();
    return name.toLowerCase().includes(search.toLowerCase()) ||
           (c.phone || '').includes(search);
  });

  const handleSelect = (customer) => {
    selectCustomer(customer);
    setIsOpen(false);
    setSearch('');
  };

  const getCustomerName = (customer) => {
    return customer.name || `${customer.firstName || ''} ${customer.lastName || ''}`.trim();
  };

  const getVehicleInfo = (customer) => {
    // Try different vehicle fields
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
      hot: { label: 'Hot', class: 'badge-hot' },
      warm: { label: 'Warm', class: 'badge-warm' },
      cold: { label: 'Cold', class: 'badge-cold' },
      new: { label: 'New', class: 'badge-warm' },
    };
    return statusMap[status?.toLowerCase()] || statusMap.new;
  };

  if (isOpen) {
    return (
      <div className="card-luxury overflow-hidden animate-fade-in">
        {/* Search header */}
        <div className="p-4 border-b border-border/30">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search customers..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="input-luxury pl-11 pr-11"
              autoFocus
              data-testid="customer-search-input"
            />
            <button
              onClick={() => { setIsOpen(false); setSearch(''); }}
              className="absolute right-2 top-1/2 -translate-y-1/2 btn-icon w-8 h-8"
              data-testid="close-customer-search"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Customer list */}
        <div className="max-h-80 overflow-y-auto hide-scrollbar">
          {filteredCustomers.length === 0 ? (
            <div className="p-8 text-center">
              <User className="w-12 h-12 mx-auto text-muted-foreground/30 mb-3" />
              <p className="text-muted-foreground">No customers found</p>
            </div>
          ) : (
            filteredCustomers.map((customer, index) => {
              const name = getCustomerName(customer);
              const vehicle = getVehicleInfo(customer);
              const status = getStatusBadge(customer.status || customer.lead_status);
              
              return (
                <React.Fragment key={customer.id}>
                  <button
                    onClick={() => handleSelect(customer)}
                    className="w-full p-4 flex items-center gap-4 text-left hover:bg-muted/20 transition-colors"
                    data-testid={`customer-${customer.id}`}
                  >
                    {/* Avatar */}
                    <div className="w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0"
                         style={{
                           background: 'linear-gradient(135deg, hsla(35, 50%, 35%, 0.3) 0%, hsla(25, 40%, 25%, 0.2) 100%)',
                           border: '1px solid hsla(40, 40%, 30%, 0.3)'
                         }}>
                      <User className="w-5 h-5 text-primary" />
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-foreground truncate">
                          {name}
                        </span>
                        <span className={status.class}>
                          {status.label}
                        </span>
                      </div>
                      
                      {vehicle && (
                        <p className="text-sm text-muted-foreground truncate mt-1 flex items-center gap-1.5">
                          <Car className="w-3.5 h-3.5" />
                          {vehicle}
                        </p>
                      )}
                    </div>
                    
                    <ChevronRight className="w-5 h-5 text-muted-foreground flex-shrink-0" />
                  </button>
                  
                  {index < filteredCustomers.length - 1 && (
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

  return (
    <button
      onClick={() => setIsOpen(true)}
      className="selector-btn w-full flex items-center gap-4"
      data-testid="customer-selector"
    >
      {selectedCustomer ? (
        <>
          {/* Avatar with ambient glow */}
          <div className="w-14 h-14 rounded-full flex items-center justify-center flex-shrink-0 ambient-gold"
               style={{
                 background: 'linear-gradient(135deg, hsla(35, 60%, 45%, 0.4) 0%, hsla(25, 50%, 30%, 0.3) 100%)',
                 border: '1px solid hsla(40, 60%, 50%, 0.3)'
               }}>
            <User className="w-6 h-6 text-primary" />
          </div>
          
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-bold text-lg text-foreground truncate">
                {name}
              </span>
              <span className={status?.class}>
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

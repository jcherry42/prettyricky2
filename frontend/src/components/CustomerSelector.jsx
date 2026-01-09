import React, { useState } from 'react';
import { User, ChevronRight, Search, Car, X } from 'lucide-react';
import { useSales } from '../context/SalesContext';

const statusConfig = {
  hot: { label: 'Hot', className: 'status-hot' },
  warm: { label: 'Warm', className: 'status-warm' },
  cold: { label: 'Cold', className: 'status-cold' },
};

export const CustomerSelector = () => {
  const { customers, selectedCustomer, selectCustomer, getVehicleById } = useSales();
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');

  const filteredCustomers = customers.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.phone.includes(search)
  );

  const handleSelect = (customer) => {
    selectCustomer(customer);
    setIsOpen(false);
    setSearch('');
  };

  const selectedVehicle = selectedCustomer ? getVehicleById(selectedCustomer.vehicleInterest) : null;

  if (isOpen) {
    return (
      <div className="glass-card overflow-hidden animate-scale-in">
        {/* Search header */}
        <div className="p-3 border-b border-border/50">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search customers..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="ios-input pl-10 pr-10"
              autoFocus
            />
            <button
              onClick={() => { setIsOpen(false); setSearch(''); }}
              className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center text-muted-foreground hover:text-foreground rounded-full hover:bg-muted/50 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Customer list */}
        <div className="max-h-80 overflow-y-auto hide-scrollbar">
          {filteredCustomers.length === 0 ? (
            <div className="p-6 text-center text-muted-foreground">
              No customers found
            </div>
          ) : (
            filteredCustomers.map((customer, index) => {
              const vehicle = getVehicleById(customer.vehicleInterest);
              const status = statusConfig[customer.status];
              
              return (
                <React.Fragment key={customer.id}>
                  <button
                    onClick={() => handleSelect(customer)}
                    className="ios-list-item w-full text-left hover:bg-primary/5"
                  >
                    <div className="w-11 h-11 rounded-full icon-bg-primary flex items-center justify-center flex-shrink-0">
                      <User className="w-5 h-5" />
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-foreground truncate">
                          {customer.name}
                        </span>
                        <span className={`text-xs px-2.5 py-0.5 rounded-full font-semibold ${status?.className}`}>
                          {status?.label}
                        </span>
                      </div>
                      
                      {vehicle && (
                        <p className="text-sm text-muted-foreground truncate mt-0.5">
                          {vehicle.year} {vehicle.make} {vehicle.model}
                        </p>
                      )}
                    </div>
                    
                    <ChevronRight className="w-5 h-5 text-muted-foreground flex-shrink-0" />
                  </button>
                  
                  {index < filteredCustomers.length - 1 && (
                    <div className="h-px bg-border/50 ml-[4.5rem]" />
                  )}
                </React.Fragment>
              );
            })
          )}
        </div>
      </div>
    );
  }

  return (
    <button
      onClick={() => setIsOpen(true)}
      className="customer-card glass-card w-full p-4 flex items-center gap-3 text-left rounded-2xl"
    >
      {selectedCustomer ? (
        <>
          <div className="w-14 h-14 rounded-full icon-bg-primary flex items-center justify-center flex-shrink-0">
            <User className="w-7 h-7" />
          </div>
          
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-bold text-lg text-foreground">
                {selectedCustomer.name}
              </span>
              <span className={`text-xs px-2.5 py-0.5 rounded-full font-semibold ${statusConfig[selectedCustomer.status]?.className}`}>
                {statusConfig[selectedCustomer.status]?.label}
              </span>
            </div>
            
            <div className="flex items-center gap-1.5 mt-1">
              {selectedVehicle && (
                <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
                  <Car className="w-4 h-4 text-primary" />
                  {selectedVehicle.year} {selectedVehicle.make} {selectedVehicle.model}
                </span>
              )}
            </div>
          </div>
          
          <ChevronRight className="w-6 h-6 text-primary flex-shrink-0" />
        </>
      ) : (
        <>
          <div className="w-14 h-14 rounded-full bg-muted/50 flex items-center justify-center flex-shrink-0">
            <User className="w-7 h-7 text-muted-foreground" />
          </div>
          
          <div className="flex-1">
            <p className="font-semibold text-lg text-foreground">Select Customer</p>
            <p className="text-sm text-muted-foreground">Tap to choose a customer</p>
          </div>
          
          <ChevronRight className="w-6 h-6 text-muted-foreground flex-shrink-0" />
        </>
      )}
    </button>
  );
};

export default CustomerSelector;

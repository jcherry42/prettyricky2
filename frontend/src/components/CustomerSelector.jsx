import React, { useState } from 'react';
import { User, ChevronRight, Search, Phone, Car, X } from 'lucide-react';
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
      <div className="ios-card overflow-hidden animate-scale-in">
        {/* Search header */}
        <div className="p-3 border-b border-border">
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
              className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center text-muted-foreground"
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
                    className="ios-list-item w-full text-left"
                  >
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <User className="w-5 h-5 text-primary" />
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-foreground truncate">
                          {customer.name}
                        </span>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${status?.className}`}>
                          {status?.label}
                        </span>
                      </div>
                      
                      {vehicle && (
                        <p className="text-sm text-muted-foreground truncate">
                          {vehicle.year} {vehicle.make} {vehicle.model}
                        </p>
                      )}
                    </div>
                    
                    <ChevronRight className="w-5 h-5 text-muted-foreground flex-shrink-0" />
                  </button>
                  
                  {index < filteredCustomers.length - 1 && (
                    <div className="ios-separator" />
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
      className="ios-card w-full p-4 flex items-center gap-3 text-left"
    >
      {selectedCustomer ? (
        <>
          <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
            <User className="w-6 h-6 text-primary" />
          </div>
          
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-foreground">
                {selectedCustomer.name}
              </span>
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusConfig[selectedCustomer.status]?.className}`}>
                {statusConfig[selectedCustomer.status]?.label}
              </span>
            </div>
            
            <div className="flex items-center gap-3 mt-1">
              {selectedVehicle && (
                <span className="flex items-center gap-1 text-sm text-muted-foreground">
                  <Car className="w-3.5 h-3.5" />
                  {selectedVehicle.year} {selectedVehicle.make} {selectedVehicle.model}
                </span>
              )}
            </div>
          </div>
          
          <ChevronRight className="w-5 h-5 text-muted-foreground flex-shrink-0" />
        </>
      ) : (
        <>
          <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
            <User className="w-6 h-6 text-muted-foreground" />
          </div>
          
          <div className="flex-1">
            <p className="font-medium text-foreground">Select Customer</p>
            <p className="text-sm text-muted-foreground">Tap to choose a customer</p>
          </div>
          
          <ChevronRight className="w-5 h-5 text-muted-foreground flex-shrink-0" />
        </>
      )}
    </button>
  );
};

export default CustomerSelector;

import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Search, User, ChevronDown, Phone, Mail, Car, Clock, X } from 'lucide-react';
import { Input } from './ui/input';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { useSales } from '../context/SalesContext';

const statusConfig = {
  hot: { label: 'Hot', variant: 'hot' },
  warm: { label: 'Warm', variant: 'warm' },
  cold: { label: 'Cold', variant: 'cold' },
  sold: { label: 'Sold', variant: 'sold' },
};

export const ProspectSelector = () => {
  const { prospects, selectedProspect, selectProspect, searchQuery, setSearch, getVehicleById } = useSales();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  // Filter prospects based on search
  const filteredProspects = useMemo(() => {
    if (!searchQuery) return prospects;
    const query = searchQuery.toLowerCase();
    return prospects.filter(p => 
      p.name.toLowerCase().includes(query) ||
      p.email.toLowerCase().includes(query) ||
      p.phone.includes(query)
    );
  }, [prospects, searchQuery]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') setIsOpen(false);
      if (e.key === '/' && e.target.tagName !== 'INPUT') {
        e.preventDefault();
        setIsOpen(true);
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleSelect = (prospect) => {
    selectProspect(prospect);
    setIsOpen(false);
    setSearch('');
  };

  const selectedVehicle = selectedProspect ? getVehicleById(selectedProspect.vehicle) : null;

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Trigger Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between gap-3 p-3 md:p-4 rounded-xl glass-card hover:shadow-lg transition-shadow duration-200 group"
      >
        {selectedProspect ? (
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <div className="flex items-center justify-center w-10 h-10 rounded-full bg-primary/10 flex-shrink-0">
              <User className="w-5 h-5 text-primary" />
            </div>
            <div className="flex flex-col items-start min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-medium text-foreground truncate">
                  {selectedProspect.name}
                </span>
                <Badge variant={statusConfig[selectedProspect.status]?.variant || 'outline'}>
                  {statusConfig[selectedProspect.status]?.label || selectedProspect.status}
                </Badge>
              </div>
              {selectedVehicle && (
                <span className="text-sm text-muted-foreground truncate">
                  {selectedVehicle.year} {selectedVehicle.make} {selectedVehicle.model} • ${selectedVehicle.price.toLocaleString()}
                </span>
              )}
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-3 text-muted-foreground">
            <div className="flex items-center justify-center w-10 h-10 rounded-full bg-muted">
              <User className="w-5 h-5" />
            </div>
            <span>Select a prospect to get started</span>
          </div>
        )}
        <div className="flex items-center gap-2 flex-shrink-0">
          <kbd className="kbd hidden md:inline-flex">/</kbd>
          <ChevronDown className={`w-5 h-5 text-muted-foreground transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
        </div>
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute top-full left-0 right-0 mt-2 z-50 glass-card rounded-xl shadow-lg overflow-hidden animate-slide-up">
          {/* Search Input */}
          <div className="p-3 border-b border-border/50">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search prospects..."
                value={searchQuery}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10 h-10 bg-muted/50 border-0 focus-visible:ring-1"
                autoFocus
              />
              {searchQuery && (
                <button
                  onClick={() => setSearch('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          {/* Prospect List */}
          <div className="max-h-80 overflow-y-auto custom-scrollbar">
            {filteredProspects.length === 0 ? (
              <div className="p-6 text-center text-muted-foreground">
                <p>No prospects found</p>
              </div>
            ) : (
              filteredProspects.map((prospect) => {
                const vehicle = getVehicleById(prospect.vehicle);
                const isSelected = selectedProspect?.id === prospect.id;
                
                return (
                  <button
                    key={prospect.id}
                    onClick={() => handleSelect(prospect)}
                    className={`w-full flex items-start gap-3 p-4 text-left transition-colors duration-150 ${
                      isSelected 
                        ? 'bg-primary/10' 
                        : 'hover:bg-muted/50'
                    }`}
                  >
                    <div className={`flex items-center justify-center w-10 h-10 rounded-full flex-shrink-0 ${
                      isSelected ? 'bg-primary/20' : 'bg-muted'
                    }`}>
                      <User className={`w-5 h-5 ${isSelected ? 'text-primary' : 'text-muted-foreground'}`} />
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium text-foreground truncate">
                          {prospect.name}
                        </span>
                        <Badge variant={statusConfig[prospect.status]?.variant || 'outline'} className="flex-shrink-0">
                          {statusConfig[prospect.status]?.label || prospect.status}
                        </Badge>
                      </div>
                      
                      {vehicle && (
                        <div className="flex items-center gap-1.5 text-sm text-muted-foreground mb-1">
                          <Car className="w-3.5 h-3.5" />
                          <span className="truncate">
                            {vehicle.year} {vehicle.make} {vehicle.model}
                          </span>
                        </div>
                      )}
                      
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {prospect.lastContact}
                        </span>
                        {prospect.objections.length > 0 && (
                          <span className="text-accent">
                            {prospect.objections.length} objection{prospect.objections.length > 1 ? 's' : ''}
                          </span>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default ProspectSelector;

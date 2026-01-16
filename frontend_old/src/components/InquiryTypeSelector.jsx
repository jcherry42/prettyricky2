import React from 'react';
import { 
  Star, 
  DollarSign, 
  Calendar, 
  Repeat, 
  CreditCard, 
  Car, 
  Clock, 
  MessageCircle 
} from 'lucide-react';
import { useSales } from '../context/SalesContext';
import { INQUIRY_TYPES } from '../data/salesData';

const iconMap = {
  'star': Star,
  'dollar-sign': DollarSign,
  'calendar': Calendar,
  'repeat': Repeat,
  'credit-card': CreditCard,
  'car': Car,
  'clock': Clock,
  'message-circle': MessageCircle,
};

export const InquiryTypeSelector = () => {
  const { selectedInquiryType, selectInquiryType, selectedCustomer } = useSales();

  if (!selectedCustomer) return null;

  return (
    <div className="space-y-3 animate-fade-in">
      <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-1">
        Inquiry Type
      </h2>
      
      <div className="grid grid-cols-4 gap-2">
        {INQUIRY_TYPES.map((type) => {
          const Icon = iconMap[type.icon] || MessageCircle;
          const isActive = selectedInquiryType === type.id;
          
          return (
            <button
              key={type.id}
              onClick={() => selectInquiryType(type.id)}
              className="flex flex-col items-center gap-2 p-3 rounded-xl transition-all duration-300"
              style={{
                background: isActive 
                  ? 'linear-gradient(180deg, hsla(35, 50%, 35%, 0.25) 0%, hsla(25, 40%, 25%, 0.2) 100%)'
                  : 'hsla(220, 10%, 12%, 0.6)',
                border: isActive 
                  ? '1px solid hsla(40, 60%, 50%, 0.4)'
                  : '1px solid hsla(220, 8%, 20%, 0.5)',
                boxShadow: isActive 
                  ? '0 0 20px hsla(40, 100%, 50%, 0.15), inset 0 1px 0 hsla(40, 50%, 50%, 0.1)'
                  : 'none',
              }}
              data-testid={`inquiry-${type.id}`}
            >
              <Icon 
                className="w-5 h-5 transition-colors"
                style={{ 
                  color: isActive ? 'hsla(40, 70%, 60%, 1)' : 'hsla(220, 10%, 55%, 1)' 
                }}
              />
              <span 
                className="text-[11px] font-medium text-center leading-tight transition-colors"
                style={{ 
                  color: isActive ? 'hsla(40, 50%, 75%, 1)' : 'hsla(220, 10%, 70%, 1)' 
                }}
              >
                {type.label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default InquiryTypeSelector;

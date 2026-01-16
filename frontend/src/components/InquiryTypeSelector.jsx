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
                  ? 'linear-gradient(180deg, hsla(38, 90%, 45%, 0.35) 0%, hsla(30, 70%, 30%, 0.3) 100%)'
                  : 'linear-gradient(180deg, hsla(25, 20%, 18%, 0.9) 0%, hsla(20, 18%, 12%, 0.95) 100%)',
                border: isActive 
                  ? '1px solid hsla(40, 100%, 55%, 0.6)'
                  : '1px solid hsla(30, 20%, 25%, 0.6)',
                boxShadow: isActive 
                  ? '0 0 20px hsla(40, 100%, 50%, 0.25), inset 0 1px 0 hsla(40, 80%, 60%, 0.2)'
                  : 'inset 0 1px 0 hsla(35, 20%, 30%, 0.3)',
              }}
              data-testid={`inquiry-${type.id}`}
            >
              <Icon 
                className="w-5 h-5 transition-colors"
                style={{ 
                  color: isActive ? 'hsla(45, 100%, 60%, 1)' : 'hsla(35, 30%, 65%, 1)',
                  filter: isActive ? 'drop-shadow(0 0 4px hsla(45, 100%, 50%, 0.5))' : 'none'
                }}
              />
              <span 
                className="text-[11px] font-semibold text-center leading-tight transition-colors"
                style={{ 
                  color: isActive ? 'hsla(45, 100%, 85%, 1)' : 'hsla(35, 20%, 80%, 1)',
                  textShadow: isActive ? '0 0 8px hsla(45, 100%, 50%, 0.4)' : 'none'
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

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
    <div className="space-y-3">
      <h2 className="text-sm font-medium text-muted-foreground px-1">
        What type of inquiry?
      </h2>
      
      <div className="grid grid-cols-4 gap-2">
        {INQUIRY_TYPES.map((type) => {
          const Icon = iconMap[type.icon] || MessageCircle;
          const isActive = selectedInquiryType === type.id;
          
          return (
            <button
              key={type.id}
              onClick={() => selectInquiryType(type.id)}
              className={`
                flex flex-col items-center justify-center gap-1.5 p-3 rounded-xl transition-all
                min-h-[72px]
                ${isActive 
                  ? 'bg-primary text-primary-foreground shadow-md' 
                  : 'bg-card text-muted-foreground'
                }
              `}
            >
              <Icon className={`w-5 h-5 ${isActive ? 'text-primary-foreground' : 'text-foreground'}`} />
              <span className="text-xs font-medium text-center leading-tight">
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

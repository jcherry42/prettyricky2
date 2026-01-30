import React, { memo } from 'react';
import { 
  Star, DollarSign, Calendar, Repeat, CreditCard, 
  Car, Clock, MessageCircle 
} from 'lucide-react';
import { useSales } from '../context/SalesContext';

/**
 * InquiryTypeSelector - 2027 Tesla-Inspired Design
 * Colorful grid layout with vibrant icons
 */

const INQUIRY_TYPES = [
  { 
    id: 'new_lead', 
    label: 'New Lead', 
    icon: Star,
    gradient: 'from-cyan-500 to-blue-500'
  },
  { 
    id: 'price_question', 
    label: 'Price Question', 
    icon: DollarSign,
    gradient: 'from-green-500 to-emerald-500'
  },
  { 
    id: 'availability', 
    label: 'Availability', 
    icon: Calendar,
    gradient: 'from-purple-500 to-pink-500'
  },
  { 
    id: 'trade_in', 
    label: 'Trade-In', 
    icon: Repeat,
    gradient: 'from-orange-500 to-red-500'
  },
  { 
    id: 'financing', 
    label: 'Financing', 
    icon: CreditCard,
    gradient: 'from-yellow-500 to-orange-500'
  },
  { 
    id: 'test_drive', 
    label: 'Test Drive', 
    icon: Car,
    gradient: 'from-blue-500 to-indigo-500',
    description: 'Schedule drive'
  },
  { 
    id: 'follow_up', 
    label: 'Follow Up', 
    icon: Clock,
    gradient: 'from-indigo-500 to-purple-500',
    description: 'Check-in'
  },
  { 
    id: 'objection', 
    label: 'Objection', 
    icon: MessageCircle,
    gradient: 'from-pink-500 to-rose-500',
    description: 'Address concerns'
  },
];

const InquiryTypeSelector = () => {
  const { selectedCustomer, selectedInquiryType, selectInquiryType } = useSales();

  if (!selectedCustomer) {
    return null;
  }

  return (
    <div className="space-y-3 tesla-animate-in">
      {/* Header */}
      <div className="text-center">
        <h3 className="text-lg font-bold text-gray-900 dark:text-white">
          What&apos;s the inquiry about?
        </h3>
        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
          Choose a response category
        </p>
      </div>

      {/* Grid Layout - 2x row with centered lower trio */}
      <div className="tesla-inquiry-grid">
        {INQUIRY_TYPES.map((type) => {
          const Icon = type.icon;
          const isSelected = selectedInquiryType === type.id;
          
          return (
            <button
              key={type.id}
              onClick={() => selectInquiryType(type.id)}
              className={`tesla-inquiry-btn ${isSelected ? 'selected' : ''}`}
              aria-pressed={isSelected}
              aria-label={`Select ${type.label} inquiry type`}
              data-testid={`inquiry-type-${type.id}`}
            >
              <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${type.gradient} flex items-center justify-center shadow-lg`}>
                <Icon className="w-5 h-5 text-white" />
              </div>
              <div className="font-semibold text-sm text-center">
                {type.label}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default memo(InquiryTypeSelector);

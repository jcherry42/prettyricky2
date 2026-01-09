import React from 'react';
import { Zap, Users, Heart } from 'lucide-react';
import { useSales } from '../context/SalesContext';
import { RESPONSE_TONES } from '../data/salesData';

const iconMap = {
  'zap': Zap,
  'users': Users,
  'heart': Heart,
};

const colorMap = {
  'accent': {
    active: 'bg-accent text-accent-foreground',
    inactive: 'text-accent',
  },
  'primary': {
    active: 'bg-primary text-primary-foreground',
    inactive: 'text-primary',
  },
  'success': {
    active: 'bg-success text-success-foreground',
    inactive: 'text-success',
  },
};

export const ToneSelector = () => {
  const { selectedTone, selectTone, selectedCustomer, selectedInquiryType } = useSales();

  if (!selectedCustomer || !selectedInquiryType) return null;

  return (
    <div className="space-y-3">
      <h2 className="text-sm font-medium text-muted-foreground px-1">
        Select your approach
      </h2>
      
      <div className="ios-segment p-1.5">
        {RESPONSE_TONES.map((tone) => {
          const Icon = iconMap[tone.icon] || Users;
          const isActive = selectedTone === tone.id;
          const colors = colorMap[tone.color] || colorMap.primary;
          
          return (
            <button
              key={tone.id}
              onClick={() => selectTone(tone.id)}
              className={`
                tone-btn
                ${isActive ? colors.active : 'text-muted-foreground'}
              `}
            >
              <Icon className={`w-5 h-5 ${isActive ? '' : colors.inactive}`} />
              <span className="text-xs font-medium">{tone.shortLabel}</span>
            </button>
          );
        })}
      </div>
      
      {/* Description */}
      <p className="text-xs text-center text-muted-foreground">
        {RESPONSE_TONES.find(t => t.id === selectedTone)?.description}
      </p>
    </div>
  );
};

export default ToneSelector;

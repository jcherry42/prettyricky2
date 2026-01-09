import React from 'react';
import { Zap, Users, Heart } from 'lucide-react';
import { useSales } from '../context/SalesContext';
import { RESPONSE_TONES } from '../data/salesData';

const iconMap = {
  'zap': Zap,
  'users': Users,
  'heart': Heart,
};

export const ToneSelector = () => {
  const { selectedTone, selectTone, selectedCustomer, selectedInquiryType } = useSales();

  if (!selectedCustomer || !selectedInquiryType) return null;

  return (
    <div className="space-y-3 animate-fade-in">
      <h2 className="text-sm font-semibold text-muted-foreground px-1">
        Select your approach
      </h2>
      
      <div className="ios-segment p-1.5">
        {RESPONSE_TONES.map((tone) => {
          const Icon = iconMap[tone.icon] || Users;
          const isActive = selectedTone === tone.id;
          
          // Determine active class based on tone type
          let activeClass = '';
          if (isActive) {
            if (tone.id === 'fast_direct') activeClass = 'active-direct';
            else if (tone.id === 'balanced') activeClass = 'active-balanced';
            else if (tone.id === 'soft_touch') activeClass = 'active-soft';
          }
          
          return (
            <button
              key={tone.id}
              onClick={() => selectTone(tone.id)}
              className={`tone-btn ${activeClass}`}
            >
              <Icon className={`tone-icon w-5 h-5 ${isActive ? '' : tone.id === 'fast_direct' ? 'text-accent' : tone.id === 'balanced' ? 'text-primary' : 'text-success'}`} />
              <span className={`tone-label text-xs font-semibold ${isActive ? '' : 'text-muted-foreground'}`}>
                {tone.shortLabel}
              </span>
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

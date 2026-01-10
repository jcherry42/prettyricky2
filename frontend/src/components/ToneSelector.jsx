import React from 'react';
import { Zap, Users, Heart } from 'lucide-react';
import { useSales } from '../context/SalesContext';
import { RESPONSE_TONES } from '../data/salesData';

const iconMap = {
  'zap': Zap,
  'users': Users,
  'heart': Heart,
};

// Ambient colors for each tone
const toneColors = {
  fast_direct: {
    active: 'hsla(210, 100%, 60%, 1)',
    glow: 'hsla(210, 100%, 60%, 0.3)',
    bg: 'hsla(210, 80%, 50%, 0.15)',
  },
  balanced: {
    active: 'hsla(40, 80%, 55%, 1)',
    glow: 'hsla(40, 100%, 50%, 0.3)',
    bg: 'hsla(40, 70%, 45%, 0.15)',
  },
  soft_touch: {
    active: 'hsla(145, 70%, 50%, 1)',
    glow: 'hsla(145, 100%, 50%, 0.3)',
    bg: 'hsla(145, 60%, 40%, 0.15)',
  },
};

export const ToneSelector = () => {
  const { selectedTone, selectTone, selectedCustomer, selectedInquiryType } = useSales();

  if (!selectedCustomer || !selectedInquiryType) return null;

  return (
    <div className="space-y-3 animate-fade-in">
      <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-1">
        Select Approach
      </h2>
      
      {/* Tone selector with carbon fiber background */}
      <div className="texture-carbon rounded-xl p-1.5 flex gap-1.5"
           style={{ boxShadow: 'inset 0 2px 6px hsla(0, 0%, 0%, 0.4)' }}>
        {RESPONSE_TONES.map((tone) => {
          const Icon = iconMap[tone.icon] || Users;
          const isActive = selectedTone === tone.id;
          const colors = toneColors[tone.id] || toneColors.balanced;
          
          return (
            <button
              key={tone.id}
              onClick={() => selectTone(tone.id)}
              className="flex-1 py-3 px-3 rounded-lg flex flex-col items-center gap-1.5 transition-all duration-300"
              style={{
                background: isActive ? colors.bg : 'transparent',
                boxShadow: isActive ? `0 0 20px ${colors.glow}` : 'none',
                border: isActive ? `1px solid ${colors.active}40` : '1px solid transparent',
              }}
              data-testid={`tone-${tone.id}`}
            >
              <Icon 
                className="w-5 h-5 transition-colors"
                style={{ color: isActive ? colors.active : 'hsla(220, 10%, 50%, 1)' }}
              />
              <span 
                className="text-xs font-semibold transition-colors"
                style={{ color: isActive ? colors.active : 'hsla(220, 10%, 50%, 1)' }}
              >
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

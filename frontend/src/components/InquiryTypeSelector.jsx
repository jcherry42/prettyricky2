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

// Theme colors
const getColors = (theme) => ({
  isDark: theme === 'dark',
  accent: theme === 'dark' ? '#FF9F43' : '#B8860B',
  accentRgba: (alpha) => theme === 'dark' ? `rgba(255, 159, 67, ${alpha})` : `rgba(184, 134, 11, ${alpha})`,
  textLabel: theme === 'dark' ? 'rgba(255, 200, 150, 0.6)' : '#7B6347',
  textMuted: theme === 'dark' ? 'rgba(255, 200, 150, 0.5)' : '#8B7355',
  buttonBg: theme === 'dark' 
    ? 'linear-gradient(180deg, rgba(0, 0, 0, 0.3) 0%, rgba(0, 0, 0, 0.2) 100%)'
    : 'linear-gradient(180deg, rgba(255, 255, 255, 0.8) 0%, rgba(250, 248, 245, 0.9) 100%)',
  buttonActiveBg: theme === 'dark'
    ? 'linear-gradient(180deg, rgba(255, 140, 0, 0.25) 0%, rgba(255, 100, 0, 0.18) 100%)'
    : 'linear-gradient(180deg, rgba(184, 134, 11, 0.2) 0%, rgba(160, 120, 60, 0.15) 100%)',
  buttonBorder: theme === 'dark' ? 'rgba(255, 140, 0, 0.1)' : 'rgba(180, 140, 80, 0.15)',
  buttonActiveBorder: theme === 'dark' ? 'rgba(255, 140, 0, 0.5)' : 'rgba(184, 134, 11, 0.4)',
});

export const InquiryTypeSelector = () => {
  const { selectedInquiryType, selectInquiryType, selectedCustomer, theme } = useSales();
  const colors = getColors(theme);

  if (!selectedCustomer) return null;

  return (
    <div className="space-y-3 animate-fade-in">
      <h2 
        className="text-xs font-semibold uppercase tracking-wider px-1"
        style={{ 
          color: colors.textLabel, 
          fontFamily: "'Bebas Neue', sans-serif", 
          letterSpacing: '0.12em' 
        }}
      >
        INQUIRY TYPE
      </h2>
      
      {/* Infotainment-style grid - like car touchscreen buttons */}
      <div 
        className="infotainment-panel p-2"
      >
        <div className="grid grid-cols-4 gap-1.5">
          {INQUIRY_TYPES.map((type) => {
            const Icon = iconMap[type.icon] || MessageCircle;
            const isActive = selectedInquiryType === type.id;
            
            return (
              <button
                key={type.id}
                onClick={() => selectInquiryType(type.id)}
                className="flex flex-col items-center gap-2 p-3 rounded-xl transition-all duration-300 luxury-transition"
                style={{
                  background: isActive ? colors.buttonActiveBg : colors.buttonBg,
                  border: isActive 
                    ? `1px solid ${colors.buttonActiveBorder}`
                    : `1px solid ${colors.buttonBorder}`,
                  boxShadow: isActive 
                    ? `0 0 20px ${colors.accentRgba(0.2)}, inset 0 1px 0 rgba(255, 255, 255, 0.08)`
                    : 'inset 0 1px 0 rgba(255, 255, 255, 0.02)',
                }}
                data-testid={`inquiry-${type.id}`}
              >
                <Icon 
                  className="w-5 h-5 transition-colors"
                  style={{ 
                    color: isActive ? colors.accent : colors.textMuted,
                    filter: isActive ? `drop-shadow(0 0 6px ${colors.accentRgba(0.6)})` : 'none'
                  }}
                />
                <span 
                  className="text-[10px] font-semibold text-center leading-tight transition-colors uppercase tracking-wide"
                  style={{ 
                    color: isActive ? colors.accent : colors.textLabel,
                    textShadow: isActive && colors.isDark ? `0 0 10px ${colors.accentRgba(0.5)}` : 'none',
                    fontFamily: "'Bebas Neue', sans-serif",
                    letterSpacing: '0.05em'
                  }}
                >
                  {type.label}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default InquiryTypeSelector;

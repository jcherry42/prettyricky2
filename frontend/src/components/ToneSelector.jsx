import React from 'react';
import { Zap, Users, Heart } from 'lucide-react';
import { useSales } from '../context/SalesContext';
import { RESPONSE_TONES } from '../data/salesData';

const iconMap = {
  'zap': Zap,
  'users': Users,
  'heart': Heart,
};

// Theme-aware tone colors - optimized for readability
const getToneColors = (theme, toneId) => {
  const isDark = theme === 'dark';
  const baseColors = {
    fast_direct: {
      active: isDark ? '#22d3ee' : '#0E7490',
      glow: isDark ? 'rgba(34, 211, 238, 0.3)' : 'none',
      bg: isDark ? 'rgba(34, 211, 238, 0.12)' : '#F0F9FA',
      border: isDark ? 'rgba(34, 211, 238, 0.35)' : '#0E7490',
    },
    balanced: {
      active: isDark ? '#FF9F43' : '#8B5A2B',
      glow: isDark ? 'rgba(255, 159, 67, 0.3)' : 'none',
      bg: isDark ? 'rgba(255, 159, 67, 0.12)' : '#FDF8F0',
      border: isDark ? 'rgba(255, 159, 67, 0.35)' : '#8B5A2B',
    },
    soft_touch: {
      active: isDark ? '#22c55e' : '#15803D',
      glow: isDark ? 'rgba(34, 197, 94, 0.3)' : 'none',
      bg: isDark ? 'rgba(34, 197, 94, 0.12)' : '#F0FDF4',
      border: isDark ? 'rgba(34, 197, 94, 0.35)' : '#15803D',
    },
  };
  return baseColors[toneId] || baseColors.balanced;
};

// Theme colors - optimized for readability
const getColors = (theme) => ({
  isDark: theme === 'dark',
  textLabel: theme === 'dark' ? 'rgba(255, 200, 150, 0.6)' : '#5D4E37',
  textMuted: theme === 'dark' ? 'rgba(255, 200, 150, 0.4)' : '#6B5B4B',
  textDescription: theme === 'dark' ? 'rgba(255, 200, 150, 0.5)' : '#5D4E37',
  buttonBg: theme === 'dark' 
    ? 'linear-gradient(180deg, rgba(0, 0, 0, 0.3) 0%, rgba(0, 0, 0, 0.2) 100%)'
    : '#FFFFFF',
  buttonBorder: theme === 'dark' ? 'rgba(255, 140, 0, 0.08)' : 'rgba(139, 90, 43, 0.2)',
});

export const ToneSelector = () => {
  const { selectedTone, selectTone, selectedCustomer, selectedInquiryType, theme } = useSales();
  const colors = getColors(theme);

  if (!selectedCustomer || !selectedInquiryType) return null;

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
        SELECT APPROACH
      </h2>
      
      {/* Tone selector with infotainment panel styling */}
      <div 
        className="infotainment-panel p-2"
      >
        <div className="flex gap-1.5">
          {RESPONSE_TONES.map((tone) => {
            const Icon = iconMap[tone.icon] || Users;
            const isActive = selectedTone === tone.id;
            const toneColor = getToneColors(theme, tone.id);
            
            return (
              <button
                key={tone.id}
                onClick={() => selectTone(tone.id)}
                className="flex-1 py-3.5 px-3 rounded-xl flex flex-col items-center gap-1.5 transition-all duration-300 luxury-transition"
                style={{
                  background: isActive ? toneColor.bg : colors.buttonBg,
                  boxShadow: isActive ? `0 0 25px ${toneColor.glow}` : 'none',
                  border: isActive ? `1px solid ${toneColor.border}` : `1px solid ${colors.buttonBorder}`,
                }}
                data-testid={`tone-${tone.id}`}
              >
                <Icon 
                  className="w-5 h-5 transition-colors"
                  style={{ 
                    color: isActive ? toneColor.active : colors.textMuted,
                    filter: isActive ? `drop-shadow(0 0 6px ${toneColor.glow})` : 'none'
                  }}
                />
                <span 
                  className="text-xs font-semibold transition-colors uppercase tracking-wide"
                  style={{ 
                    color: isActive ? toneColor.active : colors.textMuted,
                    fontFamily: "'Bebas Neue', sans-serif",
                    letterSpacing: '0.05em',
                    textShadow: isActive && colors.isDark ? `0 0 8px ${toneColor.glow}` : 'none'
                  }}
                >
                  {tone.shortLabel}
                </span>
              </button>
            );
          })}
        </div>
      </div>
      
      {/* Description - instrument cluster readout style */}
      <p 
        className="text-xs text-center px-2"
        style={{ 
          color: colors.textDescription,
          fontFamily: "'SF Mono', 'Roboto Mono', monospace",
          fontSize: '11px'
        }}
      >
        {RESPONSE_TONES.find(t => t.id === selectedTone)?.description}
      </p>
    </div>
  );
};

export default ToneSelector;

import React from 'react';
import { Zap, Users, Heart } from 'lucide-react';
import { useSales } from '../context/SalesContext';
import { RESPONSE_TONES } from '../data/salesData';

const iconMap = {
  'zap': Zap,
  'users': Users,
  'heart': Heart,
};

// Theme-aware tone colors
const getToneColors = (theme, toneId) => {
  const isDark = theme === 'dark';
  const baseColors = {
    fast_direct: {
      active: isDark ? '#22d3ee' : '#0891b2',
      glow: isDark ? 'rgba(34, 211, 238, 0.3)' : 'rgba(8, 145, 178, 0.2)',
      bg: isDark ? 'rgba(34, 211, 238, 0.12)' : 'rgba(8, 145, 178, 0.1)',
      border: isDark ? 'rgba(34, 211, 238, 0.35)' : 'rgba(8, 145, 178, 0.3)',
    },
    balanced: {
      active: isDark ? '#FF9F43' : '#B8860B',
      glow: isDark ? 'rgba(255, 159, 67, 0.3)' : 'rgba(184, 134, 11, 0.2)',
      bg: isDark ? 'rgba(255, 159, 67, 0.12)' : 'rgba(184, 134, 11, 0.1)',
      border: isDark ? 'rgba(255, 159, 67, 0.35)' : 'rgba(184, 134, 11, 0.3)',
    },
    soft_touch: {
      active: isDark ? '#22c55e' : '#16a34a',
      glow: isDark ? 'rgba(34, 197, 94, 0.3)' : 'rgba(22, 163, 74, 0.2)',
      bg: isDark ? 'rgba(34, 197, 94, 0.12)' : 'rgba(22, 163, 74, 0.1)',
      border: isDark ? 'rgba(34, 197, 94, 0.35)' : 'rgba(22, 163, 74, 0.3)',
    },
  };
  return baseColors[toneId] || baseColors.balanced;
};

// Theme colors
const getColors = (theme) => ({
  isDark: theme === 'dark',
  textLabel: theme === 'dark' ? 'rgba(255, 200, 150, 0.6)' : '#7B6347',
  textMuted: theme === 'dark' ? 'rgba(255, 200, 150, 0.4)' : '#9B8B7B',
  textDescription: theme === 'dark' ? 'rgba(255, 200, 150, 0.5)' : '#8B7B6B',
  buttonBg: theme === 'dark' 
    ? 'linear-gradient(180deg, rgba(0, 0, 0, 0.3) 0%, rgba(0, 0, 0, 0.2) 100%)'
    : 'linear-gradient(180deg, rgba(255, 255, 255, 0.8) 0%, rgba(250, 248, 245, 0.9) 100%)',
  buttonBorder: theme === 'dark' ? 'rgba(255, 140, 0, 0.08)' : 'rgba(180, 140, 80, 0.15)',
});

export const ToneSelector = () => {
  const { selectedTone, selectTone, selectedCustomer, selectedInquiryType } = useSales();

  if (!selectedCustomer || !selectedInquiryType) return null;

  return (
    <div className="space-y-3 animate-fade-in">
      <h2 
        className="text-xs font-semibold uppercase tracking-wider px-1"
        style={{ 
          color: 'rgba(255, 200, 150, 0.6)', 
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
            const colors = toneColors[tone.id] || toneColors.balanced;
            
            return (
              <button
                key={tone.id}
                onClick={() => selectTone(tone.id)}
                className="flex-1 py-3.5 px-3 rounded-xl flex flex-col items-center gap-1.5 transition-all duration-300 luxury-transition"
                style={{
                  background: isActive ? colors.bg : 'linear-gradient(180deg, rgba(0, 0, 0, 0.3) 0%, rgba(0, 0, 0, 0.2) 100%)',
                  boxShadow: isActive ? `0 0 25px ${colors.glow}` : 'none',
                  border: isActive ? `1px solid ${colors.border}` : '1px solid rgba(255, 140, 0, 0.08)',
                }}
                data-testid={`tone-${tone.id}`}
              >
                <Icon 
                  className="w-5 h-5 transition-colors"
                  style={{ 
                    color: isActive ? colors.active : 'rgba(255, 200, 150, 0.4)',
                    filter: isActive ? `drop-shadow(0 0 6px ${colors.glow})` : 'none'
                  }}
                />
                <span 
                  className="text-xs font-semibold transition-colors uppercase tracking-wide"
                  style={{ 
                    color: isActive ? colors.active : 'rgba(255, 200, 150, 0.5)',
                    fontFamily: "'Bebas Neue', sans-serif",
                    letterSpacing: '0.05em',
                    textShadow: isActive ? `0 0 8px ${colors.glow}` : 'none'
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
          color: 'rgba(255, 200, 150, 0.5)',
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

import React, { useState, useEffect } from 'react';
import { Heart, Sun, Moon, Swords, BarChart3, AlertTriangle } from 'lucide-react';
import { useSales } from '../context/SalesContext';
import { IntegrationHealthStatus } from './IntegrationHealthStatus';
import { playNotificationSound, getSoundPreferences } from '../utils/notificationSound';

export const Header = () => {
  const { 
    toggleFavorites,
    toggleVS,
    toggleAnalytics,
    toggleAdminSettings,
    favorites,
    theme,
    supercharged,
    toggleTheme,
    toggleSuperchargedMode,
  } = useSales();

  // Startup animation state
  const [startupComplete, setStartupComplete] = useState(false);
  const [startupPhase, setStartupPhase] = useState(0);

  useEffect(() => {
    const hasPlayed = sessionStorage.getItem('taillights_startup_played');
    if (hasPlayed) {
      setStartupComplete(true);
      setStartupPhase(3);
      return;
    }

    // C8 startup - both taillights illuminate together
    const phases = [
      { delay: 200, phase: 1 },   // Dim glow
      { delay: 600, phase: 2 },   // Brighter
      { delay: 1000, phase: 3 },  // Full brightness + text
    ];

    phases.forEach(({ delay, phase }) => {
      setTimeout(() => {
        setStartupPhase(phase);
        if (phase === 3) {
          const prefs = getSoundPreferences();
          if (prefs.enabled) {
            playNotificationSound(prefs.profile);
          }
          setTimeout(() => {
            setStartupComplete(true);
            sessionStorage.setItem('taillights_startup_played', 'true');
          }, 500);
        }
      }, delay);
    });
  }, []);

  return (
    <header className="header-luxury sticky top-0 z-50 safe-area-top relative">
      <div className="flex items-center justify-between h-16 px-4">
        {/* C8 Corvette Taillights - Accurate dual unit design */}
        <div className="c8-taillights-container" data-testid="taillights-logo">
          {/* Left taillight unit - tapered shape */}
          <svg 
            viewBox="0 0 60 20" 
            className={`c8-taillight-unit c8-left ${startupPhase >= 2 ? 'lit' : ''} ${startupComplete ? 'running' : ''}`}
          >
            <defs>
              <linearGradient id="c8RedGlow" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#ff3333" />
                <stop offset="50%" stopColor="#cc0000" />
                <stop offset="100%" stopColor="#990000" />
              </linearGradient>
              <linearGradient id="c8RedOff" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#330000" />
                <stop offset="100%" stopColor="#1a0000" />
              </linearGradient>
              <filter id="c8Glow">
                <feGaussianBlur stdDeviation="2" result="coloredBlur"/>
                <feMerge>
                  <feMergeNode in="coloredBlur"/>
                  <feMergeNode in="SourceGraphic"/>
                </feMerge>
              </filter>
            </defs>
            {/* Tapered shape - wider on left (outside), narrower on right (inside) */}
            <path 
              d="M2 4 L55 7 L55 13 L2 16 Z" 
              className="c8-led-path"
              fill="url(#c8RedOff)"
            />
            {/* Inner LED strip detail */}
            <path 
              d="M5 6 L52 8 L52 12 L5 14 Z" 
              className="c8-led-inner"
              fill="url(#c8RedOff)"
            />
          </svg>

          {/* Center text area */}
          <div className={`c8-center-text ${startupPhase >= 3 ? 'lit' : ''}`}>
            <span>TAILLIGHTS</span>
          </div>

          {/* Right taillight unit - tapered shape (mirrored) */}
          <svg 
            viewBox="0 0 60 20" 
            className={`c8-taillight-unit c8-right ${startupPhase >= 2 ? 'lit' : ''} ${startupComplete ? 'running' : ''}`}
          >
            {/* Tapered shape - narrower on left (inside), wider on right (outside) */}
            <path 
              d="M5 7 L58 4 L58 16 L5 13 Z" 
              className="c8-led-path"
              fill="url(#c8RedOff)"
            />
            {/* Inner LED strip detail */}
            <path 
              d="M8 8 L55 6 L55 14 L8 12 Z" 
              className="c8-led-inner"
              fill="url(#c8RedOff)"
            />
          </svg>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          <IntegrationHealthStatus compact={true} />

          {/* Supercharg'd Button */}
          <button
            onClick={toggleSuperchargedMode}
            className={`btn-supercharged-xl relative ${supercharged ? 'active' : ''}`}
            data-testid="toggle-supercharged-btn"
            title={supercharged ? "Supercharg'd Mode ON (Español)" : "Enable Supercharg'd Mode"}
          >
            <div className="exhaust-system">
              <div className="exhaust-tip tip-1"></div>
              <div className="exhaust-tip tip-2"></div>
            </div>
            <div className={`xl-flames ${supercharged ? 'active' : ''}`}>
              <div className="flame-core"></div>
              <div className="flame-layer layer-1"></div>
              <div className="flame-layer layer-2"></div>
              <div className="flame-layer layer-3"></div>
              <div className="flame-layer layer-4"></div>
              <div className="flame-layer layer-5"></div>
              <div className="flame-sparks">
                <span></span><span></span><span></span>
                <span></span><span></span><span></span>
                <span></span><span></span>
              </div>
            </div>
            <span className="supercharged-label-xl vice-city-text">
              {supercharged ? 'ESPAÑOL' : 'ENGLISH'}
            </span>
          </button>

          {/* Theme Toggle */}
          <button
            onClick={toggleTheme}
            className="btn-chrome"
            data-testid="toggle-theme-btn"
            title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
          >
            <div className="chrome-inner">
              {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </div>
          </button>

          {/* VS Button */}
          <button
            onClick={() => toggleVS(true)}
            className="btn-vs-header"
            data-testid="open-vs-btn"
            title="VS Battle Cards"
          >
            <Swords className="w-4 h-4" />
            <span className="text-[9px] font-black vice-city-text">VS</span>
          </button>

          {/* Favorites */}
          <button
            onClick={() => toggleFavorites(true)}
            className="btn-icon relative"
            data-testid="open-favorites-btn"
          >
            <Heart className="w-5 h-5 text-muted-foreground" />
            {favorites.length > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full text-[10px] font-bold flex items-center justify-center"
                    style={{ background: '#cc0000', color: 'white', boxShadow: '0 0 10px rgba(255,0,0,0.4)' }}>
                {favorites.length > 9 ? '9+' : favorites.length}
              </span>
            )}
          </button>

          {/* Analytics */}
          <button
            onClick={() => toggleAnalytics(true)}
            className="btn-icon"
            data-testid="open-analytics-btn"
            title="Analytics Dashboard"
          >
            <BarChart3 className="w-5 h-5 text-muted-foreground" />
          </button>

          {/* Check Engine Button - Fixed with proper hood animation and visible icon */}
          <button
            onClick={() => toggleAdminSettings(true)}
            className="btn-check-camaro"
            data-testid="open-admin-settings-btn"
            title="Check Engine - All Settings"
          >
            <div className="camaro-wrapper">
              {/* ZL1 Camaro SVG with working hood */}
              <svg viewBox="0 0 100 40" className="camaro-svg">
                <defs>
                  <linearGradient id="camaroBody" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stopColor="#5a5a6e" />
                    <stop offset="100%" stopColor="#3a3a4a" />
                  </linearGradient>
                  <linearGradient id="camaroWindow" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stopColor="#4a90c2" stopOpacity="0.5" />
                    <stop offset="100%" stopColor="#2a5080" stopOpacity="0.3" />
                  </linearGradient>
                </defs>
                
                {/* Body */}
                <path d="M5 28 L10 22 L30 20 L70 20 L90 22 L95 28 L90 32 L10 32 Z" fill="url(#camaroBody)" />
                
                {/* Roof */}
                <path d="M35 20 L42 12 L65 12 L72 20 Z" fill="url(#camaroBody)" />
                
                {/* Window */}
                <path d="M38 19 L44 13 L63 13 L69 19 Z" fill="url(#camaroWindow)" />
                
                {/* Hood - this will rotate on hover */}
                <g className="camaro-hood-group">
                  <path d="M10 22 L30 20 L35 20 L35 22 Z" fill="#4a4a5a" className="camaro-hood" />
                  <rect x="14" y="19" width="14" height="2.5" rx="0.5" fill="#2a2a35" />
                </g>
                
                {/* Engine glow - visible on hover */}
                <ellipse cx="22" cy="24" rx="10" ry="5" fill="#ff6600" opacity="0" className="camaro-engine-glow" />
                
                {/* Wheels */}
                <circle cx="22" cy="32" r="6" fill="#1a1a22" stroke="#3a3a4a" strokeWidth="1" />
                <circle cx="22" cy="32" r="3.5" fill="#2a2a35" />
                <circle cx="78" cy="32" r="6" fill="#1a1a22" stroke="#3a3a4a" strokeWidth="1" />
                <circle cx="78" cy="32" r="3.5" fill="#2a2a35" />
                
                {/* Headlight */}
                <ellipse cx="7" cy="25" rx="2.5" ry="1.5" fill="#ffdd88" className="camaro-headlight" />
                
                {/* Taillight */}
                <rect x="92" y="24" width="3" height="4" rx="0.5" fill="#ff0000" className="camaro-taillight" />
              </svg>
            </div>
            
            {/* Label with CHECK ENGINE icon */}
            <div className="camaro-label">
              <span>Check</span>
              <AlertTriangle className="check-icon" />
            </div>
          </button>
        </div>
      </div>
    </header>
  );
};

export default Header;

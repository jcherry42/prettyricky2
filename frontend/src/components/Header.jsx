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
        {/* C8 Corvette Taillights - Accurate L-shaped contoured design */}
        <div className="c8-taillights-container" data-testid="taillights-logo">
          {/* Left taillight unit - distinctive C8 L-shape */}
          <svg 
            viewBox="0 0 55 32" 
            className={`c8-taillight-unit c8-left ${startupPhase >= 2 ? 'lit' : ''} ${startupComplete ? 'running' : ''}`}
          >
            <defs>
              <linearGradient id="c8RedGlowL" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#ff3333" />
                <stop offset="50%" stopColor="#dd0000" />
                <stop offset="100%" stopColor="#aa0000" />
              </linearGradient>
              <linearGradient id="c8RedOffL" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#3a0000" />
                <stop offset="100%" stopColor="#200000" />
              </linearGradient>
            </defs>
            {/* Dark housing background */}
            <rect x="0" y="0" width="55" height="32" rx="2" fill="#0a0a0a" />
            {/* Horizontal LED bar - main element */}
            <rect 
              x="2" y="2" 
              width="50" height="10" 
              rx="1.5"
              className="c8-led-main"
              fill="url(#c8RedOffL)"
            />
            {/* Vertical LED element - the "L" stem */}
            <rect 
              x="42" y="14" 
              width="10" height="16" 
              rx="1.5"
              className="c8-led-vertical"
              fill="url(#c8RedOffL)"
            />
            {/* Subtle separator detail */}
            <rect x="41" y="10" width="12" height="6" fill="#0a0a0a" />
          </svg>

          {/* Center text area */}
          <div className={`c8-center-text ${startupPhase >= 3 ? 'lit' : ''}`}>
            <span>TAILLIGHTS</span>
          </div>

          {/* Right taillight unit - mirrored L-shape */}
          <svg 
            viewBox="0 0 55 32" 
            className={`c8-taillight-unit c8-right ${startupPhase >= 2 ? 'lit' : ''} ${startupComplete ? 'running' : ''}`}
          >
            <defs>
              <linearGradient id="c8RedGlowR" x1="100%" y1="0%" x2="0%" y2="0%">
                <stop offset="0%" stopColor="#ff3333" />
                <stop offset="50%" stopColor="#dd0000" />
                <stop offset="100%" stopColor="#aa0000" />
              </linearGradient>
              <linearGradient id="c8RedOffR" x1="100%" y1="0%" x2="0%" y2="0%">
                <stop offset="0%" stopColor="#3a0000" />
                <stop offset="100%" stopColor="#200000" />
              </linearGradient>
            </defs>
            {/* Dark housing background */}
            <rect x="0" y="0" width="55" height="32" rx="2" fill="#0a0a0a" />
            {/* Horizontal LED bar - main element */}
            <rect 
              x="3" y="2" 
              width="50" height="10" 
              rx="1.5"
              className="c8-led-main"
              fill="url(#c8RedOffR)"
            />
            {/* Vertical LED element - the "L" stem (on left side for mirror) */}
            <rect 
              x="3" y="14" 
              width="10" height="16" 
              rx="1.5"
              className="c8-led-vertical"
              fill="url(#c8RedOffR)"
            />
            {/* Subtle separator detail */}
            <rect x="2" y="10" width="12" height="6" fill="#0a0a0a" />
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

          {/* Check Engine Button - ZL1 Camaro with working hood animation */}
          <button
            onClick={() => toggleAdminSettings(true)}
            className="btn-check-zl1"
            data-testid="open-admin-settings-btn"
            title="Check Engine - All Settings"
          >
            <div className="zl1-car-wrapper">
              {/* 2021 ZL1 Camaro Side Profile SVG */}
              <svg viewBox="0 0 120 50" className="zl1-car-svg">
                <defs>
                  <linearGradient id="zl1BodyGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stopColor="#4a4a5a" />
                    <stop offset="50%" stopColor="#3a3a48" />
                    <stop offset="100%" stopColor="#2a2a38" />
                  </linearGradient>
                  <linearGradient id="zl1WindowGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stopColor="#5599cc" stopOpacity="0.6" />
                    <stop offset="100%" stopColor="#336699" stopOpacity="0.4" />
                  </linearGradient>
                  <linearGradient id="zl1HoodGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stopColor="#555566" />
                    <stop offset="100%" stopColor="#404050" />
                  </linearGradient>
                  <linearGradient id="zl1EngineGrad" x1="50%" y1="0%" x2="50%" y2="100%">
                    <stop offset="0%" stopColor="#ff6600" />
                    <stop offset="100%" stopColor="#cc3300" />
                  </linearGradient>
                </defs>
                
                {/* Main Body - aggressive ZL1 profile */}
                <path 
                  d="M8 32 L12 26 L22 24 L38 22 L80 22 L100 24 L108 28 L112 32 L108 38 L12 38 L8 34 Z" 
                  fill="url(#zl1BodyGrad)" 
                  className="zl1-body"
                />
                
                {/* Roof line - fastback style */}
                <path 
                  d="M42 22 L50 14 L78 14 L88 22 Z" 
                  fill="url(#zl1BodyGrad)"
                  className="zl1-roof"
                />
                
                {/* Window */}
                <path 
                  d="M46 21 L52 15 L76 15 L84 21 Z" 
                  fill="url(#zl1WindowGrad)"
                  className="zl1-window"
                />
                
                {/* Hood assembly - animated on hover */}
                <g className="zl1-hood-assembly">
                  {/* Hood panel with power bulge */}
                  <path 
                    d="M12 26 L22 24 L38 22 L42 22 L42 26 L12 28 Z" 
                    fill="url(#zl1HoodGrad)" 
                    className="zl1-hood-panel"
                  />
                  {/* Hood scoop/vent (ZL1 signature) */}
                  <rect x="18" y="23" width="18" height="3" rx="1" fill="#2a2a35" className="zl1-hood-scoop" />
                  <rect x="20" y="24" width="14" height="1" fill="#1a1a22" />
                </g>
                
                {/* Engine bay glow - appears when hood opens */}
                <ellipse 
                  cx="28" cy="30" rx="14" ry="6" 
                  fill="url(#zl1EngineGrad)" 
                  opacity="0" 
                  className="zl1-engine-glow"
                />
                
                {/* Front wheel */}
                <circle cx="28" cy="38" r="8" fill="#151520" stroke="#3a3a4a" strokeWidth="1.5" />
                <circle cx="28" cy="38" r="5" fill="#252530" />
                <circle cx="28" cy="38" r="2" fill="#1a1a22" />
                
                {/* Rear wheel */}
                <circle cx="92" cy="38" r="8" fill="#151520" stroke="#3a3a4a" strokeWidth="1.5" />
                <circle cx="92" cy="38" r="5" fill="#252530" />
                <circle cx="92" cy="38" r="2" fill="#1a1a22" />
                
                {/* Headlight */}
                <path d="M10 28 L14 27 L14 31 L10 32 Z" fill="#ffdd88" className="zl1-headlight" />
                
                {/* Taillight - ZL1 style */}
                <rect x="106" y="28" width="4" height="5" rx="1" fill="#cc0000" className="zl1-taillight" />
              </svg>
            </div>
            
            {/* Label with glowing CHECK ENGINE icon */}
            <div className="zl1-label">
              <AlertTriangle className="zl1-check-icon" />
              <span className="vice-city-text">CHECK</span>
            </div>
          </button>
        </div>
      </div>
    </header>
  );
};

export default Header;

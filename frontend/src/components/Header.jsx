import React, { useState, useEffect, useCallback } from 'react';
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
  // Brake light state - activates on screen tap
  const [brakesPressed, setBrakesPressed] = useState(false);

  useEffect(() => {
    const hasPlayed = sessionStorage.getItem('taillights_startup_played');
    if (hasPlayed) {
      setStartupComplete(true);
      setStartupPhase(3);
      return;
    }

    // C8 startup sequence
    const phases = [
      { delay: 200, phase: 1 },
      { delay: 600, phase: 2 },
      { delay: 1000, phase: 3 },
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

  // Brake light handler - flash on screen tap/click
  const handleBrakePress = useCallback(() => {
    setBrakesPressed(true);
    setTimeout(() => setBrakesPressed(false), 300);
  }, []);

  // Add global click listener for brake lights
  useEffect(() => {
    const handleClick = (e) => {
      // Don't trigger on button clicks (let buttons do their thing)
      if (!e.target.closest('button') && !e.target.closest('a')) {
        handleBrakePress();
      }
    };
    document.addEventListener('click', handleClick);
    document.addEventListener('touchstart', handleClick);
    return () => {
      document.removeEventListener('click', handleClick);
      document.removeEventListener('touchstart', handleClick);
    };
  }, [handleBrakePress]);

  return (
    <header className="header-luxury sticky top-0 z-50 safe-area-top relative">
      <div className="flex items-center justify-between h-16 px-4">
        {/* Left spacer for centering */}
        <div className="flex-1"></div>
        
        {/* C8 Corvette Z06 Taillights - CENTERED */}
        <div className="c8-taillights-container" data-testid="taillights-logo" onClick={handleBrakePress}>
          {/* Left taillight assembly - 4 angular elements */}
          <svg 
            viewBox="0 0 80 24" 
            className={`c8-taillight-unit c8-left ${startupPhase >= 2 ? 'lit' : ''} ${startupComplete ? 'running' : ''} ${brakesPressed ? 'braking' : ''}`}
          >
            <defs>
              <linearGradient id="c8RedGlow" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#ff4444" />
                <stop offset="50%" stopColor="#dd0000" />
                <stop offset="100%" stopColor="#990000" />
              </linearGradient>
              <linearGradient id="c8RedOff" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#330000" />
                <stop offset="100%" stopColor="#1a0000" />
              </linearGradient>
              <linearGradient id="c8BrakeGlow" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#ff0000" />
                <stop offset="50%" stopColor="#ff0000" />
                <stop offset="100%" stopColor="#cc0000" />
              </linearGradient>
            </defs>
            {/* Housing - dark angular shape */}
            <path d="M0 4 L78 0 L80 20 L4 24 Z" fill="#0a0a0a" />
            {/* Element 1 - Outer (turn signal area) */}
            <path d="M2 5 L18 3 L19 19 L4 21 Z" className="c8-element c8-el-1" fill="url(#c8RedOff)" />
            {/* Element 2 - Main brake light */}
            <path d="M22 3 L42 2 L43 18 L23 19 Z" className="c8-element c8-el-2" fill="url(#c8RedOff)" />
            {/* Element 3 - Secondary brake */}
            <path d="M46 2 L62 1 L63 17 L47 18 Z" className="c8-element c8-el-3" fill="url(#c8RedOff)" />
            {/* Element 4 - Inner (reverse area) */}
            <path d="M66 1 L76 1 L77 17 L67 17 Z" className="c8-element c8-el-4" fill="url(#c8RedOff)" />
          </svg>

          {/* Center text */}
          <div className={`c8-center-text ${startupPhase >= 3 ? 'lit' : ''}`}>
            <span>TAILLIGHTS</span>
          </div>

          {/* Right taillight assembly - mirrored 4 elements */}
          <svg 
            viewBox="0 0 80 24" 
            className={`c8-taillight-unit c8-right ${startupPhase >= 2 ? 'lit' : ''} ${startupComplete ? 'running' : ''} ${brakesPressed ? 'braking' : ''}`}
          >
            {/* Housing - mirrored angular shape */}
            <path d="M2 0 L80 4 L76 24 L0 20 Z" fill="#0a0a0a" />
            {/* Element 1 - Inner (reverse area) - mirrored */}
            <path d="M4 1 L14 1 L13 17 L3 17 Z" className="c8-element c8-el-4" fill="url(#c8RedOff)" />
            {/* Element 2 - Secondary brake - mirrored */}
            <path d="M18 1 L34 2 L33 18 L17 17 Z" className="c8-element c8-el-3" fill="url(#c8RedOff)" />
            {/* Element 3 - Main brake light - mirrored */}
            <path d="M38 2 L58 3 L57 19 L37 18 Z" className="c8-element c8-el-2" fill="url(#c8RedOff)" />
            {/* Element 4 - Outer (turn signal) - mirrored */}
            <path d="M62 3 L78 5 L76 21 L61 19 Z" className="c8-element c8-el-1" fill="url(#c8RedOff)" />
          </svg>
        </div>

        {/* Right spacer + Actions */}
        <div className="flex-1 flex items-center justify-end gap-2">
          <IntegrationHealthStatus compact={true} />

          {/* Supercharg'd Button with Flames */}
          <button
            onClick={toggleSuperchargedMode}
            className={`btn-supercharged ${supercharged ? 'active' : ''}`}
            data-testid="toggle-supercharged-btn"
            title={supercharged ? "Supercharg'd Mode ON (Español)" : "Enable Supercharg'd Mode"}
          >
            <div className="exhaust-tip">
              <div className="exhaust-outer">
                <div className="exhaust-inner">
                  <div className="exhaust-core"></div>
                </div>
              </div>
            </div>
            <div className={`flames ${supercharged ? 'active' : ''}`}>
              <div className="flame-core"></div>
              <div className="flame f1"></div>
              <div className="flame f2"></div>
              <div className="flame f3"></div>
              <div className="flame f4"></div>
              <div className="sparks">
                <span></span><span></span><span></span><span></span>
              </div>
            </div>
            <span className="supercharged-label vice-city-text">
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

          {/* Check Engine Button - ZL1 Camaro with BIG hood animation */}
          <button
            onClick={() => toggleAdminSettings(true)}
            className="btn-check-zl1"
            data-testid="open-admin-settings-btn"
            title="Check Engine - All Settings"
          >
            {/* Check engine icon BEHIND the text */}
            <AlertTriangle className="zl1-bg-icon" />
            
            <div className="zl1-car-wrapper">
              {/* 2021 ZL1 Camaro - Hood opens dramatically */}
              <svg viewBox="0 0 100 40" className="zl1-car-svg">
                <defs>
                  <linearGradient id="zl1Body" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stopColor="#5a5a6a" />
                    <stop offset="100%" stopColor="#3a3a4a" />
                  </linearGradient>
                  <linearGradient id="zl1Window" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stopColor="#4a90c2" stopOpacity="0.5" />
                    <stop offset="100%" stopColor="#2a5080" stopOpacity="0.3" />
                  </linearGradient>
                  <linearGradient id="zl1Engine" x1="50%" y1="0%" x2="50%" y2="100%">
                    <stop offset="0%" stopColor="#ff8800" />
                    <stop offset="50%" stopColor="#ff5500" />
                    <stop offset="100%" stopColor="#cc2200" />
                  </linearGradient>
                </defs>
                
                {/* Engine bay glow - visible when hood opens */}
                <ellipse cx="22" cy="28" rx="14" ry="8" fill="url(#zl1Engine)" className="zl1-engine-glow" />
                
                {/* Main body */}
                <path d="M5 28 L10 22 L30 20 L70 20 L90 22 L95 28 L90 32 L10 32 Z" fill="url(#zl1Body)" />
                
                {/* Roof */}
                <path d="M35 20 L42 12 L65 12 L72 20 Z" fill="url(#zl1Body)" />
                
                {/* Window */}
                <path d="M38 19 L44 13 L63 13 L69 19 Z" fill="url(#zl1Window)" />
                
                {/* Hood assembly - PIVOTS OPEN on hover */}
                <g className="zl1-hood-assembly">
                  <path d="M10 22 L30 20 L35 20 L35 24 L10 26 Z" fill="#4a4a5a" className="zl1-hood-panel" />
                  {/* Hood scoop */}
                  <rect x="14" y="20" width="14" height="3" rx="0.5" fill="#2a2a3a" />
                  <rect x="16" y="21" width="10" height="1" fill="#1a1a2a" />
                </g>
                
                {/* Wheels */}
                <circle cx="22" cy="32" r="6" fill="#1a1a22" stroke="#3a3a4a" strokeWidth="1" />
                <circle cx="22" cy="32" r="3.5" fill="#2a2a35" />
                <circle cx="78" cy="32" r="6" fill="#1a1a22" stroke="#3a3a4a" strokeWidth="1" />
                <circle cx="78" cy="32" r="3.5" fill="#2a2a35" />
                
                {/* Headlight */}
                <ellipse cx="7" cy="25" rx="2.5" ry="1.5" fill="#ffdd88" className="zl1-headlight" />
                
                {/* Taillight */}
                <rect x="92" y="24" width="3" height="4" rx="0.5" fill="#ff0000" className="zl1-taillight" />
              </svg>
            </div>
            
            {/* Label */}
            <span className="zl1-label vice-city-text">CHECK</span>
          </button>
        </div>
      </div>
    </header>
  );
};

export default Header;

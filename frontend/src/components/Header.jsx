import React, { useState, useEffect, useCallback } from 'react';
import { Sun, Moon, AlertTriangle } from 'lucide-react';
import { useSales } from '../context/SalesContext';
import { IntegrationHealthStatus } from './IntegrationHealthStatus';
import { DataHealthIndicator } from './DataHealthIndicator';
import { playNotificationSound, getSoundPreferences } from '../utils/notificationSound';

export const Header = () => {
  const { 
    toggleAdminSettings,
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
    const hasPlayed = sessionStorage.getItem('superchargd_startup_played');
    if (hasPlayed) {
      setStartupComplete(true);
      setStartupPhase(5);
      return;
    }

    // JDM-style startup sequence - outer lights first, then inner, then text
    // Mimics R34 Skyline boot-up sequence
    const phases = [
      { delay: 100, phase: 1 },   // Outer lights dim glow
      { delay: 400, phase: 2 },   // Outer lights full brightness
      { delay: 700, phase: 3 },   // Inner lights dim glow
      { delay: 1000, phase: 4 },  // Inner lights full brightness
      { delay: 1300, phase: 5 },  // Text illuminates
    ];

    phases.forEach(({ delay, phase }) => {
      setTimeout(() => {
        setStartupPhase(phase);
        if (phase === 5) {
          const prefs = getSoundPreferences();
          if (prefs.enabled) {
            playNotificationSound(prefs.profile);
          }
          setTimeout(() => {
            setStartupComplete(true);
            sessionStorage.setItem('superchargd_startup_played', 'true');
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
      <div className="flex items-center h-16 px-4">
        {/* Left side - Health Indicators */}
        <div className="flex items-center gap-2 mr-4">
          <IntegrationHealthStatus compact={true} />
          <DataHealthIndicator />
        </div>
        
        {/* Center - R34 Skyline Taillights */}
        <div className="flex-1 flex justify-center">
          <div className="r34-taillights-container" data-testid="taillights-logo" onClick={handleBrakePress}>
            {/* Left taillight cluster - 2 circular lights (outer larger) */}
            <div className={`r34-cluster left ${brakesPressed ? 'braking' : ''}`}>
              <div className={`r34-light outer ${startupPhase >= 1 ? 'dim' : ''} ${startupPhase >= 2 ? 'lit' : ''}`}>
                <div className="r34-ring"></div>
                <div className="r34-center"></div>
              </div>
              <div className={`r34-light inner ${startupPhase >= 3 ? 'dim' : ''} ${startupPhase >= 4 ? 'lit' : ''}`}>
                <div className="r34-ring"></div>
                <div className="r34-center"></div>
              </div>
            </div>

            {/* Center text */}
            <div className={`r34-center-text ${startupPhase >= 5 ? 'lit' : ''}`}>
              <span>SUPERCHARG'D</span>
            </div>

            {/* Right taillight cluster - 2 circular lights (inner smaller) */}
            <div className={`r34-cluster right ${brakesPressed ? 'braking' : ''}`}>
              <div className={`r34-light inner ${startupPhase >= 3 ? 'dim' : ''} ${startupPhase >= 4 ? 'lit' : ''}`}>
                <div className="r34-ring"></div>
                <div className="r34-center"></div>
              </div>
              <div className={`r34-light outer ${startupPhase >= 1 ? 'dim' : ''} ${startupPhase >= 2 ? 'lit' : ''}`}>
                <div className="r34-ring"></div>
                <div className="r34-center"></div>
              </div>
            </div>
          </div>
        </div>

        {/* Right side - Actions */}
        <div className="flex items-center justify-end gap-2">
          {/* Sport Mode Button with Flames */}
          <button
            onClick={toggleSuperchargedMode}
            className={`btn-supercharged ${supercharged ? 'active' : ''}`}
            data-testid="toggle-supercharged-btn"
            title={supercharged ? "Sport Mode ON (Español)" : "Enable Sport Mode"}
          >
            {/* Realistic side-view exhaust tip */}
            <div className="exhaust-tip-side">
              <div className="exhaust-pipe"></div>
              <div className="exhaust-opening"></div>
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
              {supercharged ? 'ESPAÑOL' : 'SPORT'}
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

          {/* Check Engine Button - ZL1 Camaro with hood animation */}
          <button
            onClick={() => toggleAdminSettings(true)}
            className="btn-check-zl1"
            data-testid="open-admin-settings-btn"
            title="Check Engine - All Settings"
          >
            <div className="zl1-car-wrapper">
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
                
                {/* Engine bay glow - reveals on hover - BRIGHT */}
                <ellipse cx="22" cy="26" rx="16" ry="10" fill="url(#zl1Engine)" className="zl1-engine-glow" />
                <ellipse cx="22" cy="26" rx="10" ry="6" fill="#ffcc00" className="zl1-engine-glow" style={{filter: 'blur(2px)'}} />
                
                {/* Main body */}
                <path d="M5 28 L10 22 L30 20 L70 20 L90 22 L95 28 L90 32 L10 32 Z" fill="url(#zl1Body)" />
                
                {/* Roof */}
                <path d="M35 20 L42 12 L65 12 L72 20 Z" fill="url(#zl1Body)" />
                
                {/* Window */}
                <path d="M38 19 L44 13 L63 13 L69 19 Z" fill="url(#zl1Window)" />
                
                {/* Hood assembly - OPENS on hover */}
                <g className="zl1-hood-group">
                  <path d="M10 22 L30 20 L35 20 L35 24 L10 26 Z" fill="#4a4a5a" className="zl1-hood" />
                  <rect x="14" y="20" width="14" height="3" rx="0.5" fill="#2a2a3a" />
                </g>
                
                {/* Wheels */}
                <circle cx="22" cy="32" r="6" fill="#1a1a22" stroke="#3a3a4a" strokeWidth="1" />
                <circle cx="78" cy="32" r="6" fill="#1a1a22" stroke="#3a3a4a" strokeWidth="1" />
                
                {/* Headlight */}
                <ellipse cx="7" cy="25" rx="2.5" ry="1.5" fill="#ffdd88" className="zl1-headlight" />
                
                {/* Taillight */}
                <rect x="92" y="24" width="3" height="4" rx="0.5" fill="#ff0000" className="zl1-taillight" />
              </svg>
            </div>
            
            <div className="zl1-label">
              <span>CHECK</span>
              <AlertTriangle className="w-3 h-3" />
            </div>
          </button>
        </div>
      </div>
    </header>
  );
};

export default Header;

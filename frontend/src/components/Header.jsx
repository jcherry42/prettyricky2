import React, { useState, useEffect, useCallback } from 'react';
import { Sun, Moon, AlertTriangle } from 'lucide-react';
import { useSales } from '../context/SalesContext';
import { IntegrationHealthStatus } from './IntegrationHealthStatus';
import { DataHealthIndicator } from './DataHealthIndicator';
import { VinScanner } from './VinScanner';
import { CommandCenter } from './CommandCenter';
import { getSoundPreferences } from '../utils/notificationSound';

// Startup sound
const playStartupSound = () => {
  try {
    const prefs = getSoundPreferences();
    if (!prefs.enabled) return;
    
    const audio = new Audio('/sounds/startup.wav');
    audio.volume = prefs.volume || 0.7;
    audio.play().catch(() => {});
  } catch (e) {
    console.warn('Startup sound failed:', e);
  }
};

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
  // VIN Scanner modal state
  const [vinScannerOpen, setVinScannerOpen] = useState(false);
  // Command Center modal state
  const [commandCenterOpen, setCommandCenterOpen] = useState(false);

  useEffect(() => {
    const hasPlayed = sessionStorage.getItem('superchargd_startup_played');
    if (hasPlayed) {
      // Use a ref or separate state initialization to avoid setState in effect
      return;
    }

    // Play startup sound at beginning
    playStartupSound();

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
        
        {/* OnStar-style VIN Scanner Button */}
        <button
          onClick={() => setVinScannerOpen(true)}
          className="btn-onstar"
          data-testid="vin-scanner-btn"
          title="VIN Scanner"
        >
          <div className="onstar-inner">
            <svg viewBox="0 0 24 24" className="onstar-icon">
              <circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" strokeWidth="1.5" />
              <circle cx="12" cy="12" r="3" fill="currentColor" />
              <path d="M12 2v4M12 18v4M2 12h4M18 12h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </div>
          <span className="onstar-label">VIN</span>
        </button>
        
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
              <span>SUPERCHARG&apos;D</span>
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

          {/* Check Engine Button - Simplified with amber glow */}
          <button
            onClick={() => setCommandCenterOpen(true)}
            className="btn-check-engine-simple"
            data-testid="open-admin-settings-btn"
            title="Command Center"
          >
            <div className="check-icon-wrapper">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <span className="check-label">CHECK</span>
          </button>
        </div>
      </div>
      
      {/* VIN Scanner Modal */}
      <VinScanner isOpen={vinScannerOpen} onClose={() => setVinScannerOpen(false)} />
      
      {/* Command Center Modal */}
      <CommandCenter isOpen={commandCenterOpen} onClose={() => setCommandCenterOpen(false)} />
    </header>
  );
};

export default Header;

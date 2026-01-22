import React, { useState, useEffect, useCallback } from 'react';
import { Sun, Moon, AlertTriangle, Flame } from 'lucide-react';
import { useSales } from '../context/SalesContext';
import { VinScanner } from './VinScanner';
import { CommandCenter } from './CommandCenter';
import { getSoundPreferences } from '../utils/notificationSound';

// Startup sound with smooth fade-out effect
const playStartupSound = () => {
  try {
    const prefs = getSoundPreferences();
    if (!prefs.enabled) return;
    
    const audio = new Audio('/sounds/startup.wav');
    const targetVolume = prefs.volume || 0.7;
    audio.volume = targetVolume;
    
    // Start fading earlier and more aggressively (last 2 seconds)
    const fadeStartTime = 2.0;
    let fadeInterval = null;
    
    audio.addEventListener('loadedmetadata', () => {
      const duration = audio.duration;
      const fadeStartAt = Math.max(0, duration - fadeStartTime);
      
      fadeInterval = setInterval(() => {
        if (audio.currentTime >= fadeStartAt) {
          const timeRemaining = duration - audio.currentTime;
          const fadeProgress = Math.max(0, timeRemaining / fadeStartTime);
          // Use exponential fade for smoother perception
          audio.volume = targetVolume * (fadeProgress * fadeProgress);
          
          if (fadeProgress <= 0.01) {
            clearInterval(fadeInterval);
            audio.pause();
          }
        }
      }, 50); // Check every 50ms for smooth fade
    });
    
    audio.addEventListener('ended', () => {
      if (fadeInterval) clearInterval(fadeInterval);
    });
    
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

  // Startup animation state - check session storage for initial values
  const hasPlayedStartup = typeof window !== 'undefined' && sessionStorage.getItem('superchargd_startup_played');
  const [startupComplete, setStartupComplete] = useState(hasPlayedStartup ? true : false);
  const [startupPhase, setStartupPhase] = useState(hasPlayedStartup ? 5 : 0);
  // Brake light state - activates on screen tap
  const [brakesPressed, setBrakesPressed] = useState(false);
  // VIN Scanner modal state
  const [vinScannerOpen, setVinScannerOpen] = useState(false);
  // Command Center modal state
  const [commandCenterOpen, setCommandCenterOpen] = useState(false);

  useEffect(() => {
    const hasPlayed = sessionStorage.getItem('superchargd_startup_played');
    if (hasPlayed) {
      // Already initialized via useState
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
    <header className="header-luxury fixed top-0 left-0 right-0 z-50 safe-area-top">
      {/* Row 1: Taillights Logo */}
      <div className="header-row-1">
        <div className="r34-taillights-container" data-testid="taillights-logo" onClick={handleBrakePress}>
          {/* Left taillight cluster */}
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

          {/* Right taillight cluster */}
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

      {/* Row 2: Action Buttons */}
      <div className="header-row-2">
        {/* VIN Scanner - Electric Green */}
        <button
          onClick={() => setVinScannerOpen(true)}
          className="header-btn electric-green"
          data-testid="vin-scanner-btn"
        >
          <svg viewBox="0 0 24 24" className="header-btn-icon" fill="none" stroke="currentColor" strokeWidth="1.5">
            <circle cx="12" cy="12" r="8" />
            <circle cx="12" cy="12" r="2" fill="currentColor" stroke="none" />
            <line x1="12" y1="4" x2="12" y2="7" strokeLinecap="round" />
            <line x1="12" y1="17" x2="12" y2="20" strokeLinecap="round" />
            <line x1="4" y1="12" x2="7" y2="12" strokeLinecap="round" />
            <line x1="17" y1="12" x2="20" y2="12" strokeLinecap="round" />
          </svg>
          <span>VIN</span>
        </button>

        {/* Command Center */}
        <button
          onClick={() => setCommandCenterOpen(true)}
          className="header-btn amber"
          data-testid="open-admin-settings-btn"
        >
          <AlertTriangle className="header-btn-icon" />
          <span>CHECK</span>
        </button>

        {/* Sport Mode with Fire Effect */}
        <button
          onClick={toggleSuperchargedMode}
          className={`sport-fire-btn ${supercharged ? 'active' : ''}`}
          data-testid="toggle-supercharged-btn"
        >
          <div className="flame-container">
            <div className="flame flame-1"></div>
            <div className="flame flame-2"></div>
            <div className="flame flame-3"></div>
            <div className="spark spark-1"></div>
            <div className="spark spark-2"></div>
            <div className="spark spark-3"></div>
            <div className="spark spark-4"></div>
          </div>
          <svg viewBox="0 0 24 24" className="header-btn-icon" fill="none" stroke="currentColor" strokeWidth="1.5">
            {/* Simple race car icon */}
            <path d="M5 12h14" strokeLinecap="round" />
            <path d="M5 12c0-.55.45-1 1-1h2l2-3h4l2 3h2c.55 0 1 .45 1 1" strokeLinecap="round" strokeLinejoin="round" />
            <circle cx="7.5" cy="14.5" r="1.5" fill="currentColor" stroke="none" />
            <circle cx="16.5" cy="14.5" r="1.5" fill="currentColor" stroke="none" />
            <path d="M4 12v2c0 .55.45 1 1 1h14c.55 0 1-.45 1-1v-2" strokeLinecap="round" />
          </svg>
          <span className="sport-label">{supercharged ? 'ESP' : 'SPORT'}</span>
        </button>

        {/* Theme Toggle */}
        <button
          onClick={toggleTheme}
          className="header-btn"
          data-testid="toggle-theme-btn"
        >
          {theme === 'dark' ? <Sun className="header-btn-icon" /> : <Moon className="header-btn-icon" />}
          <span>{theme === 'dark' ? 'LIGHT' : 'DARK'}</span>
        </button>
      </div>
      
      {/* VIN Scanner Modal */}
      <VinScanner isOpen={vinScannerOpen} onClose={() => setVinScannerOpen(false)} />
      
      {/* Command Center Modal */}
      <CommandCenter isOpen={commandCenterOpen} onClose={() => setCommandCenterOpen(false)} />
    </header>
  );
};

export default Header;

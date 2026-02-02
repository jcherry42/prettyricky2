import React, { useState, useEffect, useCallback, memo } from 'react';
import { AlertTriangle } from 'lucide-react';
import { useSales } from '../context/SalesContext';
import { LicenseScanner } from './LicenseScanner';
import { CommandCenter } from './CommandCenter';
import IntakeHub from './IntakeHub';
import VehicleInventoryModal from './VehicleInventoryModal';

// NOTE: Keep this file lean and avoid statically importing the full sound module.
// The sound module is dynamically imported elsewhere so it can be code-split.
const getSoundPreferences = () => {
  try {
    const stored = localStorage.getItem('superchargd_sound_preferences');
    return stored ? JSON.parse(stored) : { enabled: true, profile: 'merica', volume: 0.7 };
  } catch {
    return { enabled: true, profile: 'merica', volume: 0.7 };
  }
};

// Startup sound with smooth gradual fade-out effect
const playStartupSound = () => {
  try {
    const prefs = getSoundPreferences();
    if (!prefs.enabled) return;

    // Avoid attempting audio playback in automated test environments.
    if (typeof navigator !== 'undefined' && navigator.webdriver) return;
    
    const audio = new Audio('/sounds/startup.wav');
    const targetVolume = prefs.volume || 0.7;
    audio.volume = targetVolume;
    
    // Start fading at 60% of the track, fade over the remaining 40%
    // This creates a gradual, natural fade that starts earlier
    let fadeInterval = null;
    let fadeStarted = false;
    
    audio.addEventListener('loadedmetadata', () => {
      const duration = audio.duration;
      const fadeStartAt = duration * 0.6; // Start fading at 60% of the track
      const fadeDuration = duration - fadeStartAt; // Remaining 40% is fade
      
      fadeInterval = setInterval(() => {
        const currentTime = audio.currentTime;
        
        if (currentTime >= fadeStartAt && !fadeStarted) {
          fadeStarted = true;
        }
        
        if (fadeStarted) {
          const fadeElapsed = currentTime - fadeStartAt;
          const fadeProgress = 1 - (fadeElapsed / fadeDuration); // 1 to 0
          
          // Use cubic easing for smoother, more natural fade
          // This makes the fade start slow and accelerate at the end
          const easedProgress = fadeProgress * fadeProgress * fadeProgress;
          audio.volume = Math.max(0, targetVolume * easedProgress);
          
          if (fadeProgress <= 0.02 || audio.volume < 0.01) {
            clearInterval(fadeInterval);
            audio.pause();
            audio.volume = 0;
          }
        }
      }, 30); // Check every 30ms for very smooth fade
    });
    
    audio.addEventListener('ended', () => {
      if (fadeInterval) clearInterval(fadeInterval);
    });
    
    audio.addEventListener('error', () => {
      if (fadeInterval) clearInterval(fadeInterval);
    });
    
    audio.play().catch(() => {});
  } catch {
    // Startup sound failed - silent
  }
};

export const Header = () => {
  const { 
    toggleAdminSettings,
    supercharged,
    toggleSuperchargedMode,
  } = useSales();

  // Startup animation state - check session storage for initial values
  const hasPlayedStartup = typeof window !== 'undefined' && sessionStorage.getItem('superchargd_startup_played');
  const [startupComplete, setStartupComplete] = useState(hasPlayedStartup ? true : false);
  const [startupPhase, setStartupPhase] = useState(hasPlayedStartup ? 5 : 0);
  // Brake light state - activates on screen tap
  const [brakesPressed, setBrakesPressed] = useState(false);
  // License Scanner modal
  const [licenseScannerOpen, setLicenseScannerOpen] = useState(false);
  // Intake Hub (License + VIN Scanner)
  const [intakeOpen, setIntakeOpen] = useState(false);
  // Command Center modal state
  const [commandCenterOpen, setCommandCenterOpen] = useState(false);

  // Local inventory modal
  const [inventoryOpen, setInventoryOpen] = useState(false);

  useEffect(() => {

    const hasPlayed = sessionStorage.getItem('superchargd_startup_played');
    if (hasPlayed) {
      // Already initialized via useState
      return;
    }

    // Play startup sound only after an explicit user gesture.
    // This avoids browser autoplay restrictions and prevents aborted media requests.
    const handleFirstInteraction = () => {
      playStartupSound();
      window.removeEventListener('pointerdown', handleFirstInteraction);
      window.removeEventListener('keydown', handleFirstInteraction);
    };
    // Use capture so it fires even if UI elements stop propagation.
    window.addEventListener('pointerdown', handleFirstInteraction, { once: true, capture: true });
    window.addEventListener('keydown', handleFirstInteraction, { once: true, capture: true });

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
        {/* Intake Hub - License + VIN Scanner */}
        <button
          onClick={() => setIntakeOpen(true)}
          className="header-btn electric-green"
          data-testid="intake-scanner-btn"
        >
          <svg viewBox="0 0 24 24" className="header-btn-icon" fill="none" stroke="currentColor" strokeWidth="1.5">
            <rect x="3" y="5" width="18" height="14" rx="2" />
            <circle cx="9" cy="10" r="2" />
            <path d="M14 9h4M14 12h4M9 15h6" strokeLinecap="round" />
          </svg>
          <span>INTAKE</span>
        </button>

        {/* Command Center */}
        <button
          onClick={() => setCommandCenterOpen(true)}
          className="header-btn amber"
          data-testid="open-command-center"
        >
          <AlertTriangle className="header-btn-icon" />
          <span>CHECK</span>
        </button>

        {/* Sport Mode with Fire Effect */}
        <button
          onClick={() => {
            if (!supercharged) {
              // Play sound only when activating Sport Mode
              import('../utils/notificationSound').then(mod => {
                mod.playSportModeSound?.();
              }).catch(() => {});
            }
            toggleSuperchargedMode();
          }}
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
          <svg
            viewBox="0 0 24 24"
            className={`header-btn-icon sport-icon ${supercharged ? 'sport-icon-active' : ''}`}
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
          >
            {/* Simple race car icon */}
            <path d="M5 12h14" strokeLinecap="round" />
            <path
              d="M5 12c0-.55.45-1 1-1h2l2-3h4l2 3h2c.55 0 1 .45 1 1"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <circle cx="7.5" cy="14.5" r="1.5" fill="currentColor" stroke="none" />
            <circle cx="16.5" cy="14.5" r="1.5" fill="currentColor" stroke="none" />
            <path d="M4 12v2c0 .55.45 1 1 1h14c.55 0 1-.45 1-1v-2" strokeLinecap="round" />
          </svg>

          {!supercharged && <span className="sport-label">SPORT</span>}

        </button>

        {/* Local Inventory */}
        <button
          onClick={() => setInventoryOpen(true)}
          className={`header-btn inventory ${inventoryOpen ? 'in-use' : ''}`}
          data-testid="open-inventory-btn"
          aria-label="Open local inventory"
        >
          <div className="wheel" aria-hidden="true">
            <div className="wheel-rim" />
            <div className="wheel-spokes">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className={`spoke spoke-${i + 1}`} />
              ))}
            </div>
            <div className="wheel-hub" />
          </div>
        </button>
      </div>


      <VehicleInventoryModal isOpen={inventoryOpen} onClose={() => setInventoryOpen(false)} />

      
      {/* Intake Hub: License & VIN Scanner */}
      <IntakeHub 
        isOpen={intakeOpen} 
        onClose={() => setIntakeOpen(false)} 
        onOpenLicenseScanner={() => {
          setIntakeOpen(false);
          setLicenseScannerOpen(true);
        }}
      />

      {/* License Scanner Modal */}
      <LicenseScanner 
        isOpen={licenseScannerOpen} 
        onClose={() => setLicenseScannerOpen(false)} 
      />
      
      {/* Command Center Modal */}
      <CommandCenter isOpen={commandCenterOpen} onClose={() => setCommandCenterOpen(false)} />
    </header>
  );
};

export default memo(Header);

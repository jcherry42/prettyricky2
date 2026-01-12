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
      <div className="flex items-center h-16 px-4">
        {/* Left side - Health Indicator */}
        <div className="flex items-center mr-4">
          <IntegrationHealthStatus compact={true} />
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
              <span>TAILLIGHTS</span>
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
          {/* Supercharg'd Button with Flames */}
          <button
            onClick={toggleSuperchargedMode}
            className={`btn-supercharged ${supercharged ? 'active' : ''}`}
            data-testid="toggle-supercharged-btn"
            title={supercharged ? "Supercharg'd Mode ON (Español)" : "Enable Supercharg'd Mode"}
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

          {/* Check Engine Button - Compact inline style */}
          <button
            onClick={() => toggleAdminSettings(true)}
            className="btn-check-engine"
            data-testid="open-admin-settings-btn"
            title="Check Engine - All Settings"
          >
            <span>CHECK</span>
            <AlertTriangle className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </header>
  );
};

export default Header;

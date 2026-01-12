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
    // Check if startup has already played this session
    const hasPlayed = sessionStorage.getItem('taillights_startup_played');
    if (hasPlayed) {
      setStartupComplete(true);
      setStartupPhase(4);
      return;
    }

    // C8 Corvette startup sequence - sweeps from center outward
    const phases = [
      { delay: 100, phase: 1 },   // Center text glows
      { delay: 400, phase: 2 },   // Inner segments light
      { delay: 700, phase: 3 },   // Mid segments light
      { delay: 1000, phase: 4 },  // Outer segments + complete
    ];

    phases.forEach(({ delay, phase }) => {
      setTimeout(() => {
        setStartupPhase(phase);
        if (phase === 4) {
          // Play engine sound on final phase
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
        {/* C8 Corvette Full-Width Taillight Bar - Accurate Design */}
        <div className={`c8-taillight-strip ${startupComplete ? 'running' : ''}`} data-testid="taillights-logo">
          {/* Left outer wing */}
          <div className={`c8-wing c8-wing-left ${startupPhase >= 4 ? 'lit' : ''}`}>
            <div className="c8-led"></div>
          </div>
          
          {/* Left mid section */}
          <div className={`c8-mid c8-mid-left ${startupPhase >= 3 ? 'lit' : ''}`}>
            <div className="c8-led"></div>
          </div>
          
          {/* Left inner section */}
          <div className={`c8-inner c8-inner-left ${startupPhase >= 2 ? 'lit' : ''}`}>
            <div className="c8-led"></div>
          </div>
          
          {/* Center black section with TAILLIGHTS text */}
          <div className={`c8-center ${startupPhase >= 1 ? 'lit' : ''}`}>
            <span className="c8-text">TAILLIGHTS</span>
          </div>
          
          {/* Right inner section */}
          <div className={`c8-inner c8-inner-right ${startupPhase >= 2 ? 'lit' : ''}`}>
            <div className="c8-led"></div>
          </div>
          
          {/* Right mid section */}
          <div className={`c8-mid c8-mid-right ${startupPhase >= 3 ? 'lit' : ''}`}>
            <div className="c8-led"></div>
          </div>
          
          {/* Right outer wing */}
          <div className={`c8-wing c8-wing-right ${startupPhase >= 4 ? 'lit' : ''}`}>
            <div className="c8-led"></div>
          </div>
        </div>

        {/* Actions - No status indicator, no dealership name */}
        <div className="flex items-center gap-2">
          {/* CRM Integration Health Status */}
          <IntegrationHealthStatus compact={true} />

          {/* Supercharg'd Mode Toggle - Extra Long with Exhaust Flames */}
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
              {theme === 'dark' ? (
                <Sun className="w-4 h-4" />
              ) : (
                <Moon className="w-4 h-4" />
              )}
            </div>
          </button>

          {/* VS Battle Card button */}
          <button
            onClick={() => toggleVS(true)}
            className="btn-vs-header"
            data-testid="open-vs-btn"
            title="VS Battle Cards"
          >
            <Swords className="w-4 h-4" />
            <span className="text-[9px] font-black vice-city-text">VS</span>
          </button>

          {/* Favorites button */}
          <button
            onClick={() => toggleFavorites(true)}
            className="btn-icon relative"
            data-testid="open-favorites-btn"
          >
            <Heart className="w-5 h-5 text-muted-foreground" />
            {favorites.length > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full text-[10px] font-bold flex items-center justify-center"
                    style={{
                      background: 'hsla(0, 70%, 50%, 1)',
                      color: 'white',
                      boxShadow: '0 0 10px hsla(0, 100%, 50%, 0.4)'
                    }}>
                {favorites.length > 9 ? '9+' : favorites.length}
              </span>
            )}
          </button>

          {/* Analytics button */}
          <button
            onClick={() => toggleAnalytics(true)}
            className="btn-icon"
            data-testid="open-analytics-btn"
            title="Analytics Dashboard"
          >
            <BarChart3 className="w-5 h-5 text-muted-foreground" />
          </button>

          {/* Check Engine - Improved ZL1 Camaro Style */}
          <button
            onClick={() => toggleAdminSettings(true)}
            className="btn-check-zl1-v2"
            data-testid="open-admin-settings-btn"
            title="Check Engine - All Settings"
          >
            <div className="zl1-v2-wrapper">
              {/* Improved ZL1 Camaro Side Profile */}
              <svg viewBox="0 0 120 45" className="zl1-svg">
                {/* Car body */}
                <defs>
                  <linearGradient id="bodyGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stopColor="hsl(220, 15%, 50%)" />
                    <stop offset="100%" stopColor="hsl(220, 15%, 35%)" />
                  </linearGradient>
                  <linearGradient id="windowGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stopColor="hsl(200, 60%, 50%)" stopOpacity="0.6" />
                    <stop offset="100%" stopColor="hsl(210, 70%, 30%)" stopOpacity="0.4" />
                  </linearGradient>
                  <linearGradient id="hoodGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="hsl(220, 15%, 48%)" />
                    <stop offset="100%" stopColor="hsl(220, 15%, 42%)" />
                  </linearGradient>
                </defs>
                
                {/* Lower body */}
                <path 
                  d="M8 32 L12 26 L35 24 L85 24 L108 26 L112 32 L108 35 L12 35 Z" 
                  fill="url(#bodyGrad)" 
                  className="zl1-lower"
                />
                
                {/* Roof/cabin */}
                <path 
                  d="M42 24 L48 16 L78 16 L84 24 Z" 
                  fill="url(#bodyGrad)" 
                  className="zl1-roof"
                />
                
                {/* Window */}
                <path 
                  d="M46 23 L50 17 L76 17 L80 23 Z" 
                  fill="url(#windowGrad)" 
                  className="zl1-window"
                />
                
                {/* Hood (animated) */}
                <path 
                  d="M12 26 L35 24 L42 24 L42 26 Z" 
                  fill="url(#hoodGrad)" 
                  className="zl1-hood-svg"
                />
                
                {/* Hood scoop */}
                <rect x="18" y="23" width="18" height="3" rx="1" fill="hsl(220, 15%, 25%)" className="zl1-scoop" />
                
                {/* Front wheel */}
                <circle cx="28" cy="35" r="8" fill="hsl(220, 10%, 18%)" stroke="hsl(220, 10%, 35%)" strokeWidth="1" />
                <circle cx="28" cy="35" r="5" fill="hsl(220, 10%, 25%)" />
                <circle cx="28" cy="35" r="2" fill="hsl(220, 10%, 40%)" />
                
                {/* Rear wheel */}
                <circle cx="92" cy="35" r="8" fill="hsl(220, 10%, 18%)" stroke="hsl(220, 10%, 35%)" strokeWidth="1" />
                <circle cx="92" cy="35" r="5" fill="hsl(220, 10%, 25%)" />
                <circle cx="92" cy="35" r="2" fill="hsl(220, 10%, 40%)" />
                
                {/* Headlight */}
                <ellipse cx="10" cy="28" rx="3" ry="2" fill="hsl(45, 100%, 75%)" className="zl1-headlight-svg" />
                
                {/* Taillight */}
                <rect x="108" y="27" width="4" height="5" rx="1" fill="hsl(0, 100%, 50%)" className="zl1-taillight-svg" />
                
                {/* Engine glow (hidden by default) */}
                <ellipse cx="25" cy="28" rx="12" ry="6" fill="hsl(30, 100%, 50%)" opacity="0" className="zl1-engine-glow-svg" />
              </svg>
            </div>
            
            <div className="zl1-v2-label">
              <span className="vice-city-text">Check</span>
              <AlertTriangle className="w-4 h-4 check-engine-light" />
            </div>
          </button>
        </div>
      </div>
    </header>
  );
};

export default Header;

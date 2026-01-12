import React from 'react';
import { Heart, Sun, Moon, Flame, Swords, BarChart3 } from 'lucide-react';
import { useSales } from '../context/SalesContext';
import { IntegrationHealthStatus } from './IntegrationHealthStatus';

export const Header = () => {
  const { 
    isOffline, 
    dealership, 
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

  return (
    <header className="header-luxury sticky top-0 z-50 safe-area-top relative">
      <div className="flex items-center justify-between h-16 px-4">
        {/* Taillights Logo - Porsche 911 Style */}
        <div className="flex items-center gap-3">
          <div className="taillights-logo" data-testid="taillights-logo">
            {/* Left taillight cluster */}
            <div className="taillight-cluster left">
              <div className="taillight-bar bar-1"></div>
              <div className="taillight-bar bar-2"></div>
              <div className="taillight-bar bar-3"></div>
            </div>
            {/* Right taillight cluster */}
            <div className="taillight-cluster right">
              <div className="taillight-bar bar-1"></div>
              <div className="taillight-bar bar-2"></div>
              <div className="taillight-bar bar-3"></div>
            </div>
            {/* Center connector glow */}
            <div className="taillight-connector"></div>
          </div>
          <div>
            <h1 className="text-lg font-bold text-luxury tracking-widest">TAILLIGHTS</h1>
            <p className="text-xs text-muted-foreground truncate max-w-[140px]">
              {dealership.name}
            </p>
          </div>
        </div>

        {/* Status & Actions */}
        <div className="flex items-center gap-2">
          {/* CRM Integration Health Status */}
          <IntegrationHealthStatus compact={true} />

          {/* Online/Offline indicator */}
          <div className="status-indicator">
            {isOffline ? (
              <>
                <span className="status-dot offline" />
                <span className="text-warning">Offline</span>
              </>
            ) : (
              <>
                <span className="status-dot online" />
                <span className="text-chrome">Ready</span>
              </>
            )}
          </div>

          {/* Supercharg'd Mode Toggle - Enhanced Animated Flames */}
          <button
            onClick={toggleSuperchargedMode}
            className={`btn-supercharged-v2 relative ${supercharged ? 'active' : ''}`}
            data-testid="toggle-supercharged-btn"
            title={supercharged ? "Supercharg'd Mode ON (Español)" : "Enable Supercharg'd Mode"}
          >
            <div className="exhaust-pipe">
              <div className="pipe-opening"></div>
            </div>
            <div className={`flames-v2 ${supercharged ? 'active' : ''}`}>
              <div className="flame-core"></div>
              <div className="flame-outer flame-1"></div>
              <div className="flame-outer flame-2"></div>
              <div className="flame-outer flame-3"></div>
              <div className="flame-outer flame-4"></div>
              <div className="flame-outer flame-5"></div>
              <div className="flame-sparks">
                <span></span><span></span><span></span>
                <span></span><span></span><span></span>
              </div>
            </div>
            <span className="supercharged-label-v2">
              {supercharged ? 'ES' : 'EN'}
            </span>
          </button>

          {/* Theme Toggle - Chrome Button */}
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
            <span className="text-[9px] font-black">VS</span>
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

          {/* Check Engine - Gran Turismo Style Side View */}
          <button
            onClick={() => toggleAdminSettings(true)}
            className="btn-check-gt"
            data-testid="open-admin-settings-btn"
            title="Check - All Settings"
          >
            <div className="gt-car-container">
              {/* Car silhouette side view */}
              <div className="gt-car-body">
                <div className="gt-car-roof"></div>
                <div className="gt-car-window"></div>
                <div className="gt-car-lower"></div>
                <div className="gt-wheel gt-wheel-front"></div>
                <div className="gt-wheel gt-wheel-rear"></div>
              </div>
              {/* Hood opening animation */}
              <div className="gt-hood">
                <div className="gt-hood-panel"></div>
              </div>
              {/* Engine glow when hood opens */}
              <div className="gt-engine-glow"></div>
              {/* Headlight */}
              <div className="gt-headlight"></div>
              {/* Taillight */}
              <div className="gt-taillight"></div>
            </div>
            <span className="gt-label">Check</span>
          </button>
        </div>
      </div>
    </header>
  );
};

export default Header;

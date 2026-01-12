import React from 'react';
import { Heart, Sun, Moon, Swords, BarChart3, AlertTriangle } from 'lucide-react';
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
        {/* R34 Skyline Taillights Logo */}
        <div className="flex items-center gap-3">
          <div className="r34-taillights-logo" data-testid="taillights-logo">
            {/* Left R34 taillight - 4 circular segments */}
            <div className="r34-cluster left">
              <div className="r34-ring ring-1"><div className="r34-glow"></div></div>
              <div className="r34-ring ring-2"><div className="r34-glow"></div></div>
              <div className="r34-ring ring-3"><div className="r34-glow"></div></div>
              <div className="r34-ring ring-4"><div className="r34-glow"></div></div>
            </div>
            {/* Right R34 taillight - 4 circular segments */}
            <div className="r34-cluster right">
              <div className="r34-ring ring-1"><div className="r34-glow"></div></div>
              <div className="r34-ring ring-2"><div className="r34-glow"></div></div>
              <div className="r34-ring ring-3"><div className="r34-glow"></div></div>
              <div className="r34-ring ring-4"><div className="r34-glow"></div></div>
            </div>
          </div>
          <div>
            <h1 className="vice-city-title">TAILLIGHTS</h1>
            <p className="text-xs text-muted-foreground truncate max-w-[140px] vice-city-sub">
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
                <span className="text-warning vice-city-text">Offline</span>
              </>
            ) : (
              <>
                <span className="status-dot online" />
                <span className="text-chrome vice-city-text">Ready</span>
              </>
            )}
          </div>

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

          {/* Check Engine - ZL1 Camaro Style */}
          <button
            onClick={() => toggleAdminSettings(true)}
            className="btn-check-zl1"
            data-testid="open-admin-settings-btn"
            title="Check Engine - All Settings"
          >
            <div className="zl1-container">
              {/* ZL1 Camaro silhouette */}
              <div className="zl1-body">
                <div className="zl1-roof"></div>
                <div className="zl1-window"></div>
                <div className="zl1-lower">
                  <div className="zl1-hood-scoop"></div>
                </div>
                <div className="zl1-wheel zl1-wheel-front"></div>
                <div className="zl1-wheel zl1-wheel-rear"></div>
                {/* Hood that opens */}
                <div className="zl1-hood"></div>
                {/* Engine glow */}
                <div className="zl1-engine-glow"></div>
              </div>
              {/* Headlight */}
              <div className="zl1-headlight"></div>
              {/* Taillight */}
              <div className="zl1-taillight"></div>
            </div>
            <div className="zl1-label">
              <span className="vice-city-text">Check</span>
              <AlertTriangle className="check-engine-icon" />
            </div>
          </button>
        </div>
      </div>
    </header>
  );
};

export default Header;

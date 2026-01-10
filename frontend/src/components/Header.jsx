import React from 'react';
import { Zap, Settings, Upload, Heart, Sun, Moon, Flame, Swords } from 'lucide-react';
import { useSales } from '../context/SalesContext';

export const Header = () => {
  const { 
    isOffline, 
    dealership, 
    toggleSetup, 
    toggleImport, 
    toggleFavorites,
    toggleVS,
    favorites,
    theme,
    supercharged,
    toggleTheme,
    toggleSuperchargedMode,
  } = useSales();

  return (
    <header className="header-luxury sticky top-0 z-50 safe-area-top relative">
      <div className="flex items-center justify-between h-16 px-4">
        {/* Logo */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center ambient-gold"
               style={{
                 background: 'linear-gradient(135deg, hsla(35, 70%, 50%, 1) 0%, hsla(25, 75%, 40%, 1) 100%)'
               }}>
            <Zap className="w-5 h-5 text-black" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-luxury tracking-wide">CLOSR</h1>
            <p className="text-xs text-muted-foreground truncate max-w-[140px]">
              {dealership.name}
            </p>
          </div>
        </div>

        {/* Status & Actions */}
        <div className="flex items-center gap-2">
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

          {/* Supercharg'd Mode Toggle - Animated Flames */}
          <button
            onClick={toggleSuperchargedMode}
            className={`btn-supercharged relative ${supercharged ? 'active' : ''}`}
            data-testid="toggle-supercharged-btn"
            title={supercharged ? "Supercharg'd Mode ON" : "Enable Supercharg'd Mode"}
          >
            <div className={`flames-container ${supercharged ? 'active' : ''}`}>
              <Flame className="flame flame-1" />
              <Flame className="flame flame-2" />
              <Flame className="flame flame-3" />
            </div>
            <span className="supercharged-label">
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

          {/* Import button */}
          <button
            onClick={() => toggleImport(true)}
            className="btn-icon"
            data-testid="open-import-btn"
          >
            <Upload className="w-5 h-5 text-muted-foreground" />
          </button>

          {/* Settings button */}
          <button
            onClick={() => toggleSetup(true)}
            className="btn-icon"
            data-testid="open-settings-btn"
          >
            <Settings className="w-5 h-5 text-muted-foreground" />
          </button>
        </div>
      </div>
    </header>
  );
};

export default Header;

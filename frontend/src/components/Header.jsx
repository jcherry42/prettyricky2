import React from 'react';
import { Zap, Settings, Upload, Wifi, WifiOff } from 'lucide-react';
import { useSales } from '../context/SalesContext';

export const Header = () => {
  const { isOffline, dealership, toggleSetup, toggleImport, isSetupComplete } = useSales();

  return (
    <header className="sticky top-0 z-50 bg-card/95 ios-blur border-b border-border safe-area-top">
      <div className="flex items-center justify-between h-14 px-4">
        {/* Logo */}
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
            <Zap className="w-4 h-4 text-primary" />
          </div>
          <div>
            <h1 className="font-semibold text-foreground leading-none">Closr</h1>
            <p className="text-xs text-muted-foreground truncate max-w-[140px]">
              {dealership.name}
            </p>
          </div>
        </div>

        {/* Status & Actions */}
        <div className="flex items-center gap-1">
          {/* Online/Offline indicator */}
          <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full bg-secondary text-xs">
            {isOffline ? (
              <>
                <WifiOff className="w-3 h-3 text-warning" />
                <span className="text-warning font-medium">Offline</span>
              </>
            ) : (
              <>
                <span className="pulse-dot" />
                <span className="text-success font-medium">Ready</span>
              </>
            )}
          </div>

          {/* Import button */}
          <button
            onClick={() => toggleImport(true)}
            className="ios-btn w-10 h-10 text-muted-foreground hover:text-foreground"
          >
            <Upload className="w-5 h-5" />
          </button>

          {/* Settings button */}
          <button
            onClick={() => toggleSetup(true)}
            className="ios-btn w-10 h-10 text-muted-foreground hover:text-foreground"
          >
            <Settings className="w-5 h-5" />
          </button>
        </div>
      </div>
    </header>
  );
};

export default Header;

import React from 'react';
import { Zap, Wifi, WifiOff, Settings, Upload } from 'lucide-react';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { useSales } from '../context/SalesContext';

export const Header = ({ onSettingsClick, onImportClick }) => {
  const { isOffline, settings } = useSales();

  return (
    <header className="sticky top-0 z-50 w-full glass-card border-b border-border/50">
      <div className="flex h-16 items-center justify-between px-4 md:px-6">
        {/* Logo & Brand */}
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-primary/10">
            <Zap className="w-5 h-5 text-primary" />
          </div>
          <div className="flex flex-col">
            <span className="font-display text-lg font-semibold tracking-tight text-foreground">
              Closr
            </span>
            <span className="text-xs text-muted-foreground hidden sm:block">
              {settings.dealershipName}
            </span>
          </div>
        </div>

        {/* Center - Status */}
        <div className="hidden md:flex items-center gap-2">
          <Badge 
            variant={isOffline ? "warning" : "success"} 
            className="gap-1.5 px-3 py-1"
          >
            {isOffline ? (
              <>
                <WifiOff className="w-3 h-3" />
                <span>Offline Mode</span>
              </>
            ) : (
              <>
                <span className="pulse-dot" />
                <span>Ready</span>
              </>
            )}
          </Badge>
        </div>

        {/* Right - Actions */}
        <div className="flex items-center gap-2">
          <Button 
            variant="ghost" 
            size="icon-sm"
            onClick={onImportClick}
            className="text-muted-foreground hover:text-foreground"
          >
            <Upload className="w-4 h-4" />
          </Button>
          <Button 
            variant="ghost" 
            size="icon-sm"
            onClick={onSettingsClick}
            className="text-muted-foreground hover:text-foreground"
          >
            <Settings className="w-4 h-4" />
          </Button>
          
          {/* Mobile offline indicator */}
          <div className="md:hidden">
            {isOffline ? (
              <WifiOff className="w-4 h-4 text-warning" />
            ) : (
              <Wifi className="w-4 h-4 text-success" />
            )}
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;

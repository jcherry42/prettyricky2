import React, { useState, useEffect, useCallback } from 'react';
import { Wifi, WifiOff, Loader2 } from 'lucide-react';

const API_URL = import.meta.env.VITE_BACKEND_URL;

/**
 * Simplified Integration Health Status - Just an icon indicator
 */
export const IntegrationHealthStatus = ({ compact = true }) => {
  const [status, setStatus] = useState('loading'); // 'loading' | 'healthy' | 'degraded' | 'offline'
  
  const fetchHealth = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/api/integrations/health`);
      if (!res.ok) throw new Error('Failed');
      const data = await res.json();
      setStatus(data.overall_status || 'healthy');
    } catch {
      setStatus('offline');
    }
  }, []);

  useEffect(() => {
    fetchHealth();
    const interval = setInterval(fetchHealth, 60000); // Check every 60s
    return () => clearInterval(interval);
  }, [fetchHealth]);

  const getIcon = () => {
    switch (status) {
      case 'loading':
        return <Loader2 className="w-4 h-4 animate-spin text-gray-400" />;
      case 'healthy':
        return <Wifi className="w-4 h-4 text-green-500" />;
      case 'degraded':
        return <Wifi className="w-4 h-4 text-yellow-500" />;
      default:
        return <WifiOff className="w-4 h-4 text-red-500" />;
    }
  };

  const getTitle = () => {
    switch (status) {
      case 'loading': return 'Checking connection...';
      case 'healthy': return 'CRM Connected';
      case 'degraded': return 'Connection issues';
      default: return 'CRM Offline';
    }
  };

  return (
    <div 
      className="p-2 rounded-lg bg-black/20 cursor-default"
      title={getTitle()}
      data-testid="integration-health-indicator"
    >
      {getIcon()}
    </div>
  );
};

export default IntegrationHealthStatus;

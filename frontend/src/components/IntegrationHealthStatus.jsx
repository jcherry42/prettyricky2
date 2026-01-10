import React, { useState, useEffect, useCallback } from 'react';
import { Activity, CheckCircle, AlertCircle, XCircle, Loader2, RefreshCw, Database, Wifi, WifiOff } from 'lucide-react';

const API_URL = process.env.REACT_APP_BACKEND_URL;

/**
 * Integration Health Status Component
 * 
 * Displays the health status of all CRM integrations in a compact,
 * always-visible format suitable for the header or sidebar.
 */
export const IntegrationHealthStatus = ({ compact = true }) => {
  const [health, setHealth] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);

  const fetchHealth = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API_URL}/api/integrations/health`);
      if (!response.ok) throw new Error('Failed to fetch health status');
      const data = await response.json();
      setHealth(data);
      setLastUpdated(new Date());
      setError(null);
    } catch (err) {
      console.error('Health fetch error:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchHealth();
    // Refresh every 30 seconds
    const interval = setInterval(fetchHealth, 30000);
    return () => clearInterval(interval);
  }, [fetchHealth]);

  const getStatusIcon = (status) => {
    switch (status) {
      case 'healthy':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'degraded':
        return <AlertCircle className="w-4 h-4 text-yellow-500" />;
      case 'unhealthy':
        return <XCircle className="w-4 h-4 text-red-500" />;
      default:
        return <Activity className="w-4 h-4 text-gray-400" />;
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'healthy':
        return 'bg-green-500/20 border-green-500/30 text-green-400';
      case 'degraded':
        return 'bg-yellow-500/20 border-yellow-500/30 text-yellow-400';
      case 'unhealthy':
        return 'bg-red-500/20 border-red-500/30 text-red-400';
      default:
        return 'bg-gray-500/20 border-gray-500/30 text-gray-400';
    }
  };

  if (loading && !health) {
    return (
      <div className="integration-health-loading flex items-center gap-2 px-3 py-2 rounded-lg bg-card/50 border border-border/50">
        <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
        <span className="text-xs text-muted-foreground">Loading...</span>
      </div>
    );
  }

  if (error && !health) {
    return (
      <div className="integration-health-error flex items-center gap-2 px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/20">
        <WifiOff className="w-4 h-4 text-red-400" />
        <span className="text-xs text-red-400">CRM Offline</span>
      </div>
    );
  }

  if (!health || health.total === 0) {
    return (
      <div className="integration-health-empty flex items-center gap-2 px-3 py-2 rounded-lg bg-card/50 border border-border/50">
        <Database className="w-4 h-4 text-muted-foreground" />
        <span className="text-xs text-muted-foreground">No CRM Connected</span>
      </div>
    );
  }

  // Compact view for header
  if (compact) {
    return (
      <div 
        className={`integration-health-compact flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer transition-all hover:scale-105 ${getStatusColor(health.overall_status)}`}
        title={`${health.healthy}/${health.total} integrations healthy${health.mock_mode > 0 ? ` (${health.mock_mode} mock)` : ''}`}
        data-testid="integration-health-status"
      >
        {getStatusIcon(health.overall_status)}
        <span className="text-xs font-medium">
          {health.healthy}/{health.total} CRM
        </span>
        {health.mock_mode > 0 && (
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400 font-medium">
            MOCK
          </span>
        )}
        {loading && (
          <RefreshCw className="w-3 h-3 animate-spin opacity-50" />
        )}
      </div>
    );
  }

  // Expanded view for settings/dashboard
  return (
    <div className="integration-health-expanded p-4 rounded-xl bg-card/50 border border-border/50 space-y-4" data-testid="integration-health-expanded">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Database className="w-5 h-5 text-primary" />
          <h3 className="font-semibold text-foreground">CRM Integrations</h3>
        </div>
        <button 
          onClick={fetchHealth}
          disabled={loading}
          className="btn-icon-sm"
          title="Refresh status"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Status Summary */}
      <div className="grid grid-cols-4 gap-2">
        <div className="text-center p-2 rounded-lg bg-green-500/10">
          <div className="text-lg font-bold text-green-400">{health.healthy}</div>
          <div className="text-[10px] text-green-400/70">Healthy</div>
        </div>
        <div className="text-center p-2 rounded-lg bg-yellow-500/10">
          <div className="text-lg font-bold text-yellow-400">{health.degraded}</div>
          <div className="text-[10px] text-yellow-400/70">Degraded</div>
        </div>
        <div className="text-center p-2 rounded-lg bg-red-500/10">
          <div className="text-lg font-bold text-red-400">{health.unhealthy}</div>
          <div className="text-[10px] text-red-400/70">Unhealthy</div>
        </div>
        <div className="text-center p-2 rounded-lg bg-gray-500/10">
          <div className="text-lg font-bold text-gray-400">{health.unknown}</div>
          <div className="text-[10px] text-gray-400/70">Unknown</div>
        </div>
      </div>

      {/* Mock Mode Warning */}
      {health.mock_mode > 0 && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
          <AlertCircle className="w-4 h-4 text-amber-400 flex-shrink-0" />
          <p className="text-xs text-amber-400">
            <strong>{health.mock_mode}</strong> integration{health.mock_mode !== 1 ? 's' : ''} using mock data. Connect real CRM credentials to sync actual data.
          </p>
        </div>
      )}

      {/* Integration List */}
      <div className="space-y-2">
        {health.integrations?.map((integration) => (
          <div 
            key={integration.id}
            className={`flex items-center justify-between p-3 rounded-lg border ${getStatusColor(integration.status)}`}
          >
            <div className="flex items-center gap-3">
              {getStatusIcon(integration.status)}
              <div>
                <div className="text-sm font-medium">{integration.name}</div>
                <div className="text-[10px] opacity-70">
                  {integration.adapter_type}
                  {integration.mock_mode && ' • Mock Mode'}
                </div>
              </div>
            </div>
            <div className="text-right">
              {integration.last_sync_at ? (
                <div className="text-[10px] opacity-70">
                  Last sync: {new Date(integration.last_sync_at).toLocaleTimeString()}
                </div>
              ) : (
                <div className="text-[10px] opacity-50">Never synced</div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Last Updated */}
      {lastUpdated && (
        <div className="text-[10px] text-muted-foreground text-center">
          Updated {lastUpdated.toLocaleTimeString()}
        </div>
      )}
    </div>
  );
};

/**
 * Mini Integration Status Indicator
 * 
 * A minimal dot indicator for the header
 */
export const IntegrationStatusDot = () => {
  const [status, setStatus] = useState('unknown');

  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const response = await fetch(`${API_URL}/api/integrations/health`);
        if (response.ok) {
          const data = await response.json();
          setStatus(data.overall_status || 'unknown');
        }
      } catch {
        setStatus('unhealthy');
      }
    };

    fetchStatus();
    const interval = setInterval(fetchStatus, 30000);
    return () => clearInterval(interval);
  }, []);

  const getColor = () => {
    switch (status) {
      case 'healthy': return 'bg-green-500';
      case 'degraded': return 'bg-yellow-500';
      case 'unhealthy': return 'bg-red-500';
      default: return 'bg-gray-500';
    }
  };

  return (
    <div 
      className={`w-2 h-2 rounded-full ${getColor()} animate-pulse`}
      title={`CRM Status: ${status}`}
      data-testid="integration-status-dot"
    />
  );
};

export default IntegrationHealthStatus;

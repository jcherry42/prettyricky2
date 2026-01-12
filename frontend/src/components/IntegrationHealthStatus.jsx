import React, { useState, useEffect, useCallback } from 'react';
import { 
  Activity, CheckCircle, AlertCircle, XCircle, Loader2, RefreshCw, 
  Database, Wifi, WifiOff, Clock, Zap, TrendingUp, Server,
  BarChart3, Timer, Shield, ArrowUpDown, ChevronDown, ChevronUp,
  Play, Pause, ExternalLink
} from 'lucide-react';
import { toast } from 'sonner';

const API_URL = process.env.REACT_APP_BACKEND_URL;

/**
 * Enhanced Integration Health Status Component
 * 
 * Displays comprehensive health status of all CRM integrations with:
 * - Detailed sync statistics
 * - Rate limit information
 * - Quick actions (sync, toggle)
 * - Visual progress indicators
 */
export const IntegrationHealthStatus = ({ compact = true }) => {
  const [health, setHealth] = useState(null);
  const [detailedIntegrations, setDetailedIntegrations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [expandedId, setExpandedId] = useState(null);
  const [actionLoading, setActionLoading] = useState({});

  const fetchHealth = useCallback(async () => {
    try {
      setLoading(true);
      const [healthRes, integrationsRes] = await Promise.all([
        fetch(`${API_URL}/api/integrations/health`),
        fetch(`${API_URL}/api/integrations`)
      ]);
      
      if (!healthRes.ok) throw new Error('Failed to fetch health status');
      
      const healthData = await healthRes.json();
      const integrationsData = await integrationsRes.json();
      
      setHealth(healthData);
      setDetailedIntegrations(integrationsData.integrations || []);
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
    const interval = setInterval(fetchHealth, 30000);
    return () => clearInterval(interval);
  }, [fetchHealth]);

  const handleSync = async (integrationId) => {
    setActionLoading(prev => ({ ...prev, [`sync_${integrationId}`]: true }));
    try {
      const res = await fetch(`${API_URL}/api/integrations/${integrationId}/sync`, {
        method: 'POST'
      });
      const result = await res.json();
      if (result.success) {
        toast.success(`Synced ${result.records_fetched} records`);
        fetchHealth();
      } else {
        toast.error(result.errors?.[0] || 'Sync failed');
      }
    } catch {
      toast.error('Sync failed');
    } finally {
      setActionLoading(prev => ({ ...prev, [`sync_${integrationId}`]: false }));
    }
  };

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

  const formatTimestamp = (timestamp) => {
    if (!timestamp) return 'Never';
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${diffDays}d ago`;
  };

  const getDetailedIntegration = (id) => {
    return detailedIntegrations.find(i => i.id === id);
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
          data-testid="refresh-health-btn"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Status Summary Cards */}
      <div className="grid grid-cols-4 gap-2">
        <div className="text-center p-2 rounded-lg bg-green-500/10 border border-green-500/20">
          <div className="text-lg font-bold text-green-400">{health.healthy}</div>
          <div className="text-[10px] text-green-400/70">Healthy</div>
        </div>
        <div className="text-center p-2 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
          <div className="text-lg font-bold text-yellow-400">{health.degraded}</div>
          <div className="text-[10px] text-yellow-400/70">Degraded</div>
        </div>
        <div className="text-center p-2 rounded-lg bg-red-500/10 border border-red-500/20">
          <div className="text-lg font-bold text-red-400">{health.unhealthy}</div>
          <div className="text-[10px] text-red-400/70">Unhealthy</div>
        </div>
        <div className="text-center p-2 rounded-lg bg-amber-500/10 border border-amber-500/20">
          <div className="text-lg font-bold text-amber-400">{health.mock_mode}</div>
          <div className="text-[10px] text-amber-400/70">Mock</div>
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
        {health.integrations?.map((integration) => {
          const detailed = getDetailedIntegration(integration.id);
          const isExpanded = expandedId === integration.id;
          
          return (
            <div 
              key={integration.id}
              className={`rounded-lg border overflow-hidden transition-all ${getStatusColor(integration.status)}`}
            >
              {/* Integration Row */}
              <div 
                className="flex items-center justify-between p-3 cursor-pointer"
                onClick={() => setExpandedId(isExpanded ? null : integration.id)}
              >
                <div className="flex items-center gap-3">
                  {getStatusIcon(integration.status)}
                  <div>
                    <div className="text-sm font-medium flex items-center gap-2">
                      {integration.name}
                      {integration.mock_mode && (
                        <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-500/30 text-amber-300">
                          MOCK
                        </span>
                      )}
                    </div>
                    <div className="text-[10px] opacity-70 flex items-center gap-2">
                      <span>{detailed?.adapter_name || integration.adapter_type}</span>
                      {detailed?.vendor && detailed.vendor !== 'Custom' && (
                        <>
                          <span>•</span>
                          <span>{detailed.vendor}</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="text-right mr-2">
                    <div className="text-[10px] opacity-70 flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {formatTimestamp(integration.last_sync_at)}
                    </div>
                  </div>
                  {isExpanded ? (
                    <ChevronUp className="w-4 h-4 opacity-50" />
                  ) : (
                    <ChevronDown className="w-4 h-4 opacity-50" />
                  )}
                </div>
              </div>

              {/* Expanded Details */}
              {isExpanded && detailed && (
                <div className="px-3 pb-3 pt-1 bg-black/20 border-t border-white/10 space-y-3">
                  {/* Sync Stats */}
                  {detailed.sync_stats && Object.keys(detailed.sync_stats).length > 0 && (
                    <div className="space-y-2">
                      <div className="flex items-center gap-1 text-[10px] font-medium opacity-60">
                        <BarChart3 className="w-3 h-3" />
                        Last Sync Statistics
                      </div>
                      <div className="grid grid-cols-4 gap-2">
                        <div className="text-center p-2 rounded bg-white/5">
                          <div className="text-sm font-bold">{detailed.sync_stats.records_fetched || 0}</div>
                          <div className="text-[9px] opacity-60">Records</div>
                        </div>
                        <div className="text-center p-2 rounded bg-white/5">
                          <div className="text-sm font-bold">{detailed.sync_stats.pages_fetched || 0}</div>
                          <div className="text-[9px] opacity-60">Pages</div>
                        </div>
                        <div className="text-center p-2 rounded bg-white/5">
                          <div className="text-sm font-bold">{detailed.sync_stats.duration_ms || 0}ms</div>
                          <div className="text-[9px] opacity-60">Duration</div>
                        </div>
                        <div className="text-center p-2 rounded bg-white/5">
                          <div className={`text-sm font-bold ${detailed.sync_stats.errors > 0 ? 'text-red-400' : ''}`}>
                            {detailed.sync_stats.errors || 0}
                          </div>
                          <div className="text-[9px] opacity-60">Errors</div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Rate Limits */}
                  <div className="space-y-2">
                    <div className="flex items-center gap-1 text-[10px] font-medium opacity-60">
                      <Shield className="w-3 h-3" />
                      Rate Limits
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="flex items-center justify-between p-2 rounded bg-white/5">
                        <div className="flex items-center gap-1">
                          <Timer className="w-3 h-3 opacity-50" />
                          <span className="text-[10px]">Per Minute</span>
                        </div>
                        <span className="text-xs font-medium">{detailed.requests_per_minute || 60}</span>
                      </div>
                      <div className="flex items-center justify-between p-2 rounded bg-white/5">
                        <div className="flex items-center gap-1">
                          <TrendingUp className="w-3 h-3 opacity-50" />
                          <span className="text-[10px]">Per Day</span>
                        </div>
                        <span className="text-xs font-medium">{(detailed.requests_per_day || 10000).toLocaleString()}</span>
                      </div>
                    </div>
                  </div>

                  {/* Configuration */}
                  <div className="space-y-2">
                    <div className="flex items-center gap-1 text-[10px] font-medium opacity-60">
                      <Server className="w-3 h-3" />
                      Configuration
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-[10px]">
                      <div className="p-2 rounded bg-white/5">
                        <span className="opacity-60">Base URL:</span>
                        <div className="truncate font-mono text-[9px]">{detailed.base_url || 'N/A'}</div>
                      </div>
                      <div className="p-2 rounded bg-white/5">
                        <span className="opacity-60">Auth:</span>
                        <div className="font-mono text-[9px]">{detailed.auth_method || 'api_key'}</div>
                      </div>
                      <div className="p-2 rounded bg-white/5">
                        <span className="opacity-60">Data Type:</span>
                        <div className="capitalize">{detailed.data_type || 'customers'}</div>
                      </div>
                      <div className="p-2 rounded bg-white/5">
                        <span className="opacity-60">Page Size:</span>
                        <div>{detailed.page_size || 100}</div>
                      </div>
                    </div>
                  </div>

                  {/* Field Mappings */}
                  {detailed.field_mappings && Object.keys(detailed.field_mappings).length > 0 && (
                    <div className="space-y-2">
                      <div className="flex items-center gap-1 text-[10px] font-medium opacity-60">
                        <ArrowUpDown className="w-3 h-3" />
                        Field Mappings ({Object.keys(detailed.field_mappings).length})
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {Object.entries(detailed.field_mappings).slice(0, 6).map(([source, target]) => (
                          <span 
                            key={source}
                            className="px-2 py-1 rounded bg-primary/20 text-[9px] font-mono"
                            title={`${source} → ${target}`}
                          >
                            {source} → {target}
                          </span>
                        ))}
                        {Object.keys(detailed.field_mappings).length > 6 && (
                          <span className="px-2 py-1 text-[9px] opacity-50">
                            +{Object.keys(detailed.field_mappings).length - 6} more
                          </span>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Quick Actions */}
                  <div className="flex gap-2 pt-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleSync(integration.id);
                      }}
                      disabled={actionLoading[`sync_${integration.id}`]}
                      className="flex-1 py-2 px-3 bg-primary/20 hover:bg-primary/30 rounded-lg text-xs font-medium flex items-center justify-center gap-2 disabled:opacity-50 transition-colors"
                      data-testid={`sync-btn-${integration.id}`}
                    >
                      {actionLoading[`sync_${integration.id}`] ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : (
                        <RefreshCw className="w-3 h-3" />
                      )}
                      Sync Now
                    </button>
                    <button
                      onClick={(e) => e.stopPropagation()}
                      className="py-2 px-3 bg-white/5 hover:bg-white/10 rounded-lg text-xs font-medium flex items-center gap-2 transition-colors"
                      title="View in CRM settings"
                    >
                      <ExternalLink className="w-3 h-3" />
                      Details
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between text-[10px] text-muted-foreground pt-2 border-t border-border/30">
        <div className="flex items-center gap-1">
          <Wifi className="w-3 h-3" />
          <span>Auto-refresh: 30s</span>
        </div>
        {lastUpdated && (
          <span>Updated {lastUpdated.toLocaleTimeString()}</span>
        )}
      </div>
    </div>
  );
};

/**
 * Mini Integration Status Indicator
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

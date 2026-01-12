import React, { useState, useEffect, useCallback } from 'react';
import { 
  X, BarChart3, TrendingUp, Users, Car, MessageSquare, Activity,
  RefreshCw, Loader2, Zap, Target, Award, Clock, Flame, Shield,
  ArrowUpRight, ArrowDownRight, Minus, Database, CheckCircle,
  AlertCircle, XCircle, Calendar, PieChart, FlaskConical, Play, Pause, Trash2
} from 'lucide-react';
import { toast } from 'sonner';

const API_URL = process.env.REACT_APP_BACKEND_URL;

/**
 * Analytics Dashboard - Comprehensive metrics view
 * Inspired by Porsche/McLaren infotainment systems
 */
export const AnalyticsDashboard = ({ onClose }) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');
  const [refreshing, setRefreshing] = useState(false);
  const [abExperiments, setAbExperiments] = useState([]);

  const fetchAnalytics = useCallback(async () => {
    try {
      setRefreshing(true);
      const res = await fetch(`${API_URL}/api/analytics/dashboard`);
      if (!res.ok) throw new Error('Failed to fetch analytics');
      const result = await res.json();
      setData(result);
    } catch (err) {
      console.error('Analytics error:', err);
      toast.error('Failed to load analytics');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchAnalytics();
    const interval = setInterval(fetchAnalytics, 60000); // Refresh every minute
    return () => clearInterval(interval);
  }, [fetchAnalytics]);

  const formatNumber = (num) => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num?.toLocaleString() || '0';
  };

  const formatCurrency = (num) => {
    return `$${formatNumber(num)}`;
  };

  const getTrendIcon = (value) => {
    if (value > 0) return <ArrowUpRight className="w-3 h-3 text-emerald-400" />;
    if (value < 0) return <ArrowDownRight className="w-3 h-3 text-red-400" />;
    return <Minus className="w-3 h-3 text-muted-foreground" />;
  };

  if (loading) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center mclaren-glass-overlay">
        <div className="mclaren-card p-8 text-center">
          <Loader2 className="w-12 h-12 mx-auto mb-4 animate-spin text-primary" />
          <p className="text-muted-foreground">Loading Analytics...</p>
        </div>
      </div>
    );
  }

  const tabs = [
    { id: 'overview', label: 'Overview', icon: BarChart3 },
    { id: 'sales', label: 'Sales', icon: TrendingUp },
    { id: 'customers', label: 'Customers', icon: Users },
    { id: 'inventory', label: 'Inventory', icon: Car },
    { id: 'ai', label: 'AI Insights', icon: Zap },
  ];

  return (
    <div className="fixed inset-0 z-50 mclaren-glass-overlay">
      <div className="w-full h-full flex flex-col mclaren-dashboard">
        {/* Header */}
        <header className="mclaren-header px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="mclaren-logo-badge">
              <BarChart3 className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-foreground tracking-tight">Analytics</h1>
              <p className="text-xs text-muted-foreground">
                Real-time performance metrics
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <button
              onClick={fetchAnalytics}
              disabled={refreshing}
              className="mclaren-btn-icon"
              data-testid="refresh-analytics"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={onClose}
              className="mclaren-btn-icon"
              data-testid="close-analytics"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </header>

        {/* Tab Navigation */}
        <nav className="mclaren-nav px-6 py-2 flex gap-2 overflow-x-auto hide-scrollbar">
          {tabs.map(tab => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`mclaren-tab ${activeTab === tab.id ? 'active' : ''}`}
                data-testid={`tab-${tab.id}`}
              >
                <Icon className="w-4 h-4" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Content */}
        <main className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Overview Tab */}
          {activeTab === 'overview' && data && (
            <div className="space-y-6 animate-fade-in">
              {/* Key Metrics Grid */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <MetricCard
                  icon={MessageSquare}
                  label="AI Responses"
                  value={data.sales_performance?.total_responses_generated || 0}
                  subtext={`${data.sales_performance?.responses_per_day?.toFixed(1) || 0}/day avg`}
                  color="primary"
                />
                <MetricCard
                  icon={Users}
                  label="Customers"
                  value={data.customer_engagement?.total_customers || 0}
                  subtext={`${data.customer_engagement?.new_leads_7d || 0} new this week`}
                  color="emerald"
                />
                <MetricCard
                  icon={Car}
                  label="Vehicles"
                  value={data.inventory_metrics?.available || 0}
                  subtext={`${data.inventory_metrics?.total_vehicles || 0} total inventory`}
                  color="blue"
                />
                <MetricCard
                  icon={Database}
                  label="Integrations"
                  value={data.integration_health?.healthy || 0}
                  subtext={`${data.integration_health?.total_integrations || 0} configured`}
                  color="purple"
                  status={data.integration_health?.health_score >= 80 ? 'good' : 'warning'}
                />
              </div>

              {/* Performance Overview */}
              <div className="grid md:grid-cols-2 gap-6">
                {/* Efficiency Score */}
                <div className="mclaren-card p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-semibold text-foreground flex items-center gap-2">
                      <Zap className="w-4 h-4 text-amber-400" />
                      AI Efficiency Score
                    </h3>
                    <span className="text-2xl font-bold text-primary">
                      {data.sales_performance?.efficiency_score || 0}%
                    </span>
                  </div>
                  <div className="h-3 bg-muted/30 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-gradient-to-r from-amber-500 to-primary rounded-full transition-all duration-1000"
                      style={{ width: `${data.sales_performance?.efficiency_score || 0}%` }}
                    />
                  </div>
                  <div className="mt-4 grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-muted-foreground">Shortcut Usage</p>
                      <p className="font-semibold text-foreground">
                        {data.sales_performance?.shortcut_usage_rate?.toFixed(1) || 0}%
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Bilingual Usage</p>
                      <p className="font-semibold text-foreground">
                        {data.conversation_insights?.bilingual_usage_rate?.toFixed(1) || 0}%
                      </p>
                    </div>
                  </div>
                </div>

                {/* Integration Health */}
                <div className="mclaren-card p-6">
                  <h3 className="font-semibold text-foreground flex items-center gap-2 mb-4">
                    <Activity className="w-4 h-4 text-emerald-400" />
                    System Health
                  </h3>
                  <div className="space-y-3">
                    <HealthBar 
                      label="Healthy" 
                      count={data.integration_health?.healthy || 0} 
                      total={data.integration_health?.total_integrations || 1}
                      color="emerald"
                    />
                    <HealthBar 
                      label="Degraded" 
                      count={data.integration_health?.degraded || 0} 
                      total={data.integration_health?.total_integrations || 1}
                      color="amber"
                    />
                    <HealthBar 
                      label="Unhealthy" 
                      count={data.integration_health?.unhealthy || 0} 
                      total={data.integration_health?.total_integrations || 1}
                      color="red"
                    />
                  </div>
                  {data.integration_health?.mock_mode_count > 0 && (
                    <p className="mt-4 text-xs text-amber-400 flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" />
                      {data.integration_health.mock_mode_count} integration(s) in mock mode
                    </p>
                  )}
                </div>
              </div>

              {/* Lead Funnel */}
              <div className="mclaren-card p-6">
                <h3 className="font-semibold text-foreground flex items-center gap-2 mb-6">
                  <Target className="w-4 h-4 text-primary" />
                  Lead Conversion Funnel
                </h3>
                <div className="flex items-end justify-between h-32 gap-2">
                  <FunnelBar 
                    label="Hot" 
                    value={data.customer_engagement?.hot_leads || 0}
                    maxValue={Math.max(
                      data.customer_engagement?.hot_leads || 1,
                      data.customer_engagement?.warm_leads || 1,
                      data.customer_engagement?.cold_leads || 1
                    )}
                    color="from-red-500 to-orange-500"
                  />
                  <FunnelBar 
                    label="Warm" 
                    value={data.customer_engagement?.warm_leads || 0}
                    maxValue={Math.max(
                      data.customer_engagement?.hot_leads || 1,
                      data.customer_engagement?.warm_leads || 1,
                      data.customer_engagement?.cold_leads || 1
                    )}
                    color="from-amber-500 to-yellow-500"
                  />
                  <FunnelBar 
                    label="Cold" 
                    value={data.customer_engagement?.cold_leads || 0}
                    maxValue={Math.max(
                      data.customer_engagement?.hot_leads || 1,
                      data.customer_engagement?.warm_leads || 1,
                      data.customer_engagement?.cold_leads || 1
                    )}
                    color="from-blue-500 to-cyan-500"
                  />
                  <FunnelBar 
                    label="Sold" 
                    value={data.customer_engagement?.sold || 0}
                    maxValue={Math.max(
                      data.customer_engagement?.hot_leads || 1,
                      data.customer_engagement?.warm_leads || 1,
                      data.customer_engagement?.cold_leads || 1
                    )}
                    color="from-emerald-500 to-green-500"
                  />
                </div>
                <div className="mt-4 flex items-center justify-center gap-2 text-sm">
                  <Award className="w-4 h-4 text-emerald-400" />
                  <span className="text-muted-foreground">Conversion Rate:</span>
                  <span className="font-bold text-emerald-400">
                    {data.customer_engagement?.conversion_rate?.toFixed(1) || 0}%
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Sales Tab */}
          {activeTab === 'sales' && data && (
            <div className="space-y-6 animate-fade-in">
              <div className="grid md:grid-cols-3 gap-4">
                <MetricCard
                  icon={MessageSquare}
                  label="Total Responses"
                  value={data.sales_performance?.total_responses_generated || 0}
                  subtext="AI-generated"
                  color="primary"
                />
                <MetricCard
                  icon={Zap}
                  label="Quick Shortcuts Used"
                  value={`${data.sales_performance?.shortcut_usage_rate?.toFixed(1) || 0}%`}
                  subtext="Efficiency rate"
                  color="amber"
                />
                <MetricCard
                  icon={Calendar}
                  label="Daily Average"
                  value={data.sales_performance?.responses_per_day?.toFixed(1) || 0}
                  subtext="responses/day"
                  color="blue"
                />
              </div>

              {/* Top Categories */}
              <div className="mclaren-card p-6">
                <h3 className="font-semibold text-foreground mb-4">Top Response Categories</h3>
                <div className="space-y-3">
                  {(data.sales_performance?.top_categories || []).length > 0 ? (
                    data.sales_performance.top_categories.map((cat, idx) => (
                      <div key={cat._id} className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground capitalize">
                          {idx + 1}. {cat._id?.replace('_', ' ') || 'Unknown'}
                        </span>
                        <span className="text-sm font-semibold text-foreground">{cat.count}</span>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      No data yet. Start generating responses to see insights.
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Customers Tab */}
          {activeTab === 'customers' && data && (
            <div className="space-y-6 animate-fade-in">
              <div className="grid md:grid-cols-3 gap-4">
                <MetricCard
                  icon={Users}
                  label="Total Customers"
                  value={data.customer_engagement?.total_customers || 0}
                  color="primary"
                />
                <MetricCard
                  icon={TrendingUp}
                  label="New This Week"
                  value={data.customer_engagement?.new_leads_7d || 0}
                  color="emerald"
                />
                <MetricCard
                  icon={Award}
                  label="Conversion Rate"
                  value={`${data.customer_engagement?.conversion_rate?.toFixed(1) || 0}%`}
                  color="amber"
                />
              </div>

              {/* Contact Completeness */}
              <div className="mclaren-card p-6">
                <h3 className="font-semibold text-foreground mb-4">Contact Data Quality</h3>
                <div className="space-y-4">
                  <ProgressRow 
                    label="Has Email" 
                    value={data.customer_engagement?.contact_completeness?.with_email || 0}
                  />
                  <ProgressRow 
                    label="Has Phone" 
                    value={data.customer_engagement?.contact_completeness?.with_phone || 0}
                  />
                  <ProgressRow 
                    label="Vehicle Interest" 
                    value={data.customer_engagement?.contact_completeness?.with_vehicle_interest || 0}
                  />
                </div>
              </div>

              {/* Follow-up Priority */}
              <div className="mclaren-card p-6">
                <h3 className="font-semibold text-foreground mb-4">Follow-up Priority</h3>
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20">
                    <p className="text-2xl font-bold text-red-400">
                      {data.customer_engagement?.follow_up_priority?.immediate || 0}
                    </p>
                    <p className="text-xs text-red-400/70">Immediate</p>
                  </div>
                  <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20">
                    <p className="text-2xl font-bold text-amber-400">
                      {data.customer_engagement?.follow_up_priority?.this_week || 0}
                    </p>
                    <p className="text-xs text-amber-400/70">This Week</p>
                  </div>
                  <div className="p-4 rounded-xl bg-blue-500/10 border border-blue-500/20">
                    <p className="text-2xl font-bold text-blue-400">
                      {data.customer_engagement?.follow_up_priority?.nurture || 0}
                    </p>
                    <p className="text-xs text-blue-400/70">Nurture</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Inventory Tab */}
          {activeTab === 'inventory' && data && (
            <div className="space-y-6 animate-fade-in">
              <div className="grid md:grid-cols-4 gap-4">
                <MetricCard
                  icon={Car}
                  label="Total Inventory"
                  value={data.inventory_metrics?.total_vehicles || 0}
                  color="primary"
                />
                <MetricCard
                  icon={CheckCircle}
                  label="Available"
                  value={data.inventory_metrics?.available || 0}
                  color="emerald"
                />
                <MetricCard
                  icon={Clock}
                  label="Pending"
                  value={data.inventory_metrics?.pending || 0}
                  color="amber"
                />
                <MetricCard
                  icon={Award}
                  label="Sold"
                  value={data.inventory_metrics?.sold || 0}
                  color="blue"
                />
              </div>

              {/* Price Metrics */}
              <div className="mclaren-card p-6">
                <h3 className="font-semibold text-foreground mb-4">Price Metrics</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="text-center">
                    <p className="text-xs text-muted-foreground mb-1">Average</p>
                    <p className="text-lg font-bold text-foreground">
                      {formatCurrency(data.inventory_metrics?.price_metrics?.average_price || 0)}
                    </p>
                  </div>
                  <div className="text-center">
                    <p className="text-xs text-muted-foreground mb-1">Minimum</p>
                    <p className="text-lg font-bold text-foreground">
                      {formatCurrency(data.inventory_metrics?.price_metrics?.min_price || 0)}
                    </p>
                  </div>
                  <div className="text-center">
                    <p className="text-xs text-muted-foreground mb-1">Maximum</p>
                    <p className="text-lg font-bold text-foreground">
                      {formatCurrency(data.inventory_metrics?.price_metrics?.max_price || 0)}
                    </p>
                  </div>
                  <div className="text-center">
                    <p className="text-xs text-muted-foreground mb-1">Total Value</p>
                    <p className="text-lg font-bold text-primary">
                      {formatCurrency(data.inventory_metrics?.price_metrics?.total_inventory_value || 0)}
                    </p>
                  </div>
                </div>
              </div>

              {/* Top Makes */}
              {data.inventory_metrics?.top_makes?.length > 0 && (
                <div className="mclaren-card p-6">
                  <h3 className="font-semibold text-foreground mb-4">Top Makes</h3>
                  <div className="space-y-2">
                    {data.inventory_metrics.top_makes.slice(0, 5).map((make, idx) => (
                      <div key={make._id} className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">
                          {idx + 1}. {make._id || 'Unknown'}
                        </span>
                        <span className="text-sm font-semibold text-foreground">{make.count}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* AI Insights Tab */}
          {activeTab === 'ai' && data && (
            <div className="space-y-6 animate-fade-in">
              <div className="grid md:grid-cols-3 gap-4">
                <MetricCard
                  icon={MessageSquare}
                  label="Total Conversations"
                  value={data.conversation_insights?.total_conversations || 0}
                  color="primary"
                />
                <MetricCard
                  icon={Flame}
                  label="Bilingual Usage"
                  value={`${data.conversation_insights?.bilingual_usage_rate?.toFixed(1) || 0}%`}
                  subtext="Supercharg'd mode"
                  color="orange"
                />
                <MetricCard
                  icon={Zap}
                  label="AI Efficiency"
                  value={data.conversation_insights?.ai_efficiency_score || 0}
                  subtext="Score out of 100"
                  color="amber"
                />
              </div>

              {/* Response Stats */}
              <div className="mclaren-card p-6">
                <h3 className="font-semibold text-foreground mb-4">Response Statistics</h3>
                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Avg Response Length</p>
                    <p className="text-2xl font-bold text-foreground">
                      {data.conversation_insights?.avg_response_length || 0}
                      <span className="text-sm font-normal text-muted-foreground ml-1">chars</span>
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Peak Usage Hour</p>
                    <p className="text-2xl font-bold text-foreground">
                      {data.conversation_insights?.peak_usage_hour || 12}:00
                      <span className="text-sm font-normal text-muted-foreground ml-1">
                        {(data.conversation_insights?.peak_usage_hour || 12) >= 12 ? 'PM' : 'AM'}
                      </span>
                    </p>
                  </div>
                </div>
              </div>

              {/* Top Quick Shortcuts */}
              {data.conversation_insights?.top_quick_shortcuts?.length > 0 && (
                <div className="mclaren-card p-6">
                  <h3 className="font-semibold text-foreground mb-4">Most Used Shortcuts</h3>
                  <div className="space-y-2">
                    {data.conversation_insights.top_quick_shortcuts.map((shortcut, idx) => (
                      <div key={shortcut._id} className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground capitalize">
                          {idx + 1}. {shortcut._id?.replace('_', ' ') || 'Custom'}
                        </span>
                        <span className="text-sm font-semibold text-foreground">{shortcut.count}x</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </main>

        {/* Footer */}
        <footer className="mclaren-footer px-6 py-3 flex items-center justify-between text-xs text-muted-foreground">
          <span>Last updated: {data?.generated_at ? new Date(data.generated_at).toLocaleTimeString() : 'N/A'}</span>
          <span className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            Live
          </span>
        </footer>
      </div>
    </div>
  );
};

// Sub-components

const MetricCard = ({ icon: Icon, label, value, subtext, color = 'primary', status }) => {
  const colorClasses = {
    primary: 'text-primary border-primary/20 bg-primary/5',
    emerald: 'text-emerald-400 border-emerald-500/20 bg-emerald-500/5',
    amber: 'text-amber-400 border-amber-500/20 bg-amber-500/5',
    blue: 'text-blue-400 border-blue-500/20 bg-blue-500/5',
    purple: 'text-purple-400 border-purple-500/20 bg-purple-500/5',
    orange: 'text-orange-400 border-orange-500/20 bg-orange-500/5',
  };

  return (
    <div className={`mclaren-metric-card ${colorClasses[color]}`}>
      <div className="flex items-center justify-between mb-2">
        <Icon className="w-5 h-5 opacity-70" />
        {status === 'warning' && <AlertCircle className="w-4 h-4 text-amber-400" />}
        {status === 'good' && <CheckCircle className="w-4 h-4 text-emerald-400" />}
      </div>
      <p className="text-2xl font-bold">{typeof value === 'number' ? value.toLocaleString() : value}</p>
      <p className="text-xs opacity-70">{label}</p>
      {subtext && <p className="text-[10px] opacity-50 mt-1">{subtext}</p>}
    </div>
  );
};

const HealthBar = ({ label, count, total, color }) => {
  const percentage = (count / Math.max(total, 1)) * 100;
  const colorClasses = {
    emerald: 'bg-emerald-500',
    amber: 'bg-amber-500',
    red: 'bg-red-500',
  };

  return (
    <div className="flex items-center gap-3">
      <span className="text-xs text-muted-foreground w-20">{label}</span>
      <div className="flex-1 h-2 bg-muted/30 rounded-full overflow-hidden">
        <div 
          className={`h-full ${colorClasses[color]} rounded-full transition-all duration-500`}
          style={{ width: `${percentage}%` }}
        />
      </div>
      <span className="text-xs font-semibold text-foreground w-8 text-right">{count}</span>
    </div>
  );
};

const FunnelBar = ({ label, value, maxValue, color }) => {
  const height = Math.max((value / Math.max(maxValue, 1)) * 100, 10);
  
  return (
    <div className="flex-1 flex flex-col items-center gap-2">
      <div className="w-full h-24 flex items-end">
        <div 
          className={`w-full rounded-t-lg bg-gradient-to-t ${color} transition-all duration-500`}
          style={{ height: `${height}%` }}
        />
      </div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm font-bold text-foreground">{value}</p>
    </div>
  );
};

const ProgressRow = ({ label, value }) => (
  <div className="space-y-1">
    <div className="flex items-center justify-between text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-semibold text-foreground">{value.toFixed(1)}%</span>
    </div>
    <div className="h-2 bg-muted/30 rounded-full overflow-hidden">
      <div 
        className="h-full bg-gradient-to-r from-primary to-primary/60 rounded-full transition-all duration-500"
        style={{ width: `${value}%` }}
      />
    </div>
  </div>
);

export default AnalyticsDashboard;

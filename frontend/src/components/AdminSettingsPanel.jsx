import React, { useState, useEffect, useCallback } from 'react';
import { 
  X, Settings, Phone, Database, Shield, Check, Loader2, 
  Eye, EyeOff, AlertCircle, CheckCircle, Bell, Plug,
  ChevronRight, Save, RefreshCw, Trash2, TestTube, Key, ToggleLeft, ToggleRight, ArrowLeft
} from 'lucide-react';
import { toast } from 'sonner';

const API_URL = process.env.REACT_APP_BACKEND_URL;

/**
 * Admin Settings Panel
 * Configure integrations, notifications, and system settings
 * Porsche/McLaren premium design
 */
export const AdminSettingsPanel = ({ onClose }) => {
  const [activeTab, setActiveTab] = useState('notifications');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  // Notification config
  const [notificationConfig, setNotificationConfig] = useState({
    sms_configured: false,
    from_number: null,
    pending_notifications: 0,
  });
  
  // Twilio form
  const [twilioForm, setTwilioForm] = useState({
    account_sid: '',
    auth_token: '',
    from_number: '',
  });
  const [showSecrets, setShowSecrets] = useState({
    auth_token: false,
  });
  
  // CRM config
  const [crmConfig, setCrmConfig] = useState({
    integrations: [],
    health: null,
  });
  
  // Integration detail view
  const [selectedIntegration, setSelectedIntegration] = useState(null);
  const [integrationForm, setIntegrationForm] = useState({
    api_key: '',
    username: '',
    password: '',
    client_id: '',
    client_secret: '',
  });
  const [showIntegrationSecrets, setShowIntegrationSecrets] = useState({});

  const loadConfig = useCallback(async () => {
    setLoading(true);
    try {
      const [notifRes, healthRes, integrationsRes] = await Promise.all([
        fetch(`${API_URL}/api/notifications/config`),
        fetch(`${API_URL}/api/integrations/health`),
        fetch(`${API_URL}/api/integrations`),
      ]);
      
      if (notifRes.ok) {
        const notifData = await notifRes.json();
        setNotificationConfig(notifData);
      }
      
      if (healthRes.ok && integrationsRes.ok) {
        const healthData = await healthRes.json();
        const integrationsData = await integrationsRes.json();
        setCrmConfig({
          health: healthData,
          integrations: integrationsData.integrations || [],
        });
      }
    } catch (err) {
      console.error('Failed to load config:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadConfig();
  }, [loadConfig]);

  const handleTwilioSave = async () => {
    if (!twilioForm.account_sid || !twilioForm.auth_token || !twilioForm.from_number) {
      toast.error('Please fill in all Twilio fields');
      return;
    }
    
    setSaving(true);
    try {
      const res = await fetch(`${API_URL}/api/notifications/config/twilio`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(twilioForm),
      });
      
      const result = await res.json();
      
      if (res.ok && result.success) {
        toast.success('Twilio configured successfully!');
        setTwilioForm({ account_sid: '', auth_token: '', from_number: '' });
        loadConfig();
      } else {
        toast.error(result.detail || result.error || 'Failed to configure Twilio');
      }
    } catch (err) {
      toast.error('Failed to save Twilio configuration');
    } finally {
      setSaving(false);
    }
  };

  const handleTestNotification = async () => {
    if (!notificationConfig.sms_configured) {
      toast.error('Please configure Twilio first');
      return;
    }
    
    const testPhone = prompt('Enter your phone number to receive a test SMS (e.g., +15551234567):');
    if (!testPhone) return;
    
    setSaving(true);
    try {
      const res = await fetch(`${API_URL}/api/notifications/hot-lead`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          salesperson_phone: testPhone,
          salesperson_name: 'Test User',
          customer_name: 'Test Customer',
          customer_phone: '+15559999999',
          vehicle_interest: '2024 Test Vehicle',
        }),
      });
      
      const result = await res.json();
      
      if (result.success && result.message_sid) {
        toast.success('Test SMS sent successfully!');
      } else if (result.success) {
        toast.info('Notification queued (check Twilio config)');
      } else {
        toast.error(result.error || 'Failed to send test');
      }
    } catch (err) {
      toast.error('Failed to send test notification');
    } finally {
      setSaving(false);
    }
  };

  const handleProcessQueue = async () => {
    setSaving(true);
    try {
      const res = await fetch(`${API_URL}/api/notifications/process-scheduled`, {
        method: 'POST',
      });
      const result = await res.json();
      
      if (result.success) {
        toast.success(`Processed: ${result.sent} sent, ${result.failed} failed, ${result.skipped} skipped`);
        loadConfig();
      }
    } catch (err) {
      toast.error('Failed to process queue');
    } finally {
      setSaving(false);
    }
  };

  const handleSelectIntegration = (integration) => {
    setSelectedIntegration(integration);
    // Reset form
    setIntegrationForm({
      api_key: '',
      username: '',
      password: '',
      client_id: '',
      client_secret: '',
    });
    setShowIntegrationSecrets({});
  };

  const handleToggleMockMode = async (integration) => {
    setSaving(true);
    try {
      const res = await fetch(`${API_URL}/api/integrations/${integration.id}/toggle-mock?enabled=${!integration.mock_mode}`, {
        method: 'POST',
      });
      const result = await res.json();
      
      if (result.success) {
        toast.success(`Mock mode ${result.mock_mode ? 'enabled' : 'disabled'} for ${integration.name}`);
        loadConfig();
        // Update selected integration
        setSelectedIntegration(prev => prev ? {...prev, mock_mode: result.mock_mode} : null);
      } else {
        toast.error('Failed to toggle mock mode');
      }
    } catch (err) {
      toast.error('Failed to toggle mock mode');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveIntegrationCredentials = async () => {
    if (!selectedIntegration) return;
    
    // Build auth config from form
    const authConfig = {};
    if (integrationForm.api_key) authConfig.api_key = integrationForm.api_key;
    if (integrationForm.username) authConfig.username = integrationForm.username;
    if (integrationForm.password) authConfig.password = integrationForm.password;
    if (integrationForm.client_id) authConfig.client_id = integrationForm.client_id;
    if (integrationForm.client_secret) authConfig.client_secret = integrationForm.client_secret;
    
    if (Object.keys(authConfig).length === 0) {
      toast.error('Please enter at least one credential');
      return;
    }
    
    setSaving(true);
    try {
      const res = await fetch(`${API_URL}/api/integrations/${selectedIntegration.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ auth_config: authConfig }),
      });
      
      if (res.ok) {
        toast.success('Credentials saved successfully!');
        // Clear form
        setIntegrationForm({
          api_key: '',
          username: '',
          password: '',
          client_id: '',
          client_secret: '',
        });
        loadConfig();
      } else {
        const result = await res.json();
        toast.error(result.detail || 'Failed to save credentials');
      }
    } catch (err) {
      toast.error('Failed to save credentials');
    } finally {
      setSaving(false);
    }
  };

  const handleTestIntegration = async () => {
    if (!selectedIntegration) return;
    
    setSaving(true);
    try {
      const res = await fetch(`${API_URL}/api/integrations/${selectedIntegration.id}/test`, {
        method: 'POST',
      });
      const result = await res.json();
      
      if (result.success) {
        toast.success(`Connection successful! ${result.mock_mode ? '(Mock Mode)' : ''}`);
      } else {
        toast.error(`Connection failed: ${result.message}`);
      }
    } catch (err) {
      toast.error('Connection test failed');
    } finally {
      setSaving(false);
    }
  };

  const tabs = [
    { id: 'notifications', label: 'Notifications', icon: Bell },
    { id: 'integrations', label: 'CRM Integrations', icon: Database },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center mclaren-glass-overlay p-4">
      <div className="mclaren-admin-panel w-full max-w-2xl max-h-[85vh] overflow-hidden animate-fade-in">
        {/* Header */}
        <div className="mclaren-admin-header px-6 py-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="mclaren-setup-icon">
                <Settings className="w-5 h-5" />
              </div>
              <div>
                <h2 className="font-bold text-lg text-foreground">Admin Settings</h2>
                <p className="text-xs text-muted-foreground">Configure integrations & notifications</p>
              </div>
            </div>
            
            <button
              onClick={onClose}
              className="mclaren-close-btn"
              data-testid="close-admin-settings"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="mclaren-admin-tabs px-6 py-3 flex gap-2 border-b border-border/30">
          {tabs.map(tab => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`mclaren-admin-tab ${activeTab === tab.id ? 'active' : ''}`}
                data-testid={`tab-${tab.id}`}
              >
                <Icon className="w-4 h-4" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Content */}
        <div className="px-6 py-5 overflow-y-auto max-h-[60vh] hide-scrollbar">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          ) : (
            <>
              {/* Notifications Tab */}
              {activeTab === 'notifications' && (
                <div className="space-y-6 animate-fade-in">
                  {/* Status Card */}
                  <div className={`mclaren-status-card ${notificationConfig.sms_configured ? 'configured' : 'not-configured'}`}>
                    <div className="flex items-center gap-3">
                      {notificationConfig.sms_configured ? (
                        <CheckCircle className="w-6 h-6 text-emerald-400" />
                      ) : (
                        <AlertCircle className="w-6 h-6 text-amber-400" />
                      )}
                      <div>
                        <p className="font-semibold text-foreground">
                          SMS Notifications: {notificationConfig.sms_configured ? 'Active' : 'Not Configured'}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {notificationConfig.sms_configured 
                            ? `From: ${notificationConfig.from_number}`
                            : 'Configure Twilio to enable SMS alerts'}
                        </p>
                      </div>
                    </div>
                    
                    {notificationConfig.pending_notifications > 0 && (
                      <div className="mt-3 flex items-center justify-between">
                        <span className="text-xs text-amber-400">
                          {notificationConfig.pending_notifications} notification(s) queued
                        </span>
                        <button
                          onClick={handleProcessQueue}
                          disabled={saving || !notificationConfig.sms_configured}
                          className="text-xs px-3 py-1.5 bg-amber-500/20 text-amber-400 rounded-lg hover:bg-amber-500/30 disabled:opacity-50"
                        >
                          Process Queue
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Twilio Configuration */}
                  <div className="mclaren-config-section">
                    <div className="flex items-center gap-2 mb-4">
                      <Phone className="w-5 h-5 text-primary" />
                      <h3 className="font-semibold text-foreground">Twilio SMS Configuration</h3>
                    </div>
                    
                    <div className="space-y-4">
                      <div className="mclaren-form-group">
                        <label className="mclaren-label">Account SID</label>
                        <input
                          type="text"
                          value={twilioForm.account_sid}
                          onChange={(e) => setTwilioForm(prev => ({ ...prev, account_sid: e.target.value }))}
                          placeholder="ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                          className="mclaren-input font-mono text-sm"
                          data-testid="twilio-account-sid"
                        />
                        <p className="text-xs text-muted-foreground mt-1">
                          Find this in your <a href="https://console.twilio.com" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">Twilio Console</a>
                        </p>
                      </div>
                      
                      <div className="mclaren-form-group">
                        <label className="mclaren-label">Auth Token</label>
                        <div className="relative">
                          <input
                            type={showSecrets.auth_token ? 'text' : 'password'}
                            value={twilioForm.auth_token}
                            onChange={(e) => setTwilioForm(prev => ({ ...prev, auth_token: e.target.value }))}
                            placeholder="xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                            className="mclaren-input font-mono text-sm pr-12"
                            data-testid="twilio-auth-token"
                          />
                          <button
                            type="button"
                            onClick={() => setShowSecrets(prev => ({ ...prev, auth_token: !prev.auth_token }))}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                          >
                            {showSecrets.auth_token ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </button>
                        </div>
                      </div>
                      
                      <div className="mclaren-form-group">
                        <label className="mclaren-label">From Phone Number</label>
                        <input
                          type="text"
                          value={twilioForm.from_number}
                          onChange={(e) => setTwilioForm(prev => ({ ...prev, from_number: e.target.value }))}
                          placeholder="+15551234567"
                          className="mclaren-input"
                          data-testid="twilio-from-number"
                        />
                        <p className="text-xs text-muted-foreground mt-1">
                          Your Twilio phone number in E.164 format
                        </p>
                      </div>
                      
                      <div className="flex gap-3 pt-2">
                        <button
                          onClick={handleTwilioSave}
                          disabled={saving || !twilioForm.account_sid || !twilioForm.auth_token || !twilioForm.from_number}
                          className="mclaren-btn-primary flex-1 gap-2"
                          data-testid="save-twilio-config"
                        >
                          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                          Save Configuration
                        </button>
                        
                        {notificationConfig.sms_configured && (
                          <button
                            onClick={handleTestNotification}
                            disabled={saving}
                            className="mclaren-btn-secondary gap-2"
                            data-testid="test-sms"
                          >
                            <TestTube className="w-4 h-4" />
                            Test SMS
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Notification Types Info */}
                  <div className="mclaren-info-card">
                    <h4 className="font-medium text-foreground mb-3">Notification Types</h4>
                    <div className="space-y-2 text-sm">
                      <div className="flex items-center gap-2">
                        <span className="text-lg">🔥</span>
                        <span className="text-muted-foreground">Hot Lead Alerts - Instant SMS when leads become hot</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-lg">📊</span>
                        <span className="text-muted-foreground">Status Changes - Notify when lead status changes</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-lg">⏰</span>
                        <span className="text-muted-foreground">Follow-up Reminders - Scheduled reminder notifications</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Integrations Tab */}
              {activeTab === 'integrations' && (
                <div className="space-y-6 animate-fade-in">
                  {/* Health Overview */}
                  {crmConfig.health && (
                    <div className="grid grid-cols-4 gap-3">
                      <div className="mclaren-mini-stat healthy">
                        <span className="text-xl font-bold">{crmConfig.health.healthy}</span>
                        <span className="text-xs">Healthy</span>
                      </div>
                      <div className="mclaren-mini-stat degraded">
                        <span className="text-xl font-bold">{crmConfig.health.degraded}</span>
                        <span className="text-xs">Degraded</span>
                      </div>
                      <div className="mclaren-mini-stat unhealthy">
                        <span className="text-xl font-bold">{crmConfig.health.unhealthy}</span>
                        <span className="text-xs">Unhealthy</span>
                      </div>
                      <div className="mclaren-mini-stat mock">
                        <span className="text-xl font-bold">{crmConfig.health.mock_mode}</span>
                        <span className="text-xs">Mock</span>
                      </div>
                    </div>
                  )}

                  {/* Mock Mode Notice */}
                  <div className="mclaren-notice-card">
                    <AlertCircle className="w-5 h-5 text-amber-400 flex-shrink-0" />
                    <div>
                      <p className="font-medium text-amber-400">CRM Connectors in Mock Mode</p>
                      <p className="text-xs text-amber-400/70 mt-1">
                        All integrations are using simulated data. To connect to real CRMs, 
                        provide API credentials through the Connection Wizard in the Import menu.
                      </p>
                    </div>
                  </div>

                  {/* Integration List */}
                  <div className="mclaren-config-section">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-2">
                        <Plug className="w-5 h-5 text-primary" />
                        <h3 className="font-semibold text-foreground">Active Integrations</h3>
                      </div>
                      <button
                        onClick={loadConfig}
                        className="mclaren-btn-icon-sm"
                        title="Refresh"
                      >
                        <RefreshCw className="w-4 h-4" />
                      </button>
                    </div>
                    
                    <div className="space-y-2">
                      {crmConfig.integrations.length === 0 ? (
                        <p className="text-sm text-muted-foreground text-center py-6">
                          No integrations configured. Use the Connection Wizard to add one.
                        </p>
                      ) : (
                        crmConfig.integrations.map((integration) => (
                          <div key={integration.id} className="mclaren-integration-row">
                            <div className="flex items-center gap-3">
                              <div className={`w-2.5 h-2.5 rounded-full ${
                                integration.status === 'healthy' ? 'bg-emerald-500' :
                                integration.status === 'degraded' ? 'bg-amber-500' : 'bg-red-500'
                              }`} />
                              <div>
                                <p className="font-medium text-foreground text-sm">{integration.name}</p>
                                <p className="text-xs text-muted-foreground">
                                  {integration.adapter_name} • {integration.data_type}
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              {integration.mock_mode && (
                                <span className="text-[10px] px-2 py-0.5 bg-amber-500/20 text-amber-400 rounded font-medium">
                                  MOCK
                                </span>
                              )}
                              <ChevronRight className="w-4 h-4 text-muted-foreground" />
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  {/* Supported CRMs */}
                  <div className="mclaren-info-card">
                    <h4 className="font-medium text-foreground mb-3">Supported CRM Vendors</h4>
                    <div className="grid grid-cols-2 gap-2 text-sm text-muted-foreground">
                      <span>• VinSolutions</span>
                      <span>• DealerSocket</span>
                      <span>• elead (CDK)</span>
                      <span>• DealerTrack</span>
                      <span>• Reynolds & Reynolds</span>
                      <span>• ProMax</span>
                      <span>• CDK Drive</span>
                      <span>• Custom REST API</span>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminSettingsPanel;

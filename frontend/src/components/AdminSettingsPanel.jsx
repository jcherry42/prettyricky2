import React, { useState, useEffect, useCallback } from 'react';
import { 
  X, Settings, Phone, Database, Shield, Check, Loader2, 
  Eye, EyeOff, AlertCircle, CheckCircle, Bell, Plug,
  ChevronRight, Save, RefreshCw, Trash2, TestTube, Key, ToggleLeft, ToggleRight, ArrowLeft,
  Upload, Building2, User, MessageSquare, Clock, History
} from 'lucide-react';
import { toast } from 'sonner';
import { useSales } from '../context/SalesContext';

const API_URL = process.env.REACT_APP_BACKEND_URL;

/**
 * Admin Settings Panel
 * Configure integrations, notifications, and system settings
 * Porsche/McLaren premium design
 */
export const AdminSettingsPanel = ({ onClose }) => {
  const { 
    dealership, 
    salesperson, 
    setDealership, 
    setSalesperson,
    toggleImport 
  } = useSales();
  
  const [activeTab, setActiveTab] = useState('dealership');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  // Dealership form state
  const [dealershipForm, setDealershipForm] = useState({
    name: '',
    brand: '',
    location: '',
  });
  const [salespersonForm, setSalespersonForm] = useState({
    name: '',
    preferredPhrase: 'Hey',
  });
  
  // Notification config
  const [notificationConfig, setNotificationConfig] = useState({
    sms_configured: false,
    from_number: null,
    pending_notifications: 0,
  });
  
  // Notification history
  const [notificationHistory, setNotificationHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  
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
    // Initialize form from context
    setDealershipForm({
      name: dealership.name || '',
      brand: dealership.brand || '',
      location: dealership.location || '',
    });
    setSalespersonForm({
      name: salesperson.name || '',
      preferredPhrase: salesperson.preferredPhrase || 'Hey',
    });
  }, [loadConfig, dealership, salesperson]);

  const loadNotificationHistory = useCallback(async () => {
    setHistoryLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/notifications?limit=50`);
      if (res.ok) {
        const data = await res.json();
        setNotificationHistory(data.notifications || []);
      }
    } catch (err) {
      console.error('Failed to load notification history:', err);
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab === 'history') {
      loadNotificationHistory();
    }
  }, [activeTab, loadNotificationHistory]);

  const handleDealershipSave = () => {
    setDealership(dealershipForm);
    setSalesperson(salespersonForm);
    toast.success('Dealership settings saved!');
  };

  const handleOpenImport = () => {
    onClose();
    setTimeout(() => toggleImport(true), 100);
  };

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
    { id: 'dealership', label: 'Dealership', icon: Building2 },
    { id: 'import', label: 'Data Import', icon: Upload },
    { id: 'notifications', label: 'Notifications', icon: Bell },
    { id: 'integrations', label: 'CRM', icon: Database },
    { id: 'history', label: 'History', icon: History },
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
                <h2 className="font-bold text-lg text-foreground">Check Engine</h2>
                <p className="text-xs text-muted-foreground">All settings & configurations</p>
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
              {/* Dealership Tab */}
              {activeTab === 'dealership' && (
                <div className="space-y-6 animate-fade-in">
                  {/* Dealership Info */}
                  <div className="mclaren-config-section">
                    <div className="flex items-center gap-2 mb-4">
                      <Building2 className="w-5 h-5 text-primary" />
                      <h3 className="font-semibold text-foreground">Dealership Information</h3>
                    </div>
                    
                    <div className="space-y-4">
                      <div className="mclaren-form-group">
                        <label className="mclaren-label">Dealership Name</label>
                        <input
                          type="text"
                          value={dealershipForm.name}
                          onChange={(e) => setDealershipForm(prev => ({ ...prev, name: e.target.value }))}
                          placeholder="e.g., Premier Motors"
                          className="mclaren-input"
                          data-testid="dealership-name-input"
                        />
                      </div>
                      
                      <div className="mclaren-form-group">
                        <label className="mclaren-label">Brand / Manufacturer</label>
                        <input
                          type="text"
                          value={dealershipForm.brand}
                          onChange={(e) => setDealershipForm(prev => ({ ...prev, brand: e.target.value }))}
                          placeholder="e.g., BMW, Toyota, Multi-Brand"
                          className="mclaren-input"
                          data-testid="dealership-brand-input"
                        />
                      </div>
                      
                      <div className="mclaren-form-group">
                        <label className="mclaren-label">Location</label>
                        <input
                          type="text"
                          value={dealershipForm.location}
                          onChange={(e) => setDealershipForm(prev => ({ ...prev, location: e.target.value }))}
                          placeholder="e.g., Los Angeles, CA"
                          className="mclaren-input"
                          data-testid="dealership-location-input"
                        />
                      </div>
                    </div>
                  </div>
                  
                  {/* Salesperson Info */}
                  <div className="mclaren-config-section">
                    <div className="flex items-center gap-2 mb-4">
                      <User className="w-5 h-5 text-primary" />
                      <h3 className="font-semibold text-foreground">Your Information</h3>
                    </div>
                    
                    <div className="space-y-4">
                      <div className="mclaren-form-group">
                        <label className="mclaren-label">Your Name</label>
                        <input
                          type="text"
                          value={salespersonForm.name}
                          onChange={(e) => setSalespersonForm(prev => ({ ...prev, name: e.target.value }))}
                          placeholder="e.g., Alex Johnson"
                          className="mclaren-input"
                          data-testid="salesperson-name-input"
                        />
                      </div>
                      
                      <div className="mclaren-form-group">
                        <label className="mclaren-label">Preferred Greeting</label>
                        <div className="grid grid-cols-3 gap-2">
                          {['Hey', 'Hi', 'Hello'].map((phrase) => (
                            <button
                              key={phrase}
                              onClick={() => setSalespersonForm(prev => ({ ...prev, preferredPhrase: phrase }))}
                              className={`mclaren-option-btn py-3 justify-center ${salespersonForm.preferredPhrase === phrase ? 'selected' : ''}`}
                              data-testid={`greeting-${phrase.toLowerCase()}`}
                            >
                              {phrase}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  <button
                    onClick={handleDealershipSave}
                    className="mclaren-btn-primary w-full gap-2"
                    data-testid="save-dealership-settings"
                  >
                    <Save className="w-4 h-4" />
                    Save Settings
                  </button>
                </div>
              )}
              
              {/* Data Import Tab */}
              {activeTab === 'import' && (
                <div className="space-y-6 animate-fade-in">
                  <div className="mclaren-config-section">
                    <div className="flex items-center gap-2 mb-4">
                      <Upload className="w-5 h-5 text-primary" />
                      <h3 className="font-semibold text-foreground">Data Import Options</h3>
                    </div>
                    
                    <p className="text-sm text-muted-foreground mb-4">
                      Import your customer and vehicle data from various sources.
                    </p>
                    
                    <div className="space-y-3">
                      <button
                        onClick={handleOpenImport}
                        className="mclaren-option-btn w-full"
                        data-testid="open-import-wizard"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                            <Database className="w-5 h-5 text-primary" />
                          </div>
                          <div className="text-left">
                            <p className="font-medium text-foreground">Connection Wizard</p>
                            <p className="text-xs text-muted-foreground">Set up CRM integrations, import CSV, or connect to APIs</p>
                          </div>
                        </div>
                        <ChevronRight className="w-5 h-5 text-muted-foreground" />
                      </button>
                    </div>
                  </div>
                  
                  {/* Integration Status Summary */}
                  {crmConfig.health && (
                    <div className="mclaren-config-section">
                      <div className="flex items-center gap-2 mb-4">
                        <Plug className="w-5 h-5 text-primary" />
                        <h3 className="font-semibold text-foreground">Current Integrations</h3>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-3">
                        <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                          <p className="text-2xl font-bold text-emerald-400">{crmConfig.health.healthy}</p>
                          <p className="text-xs text-emerald-400/70">Active</p>
                        </div>
                        <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
                          <p className="text-2xl font-bold text-amber-400">{crmConfig.health.mock_mode}</p>
                          <p className="text-xs text-amber-400/70">Mock Mode</p>
                        </div>
                      </div>
                      
                      <p className="text-xs text-muted-foreground mt-3">
                        Manage credentials in the CRM tab to switch from mock to live data.
                      </p>
                    </div>
                  )}
                </div>
              )}
              
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
                  {/* Integration Detail View */}
                  {selectedIntegration ? (
                    <div className="space-y-5">
                      {/* Back button */}
                      <button
                        onClick={() => setSelectedIntegration(null)}
                        className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
                      >
                        <ArrowLeft className="w-4 h-4" />
                        Back to Integrations
                      </button>
                      
                      {/* Integration Header */}
                      <div className="mclaren-config-section">
                        <div className="flex items-center justify-between mb-4">
                          <div className="flex items-center gap-3">
                            <div className={`w-3 h-3 rounded-full ${
                              selectedIntegration.status === 'healthy' ? 'bg-emerald-500' :
                              selectedIntegration.status === 'degraded' ? 'bg-amber-500' : 'bg-red-500'
                            }`} />
                            <div>
                              <h3 className="font-semibold text-foreground">{selectedIntegration.name}</h3>
                              <p className="text-xs text-muted-foreground">
                                {selectedIntegration.adapter_name || selectedIntegration.adapter_type}
                              </p>
                            </div>
                          </div>
                          
                          {/* Mock Mode Toggle */}
                          <button
                            onClick={() => handleToggleMockMode(selectedIntegration)}
                            disabled={saving}
                            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                              selectedIntegration.mock_mode 
                                ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                                : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                            }`}
                            data-testid="toggle-mock-mode"
                          >
                            {selectedIntegration.mock_mode ? (
                              <>
                                <ToggleLeft className="w-4 h-4" />
                                Mock Mode
                              </>
                            ) : (
                              <>
                                <ToggleRight className="w-4 h-4" />
                                Live Mode
                              </>
                            )}
                          </button>
                        </div>
                        
                        {/* Connection Status */}
                        <div className={`p-3 rounded-lg mb-4 ${
                          selectedIntegration.mock_mode 
                            ? 'bg-amber-500/10 border border-amber-500/20'
                            : selectedIntegration.status === 'healthy'
                              ? 'bg-emerald-500/10 border border-emerald-500/20'
                              : 'bg-red-500/10 border border-red-500/20'
                        }`}>
                          <p className="text-sm">
                            {selectedIntegration.mock_mode ? (
                              <span className="text-amber-400">Using simulated data. Add credentials and disable mock mode for live data.</span>
                            ) : selectedIntegration.status === 'healthy' ? (
                              <span className="text-emerald-400">Connected and syncing live data from CRM.</span>
                            ) : (
                              <span className="text-red-400">Connection issue. Check credentials and try again.</span>
                            )}
                          </p>
                        </div>
                        
                        {/* Test Connection */}
                        <button
                          onClick={handleTestIntegration}
                          disabled={saving}
                          className="mclaren-btn-secondary w-full gap-2"
                          data-testid="test-integration"
                        >
                          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <TestTube className="w-4 h-4" />}
                          Test Connection
                        </button>
                      </div>
                      
                      {/* API Credentials */}
                      <div className="mclaren-config-section">
                        <div className="flex items-center gap-2 mb-4">
                          <Key className="w-5 h-5 text-primary" />
                          <h3 className="font-semibold text-foreground">API Credentials</h3>
                        </div>
                        <p className="text-xs text-muted-foreground mb-4">
                          Enter your CRM API credentials to enable live data synchronization.
                        </p>
                        
                        <div className="space-y-4">
                          {/* API Key */}
                          <div className="mclaren-form-group">
                            <label className="mclaren-label">API Key</label>
                            <div className="relative">
                              <input
                                type={showIntegrationSecrets.api_key ? 'text' : 'password'}
                                value={integrationForm.api_key}
                                onChange={(e) => setIntegrationForm(prev => ({ ...prev, api_key: e.target.value }))}
                                placeholder="Enter API key"
                                className="mclaren-input font-mono text-sm pr-12"
                                data-testid="integration-api-key"
                              />
                              <button
                                type="button"
                                onClick={() => setShowIntegrationSecrets(prev => ({ ...prev, api_key: !prev.api_key }))}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                              >
                                {showIntegrationSecrets.api_key ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                              </button>
                            </div>
                          </div>
                          
                          {/* Username/Password for basic auth */}
                          <div className="grid grid-cols-2 gap-3">
                            <div className="mclaren-form-group">
                              <label className="mclaren-label">Username (Optional)</label>
                              <input
                                type="text"
                                value={integrationForm.username}
                                onChange={(e) => setIntegrationForm(prev => ({ ...prev, username: e.target.value }))}
                                placeholder="Username"
                                className="mclaren-input text-sm"
                                data-testid="integration-username"
                              />
                            </div>
                            <div className="mclaren-form-group">
                              <label className="mclaren-label">Password (Optional)</label>
                              <div className="relative">
                                <input
                                  type={showIntegrationSecrets.password ? 'text' : 'password'}
                                  value={integrationForm.password}
                                  onChange={(e) => setIntegrationForm(prev => ({ ...prev, password: e.target.value }))}
                                  placeholder="Password"
                                  className="mclaren-input text-sm pr-10"
                                  data-testid="integration-password"
                                />
                                <button
                                  type="button"
                                  onClick={() => setShowIntegrationSecrets(prev => ({ ...prev, password: !prev.password }))}
                                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                                >
                                  {showIntegrationSecrets.password ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                                </button>
                              </div>
                            </div>
                          </div>
                          
                          {/* OAuth credentials */}
                          <div className="grid grid-cols-2 gap-3">
                            <div className="mclaren-form-group">
                              <label className="mclaren-label">Client ID (OAuth)</label>
                              <input
                                type="text"
                                value={integrationForm.client_id}
                                onChange={(e) => setIntegrationForm(prev => ({ ...prev, client_id: e.target.value }))}
                                placeholder="OAuth Client ID"
                                className="mclaren-input text-sm"
                                data-testid="integration-client-id"
                              />
                            </div>
                            <div className="mclaren-form-group">
                              <label className="mclaren-label">Client Secret (OAuth)</label>
                              <div className="relative">
                                <input
                                  type={showIntegrationSecrets.client_secret ? 'text' : 'password'}
                                  value={integrationForm.client_secret}
                                  onChange={(e) => setIntegrationForm(prev => ({ ...prev, client_secret: e.target.value }))}
                                  placeholder="OAuth Client Secret"
                                  className="mclaren-input text-sm pr-10"
                                  data-testid="integration-client-secret"
                                />
                                <button
                                  type="button"
                                  onClick={() => setShowIntegrationSecrets(prev => ({ ...prev, client_secret: !prev.client_secret }))}
                                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                                >
                                  {showIntegrationSecrets.client_secret ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                                </button>
                              </div>
                            </div>
                          </div>
                          
                          <button
                            onClick={handleSaveIntegrationCredentials}
                            disabled={saving}
                            className="mclaren-btn-primary w-full gap-2 mt-2"
                            data-testid="save-integration-credentials"
                          >
                            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                            Save Credentials
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <>
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
                      {crmConfig.health && crmConfig.health.mock_mode > 0 && (
                        <div className="mclaren-notice-card">
                          <AlertCircle className="w-5 h-5 text-amber-400 flex-shrink-0" />
                          <div>
                            <p className="font-medium text-amber-400">CRM Connectors in Mock Mode</p>
                            <p className="text-xs text-amber-400/70 mt-1">
                              {crmConfig.health.mock_mode} integration(s) using simulated data. Click an integration to add credentials.
                            </p>
                          </div>
                        </div>
                      )}

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
                              <button
                                key={integration.id}
                                onClick={() => handleSelectIntegration(integration)}
                                className="mclaren-integration-row w-full text-left"
                                data-testid={`integration-${integration.id}`}
                              >
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
                              </button>
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
                    </>
                  )}
                </div>
              )}
              
              {/* Notification History Tab */}
              {activeTab === 'history' && (
                <div className="space-y-6 animate-fade-in">
                  <div className="mclaren-config-section">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-2">
                        <History className="w-5 h-5 text-primary" />
                        <h3 className="font-semibold text-foreground">Notification History</h3>
                      </div>
                      <button
                        onClick={loadNotificationHistory}
                        className="mclaren-btn-icon-sm"
                        title="Refresh"
                      >
                        <RefreshCw className={`w-4 h-4 ${historyLoading ? 'animate-spin' : ''}`} />
                      </button>
                    </div>
                    
                    {historyLoading ? (
                      <div className="flex items-center justify-center py-8">
                        <Loader2 className="w-6 h-6 animate-spin text-primary" />
                      </div>
                    ) : notificationHistory.length === 0 ? (
                      <div className="text-center py-8">
                        <MessageSquare className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
                        <p className="text-sm text-muted-foreground">No notifications yet</p>
                        <p className="text-xs text-muted-foreground/70 mt-1">
                          Notifications will appear here when hot leads trigger alerts
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-2 max-h-[350px] overflow-y-auto hide-scrollbar">
                        {notificationHistory.map((notif, idx) => (
                          <div
                            key={notif.id || idx}
                            className="p-3 rounded-lg bg-card/50 border border-border/30 hover:border-border/50 transition-colors"
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1">
                                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium ${
                                    notif.notification_type === 'hot_lead' 
                                      ? 'bg-red-500/20 text-red-400' 
                                      : notif.notification_type === 'status_change'
                                        ? 'bg-blue-500/20 text-blue-400'
                                        : 'bg-gray-500/20 text-gray-400'
                                  }`}>
                                    {notif.notification_type === 'hot_lead' && '🔥'}
                                    {notif.notification_type === 'status_change' && '📊'}
                                    {notif.notification_type?.replace('_', ' ').toUpperCase()}
                                  </span>
                                  <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium ${
                                    notif.status === 'sent' 
                                      ? 'bg-emerald-500/20 text-emerald-400' 
                                      : notif.status === 'failed'
                                        ? 'bg-red-500/20 text-red-400'
                                        : notif.status === 'queued'
                                          ? 'bg-amber-500/20 text-amber-400'
                                          : 'bg-gray-500/20 text-gray-400'
                                  }`}>
                                    {notif.status?.toUpperCase()}
                                  </span>
                                </div>
                                <p className="text-sm text-foreground truncate">
                                  {notif.payload?.customer_name || notif.recipient || 'Unknown'}
                                </p>
                                {notif.payload?.vehicle_interest && (
                                  <p className="text-xs text-muted-foreground truncate">
                                    {notif.payload.vehicle_interest}
                                  </p>
                                )}
                                {notif.error_message && (
                                  <p className="text-xs text-red-400 mt-1 truncate">
                                    Error: {notif.error_message}
                                  </p>
                                )}
                              </div>
                              <div className="text-right flex-shrink-0">
                                <p className="text-[10px] text-muted-foreground">
                                  {notif.created_at ? new Date(notif.created_at).toLocaleDateString() : ''}
                                </p>
                                <p className="text-[10px] text-muted-foreground">
                                  {notif.created_at ? new Date(notif.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                                </p>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  
                  {/* Stats Summary */}
                  {notificationHistory.length > 0 && (
                    <div className="grid grid-cols-3 gap-3">
                      <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-center">
                        <p className="text-lg font-bold text-emerald-400">
                          {notificationHistory.filter(n => n.status === 'sent').length}
                        </p>
                        <p className="text-xs text-emerald-400/70">Sent</p>
                      </div>
                      <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-center">
                        <p className="text-lg font-bold text-amber-400">
                          {notificationHistory.filter(n => n.status === 'queued' || n.status === 'scheduled').length}
                        </p>
                        <p className="text-xs text-amber-400/70">Queued</p>
                      </div>
                      <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-center">
                        <p className="text-lg font-bold text-red-400">
                          {notificationHistory.filter(n => n.status === 'failed').length}
                        </p>
                        <p className="text-xs text-red-400/70">Failed</p>
                      </div>
                    </div>
                  )}
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

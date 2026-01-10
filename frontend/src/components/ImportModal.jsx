import React, { useState, useCallback, useEffect } from 'react';
import { X, Upload, Link, FileText, Check, AlertCircle, Loader2, RefreshCw, Database, Trash2, Clock, Download, Plug, Settings, TestTube, Zap, ChevronRight, ToggleLeft, ToggleRight, Plus, CheckCircle, XCircle, AlertTriangle, Wand2 } from 'lucide-react';
import { useSales } from '../context/SalesContext';
import { toast } from 'sonner';
import { ConnectionWizard } from './ConnectionWizard';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

// CRM Integration Settings Panel Component
const CRMIntegrationPanel = () => {
  const [integrations, setIntegrations] = useState([]);
  const [availableAdapters, setAvailableAdapters] = useState([]);
  const [healthSummary, setHealthSummary] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showAddNew, setShowAddNew] = useState(false);
  const [showWizard, setShowWizard] = useState(false);
  const [actionLoading, setActionLoading] = useState({});
  
  // New integration form state
  const [newIntegration, setNewIntegration] = useState({
    name: '',
    adapter_type: '',
    base_url: '',
    api_key: '',
    mock_mode: true,
    data_type: 'customers'
  });

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [integrationsRes, adaptersRes, healthRes] = await Promise.all([
        fetch(`${BACKEND_URL}/api/integrations`),
        fetch(`${BACKEND_URL}/api/integrations/adapters`),
        fetch(`${BACKEND_URL}/api/integrations/health`)
      ]);
      
      const integrationsData = await integrationsRes.json();
      const adaptersData = await adaptersRes.json();
      const healthData = await healthRes.json();
      
      setIntegrations(integrationsData.integrations || []);
      setAvailableAdapters(adaptersData.adapters || []);
      setHealthSummary(healthData);
    } catch (err) {
      console.error('Failed to load CRM data:', err);
      toast.error('Failed to load CRM integrations');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleTestConnection = async (integrationId) => {
    setActionLoading(prev => ({ ...prev, [`test_${integrationId}`]: true }));
    try {
      const response = await fetch(`${BACKEND_URL}/api/integrations/${integrationId}/test`, {
        method: 'POST'
      });
      const result = await response.json();
      
      if (result.success) {
        toast.success('Connection successful!', {
          description: result.mock_mode ? 'Mock mode enabled' : result.message
        });
      } else {
        toast.error('Connection failed', { description: result.message });
      }
      await loadData();
    } catch (err) {
      toast.error('Test failed');
    } finally {
      setActionLoading(prev => ({ ...prev, [`test_${integrationId}`]: false }));
    }
  };

  const handleSync = async (integrationId) => {
    setActionLoading(prev => ({ ...prev, [`sync_${integrationId}`]: true }));
    try {
      const response = await fetch(`${BACKEND_URL}/api/integrations/${integrationId}/sync`, {
        method: 'POST'
      });
      const result = await response.json();
      
      if (result.success) {
        toast.success(`Synced ${result.records_fetched} records`, {
          description: `Completed in ${result.duration_ms}ms`
        });
      } else {
        toast.error('Sync failed', { description: result.errors?.[0] });
      }
      await loadData();
    } catch (err) {
      toast.error('Sync failed');
    } finally {
      setActionLoading(prev => ({ ...prev, [`sync_${integrationId}`]: false }));
    }
  };

  const handleToggleMock = async (integrationId, currentMockMode) => {
    setActionLoading(prev => ({ ...prev, [`mock_${integrationId}`]: true }));
    try {
      await fetch(`${BACKEND_URL}/api/integrations/${integrationId}/toggle-mock?enabled=${!currentMockMode}`, {
        method: 'POST'
      });
      toast.success(`Mock mode ${!currentMockMode ? 'enabled' : 'disabled'}`);
      await loadData();
    } catch (err) {
      toast.error('Failed to toggle mock mode');
    } finally {
      setActionLoading(prev => ({ ...prev, [`mock_${integrationId}`]: false }));
    }
  };

  const handleDelete = async (integrationId, name) => {
    if (!confirm(`Delete "${name}" integration? This cannot be undone.`)) return;
    
    try {
      await fetch(`${BACKEND_URL}/api/integrations/${integrationId}`, { method: 'DELETE' });
      toast.success('Integration deleted');
      await loadData();
    } catch (err) {
      toast.error('Delete failed');
    }
  };

  const handleCreateIntegration = async () => {
    if (!newIntegration.name || !newIntegration.adapter_type) {
      toast.error('Please fill in required fields');
      return;
    }

    setActionLoading(prev => ({ ...prev, create: true }));
    try {
      const response = await fetch(`${BACKEND_URL}/api/integrations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newIntegration.name,
          adapter_type: newIntegration.adapter_type,
          base_url: newIntegration.base_url || `https://api.${newIntegration.adapter_type}.com`,
          auth_config: {
            method: 'api_key',
            api_key: newIntegration.api_key || 'mock_key'
          },
          data_type: newIntegration.data_type,
          mock_mode: newIntegration.mock_mode
        })
      });

      const result = await response.json();
      
      if (result.success) {
        toast.success('Integration created!', {
          description: newIntegration.mock_mode ? 'Mock mode enabled for testing' : 'Ready to connect'
        });
        setShowAddNew(false);
        setNewIntegration({
          name: '',
          adapter_type: '',
          base_url: '',
          api_key: '',
          mock_mode: true,
          data_type: 'customers'
        });
        await loadData();
      } else {
        toast.error('Failed to create integration');
      }
    } catch (err) {
      toast.error('Failed to create integration');
    } finally {
      setActionLoading(prev => ({ ...prev, create: false }));
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'healthy': return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'degraded': return <AlertTriangle className="w-4 h-4 text-yellow-500" />;
      case 'unhealthy': return <XCircle className="w-4 h-4 text-red-500" />;
      default: return <AlertCircle className="w-4 h-4 text-gray-400" />;
    }
  };

  const getStatusBg = (status) => {
    switch (status) {
      case 'healthy': return 'bg-green-500/10 border-green-500/20';
      case 'degraded': return 'bg-yellow-500/10 border-yellow-500/20';
      case 'unhealthy': return 'bg-red-500/10 border-red-500/20';
      default: return 'bg-gray-500/10 border-gray-500/20';
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Health Summary */}
      {healthSummary && (
        <div className="grid grid-cols-4 gap-2">
          <div className="text-center p-2 rounded-lg bg-green-500/10">
            <div className="text-lg font-bold text-green-400">{healthSummary.healthy}</div>
            <div className="text-[10px] text-green-400/70">Healthy</div>
          </div>
          <div className="text-center p-2 rounded-lg bg-yellow-500/10">
            <div className="text-lg font-bold text-yellow-400">{healthSummary.degraded}</div>
            <div className="text-[10px] text-yellow-400/70">Degraded</div>
          </div>
          <div className="text-center p-2 rounded-lg bg-red-500/10">
            <div className="text-lg font-bold text-red-400">{healthSummary.unhealthy}</div>
            <div className="text-[10px] text-red-400/70">Unhealthy</div>
          </div>
          <div className="text-center p-2 rounded-lg bg-amber-500/10">
            <div className="text-lg font-bold text-amber-400">{healthSummary.mock_mode}</div>
            <div className="text-[10px] text-amber-400/70">Mock</div>
          </div>
        </div>
      )}

      {/* Add New Button */}
      {!showAddNew && (
        <button
          onClick={() => setShowAddNew(true)}
          className="w-full py-3 px-4 border-2 border-dashed border-border rounded-xl text-muted-foreground hover:border-primary hover:text-primary transition-colors flex items-center justify-center gap-2"
          data-testid="add-integration-btn"
        >
          <Plus className="w-5 h-5" />
          Add CRM Integration
        </button>
      )}

      {/* Add New Form */}
      {showAddNew && (
        <div className="p-4 rounded-xl border border-primary/30 bg-primary/5 space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="font-medium text-foreground">New Integration</h4>
            <button
              onClick={() => setShowAddNew(false)}
              className="text-muted-foreground hover:text-foreground"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* CRM Type Selector */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">CRM Type *</label>
            <select
              value={newIntegration.adapter_type}
              onChange={(e) => {
                const adapter = availableAdapters.find(a => a.type === e.target.value);
                setNewIntegration(prev => ({
                  ...prev,
                  adapter_type: e.target.value,
                  name: prev.name || adapter?.name || ''
                }));
              }}
              className="w-full px-3 py-2 bg-muted/30 border border-border rounded-lg text-foreground text-sm"
              data-testid="adapter-type-select"
            >
              <option value="">Select CRM...</option>
              {availableAdapters.map(adapter => (
                <option key={adapter.type} value={adapter.type}>
                  {adapter.name} ({adapter.vendor})
                </option>
              ))}
            </select>
          </div>

          {/* Name */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Display Name *</label>
            <input
              type="text"
              value={newIntegration.name}
              onChange={(e) => setNewIntegration(prev => ({ ...prev, name: e.target.value }))}
              placeholder="My VinSolutions Connection"
              className="w-full px-3 py-2 bg-muted/30 border border-border rounded-lg text-foreground text-sm"
              data-testid="integration-name-input"
            />
          </div>

          {/* API Key (optional in mock mode) */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">
              API Key {newIntegration.mock_mode && <span className="text-muted-foreground/50">(optional in mock mode)</span>}
            </label>
            <input
              type="password"
              value={newIntegration.api_key}
              onChange={(e) => setNewIntegration(prev => ({ ...prev, api_key: e.target.value }))}
              placeholder={newIntegration.mock_mode ? "Not required for mock mode" : "Enter your API key"}
              className="w-full px-3 py-2 bg-muted/30 border border-border rounded-lg text-foreground text-sm"
              data-testid="api-key-input"
            />
          </div>

          {/* Data Type */}
          <div className="flex gap-2">
            {['customers', 'vehicles'].map(type => (
              <button
                key={type}
                onClick={() => setNewIntegration(prev => ({ ...prev, data_type: type }))}
                className={`flex-1 py-2 px-3 text-sm font-medium rounded-lg transition-all ${
                  newIntegration.data_type === type
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted/30 text-muted-foreground hover:text-foreground'
                }`}
              >
                {type === 'customers' ? 'Customers' : 'Vehicles'}
              </button>
            ))}
          </div>

          {/* Mock Mode Toggle */}
          <div className="flex items-center justify-between p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
            <div>
              <p className="text-sm font-medium text-amber-400">Mock Mode</p>
              <p className="text-[10px] text-amber-400/70">Generate test data without real CRM</p>
            </div>
            <button
              onClick={() => setNewIntegration(prev => ({ ...prev, mock_mode: !prev.mock_mode }))}
              className="text-amber-400"
              data-testid="mock-mode-toggle"
            >
              {newIntegration.mock_mode ? (
                <ToggleRight className="w-8 h-8" />
              ) : (
                <ToggleLeft className="w-8 h-8" />
              )}
            </button>
          </div>

          {/* Create Button */}
          <button
            onClick={handleCreateIntegration}
            disabled={actionLoading.create || !newIntegration.name || !newIntegration.adapter_type}
            className="w-full ios-btn-primary py-3 text-sm gap-2"
            data-testid="create-integration-btn"
          >
            {actionLoading.create ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Plug className="w-4 h-4" />
            )}
            Create Integration
          </button>
        </div>
      )}

      {/* Existing Integrations */}
      {integrations.length === 0 && !showAddNew ? (
        <div className="text-center py-8">
          <Plug className="w-12 h-12 mx-auto text-muted-foreground/30 mb-3" />
          <p className="text-muted-foreground">No CRM integrations configured</p>
          <p className="text-xs text-muted-foreground mt-1">
            Add a CRM to sync customer and vehicle data
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {integrations.map(integration => (
            <div
              key={integration.id}
              className={`p-3 rounded-xl border ${getStatusBg(integration.health_status)}`}
              data-testid={`integration-${integration.id}`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-start gap-3 flex-1 min-w-0">
                  {getStatusIcon(integration.health_status)}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h4 className="font-medium text-foreground text-sm truncate">{integration.name}</h4>
                      {integration.mock_mode && (
                        <span className="px-1.5 py-0.5 text-[9px] font-bold rounded bg-amber-500/20 text-amber-400">
                          MOCK
                        </span>
                      )}
                    </div>
                    <p className="text-[10px] text-muted-foreground">
                      {integration.adapter_name || integration.adapter_type} • {integration.data_type}
                    </p>
                    {integration.last_sync_at && (
                      <p className="text-[10px] text-muted-foreground">
                        Last sync: {new Date(integration.last_sync_at).toLocaleString()}
                        {integration.sync_stats?.records_fetched && (
                          <span className="ml-1">({integration.sync_stats.records_fetched} records)</span>
                        )}
                      </p>
                    )}
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => handleTestConnection(integration.id)}
                    disabled={actionLoading[`test_${integration.id}`]}
                    className="ios-btn w-7 h-7 text-muted-foreground hover:text-blue-500"
                    title="Test connection"
                  >
                    {actionLoading[`test_${integration.id}`] ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <TestTube className="w-3.5 h-3.5" />
                    )}
                  </button>
                  <button
                    onClick={() => handleSync(integration.id)}
                    disabled={actionLoading[`sync_${integration.id}`]}
                    className="ios-btn w-7 h-7 text-muted-foreground hover:text-green-500"
                    title="Sync data"
                  >
                    {actionLoading[`sync_${integration.id}`] ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <RefreshCw className="w-3.5 h-3.5" />
                    )}
                  </button>
                  <button
                    onClick={() => handleToggleMock(integration.id, integration.mock_mode)}
                    disabled={actionLoading[`mock_${integration.id}`]}
                    className={`ios-btn w-7 h-7 ${integration.mock_mode ? 'text-amber-500' : 'text-muted-foreground hover:text-amber-500'}`}
                    title={integration.mock_mode ? 'Disable mock mode' : 'Enable mock mode'}
                  >
                    {actionLoading[`mock_${integration.id}`] ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : integration.mock_mode ? (
                      <ToggleRight className="w-3.5 h-3.5" />
                    ) : (
                      <ToggleLeft className="w-3.5 h-3.5" />
                    )}
                  </button>
                  <button
                    onClick={() => handleDelete(integration.id, integration.name)}
                    className="ios-btn w-7 h-7 text-muted-foreground hover:text-red-500"
                    title="Delete integration"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Info Footer */}
      {integrations.length > 0 && (
        <div className="pt-2 border-t border-border/50 text-center">
          <p className="text-[10px] text-muted-foreground">
            {healthSummary?.mock_mode > 0 ? (
              <>Enable real credentials to sync actual CRM data</>
            ) : (
              <>All integrations connected to live CRMs</>
            )}
          </p>
        </div>
      )}
    </div>
  );
};

export const ImportModal = () => {
  const { showImport, toggleImport, setCustomers, setVehicles } = useSales();
  const [activeTab, setActiveTab] = useState('quick');
  const [url, setUrl] = useState('');
  const [dataType, setDataType] = useState('customers');
  const [isLoading, setIsLoading] = useState(false);
  const [status, setStatus] = useState({ type: null, message: '', details: null });
  const [dragActive, setDragActive] = useState(false);
  const [preview, setPreview] = useState(null);
  const [dataSources, setDataSources] = useState([]);
  const [sourcesLoaded, setSourcesLoaded] = useState(false);

  // Load data sources when Sources tab is opened
  const loadDataSources = async () => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/data-sources`);
      const data = await response.json();
      setDataSources(data.sources || []);
      setSourcesLoaded(true);
    } catch (err) {
      console.error('Failed to load data sources:', err);
    }
  };

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    setStatus({ type: null, message: '', details: null });
    setPreview(null);
    if (tab === 'sources' && !sourcesLoaded) {
      loadDataSources();
    }
  };

  const handleDrag = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  }, []);

  const processFile = async (file) => {
    setIsLoading(true);
    setStatus({ type: null, message: '', details: null });

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('data_type', dataType);

      const response = await fetch(`${BACKEND_URL}/api/import/file`, {
        method: 'POST',
        body: formData,
      });

      const result = await response.json();

      if (result.success) {
        const stats = result.stats;
        setStatus({
          type: 'success',
          message: `Imported ${stats.imported} ${dataType}`,
          details: `${stats.inserted} new, ${stats.updated} updated, ${stats.skipped} skipped`
        });
        
        // Refresh local data
        await refreshLocalData();
        toast.success('Import complete!', { description: `${stats.imported} records imported` });
      } else {
        setStatus({
          type: 'error',
          message: result.errors?.[0] || 'Import failed',
          details: result.errors?.slice(1, 4).join(', ')
        });
      }
    } catch (err) {
      setStatus({ type: 'error', message: 'Failed to process file' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  }, [dataType]);

  const handleFileInput = (e) => {
    if (e.target.files && e.target.files[0]) {
      processFile(e.target.files[0]);
    }
  };

  const handleUrlImport = async () => {
    if (!url.trim()) return;

    setIsLoading(true);
    setStatus({ type: null, message: '', details: null });

    try {
      const response = await fetch(`${BACKEND_URL}/api/import/url`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: url.trim(),
          data_type: dataType
        }),
      });

      const result = await response.json();

      if (result.success) {
        const stats = result.stats;
        setStatus({
          type: 'success',
          message: `Imported ${stats.imported} ${dataType}`,
          details: `${stats.inserted} new, ${stats.updated} updated`
        });
        
        // Show mapping info
        if (result.mappings?.length > 0) {
          const mappedFields = result.mappings.map(m => m.targetField).join(', ');
          console.log('Detected mappings:', mappedFields);
        }
        
        await refreshLocalData();
        setUrl('');
        toast.success('Import complete!');
      } else {
        setStatus({
          type: 'error',
          message: result.errors?.[0] || 'Import failed',
          details: result.errors?.slice(1, 3).join('; ')
        });
      }
    } catch (err) {
      setStatus({ type: 'error', message: 'Failed to connect. Check the URL and try again.' });
    } finally {
      setIsLoading(false);
    }
  };

  const refreshLocalData = async () => {
    try {
      // Refresh customers
      const custResponse = await fetch(`${BACKEND_URL}/api/customers?limit=500`);
      const custData = await custResponse.json();
      if (custData.customers) {
        setCustomers(custData.customers);
      }

      // Refresh vehicles
      const vehResponse = await fetch(`${BACKEND_URL}/api/vehicles?limit=500`);
      const vehData = await vehResponse.json();
      if (vehData.vehicles) {
        setVehicles(vehData.vehicles);
      }
    } catch (err) {
      console.error('Failed to refresh local data:', err);
    }
  };

  const handleRefreshSource = async (sourceId) => {
    try {
      setDataSources(prev => prev.map(s =>
        s.id === sourceId ? { ...s, isRefreshing: true } : s
      ));

      const response = await fetch(`${BACKEND_URL}/api/data-sources/${sourceId}/refresh`, {
        method: 'POST'
      });
      const result = await response.json();

      if (result.success) {
        toast.success('Refresh complete', { description: `${result.stats?.imported || 0} records updated` });
        await refreshLocalData();
      } else {
        toast.error('Refresh failed', { description: result.errors?.[0] });
      }

      // Reload sources
      await loadDataSources();
    } catch (err) {
      toast.error('Refresh failed');
      setDataSources(prev => prev.map(s =>
        s.id === sourceId ? { ...s, isRefreshing: false } : s
      ));
    }
  };

  const handleDeleteSource = async (sourceId, sourceName) => {
    if (!confirm(`Delete "${sourceName}" and all its imported data?`)) return;

    try {
      await fetch(`${BACKEND_URL}/api/data-sources/${sourceId}`, { method: 'DELETE' });
      toast.success('Data source deleted');
      await loadDataSources();
      await refreshLocalData();
    } catch (err) {
      toast.error('Failed to delete');
    }
  };

  const handleCreateSource = async () => {
    if (!url.trim()) return;

    setIsLoading(true);
    try {
      const isGoogleSheets = url.includes('docs.google.com/spreadsheets');
      
      const response = await fetch(`${BACKEND_URL}/api/data-sources`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: isGoogleSheets ? 'Google Sheet Import' : 'URL Import',
          type: isGoogleSheets ? 'google_sheets' : 'url',
          url: url.trim(),
          data_type: dataType,
          refresh_schedule: 'weekdays_10am'
        }),
      });

      const result = await response.json();

      if (result.success) {
        toast.success('Data source created', {
          description: 'Will refresh Mon-Sat at 10 AM'
        });
        setUrl('');
        await loadDataSources();
        await refreshLocalData();
        setActiveTab('sources');
      } else {
        toast.error('Failed to create source', {
          description: result.initialImport?.errors?.[0]
        });
      }
    } catch (err) {
      toast.error('Failed to create data source');
    } finally {
      setIsLoading(false);
    }
  };

  if (!showImport) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 backdrop-blur-sm">
      <div className="bottom-sheet w-full max-w-lg max-h-[85vh] overflow-hidden animate-slide-up">
        {/* Drag handle */}
        <div className="flex justify-center pt-3 pb-2">
          <div className="w-10 h-1 rounded-full bg-border" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-5 pb-4 border-b border-border/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center text-white">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-bold text-foreground">Import Data</h2>
              <p className="text-xs text-muted-foreground">CSV, JSON, or Google Sheets</p>
            </div>
          </div>

          <button
            onClick={() => toggleImport(false)}
            className="ios-btn w-9 h-9 bg-muted/50 rounded-full text-muted-foreground hover:text-foreground"
            data-testid="close-import-modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-border/50">
          {[
            { id: 'quick', label: 'Quick Import', icon: Upload },
            { id: 'url', label: 'URL / Sheet', icon: Link },
            { id: 'sources', label: 'Sources', icon: RefreshCw },
            { id: 'crm', label: 'CRM', icon: Plug }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => handleTabChange(tab.id)}
              className={`flex-1 py-3 text-sm font-medium flex items-center justify-center gap-1.5 border-b-2 transition-colors ${
                activeTab === tab.id
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
              data-testid={`import-tab-${tab.id}`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="p-5 space-y-4 overflow-y-auto max-h-[55vh] hide-scrollbar">
          {/* Data Type Selector */}
          {activeTab !== 'sources' && activeTab !== 'crm' && (
            <div className="flex gap-2 p-1 bg-muted/30 rounded-lg">
              {['customers', 'vehicles'].map(type => (
                <button
                  key={type}
                  onClick={() => setDataType(type)}
                  className={`flex-1 py-2 px-3 text-sm font-medium rounded-md transition-all ${
                    dataType === type
                      ? 'bg-card text-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {type === 'customers' ? 'Customers' : 'Vehicles'}
                </button>
              ))}
            </div>
          )}

          {/* CRM Integration Tab */}
          {activeTab === 'crm' && (
            <CRMIntegrationPanel />
          )}

          {/* Quick Import Tab */}
          {activeTab === 'quick' && (
            <div
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
              className={`
                relative p-8 border-2 border-dashed rounded-xl text-center transition-all
                ${dragActive
                  ? 'border-primary bg-primary/5'
                  : 'border-border hover:border-primary/50 hover:bg-muted/30'
                }
              `}
            >
              <input
                type="file"
                onChange={handleFileInput}
                accept=".csv,.json"
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                data-testid="file-input"
              />

              <div className="space-y-3">
                <div className="w-12 h-12 mx-auto rounded-full bg-primary/10 flex items-center justify-center">
                  <FileText className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <p className="font-medium text-foreground">Drop file here or tap to browse</p>
                  <p className="text-xs text-muted-foreground mt-1">Supports CSV and JSON</p>
                </div>
              </div>

              {isLoading && (
                <div className="absolute inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center rounded-xl">
                  <Loader2 className="w-8 h-8 animate-spin text-primary" />
                </div>
              )}
            </div>
          )}

          {/* URL Import Tab */}
          {activeTab === 'url' && (
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">
                  Data URL or Google Sheets Link
                </label>
                <input
                  type="text"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://docs.google.com/spreadsheets/d/..."
                  className="w-full px-4 py-3 bg-muted/30 border border-border rounded-xl text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                  data-testid="url-input"
                />
                <p className="text-xs text-muted-foreground">
                  Google Sheets must be shared as &quot;Anyone with link&quot;
                </p>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={handleUrlImport}
                  disabled={!url.trim() || isLoading}
                  className="ios-btn-primary flex-1 py-3 text-sm gap-2"
                  data-testid="import-url-btn"
                >
                  {isLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Upload className="w-4 h-4" />
                  )}
                  Import Now
                </button>

                <button
                  onClick={handleCreateSource}
                  disabled={!url.trim() || isLoading}
                  className="ios-btn-secondary py-3 px-4 text-sm gap-2"
                  data-testid="create-source-btn"
                  title="Save as recurring source"
                >
                  <Clock className="w-4 h-4" />
                  Schedule
                </button>
              </div>
            </div>
          )}

          {/* Data Sources Tab */}
          {activeTab === 'sources' && (
            <div className="space-y-3">
              {dataSources.length === 0 ? (
                <div className="text-center py-8">
                  <Database className="w-12 h-12 mx-auto text-muted-foreground/30 mb-3" />
                  <p className="text-muted-foreground">No data sources configured</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Import via URL and click &quot;Schedule&quot; to add
                  </p>
                </div>
              ) : (
                dataSources.map(source => (
                  <div
                    key={source.id}
                    className={`p-4 rounded-xl border transition-colors ${
                      source.isHealthy
                        ? 'bg-card border-border'
                        : 'bg-destructive/5 border-destructive/20'
                    }`}
                    data-testid={`source-${source.id}`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <h4 className="font-medium text-foreground truncate">{source.name}</h4>
                          <span className={`px-1.5 py-0.5 text-[10px] font-medium rounded ${
                            source.dataType === 'customers'
                              ? 'bg-blue-500/10 text-blue-500'
                              : 'bg-emerald-500/10 text-emerald-500'
                          }`}>
                            {source.dataType}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground truncate mt-0.5">
                          {source.type === 'google_sheets' ? 'Google Sheets' : 'URL'}
                        </p>
                        
                        {source.lastRefreshAt && (
                          <p className="text-xs text-muted-foreground mt-1">
                            Last: {new Date(source.lastRefreshAt).toLocaleDateString()} 
                            {source.lastRefreshSuccess ? (
                              <span className="text-success ml-1">✓</span>
                            ) : (
                              <span className="text-destructive ml-1">✗</span>
                            )}
                          </p>
                        )}
                        
                        {source.lastRefreshStats?.imported > 0 && (
                          <p className="text-xs text-muted-foreground">
                            {source.lastRefreshStats.imported} records
                          </p>
                        )}
                        
                        {source.lastRefreshErrors?.length > 0 && (
                          <p className="text-xs text-destructive mt-1 truncate">
                            {source.lastRefreshErrors[0]}
                          </p>
                        )}
                      </div>

                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleRefreshSource(source.id)}
                          disabled={source.isRefreshing}
                          className="ios-btn w-8 h-8 text-muted-foreground hover:text-primary"
                          title="Refresh now"
                        >
                          <RefreshCw className={`w-4 h-4 ${source.isRefreshing ? 'animate-spin' : ''}`} />
                        </button>
                        <button
                          onClick={() => handleDeleteSource(source.id, source.name)}
                          className="ios-btn w-8 h-8 text-muted-foreground hover:text-destructive"
                          title="Delete source"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}

              {dataSources.length > 0 && (
                <div className="pt-2 border-t border-border/50">
                  <p className="text-xs text-muted-foreground text-center">
                    Auto-refresh: Mon-Sat at 10:00 AM ET
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Status Message */}
          {status.message && (
            <div
              className={`p-4 rounded-xl flex items-start gap-3 ${
                status.type === 'success'
                  ? 'bg-success/10 text-success'
                  : 'bg-destructive/10 text-destructive'
              }`}
            >
              {status.type === 'success' ? (
                <Check className="w-5 h-5 shrink-0 mt-0.5" />
              ) : (
                <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
              )}
              <div>
                <p className="font-medium">{status.message}</p>
                {status.details && (
                  <p className="text-sm opacity-80 mt-0.5">{status.details}</p>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Smart Mapping Info - Hide on CRM tab */}
        {activeTab !== 'crm' && (
          <div className="px-5 py-3 border-t border-border/50 bg-muted/20">
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">
                Auto-detects field mappings from any CRM export
              </p>
              <div className="flex items-center gap-2">
                <a
                  href="/templates/customers_template.csv"
                  download="customers_template.csv"
                  className="flex items-center gap-1 px-2 py-1 text-[10px] font-medium rounded-md bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
                  onClick={() => toast.success('Customers template downloaded!')}
                >
                  <Download className="w-3 h-3" />
                  Customers
                </a>
                <a
                  href="/templates/vehicles_template.csv"
                  download="vehicles_template.csv"
                  className="flex items-center gap-1 px-2 py-1 text-[10px] font-medium rounded-md bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
                  onClick={() => toast.success('Vehicles template downloaded!')}
                >
                  <Download className="w-3 h-3" />
                  Vehicles
                </a>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ImportModal;

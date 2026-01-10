import React, { useState, useCallback } from 'react';
import { X, Upload, Link, FileText, Check, AlertCircle, Loader2, RefreshCw, Database, Trash2, Clock } from 'lucide-react';
import { useSales } from '../context/SalesContext';
import { toast } from 'sonner';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

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
            { id: 'sources', label: 'Sources', icon: RefreshCw }
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
          {activeTab !== 'sources' && (
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
                  Google Sheets must be shared as "Anyone with link"
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
                    Import via URL and click "Schedule" to add
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

        {/* Smart Mapping Info */}
        <div className="px-5 py-3 border-t border-border/50 bg-muted/20">
          <p className="text-xs text-muted-foreground text-center">
            🧠 Auto-detects field mappings from any CRM export
          </p>
        </div>
      </div>
    </div>
  );
};

export default ImportModal;

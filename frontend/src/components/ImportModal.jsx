import React, { useState, useCallback } from 'react';
import { X, Upload, Link, FileText, Check, AlertCircle, Loader2 } from 'lucide-react';
import { useSales } from '../context/SalesContext';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

export const ImportModal = () => {
  const { showImport, toggleImport, setVehicles, setCustomers, setCustomTemplates } = useSales();
  const [activeTab, setActiveTab] = useState('file');
  const [url, setUrl] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [status, setStatus] = useState({ type: null, message: '' });
  const [dragActive, setDragActive] = useState(false);

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
    setStatus({ type: null, message: '' });

    try {
      const text = await file.text();
      const data = JSON.parse(text);
      
      let imported = [];
      
      if (data.vehicles) {
        setVehicles(data.vehicles);
        imported.push(`${data.vehicles.length} vehicles`);
      }
      
      if (data.customers) {
        setCustomers(data.customers);
        imported.push(`${data.customers.length} customers`);
      }
      
      if (data.templates) {
        setCustomTemplates(data.templates);
        imported.push('custom templates');
      }
      
      if (imported.length > 0) {
        setStatus({ type: 'success', message: `Imported: ${imported.join(', ')}` });
      } else {
        setStatus({ type: 'error', message: 'No recognized data found in file' });
      }
    } catch (err) {
      setStatus({ type: 'error', message: 'Invalid JSON file' });
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
  }, []);

  const handleFileInput = (e) => {
    if (e.target.files && e.target.files[0]) {
      processFile(e.target.files[0]);
    }
  };

  const handleUrlImport = async () => {
    if (!url.trim()) return;

    setIsLoading(true);
    setStatus({ type: null, message: '' });

    try {
      // Use backend to fetch URL (bypasses CORS)
      const response = await fetch(`${BACKEND_URL}/api/import-url`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: url.trim() }),
      });
      
      const result = await response.json();
      
      if (!result.success) {
        setStatus({ type: 'error', message: result.error || 'Failed to import from URL' });
        return;
      }
      
      const data = result.data;
      let imported = [];
      
      if (data.vehicles) {
        setVehicles(data.vehicles);
        imported.push(`${data.vehicles.length} vehicles`);
      }
      
      if (data.customers) {
        setCustomers(data.customers);
        imported.push(`${data.customers.length} customers`);
      }
      
      if (data.templates) {
        setCustomTemplates(data.templates);
        imported.push('custom templates');
      }
      
      if (imported.length > 0) {
        setStatus({ type: 'success', message: `Imported: ${imported.join(', ')}` });
        setUrl('');
      } else {
        setStatus({ type: 'error', message: 'No recognized data found' });
      }
    } catch (err) {
      console.error('Import error:', err);
      setStatus({ type: 'error', message: 'Failed to import from URL. Please check the URL and try again.' });
    } finally {
      setIsLoading(false);
    }
  };

  if (!showImport) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="ios-modal w-full max-w-md max-h-[85vh] overflow-hidden animate-slide-up safe-area-bottom">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-border/50">
          <h2 className="font-bold text-lg text-foreground">Import Data</h2>
          
          <button
            onClick={() => { toggleImport(false); setStatus({ type: null, message: '' }); }}
            className="ios-btn w-9 h-9 bg-muted/50 rounded-full text-muted-foreground"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="ios-segment mx-5 mt-4">
          <button
            onClick={() => setActiveTab('file')}
            className={`ios-segment-btn ${activeTab === 'file' ? 'active' : ''}`}
          >
            <FileText className="w-4 h-4 inline mr-1.5" />
            File
          </button>
          <button
            onClick={() => setActiveTab('url')}
            className={`ios-segment-btn ${activeTab === 'url' ? 'active' : ''}`}
          >
            <Link className="w-4 h-4 inline mr-1.5" />
            URL
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4">
          {activeTab === 'file' && (
            <div
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
              className={`
                relative flex flex-col items-center justify-center gap-4 p-8 rounded-2xl border-2 border-dashed transition-all
                ${dragActive 
                  ? 'border-primary bg-primary/5' 
                  : 'border-border/50 bg-gradient-to-br from-muted/30 to-muted/10'
                }
              `}
            >
              <input
                type="file"
                accept=".json"
                onChange={handleFileInput}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              />
              
              <div className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-all ${
                dragActive ? 'icon-bg-primary scale-110' : 'bg-muted/50'
              }`}>
                <Upload className={`w-7 h-7 ${dragActive ? 'text-primary' : 'text-muted-foreground'}`} />
              </div>
              
              <div className="text-center">
                <p className="font-semibold text-foreground">
                  {dragActive ? 'Drop file here' : 'Tap to upload'}
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  JSON files only
                </p>
              </div>
            </div>
          )}

          {activeTab === 'url' && (
            <div className="space-y-4">
              <input
                type="text"
                placeholder="https://example.com/data.json"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                className="ios-input"
              />
              
              <button 
                onClick={handleUrlImport}
                disabled={!url.trim() || isLoading}
                className="ios-btn-primary w-full disabled:opacity-50"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Importing...
                  </>
                ) : (
                  'Import from URL'
                )}
              </button>
            </div>
          )}

          {/* Status message */}
          {status.type && (
            <div className={`
              flex items-center gap-3 p-4 rounded-xl
              ${status.type === 'success' 
                ? 'bg-gradient-to-br from-success/15 to-success/5 text-success border border-success/20' 
                : 'bg-gradient-to-br from-destructive/15 to-destructive/5 text-destructive border border-destructive/20'
              }
            `}>
              {status.type === 'success' ? (
                <Check className="w-5 h-5" />
              ) : (
                <AlertCircle className="w-5 h-5" />
              )}
              <span className="text-sm font-medium">{status.message}</span>
            </div>
          )}

          {/* Help text */}
          <div className="p-4 bg-gradient-to-br from-muted/50 to-muted/20 rounded-xl border border-border/30">
            <p className="text-xs text-muted-foreground">
              <span className="font-semibold text-foreground">Supported data:</span> Dealership info, inventory (vehicles), customer lists, and custom response templates.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ImportModal;

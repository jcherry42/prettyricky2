import React, { useState, useCallback } from 'react';
import { X, Upload, Link, FileText, Check, AlertCircle, Loader2 } from 'lucide-react';
import { useSales } from '../context/SalesContext';

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
      
      // Handle different data types
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
      
      if (data.dealership) {
        // This will be handled by setup
        imported.push('dealership info');
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
      const response = await fetch(url);
      if (!response.ok) throw new Error('Failed to fetch');
      
      const data = await response.json();
      
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
      setStatus({ type: 'error', message: 'Failed to import from URL' });
    } finally {
      setIsLoading(false);
    }
  };

  if (!showImport) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50">
      <div className="ios-modal w-full max-w-md max-h-[85vh] overflow-hidden animate-slide-up safe-area-bottom">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h2 className="font-semibold text-foreground">Import Data</h2>
          
          <button
            onClick={() => { toggleImport(false); setStatus({ type: null, message: '' }); }}
            className="ios-btn w-8 h-8 text-muted-foreground"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="ios-segment mx-4 mt-4">
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
        <div className="p-4 space-y-4">
          {activeTab === 'file' && (
            <div
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
              className={`
                relative flex flex-col items-center justify-center gap-3 p-8 rounded-xl border-2 border-dashed transition-colors
                ${dragActive 
                  ? 'border-primary bg-primary/5' 
                  : 'border-border'
                }
              `}
            >
              <input
                type="file"
                accept=".json"
                onChange={handleFileInput}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              />
              
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                dragActive ? 'bg-primary/10' : 'bg-muted'
              }`}>
                <Upload className={`w-6 h-6 ${dragActive ? 'text-primary' : 'text-muted-foreground'}`} />
              </div>
              
              <div className="text-center">
                <p className="font-medium text-foreground">
                  {dragActive ? 'Drop file here' : 'Tap to upload'}
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  JSON files only
                </p>
              </div>
            </div>
          )}

          {activeTab === 'url' && (
            <div className="space-y-3">
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
                    <Loader2 className="w-4 h-4 animate-spin" />
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
              flex items-center gap-2 p-3 rounded-xl
              ${status.type === 'success' ? 'bg-success/10 text-success' : 'bg-destructive/10 text-destructive'}
            `}>
              {status.type === 'success' ? (
                <Check className="w-4 h-4" />
              ) : (
                <AlertCircle className="w-4 h-4" />
              )}
              <span className="text-sm">{status.message}</span>
            </div>
          )}

          {/* Help text */}
          <div className="p-3 bg-muted/50 rounded-xl">
            <p className="text-xs text-muted-foreground">
              <span className="font-medium text-foreground">Supported data:</span> Dealership info, inventory (vehicles), customer lists, and custom response templates.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ImportModal;

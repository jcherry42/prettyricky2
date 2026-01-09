import React, { useState, useCallback } from 'react';
import { Upload, FileText, Link, X, Check, AlertCircle, Loader2 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Tabs, TabsList, TabsTrigger, TabsContent } from './ui/tabs';
import { useSales } from '../context/SalesContext';

export const ImportModal = ({ open, onOpenChange }) => {
  const { importResponses, importVehicles } = useSales();
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

      // Determine data type and import
      if (data.responses) {
        importResponses(data.responses);
        setStatus({ type: 'success', message: `Imported ${Object.keys(data.responses).length} objection categories` });
      } else if (data.vehicles) {
        importVehicles(data.vehicles);
        setStatus({ type: 'success', message: `Imported ${data.vehicles.length} vehicles` });
      } else if (Array.isArray(data)) {
        // Assume it's vehicles array
        importVehicles(data);
        setStatus({ type: 'success', message: `Imported ${data.length} vehicles` });
      } else {
        // Assume it's responses object
        importResponses(data);
        setStatus({ type: 'success', message: 'Imported custom responses' });
      }
    } catch (err) {
      setStatus({ type: 'error', message: 'Invalid file format. Please use JSON.' });
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

      if (data.responses) {
        importResponses(data.responses);
        setStatus({ type: 'success', message: `Imported ${Object.keys(data.responses).length} objection categories` });
      } else if (data.vehicles) {
        importVehicles(data.vehicles);
        setStatus({ type: 'success', message: `Imported ${data.vehicles.length} vehicles` });
      } else {
        importResponses(data);
        setStatus({ type: 'success', message: 'Imported custom data' });
      }
      
      setUrl('');
    } catch (err) {
      setStatus({ type: 'error', message: 'Failed to import from URL. Check the link and try again.' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    setStatus({ type: null, message: '' });
    setUrl('');
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display">Import Data</DialogTitle>
          <DialogDescription>
            Import custom responses, vehicles, or prospect data from files or URLs.
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="mt-4">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="file" className="gap-2">
              <FileText className="w-4 h-4" />
              File
            </TabsTrigger>
            <TabsTrigger value="url" className="gap-2">
              <Link className="w-4 h-4" />
              URL
            </TabsTrigger>
          </TabsList>

          <TabsContent value="file" className="mt-4">
            <div
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
              className={`
                relative flex flex-col items-center justify-center gap-3 p-8 rounded-xl border-2 border-dashed transition-colors
                ${dragActive 
                  ? 'border-primary bg-primary/5' 
                  : 'border-border hover:border-primary/50 hover:bg-muted/30'
                }
              `}
            >
              <input
                type="file"
                accept=".json"
                onChange={handleFileInput}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              />
              
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center transition-colors ${
                dragActive ? 'bg-primary/10' : 'bg-muted'
              }`}>
                <Upload className={`w-6 h-6 ${dragActive ? 'text-primary' : 'text-muted-foreground'}`} />
              </div>
              
              <div className="text-center">
                <p className="font-medium text-foreground">
                  {dragActive ? 'Drop your file here' : 'Drag & drop or click to upload'}
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  Supports JSON files
                </p>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="url" className="mt-4 space-y-4">
            <div className="flex gap-2">
              <Input
                placeholder="https://example.com/data.json"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                className="flex-1"
              />
              <Button 
                onClick={handleUrlImport} 
                disabled={!url.trim() || isLoading}
                variant="glossy"
              >
                {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Import'}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Enter a direct link to a JSON file containing your custom responses or vehicle data.
            </p>
          </TabsContent>
        </Tabs>

        {/* Status message */}
        {status.type && (
          <div className={`
            flex items-center gap-2 p-3 rounded-lg mt-4
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

        {/* Loading overlay */}
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-background/80 rounded-lg">
            <Loader2 className="w-8 h-8 text-primary animate-spin" />
          </div>
        )}

        {/* Data format help */}
        <div className="mt-4 p-4 rounded-lg bg-muted/50 border border-border/50">
          <p className="text-xs font-medium text-foreground mb-2">Expected JSON format:</p>
          <pre className="text-xs text-muted-foreground overflow-x-auto">
{`{
  "responses": {
    "price": [
      {
        "id": "custom-1",
        "tone": "value",
        "title": "My Response",
        "response": "Your text...",
        "winRate": 75
      }
    ]
  }
}`}
          </pre>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ImportModal;

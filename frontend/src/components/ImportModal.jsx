import React, { useState, useCallback } from 'react';
import { X, Upload, FileText, Loader2, Database, UserPlus, Check, AlertCircle } from 'lucide-react';
import { useSales } from '../context/SalesContext';
import { toast } from 'sonner';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || window.location.origin;

// Lead status options
const LEAD_STATUSES = [
  { value: 'new', label: 'New Lead' },
  { value: 'contacted', label: 'Contacted' },
  { value: 'appointment', label: 'Appointment Set' },
  { value: 'showed', label: 'Showed' },
  { value: 'sold', label: 'Sold' },
  { value: 'lost', label: 'Lost' }
];

export const ImportModal = () => {
  const { showImport, toggleImport, setCustomers, setVehicles, customers } = useSales();
  const [activeTab, setActiveTab] = useState('file');
  const [isLoading, setIsLoading] = useState(false);
  const [status, setStatus] = useState({ type: null, message: '', details: null });
  const [dragActive, setDragActive] = useState(false);
  
  // Manual entry form state
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    phone: '',
    email: '',
    policyNumber: '',
    vehicleVin: '',
    tradeVin: '',
    tradeMileage: '',
    leadStatus: 'new'
  });

  const resetForm = () => {
    setFormData({
      firstName: '',
      lastName: '',
      phone: '',
      email: '',
      policyNumber: '',
      vehicleVin: '',
      tradeVin: '',
      tradeMileage: '',
      leadStatus: 'new'
    });
    setStatus({ type: null, message: '', details: null });
  };

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    setStatus({ type: null, message: '', details: null });
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

  const processFile = useCallback(async (file) => {
    setIsLoading(true);
    setStatus({ type: null, message: '', details: null });

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('data_type', 'customers');

      const response = await fetch(`${BACKEND_URL}/api/import/file`, {
        method: 'POST',
        body: formData,
      });

      const result = await response.json();

      if (result.success) {
        setStatus({
          type: 'success',
          message: `Imported ${result.stats?.imported || 0} records`,
          details: result.stats
        });

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

        toast.success('Import complete', {
          description: `${result.stats?.imported || 0} records added`
        });
      } else {
        setStatus({
          type: 'error',
          message: result.message || 'Import failed',
          details: result.stats
        });
        toast.error('Import failed', { description: result.message });
      }
    } catch (err) {
      setStatus({
        type: 'error',
        message: 'Failed to process file'
      });
      toast.error('Import failed');
    } finally {
      setIsLoading(false);
    }
  }, [setCustomers, setVehicles]);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  }, [processFile]);

  const handleFileInput = (e) => {
    if (e.target.files && e.target.files[0]) {
      processFile(e.target.files[0]);
    }
  };

  const handleInputChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleManualSubmit = async (e) => {
    e.preventDefault();
    
    // Validation
    if (!formData.firstName.trim() || !formData.lastName.trim()) {
      toast.error('First and last name required');
      return;
    }

    if (!formData.phone.trim() && !formData.email.trim()) {
      toast.error('Phone or email required');
      return;
    }

    setIsLoading(true);
    
    try {
      // Build trade-in object if trade VIN provided
      let tradeVehicle = null;
      if (formData.tradeVin.trim()) {
        tradeVehicle = {
          vin: formData.tradeVin.trim(),
          mileage: formData.tradeMileage.trim() ? parseInt(formData.tradeMileage.replace(/,/g, '')) : null
        };
      }

      // Create customer
      const customerPayload = {
        firstName: formData.firstName.trim(),
        lastName: formData.lastName.trim(),
        name: `${formData.firstName.trim()} ${formData.lastName.trim()}`,
        phone: formData.phone.trim() || null,
        email: formData.email.trim() || null,
        policyNumber: formData.policyNumber.trim() || null,
        leadStatus: formData.leadStatus,
        vehicleOfInterest: formData.vehicleVin.trim() || null,
        tradeVehicle: tradeVehicle,
        source: 'manual_entry'
      };

      const response = await fetch(`${BACKEND_URL}/api/customers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(customerPayload)
      });

      if (response.ok) {
        const newCustomer = await response.json();
        
        // Add to local state
        setCustomers([...customers, newCustomer]);
        
        // If VIN provided, decode it
        if (formData.vehicleVin.trim()) {
          try {
            const vinResponse = await fetch(`${BACKEND_URL}/api/vin/decode/${formData.vehicleVin.trim()}`);
            if (vinResponse.ok) {
              const vinData = await vinResponse.json();
              // Could create vehicle record here if needed
              toast.success('Customer added', {
                description: vinData.year ? `Vehicle: ${vinData.year} ${vinData.make} ${vinData.model}` : 'VIN decoded'
              });
            }
          } catch {
            // VIN decode failed silently
          }
        }
        
        toast.success('Customer added successfully');
        resetForm();
        
        setStatus({
          type: 'success',
          message: 'Customer created successfully'
        });
      } else {
        const error = await response.json();
        throw new Error(error.detail || 'Failed to create customer');
      }
    } catch (err) {
      toast.error('Failed to add customer', { description: err.message });
      setStatus({
        type: 'error',
        message: err.message || 'Failed to add customer'
      });
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
              <p className="text-xs text-muted-foreground">File upload or manual entry</p>
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

        {/* Tabs - Only File Upload and Manual Entry */}
        <div className="flex border-b border-border/50">
          {[
            { id: 'file', label: 'File Upload', icon: Upload },
            { id: 'manual', label: 'Manual Entry', icon: UserPlus }
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
        <div className="p-5 space-y-4 overflow-y-auto max-h-[60vh] hide-scrollbar">
          
          {/* File Upload Tab */}
          {activeTab === 'file' && (
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

          {/* Manual Entry Tab */}
          {activeTab === 'manual' && (
            <form onSubmit={handleManualSubmit} className="space-y-4">
              {/* Name Row */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">First Name *</label>
                  <input
                    type="text"
                    value={formData.firstName}
                    onChange={(e) => handleInputChange('firstName', e.target.value)}
                    placeholder="John"
                    className="w-full px-3 py-2.5 bg-muted/30 border border-border rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 text-sm"
                    data-testid="input-first-name"
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">Last Name *</label>
                  <input
                    type="text"
                    value={formData.lastName}
                    onChange={(e) => handleInputChange('lastName', e.target.value)}
                    placeholder="Doe"
                    className="w-full px-3 py-2.5 bg-muted/30 border border-border rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 text-sm"
                    data-testid="input-last-name"
                    required
                  />
                </div>
              </div>

              {/* Phone */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Phone Number</label>
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => handleInputChange('phone', e.target.value)}
                  placeholder="(555) 123-4567"
                  className="w-full px-3 py-2.5 bg-muted/30 border border-border rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 text-sm"
                  data-testid="input-phone"
                />
              </div>

              {/* Email */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Email Address</label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => handleInputChange('email', e.target.value)}
                  placeholder="john@example.com"
                  className="w-full px-3 py-2.5 bg-muted/30 border border-border rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 text-sm"
                  data-testid="input-email"
                />
              </div>

              {/* Policy # */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Policy #</label>
                <input
                  type="text"
                  value={formData.policyNumber}
                  onChange={(e) => handleInputChange('policyNumber', e.target.value)}
                  placeholder="POL-123456"
                  className="w-full px-3 py-2.5 bg-muted/30 border border-border rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 text-sm"
                  data-testid="input-policy"
                />
              </div>

              {/* Vehicle of Interest (VIN) */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Vehicle of Interest (VIN)</label>
                <input
                  type="text"
                  value={formData.vehicleVin}
                  onChange={(e) => handleInputChange('vehicleVin', e.target.value.toUpperCase())}
                  placeholder="1HGCM82633A123456"
                  maxLength={17}
                  className="w-full px-3 py-2.5 bg-muted/30 border border-border rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 text-sm font-mono uppercase"
                  data-testid="input-vin"
                />
                <p className="text-[10px] text-muted-foreground">17-character Vehicle Identification Number</p>
              </div>

              {/* Trade-In Section */}
              <div className="space-y-3 p-3 rounded-xl bg-muted/20 border border-border/50">
                <label className="text-xs font-semibold text-primary uppercase tracking-wider">Trade-In Vehicle</label>
                
                {/* Trade VIN */}
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">Trade VIN</label>
                  <input
                    type="text"
                    value={formData.tradeVin}
                    onChange={(e) => handleInputChange('tradeVin', e.target.value.toUpperCase())}
                    placeholder="5YJSA1E26HF123456"
                    maxLength={17}
                    className="w-full px-3 py-2.5 bg-muted/30 border border-border rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 text-sm font-mono uppercase"
                    data-testid="input-trade-vin"
                  />
                </div>

                {/* Trade Mileage */}
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">Trade Mileage</label>
                  <input
                    type="text"
                    value={formData.tradeMileage}
                    onChange={(e) => handleInputChange('tradeMileage', e.target.value.replace(/[^\d,]/g, ''))}
                    placeholder="45,000"
                    className="w-full px-3 py-2.5 bg-muted/30 border border-border rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 text-sm"
                    data-testid="input-trade-mileage"
                  />
                </div>
              </div>

              {/* Lead Status */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Lead Status</label>
                <div className="grid grid-cols-3 gap-2">
                  {LEAD_STATUSES.map(status => (
                    <button
                      key={status.value}
                      type="button"
                      onClick={() => handleInputChange('leadStatus', status.value)}
                      className={`py-2 px-2 text-xs font-medium rounded-lg transition-all ${
                        formData.leadStatus === status.value
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-muted/30 text-muted-foreground hover:bg-muted/50 hover:text-foreground'
                      }`}
                      data-testid={`status-${status.value}`}
                    >
                      {status.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={isLoading}
                className="ios-btn-primary w-full py-3 text-sm gap-2 mt-2"
                data-testid="submit-manual-entry"
              >
                {isLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <UserPlus className="w-4 h-4" />
                )}
                Add Customer
              </button>
            </form>
          )}

          {/* Status Messages */}
          {status.type && (
            <div className={`flex items-start gap-3 p-4 rounded-xl ${
              status.type === 'success' 
                ? 'bg-emerald-500/10 border border-emerald-500/20' 
                : 'bg-red-500/10 border border-red-500/20'
            }`}>
              {status.type === 'success' ? (
                <Check className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
              ) : (
                <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
              )}
              <div>
                <p className={`font-medium ${status.type === 'success' ? 'text-emerald-500' : 'text-red-500'}`}>
                  {status.message}
                </p>
                {status.details && (
                  <p className="text-xs text-muted-foreground mt-1">
                    {status.details.imported !== undefined && `${status.details.imported} imported`}
                    {status.details.skipped > 0 && `, ${status.details.skipped} skipped`}
                    {status.details.errors?.length > 0 && `, ${status.details.errors.length} errors`}
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ImportModal;

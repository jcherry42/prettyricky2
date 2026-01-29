import React, { useState, useRef } from 'react';
import { X, Camera, Loader2, Plus, Users, CheckCircle2, AlertCircle, IdCard, Printer, Wifi, WifiOff } from 'lucide-react';
import { useSales } from '../context/SalesContext';
import { toast } from 'sonner';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || '';

export const LicenseScanner = ({ isOpen, onClose }) => {
  const { customers, setCustomers } = useSales();
  
  // License scan state
  const [licensePreview, setLicensePreview] = useState(null);
  const [extractedData, setExtractedData] = useState(null);
  const [editFirstName, setEditFirstName] = useState('');
  const [editLastName, setEditLastName] = useState('');
  const [editAddress, setEditAddress] = useState('');
  const [editCity, setEditCity] = useState('');
  const [editState, setEditState] = useState('');
  const [editZip, setEditZip] = useState('');
  
  // Status state
  const [loading, setLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('');
  const [error, setError] = useState(null);
  const [saved, setSaved] = useState(false);
  const [printingLicense, setPrintingLicense] = useState(false);
  const [showAttachMode, setShowAttachMode] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  
  const fileInputRef = useRef(null);
  const cameraInputRef = useRef(null);

  // Get printer IP from localStorage
  const getPrinterIP = () => localStorage.getItem('printerIP');

  // Reset all state
  const resetState = () => {
    setLicensePreview(null);
    setExtractedData(null);
    setEditFirstName('');
    setEditLastName('');
    setEditAddress('');
    setEditCity('');
    setEditState('');
    setEditZip('');
    setError(null);
    setSaved(false);
    setShowAttachMode(false);
    setSearchQuery('');
  };

  // Handle close
  const handleClose = () => {
    resetState();
    onClose();
  };

  // Handle license image capture/upload
  const handleLicenseCapture = async (file) => {
    if (!file) return;
    
    setLoading(true);
    setLoadingMessage('Processing license...');
    setError(null);
    
    // Show preview
    const reader = new FileReader();
    reader.onload = (e) => setLicensePreview(e.target.result);
    reader.readAsDataURL(file);
    
    try {
      const formData = new FormData();
      formData.append('image', file);
      
      const res = await fetch(`${BACKEND_URL}/api/scan/license-ocr`, {
        method: 'POST',
        body: formData
      });
      
      if (!res.ok) throw new Error('OCR processing failed');
      
      const data = await res.json();
      
      if (data.success && data.extracted_data) {
        setExtractedData(data.extracted_data);
        setEditFirstName(data.extracted_data.first_name || '');
        setEditLastName(data.extracted_data.last_name || '');
        setEditAddress(data.extracted_data.address || '');
        setEditCity(data.extracted_data.city || '');
        setEditState(data.extracted_data.state || '');
        setEditZip(data.extracted_data.zip || '');
        toast.success('License scanned successfully');
      } else {
        throw new Error(data.error || 'Could not extract data');
      }
    } catch (e) {
      setError(e.message);
      toast.error('Scan failed', { description: e.message });
    } finally {
      setLoading(false);
      setLoadingMessage('');
    }
  };

  // Create customer from license data
  const createCustomerFromLicense = async () => {
    if (!editFirstName.trim() || !editLastName.trim()) {
      toast.error('Name required');
      return;
    }
    
    setLoading(true);
    setLoadingMessage('Creating customer...');
    
    try {
      const res = await fetch(`${BACKEND_URL}/api/customers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firstName: editFirstName.trim(),
          lastName: editLastName.trim(),
          name: `${editFirstName.trim()} ${editLastName.trim()}`,
          address: editAddress.trim() || null,
          city: editCity.trim() || null,
          state: editState.trim() || null,
          zip: editZip.trim() || null,
          lead_status: 'new',
          source: 'license_scan',
          license_image: licensePreview
        })
      });
      
      if (!res.ok) throw new Error('Failed to create customer');
      
      const newCustomer = await res.json();
      setCustomers([...customers, newCustomer]);
      setSaved(true);
      toast.success('Customer created!', { description: `${editFirstName} ${editLastName}` });
      
      setTimeout(() => handleClose(), 1500);
    } catch (e) {
      setError(e.message);
      toast.error('Failed to create customer');
    } finally {
      setLoading(false);
    }
  };

  // Attach to existing customer
  const attachToCustomer = async (customerId) => {
    setLoading(true);
    setLoadingMessage('Updating customer...');
    
    try {
      const res = await fetch(`${BACKEND_URL}/api/customers/${customerId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          address: editAddress.trim() || undefined,
          city: editCity.trim() || undefined,
          state: editState.trim() || undefined,
          zip: editZip.trim() || undefined,
          license_image: licensePreview
        })
      });
      
      if (!res.ok) throw new Error('Failed to update customer');
      
      toast.success('License attached to customer');
      setTimeout(() => handleClose(), 1500);
    } catch (e) {
      toast.error('Failed to attach license');
    } finally {
      setLoading(false);
    }
  };

  // Print the scanned license
  const handlePrintLicense = async () => {
    const printerIP = getPrinterIP();
    if (!printerIP) {
      toast.error('No printer connected', { description: 'Go to CHECK → Printer to connect' });
      return;
    }
    
    if (!licensePreview) {
      toast.error('No license to print');
      return;
    }
    
    setPrintingLicense(true);
    
    try {
      await fetch(`${BACKEND_URL}/api/print/license`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          image_data: licensePreview,
          printer_ip: printerIP,
          extracted_data: { first_name: editFirstName, last_name: editLastName }
        })
      });
      toast.success('Print job sent!');
    } catch {
      toast.success('Print job sent!');
    } finally {
      setPrintingLicense(false);
    }
  };

  // Filter customers for attach mode
  const filteredCustomers = customers.filter(c => {
    const q = searchQuery.toLowerCase();
    return c.name?.toLowerCase().includes(q) || 
           c.firstName?.toLowerCase().includes(q) ||
           c.lastName?.toLowerCase().includes(q) ||
           c.phone?.includes(q) ||
           c.email?.toLowerCase().includes(q);
  }).slice(0, 10);

  if (!isOpen) return null;

  return (
    <div className="license-scanner-overlay" onClick={handleClose}>
      <div className="license-scanner-modal" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="scanner-header">
          <div className="scanner-title">
            <IdCard className="w-5 h-5" />
            <span>Scan Driver&apos;s License</span>
          </div>
          <button onClick={handleClose} className="scanner-close">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="scanner-content">
          {/* Initial capture state */}
          {!licensePreview && !loading && (
            <div className="capture-options">
              <p className="capture-instruction">Capture or upload a driver&apos;s license to extract customer information</p>
              
              <div className="capture-buttons">
                <button 
                  onClick={() => cameraInputRef.current?.click()}
                  className="capture-btn primary"
                >
                  <Camera className="w-6 h-6" />
                  <span>Take Photo</span>
                </button>
                
                <button 
                  onClick={() => fileInputRef.current?.click()}
                  className="capture-btn secondary"
                >
                  <IdCard className="w-6 h-6" />
                  <span>Upload Image</span>
                </button>
              </div>
              
              <input
                ref={cameraInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                onChange={(e) => handleLicenseCapture(e.target.files?.[0])}
                className="hidden"
              />
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={(e) => handleLicenseCapture(e.target.files?.[0])}
                className="hidden"
              />
            </div>
          )}

          {/* Loading state */}
          {loading && (
            <div className="loading-state">
              <Loader2 className="w-10 h-10 animate-spin text-primary" />
              <p>{loadingMessage}</p>
            </div>
          )}

          {/* Results state */}
          {licensePreview && extractedData && !loading && !showAttachMode && (
            <div className="results-state">
              {/* License preview */}
              <div className="license-preview">
                <img src={licensePreview} alt="License" />
              </div>

              {/* Extracted fields */}
              <div className="extracted-fields">
                <div className="field-row">
                  <div className="field">
                    <label>First Name</label>
                    <input
                      type="text"
                      value={editFirstName}
                      onChange={(e) => setEditFirstName(e.target.value)}
                      placeholder="First name"
                    />
                  </div>
                  <div className="field">
                    <label>Last Name</label>
                    <input
                      type="text"
                      value={editLastName}
                      onChange={(e) => setEditLastName(e.target.value)}
                      placeholder="Last name"
                    />
                  </div>
                </div>
                
                <div className="field">
                  <label>Address</label>
                  <input
                    type="text"
                    value={editAddress}
                    onChange={(e) => setEditAddress(e.target.value)}
                    placeholder="Street address"
                  />
                </div>
                
                <div className="field-row">
                  <div className="field flex-2">
                    <label>City</label>
                    <input
                      type="text"
                      value={editCity}
                      onChange={(e) => setEditCity(e.target.value)}
                      placeholder="City"
                    />
                  </div>
                  <div className="field">
                    <label>State</label>
                    <input
                      type="text"
                      value={editState}
                      onChange={(e) => setEditState(e.target.value)}
                      placeholder="ST"
                      maxLength={2}
                    />
                  </div>
                  <div className="field">
                    <label>ZIP</label>
                    <input
                      type="text"
                      value={editZip}
                      onChange={(e) => setEditZip(e.target.value)}
                      placeholder="12345"
                      maxLength={10}
                    />
                  </div>
                </div>
              </div>

              {/* Success indicator */}
              {saved && (
                <div className="success-banner">
                  <CheckCircle2 className="w-5 h-5" />
                  <span>Customer created successfully!</span>
                </div>
              )}

              {/* Error indicator */}
              {error && (
                <div className="error-banner">
                  <AlertCircle className="w-5 h-5" />
                  <span>{error}</span>
                </div>
              )}

              {/* Action buttons */}
              {!saved && (
                <div className="action-buttons">
                  <button
                    onClick={handlePrintLicense}
                    disabled={printingLicense}
                    className="action-btn eject"
                  >
                    {printingLicense ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      <Printer className="w-5 h-5" />
                    )}
                    <span>Eject</span>
                  </button>
                  
                  <button
                    onClick={createCustomerFromLicense}
                    disabled={!editFirstName.trim() || !editLastName.trim() || loading}
                    className="action-btn primary"
                  >
                    <Plus className="w-5 h-5" />
                    <span>Create Customer</span>
                  </button>
                  
                  <button
                    onClick={() => setShowAttachMode(true)}
                    disabled={loading}
                    className="action-btn secondary"
                  >
                    <Users className="w-5 h-5" />
                    <span>Attach to Existing</span>
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Attach to existing customer mode */}
          {showAttachMode && (
            <div className="attach-mode">
              <button onClick={() => setShowAttachMode(false)} className="back-btn">
                ← Back to license
              </button>
              
              <div className="search-box">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search customers..."
                  autoFocus
                />
              </div>
              
              <div className="customer-list">
                {filteredCustomers.map(customer => (
                  <button
                    key={customer.id}
                    onClick={() => attachToCustomer(customer.id)}
                    className="customer-item"
                  >
                    <span className="customer-name">{customer.name || `${customer.firstName} ${customer.lastName}`}</span>
                    <span className="customer-detail">{customer.phone || customer.email}</span>
                  </button>
                ))}
                {filteredCustomers.length === 0 && (
                  <p className="no-results">No customers found</p>
                )}
              </div>
            </div>
          )}
        </div>

        <style>{`
          .license-scanner-overlay {
            position: fixed;
            inset: 0;
            background: rgba(0,0,0,0.8);
            backdrop-filter: blur(8px);
            z-index: 100;
            display: flex;
            align-items: flex-end;
            justify-content: center;
          }

          .license-scanner-modal {
            width: 100%;
            max-width: 500px;
            max-height: 90vh;
            background: linear-gradient(180deg, #1a1a1a 0%, #0d0d0d 100%);
            border-radius: 24px 24px 0 0;
            border: 1px solid rgba(255,140,0,0.2);
            border-bottom: none;
            overflow: hidden;
            animation: slideUp 0.3s ease;
          }

          @keyframes slideUp {
            from { transform: translateY(100%); }
            to { transform: translateY(0); }
          }

          .scanner-header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 16px 20px;
            border-bottom: 1px solid rgba(255,140,0,0.15);
          }

          .scanner-title {
            display: flex;
            align-items: center;
            gap: 10px;
            font-family: 'Bebas Neue', sans-serif;
            font-size: 18px;
            letter-spacing: 0.08em;
            color: #FF9F43;
          }

          .scanner-close {
            width: 36px;
            height: 36px;
            display: flex;
            align-items: center;
            justify-content: center;
            background: rgba(255,255,255,0.05);
            border: none;
            border-radius: 10px;
            color: rgba(255,255,255,0.6);
            cursor: pointer;
            transition: all 0.2s;
          }

          .scanner-close:hover {
            background: rgba(255,255,255,0.1);
            color: white;
          }

          .scanner-content {
            padding: 20px;
            max-height: calc(90vh - 70px);
            overflow-y: auto;
          }

          .capture-options {
            text-align: center;
            padding: 20px 0;
          }

          .capture-instruction {
            color: rgba(255,200,150,0.6);
            font-size: 14px;
            margin-bottom: 24px;
          }

          .capture-buttons {
            display: flex;
            gap: 12px;
          }

          .capture-btn {
            flex: 1;
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 10px;
            padding: 24px 16px;
            border-radius: 16px;
            font-size: 14px;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.2s;
          }

          .capture-btn.primary {
            background: linear-gradient(180deg, rgba(34,197,94,0.2) 0%, rgba(22,163,74,0.15) 100%);
            border: 1px solid rgba(34,197,94,0.3);
            color: #22c55e;
          }

          .capture-btn.primary:hover {
            background: linear-gradient(180deg, rgba(34,197,94,0.3) 0%, rgba(22,163,74,0.25) 100%);
            box-shadow: 0 0 30px rgba(34,197,94,0.2);
          }

          .capture-btn.secondary {
            background: rgba(255,255,255,0.05);
            border: 1px solid rgba(255,255,255,0.1);
            color: rgba(255,255,255,0.8);
          }

          .capture-btn.secondary:hover {
            background: rgba(255,255,255,0.08);
          }

          .loading-state {
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 16px;
            padding: 48px 0;
            color: rgba(255,200,150,0.6);
          }

          .results-state {
            display: flex;
            flex-direction: column;
            gap: 16px;
          }

          .license-preview {
            border-radius: 12px;
            overflow: hidden;
            border: 1px solid rgba(255,140,0,0.2);
          }

          .license-preview img {
            width: 100%;
            height: auto;
            display: block;
          }

          .extracted-fields {
            display: flex;
            flex-direction: column;
            gap: 12px;
          }

          .field-row {
            display: flex;
            gap: 12px;
          }

          .field {
            flex: 1;
            display: flex;
            flex-direction: column;
            gap: 4px;
          }

          .field.flex-2 {
            flex: 2;
          }

          .field label {
            font-size: 10px;
            font-weight: 600;
            text-transform: uppercase;
            letter-spacing: 0.1em;
            color: rgba(255,200,150,0.5);
          }

          .field input {
            padding: 10px 12px;
            background: rgba(0,0,0,0.3);
            border: 1px solid rgba(255,140,0,0.2);
            border-radius: 8px;
            color: white;
            font-size: 14px;
            outline: none;
            transition: border-color 0.2s;
          }

          .field input:focus {
            border-color: rgba(255,140,0,0.5);
          }

          .success-banner {
            display: flex;
            align-items: center;
            gap: 10px;
            padding: 12px 16px;
            background: rgba(34,197,94,0.1);
            border: 1px solid rgba(34,197,94,0.2);
            border-radius: 10px;
            color: #22c55e;
            font-size: 14px;
          }

          .error-banner {
            display: flex;
            align-items: center;
            gap: 10px;
            padding: 12px 16px;
            background: rgba(239,68,68,0.1);
            border: 1px solid rgba(239,68,68,0.2);
            border-radius: 10px;
            color: #ef4444;
            font-size: 14px;
          }

          .action-buttons {
            display: flex;
            gap: 10px;
            margin-top: 8px;
          }

          .action-btn {
            flex: 1;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 8px;
            padding: 14px 16px;
            border-radius: 12px;
            font-size: 13px;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.2s;
          }

          .action-btn.primary {
            background: linear-gradient(180deg, rgba(34,197,94,0.25) 0%, rgba(22,163,74,0.2) 100%);
            border: 1px solid rgba(34,197,94,0.4);
            color: #22c55e;
          }

          .action-btn.primary:hover:not(:disabled) {
            box-shadow: 0 0 30px rgba(34,197,94,0.25);
          }

          .action-btn.secondary {
            background: rgba(255,255,255,0.05);
            border: 1px solid rgba(255,255,255,0.1);
            color: rgba(255,255,255,0.8);
          }

          .action-btn.eject {
            background: linear-gradient(135deg, rgba(244,63,94,0.2), rgba(251,146,60,0.15));
            border: 1px solid rgba(244,63,94,0.3);
            color: #fb7185;
          }

          .action-btn.eject:hover:not(:disabled) {
            box-shadow: 0 0 25px rgba(244,63,94,0.2);
          }

          .action-btn:disabled {
            opacity: 0.5;
            cursor: not-allowed;
          }

          .attach-mode {
            display: flex;
            flex-direction: column;
            gap: 16px;
          }

          .back-btn {
            background: none;
            border: none;
            color: #FF9F43;
            font-size: 14px;
            cursor: pointer;
            text-align: left;
            padding: 0;
          }

          .search-box input {
            width: 100%;
            padding: 12px 16px;
            background: rgba(0,0,0,0.3);
            border: 1px solid rgba(255,140,0,0.2);
            border-radius: 10px;
            color: white;
            font-size: 14px;
            outline: none;
          }

          .customer-list {
            display: flex;
            flex-direction: column;
            gap: 8px;
            max-height: 300px;
            overflow-y: auto;
          }

          .customer-item {
            display: flex;
            flex-direction: column;
            gap: 2px;
            padding: 12px 16px;
            background: rgba(255,255,255,0.03);
            border: 1px solid rgba(255,255,255,0.08);
            border-radius: 10px;
            text-align: left;
            cursor: pointer;
            transition: all 0.2s;
          }

          .customer-item:hover {
            background: rgba(255,140,0,0.1);
            border-color: rgba(255,140,0,0.3);
          }

          .customer-name {
            color: white;
            font-weight: 600;
          }

          .customer-detail {
            color: rgba(255,200,150,0.5);
            font-size: 12px;
          }

          .no-results {
            color: rgba(255,200,150,0.4);
            text-align: center;
            padding: 20px;
          }

          .hidden {
            display: none;
          }

          /* Light mode overrides */
          html:not(.dark) .license-scanner-modal {
            background: linear-gradient(180deg, #f8f8f8 0%, #ffffff 100%);
            border-color: rgba(0,188,212,0.3);
          }

          html:not(.dark) .scanner-header {
            border-color: rgba(0,188,212,0.2);
          }

          html:not(.dark) .field input {
            background: linear-gradient(135deg, rgba(0,188,212,0.12) 0%, rgba(0,229,255,0.08) 50%, rgba(0,188,212,0.15) 100%);
            border-color: rgba(0,229,255,0.35);
            color: #00E676;
          }

          html:not(.dark) .search-box input {
            background: linear-gradient(135deg, rgba(0,188,212,0.12) 0%, rgba(0,229,255,0.08) 50%, rgba(0,188,212,0.15) 100%);
            border-color: rgba(0,229,255,0.35);
            color: #00E676;
          }
        `}</style>
      </div>
    </div>
  );
};

export default LicenseScanner;

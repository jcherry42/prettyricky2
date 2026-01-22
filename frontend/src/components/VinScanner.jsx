import React, { useState, useCallback, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { 
  X, Camera, Keyboard, Car, Save, Check, Loader2, AlertCircle, ScanLine, 
  Shield, Fuel, Gauge, MapPin, Settings2, Zap, CheckCircle2, Flashlight, 
  FlashlightOff, RotateCcw, Target, CreditCard, User, Home, Calendar,
  FileText, ChevronRight, Plus, Scan, IdCard, Users, Search
} from 'lucide-react';
import { useSales } from '../context/SalesContext';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL;
const isCapacitor = typeof window !== 'undefined' && window.Capacitor?.isNativePlatform();

/**
 * Enterprise Intake Scanner
 * Superior to VinSolutions - combines VIN scanning with Driver's License capture
 * 
 * Features:
 * - VIN Scanning (windshield barcode, manual entry)
 * - Driver's License Image Capture (saves to customer profile)
 * - License image included in Eject SMS/MMS
 */
export const VinScanner = ({ isOpen, onClose }) => {
  const { customers } = useSales();
  const [mode, setMode] = useState('menu');
  
  // VIN State
  const [vin, setVin] = useState('');
  const [manualVin, setManualVin] = useState('');
  const [vehicleData, setVehicleData] = useState(null);
  const [vinValidation, setVinValidation] = useState({ valid: false, message: '' });
  const [recentScans, setRecentScans] = useState([]);
  
  // License State
  const [licenseImage, setLicenseImage] = useState(null);
  const [licensePreview, setLicensePreview] = useState(null);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [customerSearch, setCustomerSearch] = useState('');
  
  // Common State
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [saved, setSaved] = useState(false);
  const [torchEnabled, setTorchEnabled] = useState(false);
  
  const fileInputRef = useRef(null);
  const cameraInputRef = useRef(null);

  // Load recent scans
  useEffect(() => {
    const stored = localStorage.getItem('recentVinScans');
    if (stored) {
      try {
        setRecentScans(JSON.parse(stored));
      } catch (e) {}
    }
  }, []);

  // Reset on open
  useEffect(() => {
    if (isOpen) {
      setMode('menu');
      setVin('');
      setManualVin('');
      setVehicleData(null);
      setLicenseImage(null);
      setLicensePreview(null);
      setSelectedCustomer(null);
      setCustomerSearch('');
      setError(null);
      setSaved(false);
      setVinValidation({ valid: false, message: '' });
    }
  }, [isOpen]);

  // Cleanup blob URLs
  useEffect(() => {
    return () => {
      if (licensePreview) URL.revokeObjectURL(licensePreview);
    };
  }, [licensePreview]);

  // VIN Validation
  const validateVin = (value) => {
    const clean = value.toUpperCase().replace(/[^A-HJ-NPR-Z0-9]/g, '');
    
    if (clean.length === 0) {
      setVinValidation({ valid: false, message: '' });
      return;
    }
    
    if (clean.length < 17) {
      setVinValidation({ valid: false, message: `${clean.length}/17 characters` });
      return;
    }
    
    if (clean.length === 17) {
      if (/[IOQ]/.test(clean)) {
        setVinValidation({ valid: false, message: 'Invalid: VINs cannot contain I, O, or Q' });
        return;
      }
      setVinValidation({ valid: true, message: '✓ Valid VIN format' });
    }
  };

  const handleManualVinChange = (value) => {
    const formatted = value.toUpperCase().replace(/[^A-HJ-NPR-Z0-9]/g, '');
    setManualVin(formatted);
    validateVin(formatted);
  };

  // Decode VIN
  const decodeVin = async (vinToCheck) => {
    if (!vinToCheck || vinToCheck.length !== 17) {
      setError('Please enter a valid 17-character VIN');
      return;
    }

    setLoading(true);
    setError(null);
    setVehicleData(null);

    try {
      const res = await fetch(`${BACKEND_URL}/api/vin/decode/${vinToCheck}`);
      
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.detail || 'Failed to decode VIN');
      }

      const data = await res.json();
      setVehicleData(data);
      setVin(vinToCheck);
      
      // Save to recent scans
      const scan = {
        vin: vinToCheck,
        vehicle: `${data.year} ${data.make} ${data.model}`,
        timestamp: Date.now(),
      };
      const updated = [scan, ...recentScans.filter(s => s.vin !== vinToCheck)].slice(0, 10);
      setRecentScans(updated);
      localStorage.setItem('recentVinScans', JSON.stringify(updated));
      
      setMode('result');
    } catch (err) {
      setError(err.message || 'Failed to decode VIN');
    } finally {
      setLoading(false);
    }
  };

  // License Capture - just store the file, no OCR
  const handleLicenseCapture = async (file) => {
    if (!file) return;
    
    setLicenseImage(file);
    setLicensePreview(URL.createObjectURL(file));
    setError(null);
    setMode('licenseSelectCustomer');
  };

  const handleFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (file) handleLicenseCapture(file);
  };

  // Upload license and attach to customer
  const uploadLicenseToCustomer = async () => {
    if (!licenseImage || !selectedCustomer) {
      setError('Please select a customer to attach the license to');
      return;
    }
    
    setLoading(true);
    setError(null);
    
    try {
      const formData = new FormData();
      formData.append('image', licenseImage);
      formData.append('customer_id', selectedCustomer.id);
      
      const res = await fetch(`${BACKEND_URL}/api/license/upload`, {
        method: 'POST',
        body: formData
      });
      
      const data = await res.json();
      
      if (!data.success) {
        throw new Error(data.error || 'Failed to upload license');
      }
      
      setSaved(true);
      setTimeout(() => onClose(), 1500);
    } catch (err) {
      setError(err.message || 'Failed to upload license');
    } finally {
      setLoading(false);
    }
  };

  // Save vehicle
  const saveVehicle = async (asTradeIn = false) => {
    if (!vehicleData) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const res = await fetch(`${BACKEND_URL}/api/vehicles/add`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...vehicleData,
          isTradeIn: asTradeIn,
        }),
      });

      if (res.ok) {
        setSaved(true);
        setTimeout(() => onClose(), 1500);
      } else {
        throw new Error('Failed to save vehicle');
      }
    } catch (err) {
      setError(err.message || 'Failed to save');
    } finally {
      setLoading(false);
    }
  };

  // Filter customers for search
  const filteredCustomers = customers?.filter(c => {
    if (!customerSearch) return true;
    const search = customerSearch.toLowerCase();
    const name = (c.name || `${c.firstName || ''} ${c.lastName || ''}`).toLowerCase();
    const phone = (c.phone || '').toLowerCase();
    return name.includes(search) || phone.includes(search);
  }) || [];

  if (!isOpen) return null;

  // Render Menu
  const renderMenu = () => (
    <div className="intake-menu">
      <h3 className="intake-menu-title">Customer Intake</h3>
      <p className="intake-menu-subtitle">Choose an intake method</p>
      
      <div className="intake-options">
        {/* License Scan Option - Featured */}
        <button
          onClick={() => setMode('licenseCapture')}
          className="intake-option featured"
          data-testid="license-scan-option"
        >
          <div className="intake-option-icon license">
            <IdCard className="w-8 h-8" />
          </div>
          <div className="intake-option-content">
            <span className="intake-option-title">Scan Driver's License</span>
            <span className="intake-option-desc">Capture and save to customer profile</span>
          </div>
          <div className="intake-option-badge">NEW</div>
          <ChevronRight className="w-5 h-5 intake-chevron" />
        </button>
        
        {/* VIN Scan Option */}
        <button
          onClick={() => setMode('vinMenu')}
          className="intake-option"
          data-testid="vin-scan-option"
        >
          <div className="intake-option-icon vin">
            <Car className="w-8 h-8" />
          </div>
          <div className="intake-option-content">
            <span className="intake-option-title">Scan Vehicle VIN</span>
            <span className="intake-option-desc">Windshield scan or manual entry</span>
          </div>
          <ChevronRight className="w-5 h-5 intake-chevron" />
        </button>
      </div>
      
      {/* Recent Scans */}
      {recentScans.length > 0 && (
        <div className="intake-recent">
          <h4 className="intake-recent-title">Recent Scans</h4>
          <div className="intake-recent-list">
            {recentScans.slice(0, 3).map((scan, i) => (
              <button
                key={scan.vin}
                onClick={() => { setManualVin(scan.vin); setMode('vinManual'); }}
                className="intake-recent-item"
              >
                <Car className="w-4 h-4" />
                <span className="intake-recent-vehicle">{scan.vehicle}</span>
                <span className="intake-recent-vin">{scan.vin.slice(-6)}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );

  // Render VIN Menu
  const renderVinMenu = () => (
    <div className="intake-menu">
      <button onClick={() => setMode('menu')} className="intake-back-btn">
        ← Back to Intake
      </button>
      
      <h3 className="intake-menu-title">VIN Scanner</h3>
      <p className="intake-menu-subtitle">Scan or enter vehicle identification</p>
      
      <div className="intake-options">
        <button
          onClick={() => setMode('vinScan')}
          className="intake-option"
        >
          <div className="intake-option-icon scan">
            <Scan className="w-8 h-8" />
          </div>
          <div className="intake-option-content">
            <span className="intake-option-title">Scan Windshield VIN</span>
            <span className="intake-option-desc">Point camera at windshield barcode</span>
          </div>
          <ChevronRight className="w-5 h-5 intake-chevron" />
        </button>
        
        <button
          onClick={() => setMode('vinManual')}
          className="intake-option"
        >
          <div className="intake-option-icon manual">
            <Keyboard className="w-8 h-8" />
          </div>
          <div className="intake-option-content">
            <span className="intake-option-title">Enter VIN Manually</span>
            <span className="intake-option-desc">Type or paste 17-character VIN</span>
          </div>
          <ChevronRight className="w-5 h-5 intake-chevron" />
        </button>
      </div>
    </div>
  );

  // Render VIN Manual Entry
  const renderVinManual = () => (
    <div className="intake-form">
      <button onClick={() => setMode('vinMenu')} className="intake-back-btn">
        ← Back
      </button>
      
      <div className="intake-form-header">
        <div className="intake-form-icon">
          <Keyboard className="w-6 h-6" />
        </div>
        <h3>Enter VIN</h3>
      </div>
      
      <div className="intake-input-group">
        <label>Vehicle Identification Number</label>
        <input
          type="text"
          value={manualVin}
          onChange={(e) => handleManualVinChange(e.target.value)}
          placeholder="Enter 17-character VIN"
          maxLength={17}
          className={vinValidation.valid ? 'valid' : ''}
          data-testid="vin-input"
        />
        {vinValidation.message && (
          <span className={`intake-validation ${vinValidation.valid ? 'valid' : 'invalid'}`}>
            {vinValidation.message}
          </span>
        )}
      </div>
      
      {error && (
        <div className="intake-error">
          <AlertCircle className="w-4 h-4" />
          <span>{error}</span>
        </div>
      )}
      
      <button
        onClick={() => decodeVin(manualVin)}
        disabled={!vinValidation.valid || loading}
        className="intake-submit-btn"
        data-testid="decode-vin-btn"
      >
        {loading ? (
          <>
            <Loader2 className="w-5 h-5 animate-spin" />
            Decoding...
          </>
        ) : (
          <>
            <ScanLine className="w-5 h-5" />
            Decode VIN
          </>
        )}
      </button>
    </div>
  );

  // Render VIN Result
  const renderVinResult = () => {
    if (!vehicleData) return null;
    
    const confidence = vehicleData.confidence_score || 85;
    const confidenceColor = confidence >= 80 ? '#22c55e' : confidence >= 60 ? '#f59e0b' : '#ef4444';
    
    return (
      <div className="intake-result">
        <button onClick={() => setMode('vinManual')} className="intake-back-btn">
          ← Scan Another
        </button>
        
        {saved ? (
          <div className="intake-success">
            <CheckCircle2 className="w-16 h-16" />
            <span>Vehicle Saved!</span>
          </div>
        ) : (
          <>
            <div className="intake-result-header">
              <h3 className="intake-result-title">
                {vehicleData.year} {vehicleData.make}
              </h3>
              <p className="intake-result-subtitle">{vehicleData.model} {vehicleData.trim || ''}</p>
              
              <div className="intake-confidence" style={{ borderColor: confidenceColor }}>
                <span style={{ color: confidenceColor }}>{confidence}%</span>
                <span>Confidence</span>
              </div>
            </div>
            
            <div className="intake-result-grid">
              <div className="intake-result-item">
                <Car className="w-4 h-4" />
                <span className="label">VIN</span>
                <span className="value">{vehicleData.vin}</span>
              </div>
              <div className="intake-result-item">
                <Fuel className="w-4 h-4" />
                <span className="label">Fuel</span>
                <span className="value">{vehicleData.fuel_type || 'N/A'}</span>
              </div>
              <div className="intake-result-item">
                <Settings2 className="w-4 h-4" />
                <span className="label">Engine</span>
                <span className="value">{vehicleData.engine_displacement || 'N/A'}</span>
              </div>
              <div className="intake-result-item">
                <MapPin className="w-4 h-4" />
                <span className="label">Made In</span>
                <span className="value">{vehicleData.plant_country || 'N/A'}</span>
              </div>
            </div>
            
            {vehicleData.safety_features && vehicleData.safety_features.length > 0 && (
              <div className="intake-safety">
                <h4><Shield className="w-4 h-4" /> Safety Features</h4>
                <div className="intake-safety-list">
                  {vehicleData.safety_features.slice(0, 6).map((feature, i) => (
                    <span key={i} className="intake-safety-item">
                      <Check className="w-3 h-3" /> {feature}
                    </span>
                  ))}
                </div>
              </div>
            )}
            
            {error && (
              <div className="intake-error">
                <AlertCircle className="w-4 h-4" />
                <span>{error}</span>
              </div>
            )}
            
            <div className="intake-actions">
              <button onClick={() => saveVehicle(false)} disabled={loading} className="intake-action-btn primary">
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                Save to Inventory
              </button>
              <button onClick={() => saveVehicle(true)} disabled={loading} className="intake-action-btn secondary">
                Trade-In
              </button>
            </div>
          </>
        )}
      </div>
    );
  };

  // Render License Capture
  const renderLicenseCapture = () => (
    <div className="intake-form license-capture">
      <button onClick={() => setMode('menu')} className="intake-back-btn">
        ← Back to Intake
      </button>
      
      <div className="intake-form-header">
        <div className="intake-form-icon license">
          <IdCard className="w-6 h-6" />
        </div>
        <h3>Scan Driver's License</h3>
        <p>Capture license image for customer profile</p>
      </div>
      
      <div className="license-capture-area">
        {licensePreview ? (
          <div className="license-preview">
            <img src={licensePreview} alt="License preview" />
            {loading && (
              <div className="license-processing">
                <Loader2 className="w-8 h-8 animate-spin" />
                <span>Processing...</span>
              </div>
            )}
          </div>
        ) : (
          <div className="license-placeholder">
            <IdCard className="w-16 h-16" />
            <span>Position license front in frame</span>
          </div>
        )}
      </div>
      
      {error && (
        <div className="intake-error">
          <AlertCircle className="w-4 h-4" />
          <span>{error}</span>
        </div>
      )}
      
      <div className="license-capture-actions">
        <input
          ref={cameraInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={handleFileSelect}
          style={{ display: 'none' }}
        />
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileSelect}
          style={{ display: 'none' }}
        />
        
        <button
          onClick={() => cameraInputRef.current?.click()}
          className="intake-submit-btn"
          disabled={loading}
        >
          <Camera className="w-5 h-5" />
          Take Photo
        </button>
        
        <button
          onClick={() => fileInputRef.current?.click()}
          className="intake-secondary-btn"
          disabled={loading}
        >
          <FileText className="w-5 h-5" />
          Choose File
        </button>
      </div>
      
      <div className="license-tips">
        <h4>Tips for best results:</h4>
        <ul>
          <li>Use good lighting, avoid glare</li>
          <li>Keep license flat and steady</li>
          <li>Include all four corners in frame</li>
          <li>Front side of license only</li>
        </ul>
      </div>
    </div>
  );

  // Render Customer Selection for License
  const renderLicenseSelectCustomer = () => (
    <div className="intake-form license-select">
      <button onClick={() => { setMode('licenseCapture'); setLicenseImage(null); setLicensePreview(null); }} className="intake-back-btn">
        ← Retake Photo
      </button>
      
      <div className="intake-form-header">
        <div className="intake-form-icon license">
          <Users className="w-6 h-6" />
        </div>
        <h3>Select Customer</h3>
        <p>Choose a customer to attach this license to</p>
      </div>
      
      {/* License Preview Thumbnail */}
      {licensePreview && (
        <div className="license-thumbnail">
          <img src={licensePreview} alt="License" />
          <span>License captured</span>
        </div>
      )}
      
      {/* Customer Search */}
      <div className="intake-input-group">
        <label>Search Customers</label>
        <div className="customer-search-input">
          <Search className="w-4 h-4" />
          <input
            type="text"
            value={customerSearch}
            onChange={(e) => setCustomerSearch(e.target.value)}
            placeholder="Search by name or phone..."
            data-testid="customer-search-input"
          />
        </div>
      </div>
      
      {/* Customer List */}
      <div className="customer-list">
        {filteredCustomers.length === 0 ? (
          <div className="customer-empty">
            <Users className="w-8 h-8" />
            <span>No customers found</span>
            <span className="sub">Add customers first to attach licenses</span>
          </div>
        ) : (
          filteredCustomers.slice(0, 10).map(customer => (
            <button
              key={customer.id}
              onClick={() => setSelectedCustomer(customer)}
              className={`customer-item ${selectedCustomer?.id === customer.id ? 'selected' : ''}`}
              data-testid={`customer-${customer.id}`}
            >
              <div className="customer-avatar">
                <User className="w-5 h-5" />
              </div>
              <div className="customer-info">
                <span className="customer-name">{customer.name || `${customer.firstName || ''} ${customer.lastName || ''}`}</span>
                <span className="customer-phone">{customer.phone || 'No phone'}</span>
              </div>
              {selectedCustomer?.id === customer.id && (
                <CheckCircle2 className="w-5 h-5 text-green-500" />
              )}
            </button>
          ))
        )}
      </div>
      
      {error && (
        <div className="intake-error">
          <AlertCircle className="w-4 h-4" />
          <span>{error}</span>
        </div>
      )}
      
      <button
        onClick={uploadLicenseToCustomer}
        disabled={!selectedCustomer || loading}
        className="intake-submit-btn license-btn"
        data-testid="save-license-btn"
      >
        {loading ? (
          <>
            <Loader2 className="w-5 h-5 animate-spin" />
            Saving...
          </>
        ) : saved ? (
          <>
            <CheckCircle2 className="w-5 h-5" />
            Saved!
          </>
        ) : (
          <>
            <Save className="w-5 h-5" />
            Save License to {selectedCustomer?.name || 'Customer'}
          </>
        )}
      </button>
    </div>
  );

  // Render current mode
  const renderContent = () => {
    switch (mode) {
      case 'menu':
        return renderMenu();
      case 'vinMenu':
        return renderVinMenu();
      case 'vinManual':
        return renderVinManual();
      case 'result':
        return renderVinResult();
      case 'licenseCapture':
        return renderLicenseCapture();
      case 'licenseSelectCustomer':
        return renderLicenseSelectCustomer();
      default:
        return renderMenu();
    }
  };

  return createPortal(
    <div className="intake-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="intake-modal">
        <button onClick={onClose} className="intake-close-btn" data-testid="intake-close">
          <X className="w-5 h-5" />
        </button>
        
        {renderContent()}
      </div>
      
      <style>{`
        /* ==========================================
           ENTERPRISE INTAKE SCANNER
           Superior to VinSolutions
           ========================================== */
        
        .intake-overlay {
          position: fixed;
          inset: 0;
          z-index: 9999;
          background: rgba(0, 0, 0, 0.9);
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 16px;
        }
        
        .intake-modal {
          position: relative;
          width: 100%;
          max-width: 400px;
          max-height: 90vh;
          overflow-y: auto;
          background: linear-gradient(180deg, rgba(22, 22, 28, 0.98) 0%, rgba(12, 12, 16, 0.99) 100%);
          border-radius: 24px;
          border: 1px solid rgba(255, 255, 255, 0.08);
          box-shadow: 0 25px 60px rgba(0, 0, 0, 0.5), 0 0 80px rgba(34, 211, 238, 0.08);
        }
        
        .intake-close-btn {
          position: absolute;
          top: 16px;
          right: 16px;
          width: 36px;
          height: 36px;
          border-radius: 10px;
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.08);
          color: rgba(255, 255, 255, 0.5);
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          z-index: 10;
          transition: all 0.2s;
        }
        
        .intake-close-btn:hover {
          background: rgba(255, 255, 255, 0.1);
          color: #fff;
        }
        
        .intake-back-btn {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          padding: 8px 12px;
          margin-bottom: 16px;
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 8px;
          color: rgba(255, 255, 255, 0.6);
          font-size: 13px;
          cursor: pointer;
          transition: all 0.2s;
        }
        
        .intake-back-btn:hover {
          background: rgba(255, 255, 255, 0.1);
          color: #fff;
        }
        
        /* Menu */
        .intake-menu {
          padding: 24px;
        }
        
        .intake-menu-title {
          font-size: 22px;
          font-weight: 700;
          color: #fff;
          margin: 0 0 6px 0;
        }
        
        .intake-menu-subtitle {
          font-size: 13px;
          color: rgba(255, 255, 255, 0.5);
          margin: 0 0 24px 0;
        }
        
        .intake-options {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }
        
        .intake-option {
          display: flex;
          align-items: center;
          gap: 14px;
          padding: 16px;
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 16px;
          cursor: pointer;
          transition: all 0.2s;
          text-align: left;
        }
        
        .intake-option:hover {
          background: rgba(255, 255, 255, 0.06);
          border-color: rgba(255, 255, 255, 0.12);
        }
        
        .intake-option.featured {
          background: linear-gradient(135deg, rgba(139, 92, 246, 0.12) 0%, rgba(109, 40, 217, 0.08) 100%);
          border-color: rgba(139, 92, 246, 0.25);
        }
        
        .intake-option.featured:hover {
          background: linear-gradient(135deg, rgba(139, 92, 246, 0.18) 0%, rgba(109, 40, 217, 0.12) 100%);
          border-color: rgba(139, 92, 246, 0.35);
        }
        
        .intake-option-icon {
          width: 56px;
          height: 56px;
          border-radius: 14px;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }
        
        .intake-option-icon.license {
          background: linear-gradient(135deg, rgba(139, 92, 246, 0.2) 0%, rgba(109, 40, 217, 0.15) 100%);
          border: 1px solid rgba(139, 92, 246, 0.3);
          color: #a78bfa;
        }
        
        .intake-option-icon.vin {
          background: linear-gradient(135deg, rgba(34, 211, 238, 0.15) 0%, rgba(6, 182, 212, 0.1) 100%);
          border: 1px solid rgba(34, 211, 238, 0.25);
          color: #22d3ee;
        }
        
        .intake-option-icon.scan {
          background: linear-gradient(135deg, rgba(34, 197, 94, 0.15) 0%, rgba(22, 163, 74, 0.1) 100%);
          border: 1px solid rgba(34, 197, 94, 0.25);
          color: #22c55e;
        }
        
        .intake-option-icon.manual {
          background: linear-gradient(135deg, rgba(251, 191, 36, 0.15) 0%, rgba(245, 158, 11, 0.1) 100%);
          border: 1px solid rgba(251, 191, 36, 0.25);
          color: #fbbf24;
        }
        
        .intake-option-content {
          flex: 1;
          min-width: 0;
        }
        
        .intake-option-title {
          display: block;
          font-size: 15px;
          font-weight: 600;
          color: #fff;
          margin-bottom: 4px;
        }
        
        .intake-option-desc {
          display: block;
          font-size: 12px;
          color: rgba(255, 255, 255, 0.5);
        }
        
        .intake-option-badge {
          padding: 3px 8px;
          background: linear-gradient(135deg, #a78bfa 0%, #8b5cf6 100%);
          border-radius: 6px;
          font-size: 9px;
          font-weight: 700;
          color: #fff;
          letter-spacing: 0.5px;
        }
        
        .intake-chevron {
          color: rgba(255, 255, 255, 0.3);
          flex-shrink: 0;
        }
        
        /* Recent Scans */
        .intake-recent {
          margin-top: 24px;
          padding-top: 20px;
          border-top: 1px solid rgba(255, 255, 255, 0.06);
        }
        
        .intake-recent-title {
          font-size: 11px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          color: rgba(255, 255, 255, 0.4);
          margin: 0 0 12px 0;
        }
        
        .intake-recent-list {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        
        .intake-recent-item {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 10px 12px;
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid rgba(255, 255, 255, 0.05);
          border-radius: 10px;
          cursor: pointer;
          transition: all 0.2s;
        }
        
        .intake-recent-item:hover {
          background: rgba(255, 255, 255, 0.06);
        }
        
        .intake-recent-item svg {
          color: rgba(34, 211, 238, 0.7);
        }
        
        .intake-recent-vehicle {
          flex: 1;
          font-size: 13px;
          color: #fff;
        }
        
        .intake-recent-vin {
          font-size: 11px;
          color: rgba(255, 255, 255, 0.4);
          font-family: monospace;
        }
        
        /* Form */
        .intake-form {
          padding: 24px;
        }
        
        .intake-form-header {
          text-align: center;
          margin-bottom: 24px;
        }
        
        .intake-form-header h3 {
          font-size: 18px;
          font-weight: 600;
          color: #fff;
          margin: 12px 0 4px 0;
        }
        
        .intake-form-header p {
          font-size: 13px;
          color: rgba(255, 255, 255, 0.5);
          margin: 0;
        }
        
        .intake-form-icon {
          width: 56px;
          height: 56px;
          margin: 0 auto;
          border-radius: 16px;
          background: rgba(34, 211, 238, 0.15);
          border: 1px solid rgba(34, 211, 238, 0.25);
          display: flex;
          align-items: center;
          justify-content: center;
          color: #22d3ee;
        }
        
        .intake-form-icon.license {
          background: linear-gradient(135deg, rgba(139, 92, 246, 0.2) 0%, rgba(109, 40, 217, 0.15) 100%);
          border: 1px solid rgba(139, 92, 246, 0.3);
          color: #a78bfa;
        }
        
        .intake-input-group {
          margin-bottom: 20px;
        }
        
        .intake-input-group label {
          display: block;
          font-size: 11px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          color: rgba(34, 211, 238, 0.8);
          margin-bottom: 8px;
        }
        
        .intake-input-group input {
          width: 100%;
          padding: 14px 16px;
          background: rgba(0, 0, 0, 0.4);
          border: 1px solid rgba(34, 211, 238, 0.2);
          border-radius: 12px;
          color: #fff;
          font-size: 16px;
          font-family: 'SF Mono', monospace;
          letter-spacing: 1px;
          text-transform: uppercase;
          transition: all 0.2s;
        }
        
        .intake-input-group input:focus {
          outline: none;
          border-color: rgba(34, 211, 238, 0.5);
          box-shadow: 0 0 20px rgba(34, 211, 238, 0.15);
        }
        
        .intake-input-group input.valid {
          border-color: rgba(34, 197, 94, 0.5);
        }
        
        .intake-validation {
          display: block;
          margin-top: 8px;
          font-size: 12px;
        }
        
        .intake-validation.valid {
          color: #22c55e;
        }
        
        .intake-validation.invalid {
          color: rgba(255, 255, 255, 0.5);
        }
        
        .intake-error {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 12px;
          background: rgba(239, 68, 68, 0.1);
          border: 1px solid rgba(239, 68, 68, 0.25);
          border-radius: 10px;
          color: #fca5a5;
          font-size: 13px;
          margin-bottom: 16px;
        }
        
        .intake-submit-btn {
          width: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          padding: 14px 20px;
          background: linear-gradient(135deg, rgba(34, 211, 238, 0.2) 0%, rgba(6, 182, 212, 0.15) 100%);
          border: 1px solid rgba(34, 211, 238, 0.4);
          border-radius: 12px;
          color: #22d3ee;
          font-size: 15px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
        }
        
        .intake-submit-btn:hover:not(:disabled) {
          background: linear-gradient(135deg, rgba(34, 211, 238, 0.3) 0%, rgba(6, 182, 212, 0.25) 100%);
          box-shadow: 0 0 25px rgba(34, 211, 238, 0.2);
        }
        
        .intake-submit-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
        
        .intake-submit-btn.license-btn {
          background: linear-gradient(135deg, rgba(139, 92, 246, 0.2) 0%, rgba(109, 40, 217, 0.15) 100%);
          border-color: rgba(139, 92, 246, 0.4);
          color: #a78bfa;
        }
        
        .intake-submit-btn.license-btn:hover:not(:disabled) {
          background: linear-gradient(135deg, rgba(139, 92, 246, 0.3) 0%, rgba(109, 40, 217, 0.25) 100%);
          box-shadow: 0 0 25px rgba(139, 92, 246, 0.2);
        }
        
        .intake-secondary-btn {
          width: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          padding: 12px 20px;
          margin-top: 10px;
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 12px;
          color: rgba(255, 255, 255, 0.7);
          font-size: 14px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s;
        }
        
        .intake-secondary-btn:hover:not(:disabled) {
          background: rgba(255, 255, 255, 0.08);
          color: #fff;
        }
        
        /* License Capture */
        .license-capture-area {
          aspect-ratio: 1.6;
          background: rgba(0, 0, 0, 0.4);
          border: 2px dashed rgba(139, 92, 246, 0.3);
          border-radius: 16px;
          margin-bottom: 20px;
          overflow: hidden;
          position: relative;
        }
        
        .license-placeholder {
          width: 100%;
          height: 100%;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 12px;
          color: rgba(139, 92, 246, 0.5);
        }
        
        .license-placeholder span {
          font-size: 13px;
        }
        
        .license-preview {
          width: 100%;
          height: 100%;
          position: relative;
        }
        
        .license-preview img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }
        
        .license-processing {
          position: absolute;
          inset: 0;
          background: rgba(0, 0, 0, 0.7);
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 12px;
          color: #a78bfa;
        }
        
        .license-capture-actions {
          display: flex;
          flex-direction: column;
          gap: 10px;
        }
        
        .license-capture .intake-submit-btn {
          background: linear-gradient(135deg, rgba(139, 92, 246, 0.2) 0%, rgba(109, 40, 217, 0.15) 100%);
          border-color: rgba(139, 92, 246, 0.4);
          color: #a78bfa;
        }
        
        .license-capture .intake-submit-btn:hover:not(:disabled) {
          background: linear-gradient(135deg, rgba(139, 92, 246, 0.3) 0%, rgba(109, 40, 217, 0.25) 100%);
          box-shadow: 0 0 25px rgba(139, 92, 246, 0.2);
        }
        
        .license-tips {
          margin-top: 20px;
          padding: 14px;
          background: rgba(255, 255, 255, 0.03);
          border-radius: 12px;
        }
        
        .license-tips h4 {
          font-size: 12px;
          font-weight: 600;
          color: rgba(255, 255, 255, 0.6);
          margin: 0 0 10px 0;
        }
        
        .license-tips ul {
          margin: 0;
          padding: 0 0 0 18px;
        }
        
        .license-tips li {
          font-size: 12px;
          color: rgba(255, 255, 255, 0.4);
          margin-bottom: 4px;
        }
        
        /* License Thumbnail */
        .license-thumbnail {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 12px;
          background: rgba(139, 92, 246, 0.1);
          border: 1px solid rgba(139, 92, 246, 0.25);
          border-radius: 12px;
          margin-bottom: 20px;
        }
        
        .license-thumbnail img {
          width: 60px;
          height: 40px;
          object-fit: cover;
          border-radius: 6px;
        }
        
        .license-thumbnail span {
          color: #a78bfa;
          font-size: 13px;
          font-weight: 500;
        }
        
        /* Customer Search */
        .customer-search-input {
          position: relative;
        }
        
        .customer-search-input svg {
          position: absolute;
          left: 14px;
          top: 50%;
          transform: translateY(-50%);
          color: rgba(255, 255, 255, 0.4);
        }
        
        .customer-search-input input {
          padding-left: 42px;
          text-transform: none;
          font-family: inherit;
          letter-spacing: normal;
        }
        
        /* Customer List */
        .customer-list {
          max-height: 250px;
          overflow-y: auto;
          margin-bottom: 20px;
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        
        .customer-empty {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 8px;
          padding: 30px 20px;
          color: rgba(255, 255, 255, 0.4);
        }
        
        .customer-empty .sub {
          font-size: 12px;
          color: rgba(255, 255, 255, 0.3);
        }
        
        .customer-item {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 12px;
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 12px;
          cursor: pointer;
          transition: all 0.2s;
        }
        
        .customer-item:hover {
          background: rgba(255, 255, 255, 0.06);
        }
        
        .customer-item.selected {
          background: rgba(139, 92, 246, 0.15);
          border-color: rgba(139, 92, 246, 0.35);
        }
        
        .customer-avatar {
          width: 40px;
          height: 40px;
          border-radius: 10px;
          background: rgba(139, 92, 246, 0.15);
          display: flex;
          align-items: center;
          justify-content: center;
          color: #a78bfa;
        }
        
        .customer-info {
          flex: 1;
          min-width: 0;
        }
        
        .customer-name {
          display: block;
          font-size: 14px;
          font-weight: 500;
          color: #fff;
          margin-bottom: 2px;
        }
        
        .customer-phone {
          display: block;
          font-size: 12px;
          color: rgba(255, 255, 255, 0.5);
        }
        
        /* Results */
        .intake-result {
          padding: 24px;
        }
        
        .intake-success {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 16px;
          padding: 40px 20px;
          color: #22c55e;
        }
        
        .intake-success svg {
          filter: drop-shadow(0 0 20px rgba(34, 197, 94, 0.5));
        }
        
        .intake-success span {
          font-size: 18px;
          font-weight: 600;
        }
        
        .intake-result-header {
          text-align: center;
          margin-bottom: 20px;
        }
        
        .intake-result-title {
          font-size: 22px;
          font-weight: 700;
          color: #fff;
          margin: 0;
        }
        
        .intake-result-subtitle {
          font-size: 14px;
          color: #22d3ee;
          margin: 4px 0 0 0;
        }
        
        .intake-confidence {
          display: inline-flex;
          flex-direction: column;
          align-items: center;
          padding: 8px 16px;
          background: rgba(0, 0, 0, 0.3);
          border: 1px solid;
          border-radius: 10px;
          margin-top: 12px;
        }
        
        .intake-confidence span:first-child {
          font-size: 20px;
          font-weight: 700;
        }
        
        .intake-confidence span:last-child {
          font-size: 10px;
          color: rgba(255, 255, 255, 0.5);
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }
        
        .intake-result-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 10px;
          margin-bottom: 16px;
        }
        
        .intake-result-item {
          padding: 12px;
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid rgba(255, 255, 255, 0.06);
          border-radius: 12px;
          display: flex;
          flex-direction: column;
          gap: 4px;
        }
        
        .intake-result-item svg {
          color: rgba(34, 211, 238, 0.6);
          margin-bottom: 4px;
        }
        
        .intake-result-item .label {
          font-size: 10px;
          color: rgba(255, 255, 255, 0.4);
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }
        
        .intake-result-item .value {
          font-size: 13px;
          color: #fff;
          font-weight: 500;
        }
        
        .intake-safety {
          padding: 14px;
          background: rgba(34, 197, 94, 0.08);
          border: 1px solid rgba(34, 197, 94, 0.15);
          border-radius: 12px;
          margin-bottom: 16px;
        }
        
        .intake-safety h4 {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 12px;
          font-weight: 600;
          color: #22c55e;
          margin: 0 0 10px 0;
        }
        
        .intake-safety-list {
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
        }
        
        .intake-safety-item {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          padding: 4px 8px;
          background: rgba(34, 197, 94, 0.1);
          border-radius: 6px;
          font-size: 11px;
          color: rgba(34, 197, 94, 0.9);
        }
        
        .intake-actions {
          display: flex;
          gap: 10px;
        }
        
        .intake-action-btn {
          flex: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          padding: 14px 16px;
          border-radius: 12px;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
        }
        
        .intake-action-btn.primary {
          background: linear-gradient(135deg, rgba(34, 211, 238, 0.2) 0%, rgba(6, 182, 212, 0.15) 100%);
          border: 1px solid rgba(34, 211, 238, 0.4);
          color: #22d3ee;
        }
        
        .intake-action-btn.primary:hover:not(:disabled) {
          background: linear-gradient(135deg, rgba(34, 211, 238, 0.3) 0%, rgba(6, 182, 212, 0.25) 100%);
          box-shadow: 0 0 20px rgba(34, 211, 238, 0.2);
        }
        
        .intake-action-btn.secondary {
          background: rgba(251, 191, 36, 0.12);
          border: 1px solid rgba(251, 191, 36, 0.3);
          color: #fbbf24;
        }
        
        .intake-action-btn.secondary:hover:not(:disabled) {
          background: rgba(251, 191, 36, 0.2);
        }
        
        .intake-action-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
      `}</style>
    </div>,
    document.body
  );
};

export default VinScanner;

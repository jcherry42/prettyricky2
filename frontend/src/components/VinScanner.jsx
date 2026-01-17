import React, { useState, useCallback, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Camera, Keyboard, Car, Save, Check, Loader2, AlertCircle, ScanLine, Shield, Fuel, Gauge, MapPin, Settings2, Zap, CheckCircle2 } from 'lucide-react';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL;
const isCapacitor = typeof window !== 'undefined' && window.Capacitor?.isNativePlatform();

export const VinScanner = ({ isOpen, onClose }) => {
  const [mode, setMode] = useState('menu');
  const [vin, setVin] = useState('');
  const [manualVin, setManualVin] = useState('');
  const [vehicleData, setVehicleData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [saved, setSaved] = useState(false);
  const [recentScans, setRecentScans] = useState([]);
  const [vinValidation, setVinValidation] = useState({ valid: false, message: '' });

  // Load recent scans from localStorage
  useEffect(() => {
    const stored = localStorage.getItem('recentVinScans');
    if (stored) {
      try {
        setRecentScans(JSON.parse(stored));
      } catch (e) {
        console.error('Failed to load recent scans:', e);
      }
    }
  }, []);

  // Save to recent scans
  const addToRecentScans = useCallback((vinData) => {
    const scan = {
      vin: vinData.vin,
      vehicle: `${vinData.year} ${vinData.make} ${vinData.model}`,
      timestamp: Date.now(),
    };
    
    const updated = [scan, ...recentScans.filter(s => s.vin !== vinData.vin)].slice(0, 5);
    setRecentScans(updated);
    localStorage.setItem('recentVinScans', JSON.stringify(updated));
  }, [recentScans]);

  // Real-time VIN validation as user types
  const validateVin = (value) => {
    const clean = value.toUpperCase().replace(/[^A-HJ-NPR-Z0-9]/g, '');
    
    if (clean.length === 0) {
      setVinValidation({ valid: false, message: '' });
      return;
    }
    
    if (clean.length < 17) {
      setVinValidation({ 
        valid: false, 
        message: `${clean.length}/17 characters` 
      });
      return;
    }
    
    if (clean.length === 17) {
      // Check for invalid characters (I, O, Q not allowed in VINs)
      if (/[IOQ]/.test(clean)) {
        setVinValidation({ 
          valid: false, 
          message: 'Invalid: VINs cannot contain I, O, or Q' 
        });
        return;
      }
      
      setVinValidation({ 
        valid: true, 
        message: '✓ Valid VIN format' 
      });
    }
  };

  const handleManualVinChange = (value) => {
    const formatted = value.toUpperCase().replace(/[^A-HJ-NPR-Z0-9]/g, '');
    setManualVin(formatted);
    validateVin(formatted);
  };

  useEffect(() => {
    if (isOpen) {
      setMode('menu');
      setVin('');
      setManualVin('');
      setVehicleData(null);
      setError(null);
      setSaved(false);
    }
  }, [isOpen]);

  const initScanner = useCallback(async () => {
    if (!isCapacitor) {
      setError('Camera scanning requires the mobile app. Use manual entry.');
      return false;
    }

    try {
      const { BarcodeScanner } = await import('@capacitor-mlkit/barcode-scanning');
      
      const { camera } = await BarcodeScanner.checkPermissions();
      if (camera !== 'granted') {
        const { camera: newPermission } = await BarcodeScanner.requestPermissions();
        if (newPermission !== 'granted') {
          setError('Camera permission required');
          return false;
        }
      }

      const { supported } = await BarcodeScanner.isSupported();
      if (!supported) {
        setError('Barcode scanning not supported');
        return false;
      }

      return true;
    } catch (err) {
      console.error('Scanner init error:', err);
      setError('Failed to initialize scanner');
      return false;
    }
  }, []);

  // Define lookupVin BEFORE it's used
  const lookupVin = useCallback(async (vinNumber) => {
    setLoading(true);
    setError(null);

    try {
      console.log('[VIN] Attempting to decode:', vinNumber);
      console.log('[VIN] Backend URL:', BACKEND_URL);
      
      const res = await fetch(`${BACKEND_URL}/api/vin/decode/${vinNumber}`, {
        headers: {
          'Accept': 'application/json',
        },
      });
      
      console.log('[VIN] Response status:', res.status);
      
      const data = await res.json();
      console.log('[VIN] Response data:', data);

      if (!res.ok) {
        const errorMsg = data.detail || data.message || 'VIN lookup failed';
        console.error('[VIN] Error:', errorMsg);
        throw new Error(errorMsg);
      }

      if (!data.make || !data.model) {
        throw new Error('Invalid VIN - could not decode vehicle information');
      }

      setVehicleData(data);
      addToRecentScans(data);
      setMode('result');
    } catch (err) {
      console.error('[VIN] Exception:', err);
      const errorMessage = err.message || 'Failed to decode VIN. Check your internet connection.';
      setError(errorMessage);
      setMode('menu');
    } finally {
      setLoading(false);
    }
  }, [addToRecentScans]);

  const startBarcodeScanning = useCallback(async () => {
    setError(null);
    setLoading(true);
    setMode('scanning');

    const ready = await initScanner();
    if (!ready) {
      setLoading(false);
      setMode('menu');
      return;
    }

    try {
      const { BarcodeScanner } = await import('@capacitor-mlkit/barcode-scanning');
      document.body.classList.add('barcode-scanning');

      const result = await BarcodeScanner.scan({
        formats: ['CODE_39', 'CODE_128', 'DATA_MATRIX', 'QR_CODE'],
      });

      document.body.classList.remove('barcode-scanning');

      if (result.barcodes?.length > 0) {
        const scannedVin = result.barcodes[0].rawValue;
        if (scannedVin?.length === 17) {
          setVin(scannedVin.toUpperCase());
          await lookupVin(scannedVin.toUpperCase());
        } else {
          setError('Invalid VIN. Must be 17 characters.');
          setMode('menu');
        }
      } else {
        setError('No barcode detected. Try manual entry.');
        setMode('menu');
      }
    } catch (err) {
      document.body.classList.remove('barcode-scanning');
      if (err.message !== 'scan canceled') {
        setError('Scan failed. Try manual entry.');
      }
      setMode('menu');
    } finally {
      setLoading(false);
    }
  }, [initScanner, lookupVin]);

  const stopScanning = useCallback(async () => {
    try {
      if (isCapacitor) {
        const { BarcodeScanner } = await import('@capacitor-mlkit/barcode-scanning');
        await BarcodeScanner.stopScan();
      }
      document.body.classList.remove('barcode-scanning');
    } catch (err) {
      console.error('Stop scan error:', err);
    }
    setMode('menu');
    setLoading(false);
  }, []);

  const handleManualSubmit = async (e) => {
    e.preventDefault();
    const cleanVin = manualVin.toUpperCase().replace(/[^A-HJ-NPR-Z0-9]/g, '');
    
    if (cleanVin.length !== 17) {
      setError('VIN must be 17 characters');
      return;
    }

    setVin(cleanVin);
    await lookupVin(cleanVin);
  };

  // State for category selection
  const [saveCategory, setSaveCategory] = useState('active_inventory');
  const [tradeInValue, setTradeInValue] = useState('');

  const saveToInventory = async () => {
    if (!vehicleData) return;

    setLoading(true);
    setError(null);
    
    try {
      console.log('[VIN Save] Attempting to save VIN to inventory:', vin);
      
      const res = await fetch(`${BACKEND_URL}/api/vin/save-to-inventory`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          vin, 
          vehicle_data: vehicleData,
          category: saveCategory,
          trade_in_value: saveCategory === 'trade_in' && tradeInValue ? parseFloat(tradeInValue) : null
        }),
      });

      const data = await res.json();
      
      if (!res.ok) {
        console.error('[VIN Save] Error response:', data);
        
        // Special handling for duplicate VIN (409 Conflict)
        if (res.status === 409) {
          throw new Error(`⚠️ DUPLICATE VIN\n\n${data.detail || 'This VIN already exists in inventory'}`);
        }
        
        throw new Error(data.detail || 'Failed to save vehicle to inventory');
      }

      console.log('[VIN Save] Success:', data.message);
      setSaved(true);
    } catch (err) {
      console.error('[VIN Save] Exception:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  // Use portal to render outside header context
  return createPortal(
    <div className="vin-modal-overlay" onClick={mode === 'scanning' ? stopScanning : onClose}>
      <div className="vin-modal" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="vin-modal-header">
          <div className="vin-header-icon">
            <ScanLine className="w-5 h-5" />
          </div>
          <div>
            <h2>VIN Scanner</h2>
            <p>Decode any vehicle</p>
          </div>
          <button onClick={mode === 'scanning' ? stopScanning : onClose} className="vin-close-btn">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="vin-modal-content">
          {error && (
            <div className="vin-error">
              <AlertCircle className="w-4 h-4" />
              <span>{error}</span>
            </div>
          )}

          {/* Menu Mode */}
          {mode === 'menu' && (
            <div className="vin-menu">
              <button onClick={startBarcodeScanning} disabled={loading} className="vin-option">
                <div className="vin-option-icon cyan">
                  <Camera className="w-6 h-6" />
                </div>
                <div className="vin-option-text">
                  <span className="title">Scan Barcode</span>
                  <span className="subtitle">Door jamb or window sticker</span>
                </div>
              </button>

              <button onClick={() => setMode('manual')} className="vin-option">
                <div className="vin-option-icon amber">
                  <Keyboard className="w-6 h-6" />
                </div>
                <div className="vin-option-text">
                  <span className="title">Enter Manually</span>
                  <span className="subtitle">Type the 17-digit VIN</span>
                </div>
              </button>

              {/* Recent Scans */}
              {recentScans.length > 0 && (
                <div className="recent-scans">
                  <div className="recent-header">
                    <span>Recent Scans</span>
                  </div>
                  {recentScans.map((scan, index) => (
                    <button 
                      key={scan.vin} 
                      onClick={() => lookupVin(scan.vin)}
                      className="recent-scan-item"
                    >
                      <div className="recent-scan-info">
                        <span className="recent-vehicle">{scan.vehicle}</span>
                        <span className="recent-vin">{scan.vin}</span>
                      </div>
                      <span className="recent-time">
                        {new Date(scan.timestamp).toLocaleDateString()}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Scanning Mode */}
          {mode === 'scanning' && (
            <div className="vin-scanning">
              <div className="scan-box">
                <div className="scan-line" />
                <Loader2 className="w-8 h-8 animate-spin" />
              </div>
              <p>Point camera at VIN barcode</p>
              <button onClick={stopScanning} className="vin-cancel-btn">Cancel</button>
            </div>
          )}

          {/* Manual Entry */}
          {mode === 'manual' && (
            <form onSubmit={handleManualSubmit} className="vin-manual">
              <label>Vehicle Identification Number</label>
              <input
                type="text"
                value={manualVin}
                onChange={(e) => handleManualVinChange(e.target.value)}
                placeholder="1HGCM82633A123456"
                maxLength={17}
                autoFocus
                data-testid="vin-input"
              />
              <div className="vin-input-info">
                <span>Letters I, O, Q not valid</span>
                <span className={`validation-message ${vinValidation.valid ? 'valid' : 'invalid'}`}>
                  {vinValidation.message || `${manualVin.length}/17 characters`}
                </span>
              </div>
              <div className="vin-form-btns">
                <button type="button" onClick={() => setMode('menu')} className="vin-back-btn">Back</button>
                <button type="submit" disabled={!vinValidation.valid || loading} className="vin-submit-btn" data-testid="decode-vin-btn">
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ScanLine className="w-4 h-4" />}
                  Decode
                </button>
              </div>
            </form>
          )}

          {/* Results */}
          {mode === 'result' && vehicleData && (
            <div className="vin-results">
              {/* Confidence Badge */}
              {vehicleData.validation && (
                <div className={`confidence-badge ${vehicleData.validation.confidence_score >= 70 ? 'high' : vehicleData.validation.confidence_score >= 40 ? 'medium' : 'low'}`}>
                  <Shield className="w-4 h-4" />
                  <span>{vehicleData.validation.confidence_score}% Confidence</span>
                  {vehicleData.validation.checksum_valid && <CheckCircle2 className="w-3 h-3" />}
                </div>
              )}
              
              {/* Vehicle Hero */}
              <div className="vin-hero">
                <div className="vin-hero-icon">
                  <Car className="w-6 h-6" />
                </div>
                <div className="vin-hero-info">
                  <span className="year">{vehicleData.year}</span>
                  <h3>{vehicleData.make} {vehicleData.model}</h3>
                  {vehicleData.trim && <span className="trim">{vehicleData.trim}</span>}
                  <span className="vin-number">{vin}</span>
                </div>
              </div>

              {/* Specs Grid */}
              <div className="vin-specs">
                {vehicleData.engine_display && (
                  <div className="spec-item">
                    <Gauge className="w-4 h-4 text-amber-400" />
                    <div>
                      <span className="label">Engine</span>
                      <span className="value">{vehicleData.engine_display}</span>
                    </div>
                  </div>
                )}
                {vehicleData.transmission && (
                  <div className="spec-item">
                    <Settings2 className="w-4 h-4 text-purple-400" />
                    <div>
                      <span className="label">Trans</span>
                      <span className="value">{vehicleData.transmission}</span>
                    </div>
                  </div>
                )}
                {vehicleData.fuel_type && (
                  <div className="spec-item">
                    <Fuel className="w-4 h-4 text-orange-400" />
                    <div>
                      <span className="label">Fuel</span>
                      <span className="value">{vehicleData.fuel_type}</span>
                    </div>
                  </div>
                )}
                {vehicleData.drive_type && (
                  <div className="spec-item">
                    <Zap className="w-4 h-4 text-green-400" />
                    <div>
                      <span className="label">Drive</span>
                      <span className="value">{vehicleData.drive_type}</span>
                    </div>
                  </div>
                )}
                {vehicleData.body_class && (
                  <div className="spec-item">
                    <Car className="w-4 h-4 text-blue-400" />
                    <div>
                      <span className="label">Body</span>
                      <span className="value">{vehicleData.body_class}</span>
                    </div>
                  </div>
                )}
                {vehicleData.assembly_location && (
                  <div className="spec-item">
                    <MapPin className="w-4 h-4 text-rose-400" />
                    <div>
                      <span className="label">Built In</span>
                      <span className="value">{vehicleData.assembly_location}</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Safety */}
              {vehicleData.safety_features?.length > 0 && (
                <div className="vin-safety">
                  <div className="safety-header">
                    <Shield className="w-4 h-4 text-emerald-400" />
                    <span>Safety</span>
                  </div>
                  <div className="safety-tags">
                    {vehicleData.safety_features.map((f, i) => (
                      <span key={i} className="safety-tag">{f}</span>
                    ))}
                  </div>
                </div>
              )}

              {/* Category Selector */}
              <div className="vin-category-selector">
                <span className="category-label">Save to:</span>
                <div className="category-options">
                  <button 
                    className={`category-btn ${saveCategory === 'active_inventory' ? 'active' : ''}`}
                    onClick={() => setSaveCategory('active_inventory')}
                  >
                    <Car className="w-4 h-4" />
                    Inventory
                  </button>
                  <button 
                    className={`category-btn trade ${saveCategory === 'trade_in' ? 'active' : ''}`}
                    onClick={() => setSaveCategory('trade_in')}
                  >
                    <Car className="w-4 h-4" />
                    Trade-In
                  </button>
                </div>
                {saveCategory === 'trade_in' && (
                  <input
                    type="number"
                    placeholder="Trade-in value ($)"
                    value={tradeInValue}
                    onChange={e => setTradeInValue(e.target.value)}
                    className="trade-value-input"
                  />
                )}
              </div>

              {/* Actions */}
              <div className="vin-actions">
                <button onClick={() => { setMode('menu'); setVehicleData(null); setVin(''); setSaved(false); setSaveCategory('active_inventory'); setTradeInValue(''); }} className="vin-back-btn">
                  Scan Another
                </button>
                <button onClick={saveToInventory} disabled={loading || saved} className={`vin-save-btn ${saved ? 'saved' : ''}`} data-testid="save-vehicle-btn">
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : saved ? <Check className="w-4 h-4" /> : <Save className="w-4 h-4" />}
                  {saved ? 'Saved!' : 'Save'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      <style>{`
        .vin-modal-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          width: 100vw;
          height: 100vh;
          background: rgba(10,8,6,0.9);
          backdrop-filter: blur(16px);
          z-index: 9999;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 16px;
        }

        .vin-modal {
          position: relative;
          width: calc(100% - 32px);
          max-width: 340px;
          max-height: 85vh;
          margin: auto;
          overflow-y: auto;
          background: rgba(20,18,16,0.75);
          backdrop-filter: blur(16px);
          border-radius: 20px;
          border: 1px solid rgba(255,191,0,0.2);
          box-shadow: 
            0 25px 50px rgba(0,0,0,0.6),
            0 0 40px rgba(255,191,0,0.12),
            inset 0 1px 0 rgba(255,255,255,0.08);
        }

        .vin-modal-header {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 16px;
          border-bottom: 1px solid rgba(255,191,0,0.12);
        }

        .vin-header-icon {
          width: 40px;
          height: 40px;
          border-radius: 12px;
          background: rgba(255,191,0,0.15);
          border: 1px solid rgba(255,191,0,0.3);
          display: flex;
          align-items: center;
          justify-content: center;
          color: #FFBF00;
        }

        .vin-modal-header h2 {
          font-family: 'Chakra Petch', sans-serif;
          font-size: 16px;
          font-weight: 600;
          color: #FFBF00;
          margin: 0;
          text-shadow: 0 0 10px rgba(255,191,0,0.3);
        }

        .vin-modal-header p {
          font-size: 11px;
          color: #666;
          margin: 0;
        }

        .vin-close-btn {
          margin-left: auto;
          width: 32px;
          height: 32px;
          border-radius: 50%;
          background: rgba(255,255,255,0.08);
          border: none;
          color: #888;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .vin-modal-content {
          padding: 16px;
        }

        .vin-error {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 10px 12px;
          margin-bottom: 12px;
          border-radius: 10px;
          background: rgba(239,68,68,0.1);
          border: 1px solid rgba(239,68,68,0.2);
          color: #fca5a5;
          font-size: 13px;
        }

        .vin-menu {
          display: flex;
          flex-direction: column;
          gap: 10px;
        }

        .vin-option {
          display: flex;
          align-items: center;
          gap: 14px;
          padding: 14px;
          border-radius: 14px;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.08);
          cursor: pointer;
          text-align: left;
          transition: all 0.2s;
        }

        .vin-option:active {
          transform: scale(0.98);
        }

        .vin-option-icon {
          width: 48px;
          height: 48px;
          border-radius: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }

        .vin-option-icon.cyan {
          background: rgba(34,211,238,0.15);
          border: 1px solid rgba(34,211,238,0.3);
          color: #22d3ee;
        }

        .vin-option-icon.amber {
          background: rgba(251,191,36,0.15);
          border: 1px solid rgba(251,191,36,0.3);
          color: #fbbf24;
        }

        .vin-option-text {
          display: flex;
          flex-direction: column;
          gap: 2px;
        }

        .vin-option-text .title {
          font-size: 14px;
          font-weight: 600;
          color: #fff;
        }

        .vin-option-text .subtitle {
          font-size: 11px;
          color: #666;
        }

        /* Confidence Badge */
        .confidence-badge {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          padding: 8px 14px;
          border-radius: 10px;
          font-size: 12px;
          font-weight: 600;
          margin-bottom: 14px;
        }
        
        .confidence-badge.high {
          background: rgba(34,197,94,0.15);
          border: 1px solid rgba(34,197,94,0.3);
          color: #22c55e;
        }
        
        .confidence-badge.medium {
          background: rgba(255,191,0,0.15);
          border: 1px solid rgba(255,191,0,0.3);
          color: #FFBF00;
        }
        
        .confidence-badge.low {
          background: rgba(239,68,68,0.15);
          border: 1px solid rgba(239,68,68,0.3);
          color: #ef4444;
        }

        .vin-scanning {
          text-align: center;
          padding: 20px 0;
        }

        .scan-box {
          width: 160px;
          height: 100px;
          margin: 0 auto 16px;
          border-radius: 12px;
          border: 2px solid rgba(34,211,238,0.4);
          background: rgba(34,211,238,0.05);
          display: flex;
          align-items: center;
          justify-content: center;
          position: relative;
          overflow: hidden;
          color: #22d3ee;
        }

        .scan-line {
          position: absolute;
          left: 0;
          right: 0;
          height: 2px;
          background: linear-gradient(90deg, transparent, #22d3ee, transparent);
          animation: scan 2s ease-in-out infinite;
        }

        @keyframes scan {
          0%, 100% { top: 10%; }
          50% { top: 90%; }
        }

        .vin-scanning p {
          font-size: 13px;
          color: #888;
          margin-bottom: 12px;
        }

        .vin-cancel-btn {
          padding: 8px 20px;
          border-radius: 8px;
          background: rgba(239,68,68,0.15);
          border: 1px solid rgba(239,68,68,0.3);
          color: #f87171;
          font-size: 13px;
          cursor: pointer;
        }

        .vin-manual label {
          display: block;
          font-size: 10px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          color: #666;
          margin-bottom: 8px;
        }

        .vin-manual input {
          width: 100%;
          padding: 14px;
          border-radius: 12px;
          font-size: 16px;
          font-family: monospace;
          letter-spacing: 2px;
          background: rgba(15,17,23,0.8);
          border: 1px solid rgba(255,255,255,0.15);
          color: #fff;
          outline: none;
        }

        .vin-manual input:focus {
          border-color: rgba(34,211,238,0.5);
        }

        .vin-input-info {
          display: flex;
          justify-content: space-between;
          margin-top: 6px;
          font-size: 11px;
          color: #555;
        }

        .vin-input-info .count {
          color: #22d3ee;
        }

        .validation-message {
          font-weight: 500;
        }

        .validation-message.valid {
          color: #22c55e;
        }

        .validation-message.invalid {
          color: #ef4444;
        }

        /* Recent Scans */
        .recent-scans {
          margin-top: 16px;
          padding-top: 16px;
          border-top: 1px solid rgba(255,255,255,0.08);
        }

        .recent-header {
          font-size: 10px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          color: #888;
          margin-bottom: 10px;
        }

        .recent-scan-item {
          display: flex;
          align-items: center;
          justify-content: space-between;
          width: 100%;
          padding: 10px 12px;
          margin-bottom: 6px;
          border-radius: 10px;
          background: rgba(255,255,255,0.03);
          border: 1px solid rgba(255,255,255,0.06);
          cursor: pointer;
          text-align: left;
          transition: all 0.2s;
        }

        .recent-scan-item:hover {
          background: rgba(255,255,255,0.06);
          border-color: rgba(255,191,0,0.2);
        }

        .recent-scan-info {
          display: flex;
          flex-direction: column;
          gap: 2px;
        }

        .recent-vehicle {
          font-size: 12px;
          font-weight: 500;
          color: #fff;
        }

        .recent-vin {
          font-size: 10px;
          font-family: monospace;
          color: #666;
          letter-spacing: 1px;
        }

        .recent-time {
          font-size: 10px;
          color: #888;
        }

        .vin-form-btns {
          display: flex;
          gap: 10px;
          margin-top: 16px;
        }

        .vin-back-btn {
          flex: 1;
          padding: 12px;
          border-radius: 10px;
          background: rgba(255,255,255,0.08);
          border: 1px solid rgba(255,255,255,0.1);
          color: #888;
          font-size: 14px;
          font-weight: 500;
          cursor: pointer;
        }

        .vin-submit-btn, .vin-save-btn {
          flex: 1;
          padding: 12px;
          border-radius: 10px;
          background: rgba(34,211,238,0.2);
          border: 1px solid rgba(34,211,238,0.4);
          color: #22d3ee;
          font-size: 14px;
          font-weight: 500;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
        }

        .vin-submit-btn:disabled, .vin-save-btn:disabled {
          opacity: 0.5;
        }

        .vin-save-btn.saved {
          background: rgba(34,197,94,0.2);
          border-color: rgba(34,197,94,0.4);
          color: #22c55e;
        }

        .vin-results {
          display: flex;
          flex-direction: column;
          gap: 14px;
        }

        .vin-hero {
          display: flex;
          align-items: flex-start;
          gap: 14px;
          padding: 14px;
          border-radius: 14px;
          background: linear-gradient(135deg, rgba(34,197,94,0.1) 0%, rgba(34,197,94,0.05) 100%);
          border: 1px solid rgba(34,197,94,0.2);
        }

        .vin-hero-icon {
          width: 48px;
          height: 48px;
          border-radius: 12px;
          background: rgba(34,197,94,0.2);
          display: flex;
          align-items: center;
          justify-content: center;
          color: #22c55e;
          flex-shrink: 0;
        }

        .vin-hero-info {
          display: flex;
          flex-direction: column;
        }

        .vin-hero-info .year {
          font-size: 12px;
          color: #22c55e;
          font-weight: 500;
        }

        .vin-hero-info h3 {
          font-size: 18px;
          font-weight: 700;
          color: #fff;
          margin: 2px 0;
        }

        .vin-hero-info .trim {
          font-size: 13px;
          color: #aaa;
        }

        .vin-hero-info .vin-number {
          font-size: 10px;
          font-family: monospace;
          color: #555;
          margin-top: 6px;
          letter-spacing: 1px;
        }

        .vin-specs {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 8px;
        }

        .spec-item {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 10px;
          border-radius: 10px;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.06);
        }

        .spec-item > div {
          display: flex;
          flex-direction: column;
          min-width: 0;
        }

        .spec-item .label {
          font-size: 9px;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          color: #555;
        }

        .spec-item .value {
          font-size: 12px;
          color: #ddd;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .vin-safety {
          padding: 12px;
          border-radius: 12px;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.06);
        }

        .safety-header {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 10px;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          color: #666;
          margin-bottom: 10px;
        }

        .safety-tags {
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
        }

        .safety-tag {
          padding: 4px 10px;
          border-radius: 12px;
          font-size: 10px;
          background: rgba(34,197,94,0.1);
          border: 1px solid rgba(34,197,94,0.2);
          color: #86efac;
        }

        /* Category Selector */
        .vin-category-selector {
          padding: 14px;
          border-radius: 14px;
          background: rgba(255,255,255,0.03);
          border: 1px solid rgba(255,255,255,0.06);
        }

        .category-label {
          display: block;
          font-size: 10px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          color: #888;
          margin-bottom: 10px;
        }

        .category-options {
          display: flex;
          gap: 8px;
        }

        .category-btn {
          flex: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          padding: 12px;
          border-radius: 10px;
          background: rgba(255,255,255,0.05);
          border: 2px solid transparent;
          color: #888;
          font-size: 12px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s;
        }

        .category-btn.active {
          background: rgba(34,197,94,0.15);
          border-color: rgba(34,197,94,0.4);
          color: #22c55e;
        }

        .category-btn.trade.active {
          background: rgba(251,191,36,0.15);
          border-color: rgba(251,191,36,0.4);
          color: #fbbf24;
        }

        .trade-value-input {
          width: 100%;
          margin-top: 10px;
          padding: 10px 12px;
          border-radius: 10px;
          background: rgba(0,0,0,0.3);
          border: 1px solid rgba(255,255,255,0.1);
          color: #fff;
          font-size: 14px;
          outline: none;
        }

        .trade-value-input:focus {
          border-color: rgba(251,191,36,0.5);
        }

        .vin-actions {
          display: flex;
          gap: 10px;
          margin-top: 4px;
        }
      `}</style>
    </div>,
    document.body
  );
};

export default VinScanner;

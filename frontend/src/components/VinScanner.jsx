import React, { useState, useCallback, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Camera, Keyboard, Car, Save, Check, Loader2, AlertCircle, ScanLine, Shield, Fuel, Gauge, MapPin, Settings2, Zap } from 'lucide-react';

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
  }, [initScanner]);

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

  const lookupVin = async (vinNumber) => {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`${BACKEND_URL}/api/vin/decode/${vinNumber}`);
      const data = await res.json();

      if (!res.ok) throw new Error(data.detail || 'VIN lookup failed');

      setVehicleData(data);
      setMode('result');
    } catch (err) {
      setError(err.message || 'Failed to decode VIN');
      setMode('menu');
    } finally {
      setLoading(false);
    }
  };

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
    try {
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

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.detail || 'Failed to save');
      }

      setSaved(true);
    } catch (err) {
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
                onChange={(e) => setManualVin(e.target.value.toUpperCase())}
                placeholder="1HGCM82633A123456"
                maxLength={17}
                autoFocus
                data-testid="vin-input"
              />
              <div className="vin-input-info">
                <span>Letters I, O, Q not valid</span>
                <span className="count">{manualVin.length}/17</span>
              </div>
              <div className="vin-form-btns">
                <button type="button" onClick={() => setMode('menu')} className="vin-back-btn">Back</button>
                <button type="submit" disabled={manualVin.length !== 17 || loading} className="vin-submit-btn" data-testid="decode-vin-btn">
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ScanLine className="w-4 h-4" />}
                  Decode
                </button>
              </div>
            </form>
          )}

          {/* Results */}
          {mode === 'result' && vehicleData && (
            <div className="vin-results">
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
          background: 
            url('https://www.transparenttextures.com/patterns/wood-pattern.png'),
            linear-gradient(180deg, rgba(30,25,20,0.98) 0%, rgba(18,15,12,0.99) 100%);
          background-size: 180px 180px, 100% 100%;
          background-blend-mode: overlay, normal;
          border-radius: 20px;
          border: 1px solid rgba(255,191,0,0.15);
          box-shadow: 
            0 25px 50px rgba(0,0,0,0.6),
            0 0 40px rgba(255,150,0,0.08);
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
    </div>
  );
};

export default VinScanner;

import React, { useState, useCallback, useEffect } from 'react';
import { X, Camera, Keyboard, Car, Save, Check, Loader2, AlertCircle, ScanLine, Shield, Fuel, Gauge, MapPin, Settings2, Zap } from 'lucide-react';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL;

// Check if we're running in Capacitor
const isCapacitor = typeof window !== 'undefined' && window.Capacitor?.isNativePlatform();

export const VinScanner = ({ isOpen, onClose }) => {
  const [mode, setMode] = useState('menu'); // 'menu', 'scanning', 'manual', 'result'
  const [vin, setVin] = useState('');
  const [manualVin, setManualVin] = useState('');
  const [vehicleData, setVehicleData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [saved, setSaved] = useState(false);

  // Reset state when modal opens
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

  // Initialize barcode scanner
  const initScanner = useCallback(async () => {
    if (!isCapacitor) {
      setError('Camera scanning requires the mobile app. Use manual entry instead.');
      return false;
    }

    try {
      const { BarcodeScanner } = await import('@capacitor-mlkit/barcode-scanning');
      
      const { camera } = await BarcodeScanner.checkPermissions();
      if (camera !== 'granted') {
        const { camera: newPermission } = await BarcodeScanner.requestPermissions();
        if (newPermission !== 'granted') {
          setError('Camera permission is required for scanning');
          return false;
        }
      }

      const { supported } = await BarcodeScanner.isSupported();
      if (!supported) {
        setError('Barcode scanning is not supported on this device');
        return false;
      }

      return true;
    } catch (err) {
      console.error('Scanner init error:', err);
      setError('Failed to initialize scanner');
      return false;
    }
  }, []);

  // Start barcode scanning
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

      if (result.barcodes && result.barcodes.length > 0) {
        const scannedVin = result.barcodes[0].rawValue;
        if (scannedVin && scannedVin.length === 17) {
          setVin(scannedVin.toUpperCase());
          await lookupVin(scannedVin.toUpperCase());
        } else {
          setError('Invalid VIN format. VIN must be 17 characters.');
          setMode('menu');
        }
      } else {
        setError('No barcode detected. Try again or enter manually.');
        setMode('menu');
      }
    } catch (err) {
      document.body.classList.remove('barcode-scanning');
      if (err.message !== 'scan canceled') {
        setError('Scanning failed. Try again or enter manually.');
      }
      setMode('menu');
    } finally {
      setLoading(false);
    }
  }, [initScanner]);

  // Stop scanning
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

  // Lookup VIN via NHTSA API
  const lookupVin = async (vinNumber) => {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`${BACKEND_URL}/api/vin/decode/${vinNumber}`);
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.detail || 'VIN lookup failed');
      }

      setVehicleData(data);
      setMode('result');
    } catch (err) {
      console.error('VIN lookup error:', err);
      setError(err.message || 'Failed to decode VIN');
      setMode('menu');
    } finally {
      setLoading(false);
    }
  };

  // Handle manual VIN entry
  const handleManualSubmit = async (e) => {
    e.preventDefault();
    const cleanVin = manualVin.toUpperCase().replace(/[^A-HJ-NPR-Z0-9]/g, '');
    
    if (cleanVin.length !== 17) {
      setError('VIN must be exactly 17 characters');
      return;
    }

    setVin(cleanVin);
    await lookupVin(cleanVin);
  };

  // Save vehicle to inventory
  const saveToInventory = async () => {
    if (!vehicleData) return;

    setLoading(true);
    try {
      const res = await fetch(`${BACKEND_URL}/api/vin/save`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          vin: vin,
          vehicle_data: vehicleData,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.detail || 'Failed to save vehicle');
      }

      setSaved(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/70 backdrop-blur-md"
        onClick={mode === 'scanning' ? stopScanning : onClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-lg animate-fade-in">
        <div className="liquid-glass-container rounded-3xl overflow-hidden">
          {/* Header */}
          <div className="liquid-glass-header px-6 py-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="liquid-glass-icon-circle">
                  <ScanLine className="w-6 h-6 text-cyan-300" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-white">VIN Scanner</h2>
                  <p className="text-xs text-white/50">Instant Vehicle Lookup</p>
                </div>
              </div>
              <button
                onClick={mode === 'scanning' ? stopScanning : onClose}
                className="liquid-glass-close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="px-6 pb-6">
            {/* Error Display */}
            {error && (
              <div className="liquid-glass-error mb-4">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <p className="text-sm">{error}</p>
              </div>
            )}

            {/* Menu Mode */}
            {mode === 'menu' && (
              <div className="space-y-3">
                <button
                  onClick={startBarcodeScanning}
                  disabled={loading}
                  className="liquid-glass-option-btn w-full"
                  data-testid="scan-barcode-btn"
                >
                  <div className="liquid-glass-option-icon cyan">
                    <Camera className="w-6 h-6" />
                  </div>
                  <div className="text-left flex-1">
                    <p className="font-semibold text-white">Scan Barcode</p>
                    <p className="text-xs text-white/50">Door jamb sticker or window</p>
                  </div>
                  <div className="liquid-glass-arrow">→</div>
                </button>

                <button
                  onClick={() => setMode('manual')}
                  className="liquid-glass-option-btn w-full"
                  data-testid="manual-entry-btn"
                >
                  <div className="liquid-glass-option-icon amber">
                    <Keyboard className="w-6 h-6" />
                  </div>
                  <div className="text-left flex-1">
                    <p className="font-semibold text-white">Enter Manually</p>
                    <p className="text-xs text-white/50">Type the 17-digit VIN</p>
                  </div>
                  <div className="liquid-glass-arrow">→</div>
                </button>
              </div>
            )}

            {/* Scanning Mode */}
            {mode === 'scanning' && (
              <div className="text-center py-10">
                <div className="liquid-glass-scan-box mx-auto mb-6">
                  <div className="scan-line" />
                  <Loader2 className="w-10 h-10 text-cyan-400 animate-spin" />
                </div>
                <p className="text-white/70 mb-4">Point camera at VIN barcode</p>
                <button onClick={stopScanning} className="liquid-glass-cancel-btn">
                  Cancel Scan
                </button>
              </div>
            )}

            {/* Manual Entry Mode */}
            {mode === 'manual' && (
              <form onSubmit={handleManualSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-white/60 mb-2 uppercase tracking-wider">
                    Vehicle Identification Number
                  </label>
                  <input
                    type="text"
                    value={manualVin}
                    onChange={(e) => setManualVin(e.target.value.toUpperCase())}
                    placeholder="1HGCM82633A123456"
                    maxLength={17}
                    className="liquid-glass-input"
                    autoFocus
                    data-testid="vin-input"
                  />
                  <div className="flex justify-between mt-2">
                    <p className="text-xs text-white/40">Letters I, O, Q are not valid</p>
                    <p className="text-xs text-cyan-400 font-mono">{manualVin.length}/17</p>
                  </div>
                </div>
                <div className="flex gap-3">
                  <button type="button" onClick={() => setMode('menu')} className="liquid-glass-back-btn flex-1">
                    Back
                  </button>
                  <button
                    type="submit"
                    disabled={manualVin.length !== 17 || loading}
                    className="liquid-glass-submit-btn flex-1"
                    data-testid="decode-vin-btn"
                  >
                    {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <ScanLine className="w-5 h-5" />}
                    <span>Decode VIN</span>
                  </button>
                </div>
              </form>
            )}

            {/* Result Mode - Liquid Glass Cards */}
            {mode === 'result' && vehicleData && (
              <div className="space-y-4">
                {/* Main Vehicle Card */}
                <div className="liquid-glass-card-hero">
                  <div className="flex items-start gap-4">
                    <div className="liquid-glass-car-badge">
                      <Car className="w-8 h-8" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-cyan-300/80 font-medium">{vehicleData.year}</p>
                      <h3 className="text-2xl font-bold text-white leading-tight">
                        {vehicleData.make} {vehicleData.model}
                      </h3>
                      {vehicleData.trim && (
                        <p className="text-white/60">{vehicleData.trim}</p>
                      )}
                      <p className="text-xs font-mono text-white/40 mt-2 tracking-wider">{vin}</p>
                    </div>
                  </div>
                </div>

                {/* Specs Grid */}
                <div className="grid grid-cols-2 gap-3">
                  {/* Powertrain Card */}
                  {(vehicleData.engine_display || vehicleData.fuel_type) && (
                    <div className="liquid-glass-card">
                      <div className="liquid-glass-card-header">
                        <Gauge className="w-4 h-4 text-amber-400" />
                        <span>Powertrain</span>
                      </div>
                      <div className="space-y-2">
                        {vehicleData.engine_display && (
                          <div className="liquid-glass-spec">
                            <span className="label">Engine</span>
                            <span className="value">{vehicleData.engine_display}</span>
                          </div>
                        )}
                        {vehicleData.horsepower && (
                          <div className="liquid-glass-spec">
                            <span className="label">Power</span>
                            <span className="value">{vehicleData.horsepower} HP</span>
                          </div>
                        )}
                        {vehicleData.transmission && (
                          <div className="liquid-glass-spec">
                            <span className="label">Trans</span>
                            <span className="value">{vehicleData.transmission}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Fuel Card */}
                  {(vehicleData.fuel_type || vehicleData.electrification) && (
                    <div className="liquid-glass-card">
                      <div className="liquid-glass-card-header">
                        {vehicleData.electrification ? <Zap className="w-4 h-4 text-green-400" /> : <Fuel className="w-4 h-4 text-orange-400" />}
                        <span>Fuel</span>
                      </div>
                      <div className="space-y-2">
                        <div className="liquid-glass-spec">
                          <span className="label">Type</span>
                          <span className="value">{vehicleData.fuel_type || 'Electric'}</span>
                        </div>
                        {vehicleData.electrification && (
                          <div className="liquid-glass-spec">
                            <span className="label">EV Type</span>
                            <span className="value">{vehicleData.electrification}</span>
                          </div>
                        )}
                        {vehicleData.drive_type && (
                          <div className="liquid-glass-spec">
                            <span className="label">Drive</span>
                            <span className="value">{vehicleData.drive_type}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Body Card */}
                  {(vehicleData.body_class || vehicleData.doors) && (
                    <div className="liquid-glass-card">
                      <div className="liquid-glass-card-header">
                        <Settings2 className="w-4 h-4 text-purple-400" />
                        <span>Body</span>
                      </div>
                      <div className="space-y-2">
                        {vehicleData.body_class && (
                          <div className="liquid-glass-spec">
                            <span className="label">Style</span>
                            <span className="value">{vehicleData.body_class}</span>
                          </div>
                        )}
                        {vehicleData.doors && (
                          <div className="liquid-glass-spec">
                            <span className="label">Doors</span>
                            <span className="value">{vehicleData.doors}</span>
                          </div>
                        )}
                        {vehicleData.vehicle_type && (
                          <div className="liquid-glass-spec">
                            <span className="label">Type</span>
                            <span className="value">{vehicleData.vehicle_type}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Assembly Card */}
                  {vehicleData.assembly_location && (
                    <div className="liquid-glass-card">
                      <div className="liquid-glass-card-header">
                        <MapPin className="w-4 h-4 text-rose-400" />
                        <span>Assembly</span>
                      </div>
                      <div className="space-y-2">
                        <div className="liquid-glass-spec">
                          <span className="label">Built In</span>
                          <span className="value">{vehicleData.assembly_location}</span>
                        </div>
                        {vehicleData.manufacturer && (
                          <div className="liquid-glass-spec">
                            <span className="label">By</span>
                            <span className="value text-xs">{vehicleData.manufacturer}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* Safety Features */}
                {vehicleData.safety_features && vehicleData.safety_features.length > 0 && (
                  <div className="liquid-glass-card">
                    <div className="liquid-glass-card-header">
                      <Shield className="w-4 h-4 text-emerald-400" />
                      <span>Safety Features</span>
                    </div>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {vehicleData.safety_features.map((feature, idx) => (
                        <span key={idx} className="liquid-glass-tag">
                          {feature}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Action Buttons */}
                <div className="flex gap-3 pt-2">
                  <button
                    onClick={() => {
                      setMode('menu');
                      setVehicleData(null);
                      setVin('');
                      setSaved(false);
                    }}
                    className="liquid-glass-back-btn flex-1"
                  >
                    Scan Another
                  </button>
                  <button
                    onClick={saveToInventory}
                    disabled={loading || saved}
                    className={`liquid-glass-save-btn flex-1 ${saved ? 'saved' : ''}`}
                    data-testid="save-vehicle-btn"
                  >
                    {loading ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : saved ? (
                      <>
                        <Check className="w-5 h-5" />
                        <span>Saved!</span>
                      </>
                    ) : (
                      <>
                        <Save className="w-5 h-5" />
                        <span>Save to Inventory</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <style>{`
        /* Liquid Glass Container */
        .liquid-glass-container {
          background: linear-gradient(
            135deg,
            rgba(30, 41, 59, 0.85) 0%,
            rgba(15, 23, 42, 0.9) 50%,
            rgba(30, 41, 59, 0.85) 100%
          );
          backdrop-filter: blur(20px) saturate(180%);
          border: 1px solid rgba(148, 163, 184, 0.15);
          box-shadow: 
            0 32px 64px -12px rgba(0, 0, 0, 0.5),
            0 0 0 1px rgba(255, 255, 255, 0.05) inset,
            0 1px 0 rgba(255, 255, 255, 0.1) inset;
        }

        .liquid-glass-header {
          background: linear-gradient(180deg, rgba(255,255,255,0.03) 0%, transparent 100%);
          border-bottom: 1px solid rgba(148, 163, 184, 0.1);
        }

        .liquid-glass-icon-circle {
          width: 48px;
          height: 48px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          background: linear-gradient(135deg, rgba(34, 211, 238, 0.15) 0%, rgba(34, 211, 238, 0.05) 100%);
          border: 1px solid rgba(34, 211, 238, 0.3);
          box-shadow: 0 0 20px rgba(34, 211, 238, 0.2);
        }

        .liquid-glass-close {
          width: 36px;
          height: 36px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.1);
          color: rgba(255, 255, 255, 0.6);
          transition: all 0.2s ease;
        }
        .liquid-glass-close:hover {
          background: rgba(239, 68, 68, 0.2);
          border-color: rgba(239, 68, 68, 0.4);
          color: #ef4444;
        }

        .liquid-glass-error {
          display: flex;
          align-items: flex-start;
          gap: 10px;
          padding: 14px;
          border-radius: 12px;
          background: linear-gradient(135deg, rgba(239, 68, 68, 0.1) 0%, rgba(239, 68, 68, 0.05) 100%);
          border: 1px solid rgba(239, 68, 68, 0.25);
          color: #fca5a5;
        }

        /* Option Buttons */
        .liquid-glass-option-btn {
          display: flex;
          align-items: center;
          gap: 16px;
          padding: 18px;
          border-radius: 16px;
          background: linear-gradient(135deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.01) 100%);
          border: 1px solid rgba(255, 255, 255, 0.08);
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        }
        .liquid-glass-option-btn:hover {
          background: linear-gradient(135deg, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0.03) 100%);
          border-color: rgba(255, 255, 255, 0.15);
          transform: translateY(-2px);
          box-shadow: 0 8px 24px rgba(0, 0, 0, 0.3);
        }

        .liquid-glass-option-icon {
          width: 52px;
          height: 52px;
          border-radius: 14px;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }
        .liquid-glass-option-icon.cyan {
          background: linear-gradient(135deg, rgba(34, 211, 238, 0.2) 0%, rgba(34, 211, 238, 0.05) 100%);
          border: 1px solid rgba(34, 211, 238, 0.3);
          color: #22d3ee;
        }
        .liquid-glass-option-icon.amber {
          background: linear-gradient(135deg, rgba(251, 191, 36, 0.2) 0%, rgba(251, 191, 36, 0.05) 100%);
          border: 1px solid rgba(251, 191, 36, 0.3);
          color: #fbbf24;
        }

        .liquid-glass-arrow {
          font-size: 20px;
          color: rgba(255, 255, 255, 0.3);
          transition: all 0.2s ease;
        }
        .liquid-glass-option-btn:hover .liquid-glass-arrow {
          color: rgba(255, 255, 255, 0.7);
          transform: translateX(4px);
        }

        /* Scan Box */
        .liquid-glass-scan-box {
          width: 200px;
          height: 140px;
          border-radius: 16px;
          border: 2px solid rgba(34, 211, 238, 0.4);
          background: rgba(34, 211, 238, 0.05);
          display: flex;
          align-items: center;
          justify-content: center;
          position: relative;
          overflow: hidden;
        }
        .scan-line {
          position: absolute;
          left: 0;
          right: 0;
          height: 2px;
          background: linear-gradient(90deg, transparent, #22d3ee, transparent);
          animation: scanMove 2s ease-in-out infinite;
          box-shadow: 0 0 20px #22d3ee;
        }
        @keyframes scanMove {
          0%, 100% { top: 10%; }
          50% { top: 90%; }
        }

        /* Input */
        .liquid-glass-input {
          width: 100%;
          padding: 16px 20px;
          border-radius: 14px;
          font-size: 18px;
          font-family: 'SF Mono', 'Fira Code', monospace;
          letter-spacing: 2px;
          text-transform: uppercase;
          background: rgba(15, 23, 42, 0.6);
          border: 1px solid rgba(148, 163, 184, 0.2);
          color: white;
          transition: all 0.2s ease;
        }
        .liquid-glass-input:focus {
          outline: none;
          border-color: rgba(34, 211, 238, 0.5);
          box-shadow: 0 0 0 3px rgba(34, 211, 238, 0.1), 0 0 20px rgba(34, 211, 238, 0.1);
        }
        .liquid-glass-input::placeholder {
          color: rgba(148, 163, 184, 0.4);
          letter-spacing: 1px;
        }

        /* Buttons */
        .liquid-glass-back-btn, .liquid-glass-cancel-btn {
          padding: 14px 20px;
          border-radius: 12px;
          font-weight: 600;
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.1);
          color: rgba(255, 255, 255, 0.7);
          transition: all 0.2s ease;
        }
        .liquid-glass-back-btn:hover, .liquid-glass-cancel-btn:hover {
          background: rgba(255, 255, 255, 0.1);
          border-color: rgba(255, 255, 255, 0.2);
        }

        .liquid-glass-submit-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          padding: 14px 20px;
          border-radius: 12px;
          font-weight: 600;
          background: linear-gradient(135deg, rgba(34, 211, 238, 0.25) 0%, rgba(34, 211, 238, 0.1) 100%);
          border: 1px solid rgba(34, 211, 238, 0.4);
          color: #22d3ee;
          transition: all 0.2s ease;
        }
        .liquid-glass-submit-btn:hover:not(:disabled) {
          background: linear-gradient(135deg, rgba(34, 211, 238, 0.35) 0%, rgba(34, 211, 238, 0.15) 100%);
          box-shadow: 0 0 20px rgba(34, 211, 238, 0.2);
        }
        .liquid-glass-submit-btn:disabled {
          opacity: 0.5;
        }

        .liquid-glass-save-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          padding: 14px 20px;
          border-radius: 12px;
          font-weight: 600;
          background: linear-gradient(135deg, rgba(34, 211, 238, 0.25) 0%, rgba(34, 211, 238, 0.1) 100%);
          border: 1px solid rgba(34, 211, 238, 0.4);
          color: #22d3ee;
          transition: all 0.3s ease;
        }
        .liquid-glass-save-btn:hover:not(:disabled) {
          background: linear-gradient(135deg, rgba(34, 211, 238, 0.35) 0%, rgba(34, 211, 238, 0.15) 100%);
          box-shadow: 0 0 20px rgba(34, 211, 238, 0.2);
        }
        .liquid-glass-save-btn.saved {
          background: linear-gradient(135deg, rgba(34, 197, 94, 0.25) 0%, rgba(34, 197, 94, 0.1) 100%);
          border-color: rgba(34, 197, 94, 0.4);
          color: #22c55e;
        }
        .liquid-glass-save-btn:disabled {
          opacity: 0.6;
        }

        /* Hero Card */
        .liquid-glass-card-hero {
          padding: 24px;
          border-radius: 20px;
          background: linear-gradient(
            135deg,
            rgba(34, 211, 238, 0.08) 0%,
            rgba(59, 130, 246, 0.05) 50%,
            rgba(139, 92, 246, 0.05) 100%
          );
          border: 1px solid rgba(34, 211, 238, 0.2);
          box-shadow: 
            0 0 40px rgba(34, 211, 238, 0.1),
            inset 0 1px 0 rgba(255, 255, 255, 0.05);
        }

        .liquid-glass-car-badge {
          width: 64px;
          height: 64px;
          border-radius: 16px;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          background: linear-gradient(135deg, rgba(34, 197, 94, 0.2) 0%, rgba(34, 197, 94, 0.05) 100%);
          border: 1px solid rgba(34, 197, 94, 0.3);
          color: #22c55e;
          box-shadow: 0 0 24px rgba(34, 197, 94, 0.2);
        }

        /* Info Cards */
        .liquid-glass-card {
          padding: 16px;
          border-radius: 16px;
          background: linear-gradient(135deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.01) 100%);
          border: 1px solid rgba(255, 255, 255, 0.06);
          backdrop-filter: blur(10px);
        }

        .liquid-glass-card-header {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 11px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 1px;
          color: rgba(255, 255, 255, 0.5);
          margin-bottom: 12px;
          padding-bottom: 8px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.05);
        }

        .liquid-glass-spec {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 6px 0;
        }
        .liquid-glass-spec .label {
          font-size: 11px;
          color: rgba(255, 255, 255, 0.4);
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }
        .liquid-glass-spec .value {
          font-size: 13px;
          font-weight: 500;
          color: rgba(255, 255, 255, 0.9);
          text-align: right;
          max-width: 60%;
        }

        /* Safety Tags */
        .liquid-glass-tag {
          display: inline-block;
          padding: 6px 12px;
          border-radius: 20px;
          font-size: 11px;
          font-weight: 500;
          background: rgba(34, 197, 94, 0.1);
          border: 1px solid rgba(34, 197, 94, 0.25);
          color: #86efac;
        }
      `}</style>
    </div>
  );
};

export default VinScanner;

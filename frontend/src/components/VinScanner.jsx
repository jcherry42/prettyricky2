import React, { useState, useCallback, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X, Camera, Keyboard, Car, Save, Check, Loader2, AlertCircle, ScanLine, Shield, Fuel, Gauge, MapPin, Settings2, Zap, CheckCircle2, Flashlight, FlashlightOff, RotateCcw, Target } from 'lucide-react';

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
  const [torchEnabled, setTorchEnabled] = useState(false);
  const [scanAttempts, setScanAttempts] = useState(0);
  const [scannerReady, setScannerReady] = useState(false);
  
  const scannerRef = useRef(null);

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
    
    const updated = [scan, ...recentScans.filter(s => s.vin !== vinData.vin)].slice(0, 10);
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
      setScanAttempts(0);
      setTorchEnabled(false);
    }
  }, [isOpen]);

  // Cleanup scanner on unmount or close
  useEffect(() => {
    return () => {
      if (scannerRef.current) {
        try {
          scannerRef.current.stopScan();
        } catch (e) { /* ignore */ }
      }
      document.body.classList.remove('barcode-scanning');
    };
  }, []);

  const initScanner = useCallback(async () => {
    if (!isCapacitor) {
      setError('Camera scanning requires the mobile app. Use manual entry on web.');
      return false;
    }

    try {
      const { BarcodeScanner } = await import('@capacitor-mlkit/barcode-scanning');
      scannerRef.current = BarcodeScanner;
      
      const { camera } = await BarcodeScanner.checkPermissions();
      if (camera !== 'granted') {
        const { camera: newPermission } = await BarcodeScanner.requestPermissions();
        if (newPermission !== 'granted') {
          setError('Camera permission required to scan VINs');
          return false;
        }
      }

      const { supported } = await BarcodeScanner.isSupported();
      if (!supported) {
        setError('Barcode scanning not supported on this device');
        return false;
      }

      setScannerReady(true);
      return true;
    } catch (err) {
      console.error('[VIN Scanner] Init error:', err);
      setError('Failed to initialize camera scanner');
      return false;
    }
  }, []);

  // VIN lookup
  const lookupVin = useCallback(async (vinNumber) => {
    setLoading(true);
    setError(null);

    try {
      console.log('[VIN] Decoding:', vinNumber);
      
      const res = await fetch(`${BACKEND_URL}/api/vin/decode/${vinNumber}`, {
        headers: { 'Accept': 'application/json' },
      });
      
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.detail || data.message || 'VIN lookup failed');
      }

      if (!data.make || !data.model) {
        throw new Error('Could not decode vehicle information from this VIN');
      }

      setVehicleData(data);
      addToRecentScans(data);
      setMode('result');
    } catch (err) {
      console.error('[VIN] Error:', err);
      setError(err.message || 'Failed to decode VIN');
      setMode('menu');
    } finally {
      setLoading(false);
    }
  }, [addToRecentScans]);

  // Toggle torch/flashlight
  const toggleTorch = useCallback(async () => {
    if (!scannerRef.current) return;
    
    try {
      if (torchEnabled) {
        await scannerRef.current.disableTorch();
      } else {
        await scannerRef.current.enableTorch();
      }
      setTorchEnabled(!torchEnabled);
    } catch (err) {
      console.error('[VIN Scanner] Torch error:', err);
    }
  }, [torchEnabled]);

  // Extract VIN from barcode data
  const extractVinFromBarcode = (rawData) => {
    if (!rawData) return null;
    
    const cleanData = rawData.toUpperCase().trim();
    console.log('[VIN Scanner] Processing barcode:', cleanData);
    
    // Pattern 1: Direct 17-character VIN
    const vinPattern = /[A-HJ-NPR-Z0-9]{17}/g;
    const matches = cleanData.match(vinPattern);
    if (matches && matches.length > 0) {
      return matches[0];
    }
    
    // Pattern 2: VIN with prefix (e.g., "VIN:" or "I")
    const prefixPattern = /(?:VIN[:\s]*|I)([A-HJ-NPR-Z0-9]{17})/i;
    const prefixMatch = cleanData.match(prefixPattern);
    if (prefixMatch) {
      return prefixMatch[1];
    }
    
    // Pattern 3: Extract from longer string (windshield barcodes may have extra data)
    const chars = cleanData.replace(/[^A-HJ-NPR-Z0-9]/g, '');
    if (chars.length >= 17) {
      // Try to find valid VIN starting positions
      for (let i = 0; i <= chars.length - 17; i++) {
        const candidate = chars.substring(i, i + 17);
        // VIN position 10 should be a digit (model year) for 1981+ vehicles
        if (/^[A-HJ-NPR-Z0-9]{9}[0-9A-HJ-NPR-TV-Y][A-HJ-NPR-Z0-9]{7}$/.test(candidate)) {
          return candidate;
        }
      }
      // Fallback: just take first 17 valid characters
      return chars.substring(0, 17);
    }
    
    return null;
  };

  // Start windshield VIN scanning
  const startWindshieldScan = useCallback(async () => {
    setError(null);
    setLoading(true);
    setMode('scanning');
    setScanAttempts(prev => prev + 1);

    const ready = await initScanner();
    if (!ready) {
      setLoading(false);
      setMode('menu');
      return;
    }

    try {
      const { BarcodeScanner } = await import('@capacitor-mlkit/barcode-scanning');
      
      // Add scanning class for UI
      document.body.classList.add('barcode-scanning');
      
      // Configure for windshield VIN scanning
      // VINs typically use Code 39, Code 128, or Data Matrix
      const result = await BarcodeScanner.scan({
        formats: [
          'CODE_39',      // Most common for windshield VINs
          'CODE_128',     // Also used for VINs
          'DATA_MATRIX',  // Modern 2D VIN barcodes
          'QR_CODE',      // Some newer vehicles
          'PDF_417',      // Used on some registration docs
        ],
      });

      document.body.classList.remove('barcode-scanning');
      setTorchEnabled(false);

      if (result.barcodes?.length > 0) {
        const rawValue = result.barcodes[0].rawValue;
        const format = result.barcodes[0].format;
        console.log('[VIN Scanner] Scanned:', { rawValue, format });
        
        const extractedVin = extractVinFromBarcode(rawValue);
        
        if (extractedVin && extractedVin.length === 17) {
          console.log('[VIN Scanner] Extracted VIN:', extractedVin);
          setVin(extractedVin);
          await lookupVin(extractedVin);
        } else {
          setError(`Could not extract VIN from barcode. Raw data: "${rawValue?.substring(0, 30)}..."`);
          setMode('menu');
        }
      } else {
        setError('No barcode detected. Position camera over the VIN barcode on the windshield.');
        setMode('menu');
      }
    } catch (err) {
      console.error('[VIN Scanner] Scan error:', err);
      document.body.classList.remove('barcode-scanning');
      setTorchEnabled(false);
      
      if (err.message?.includes('canceled') || err.message?.includes('cancelled')) {
        setMode('menu');
      } else {
        setError('Scanning failed. Please try again.');
        setMode('menu');
      }
    } finally {
      setLoading(false);
    }
  }, [initScanner, lookupVin]);

  // Cancel scanning
  const cancelScan = useCallback(async () => {
    if (scannerRef.current) {
      try {
        await scannerRef.current.stopScan();
        if (torchEnabled) {
          await scannerRef.current.disableTorch();
        }
      } catch (e) { /* ignore */ }
    }
    document.body.classList.remove('barcode-scanning');
    setTorchEnabled(false);
    setMode('menu');
  }, [torchEnabled]);

  // Handle manual VIN submission
  const handleManualSubmit = async () => {
    if (manualVin.length !== 17) {
      setError('VIN must be exactly 17 characters');
      return;
    }

    const cleanVin = manualVin.toUpperCase().replace(/[^A-HJ-NPR-Z0-9]/g, '');
    
    if (cleanVin.length !== 17) {
      setError('Invalid VIN characters detected');
      return;
    }

    setVin(cleanVin);
    await lookupVin(cleanVin);
  };

  // Save vehicle to inventory
  const saveToInventory = async (asTradeIn = false) => {
    if (!vehicleData) return;
    
    setLoading(true);
    try {
      const res = await fetch(`${BACKEND_URL}/api/vin/save-to-inventory`, {
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

  // Render scanning overlay with windshield guide
  const renderScanningOverlay = () => {
    if (mode !== 'scanning') return null;
    
    return createPortal(
      <div className="vin-scanner-overlay">
        {/* Scanning guide overlay */}
        <div className="scan-guide">
          {/* Target box for windshield VIN */}
          <div className="scan-target">
            <div className="scan-target-corner tl" />
            <div className="scan-target-corner tr" />
            <div className="scan-target-corner bl" />
            <div className="scan-target-corner br" />
            <div className="scan-line" />
          </div>
          
          {/* Instructions */}
          <div className="scan-instructions">
            <Target className="w-5 h-5" />
            <span>Align VIN barcode within the frame</span>
          </div>
          
          {/* Tip */}
          <div className="scan-tip">
            Look for the barcode at the bottom of the windshield (driver's side)
          </div>
        </div>
        
        {/* Controls */}
        <div className="scan-controls">
          <button onClick={toggleTorch} className="scan-control-btn">
            {torchEnabled ? (
              <FlashlightOff className="w-6 h-6" />
            ) : (
              <Flashlight className="w-6 h-6" />
            )}
            <span>{torchEnabled ? 'Light Off' : 'Light On'}</span>
          </button>
          
          <button onClick={cancelScan} className="scan-cancel-btn">
            <X className="w-6 h-6" />
            <span>Cancel</span>
          </button>
        </div>
        
        <style>{`
          .vin-scanner-overlay {
            position: fixed;
            inset: 0;
            z-index: 9999;
            background: transparent;
          }
          
          .scan-guide {
            position: absolute;
            inset: 0;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            pointer-events: none;
          }
          
          .scan-target {
            width: 300px;
            height: 100px;
            position: relative;
            border: 2px solid rgba(34, 211, 238, 0.8);
            border-radius: 8px;
            background: rgba(0, 0, 0, 0.3);
          }
          
          .scan-target-corner {
            position: absolute;
            width: 20px;
            height: 20px;
            border-color: #22d3ee;
            border-style: solid;
          }
          
          .scan-target-corner.tl {
            top: -2px;
            left: -2px;
            border-width: 4px 0 0 4px;
            border-radius: 8px 0 0 0;
          }
          
          .scan-target-corner.tr {
            top: -2px;
            right: -2px;
            border-width: 4px 4px 0 0;
            border-radius: 0 8px 0 0;
          }
          
          .scan-target-corner.bl {
            bottom: -2px;
            left: -2px;
            border-width: 0 0 4px 4px;
            border-radius: 0 0 0 8px;
          }
          
          .scan-target-corner.br {
            bottom: -2px;
            right: -2px;
            border-width: 0 4px 4px 0;
            border-radius: 0 0 8px 0;
          }
          
          .scan-line {
            position: absolute;
            left: 10px;
            right: 10px;
            height: 2px;
            background: linear-gradient(90deg, transparent, #22d3ee, transparent);
            animation: scan-sweep 2s ease-in-out infinite;
          }
          
          @keyframes scan-sweep {
            0%, 100% { top: 10px; }
            50% { top: calc(100% - 12px); }
          }
          
          .scan-instructions {
            display: flex;
            align-items: center;
            gap: 8px;
            margin-top: 20px;
            padding: 10px 20px;
            background: rgba(0, 0, 0, 0.7);
            border-radius: 20px;
            color: #22d3ee;
            font-size: 14px;
            font-weight: 500;
          }
          
          .scan-tip {
            margin-top: 12px;
            padding: 8px 16px;
            background: rgba(0, 0, 0, 0.6);
            border-radius: 12px;
            color: rgba(255, 255, 255, 0.7);
            font-size: 12px;
            text-align: center;
            max-width: 280px;
          }
          
          .scan-controls {
            position: absolute;
            bottom: 40px;
            left: 0;
            right: 0;
            display: flex;
            justify-content: center;
            gap: 30px;
            pointer-events: auto;
          }
          
          .scan-control-btn, .scan-cancel-btn {
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 6px;
            padding: 12px 20px;
            border-radius: 16px;
            border: none;
            cursor: pointer;
            font-size: 12px;
            font-weight: 500;
          }
          
          .scan-control-btn {
            background: rgba(34, 211, 238, 0.2);
            color: #22d3ee;
            border: 1px solid rgba(34, 211, 238, 0.3);
          }
          
          .scan-cancel-btn {
            background: rgba(239, 68, 68, 0.2);
            color: #ef4444;
            border: 1px solid rgba(239, 68, 68, 0.3);
          }
        `}</style>
      </div>,
      document.body
    );
  };

  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm p-4">
      <div className="w-full max-w-md rounded-2xl overflow-hidden"
           style={{
             background: 'linear-gradient(180deg, rgba(20, 25, 35, 0.98) 0%, rgba(12, 15, 22, 0.98) 100%)',
             border: '1px solid rgba(34, 211, 238, 0.2)',
             boxShadow: '0 25px 50px rgba(0, 0, 0, 0.5), 0 0 40px rgba(34, 211, 238, 0.1)',
           }}>
        
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center"
                 style={{ background: 'linear-gradient(135deg, rgba(34, 211, 238, 0.2) 0%, rgba(34, 211, 238, 0.1) 100%)' }}>
              <ScanLine className="w-5 h-5 text-cyan-400" />
            </div>
            <div>
              <h2 className="font-bold text-white">VIN Scanner</h2>
              <p className="text-xs text-zinc-400">Windshield & Manual Entry</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-white/10 transition">
            <X className="w-5 h-5 text-zinc-400" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4">
          {error && (
            <div className="mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/20 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm text-red-300">{error}</p>
                {scanAttempts > 1 && (
                  <p className="text-xs text-red-400/70 mt-1">
                    Tip: Try manual entry if scanning continues to fail
                  </p>
                )}
              </div>
            </div>
          )}

          {mode === 'menu' && (
            <div className="space-y-3">
              {/* Windshield Scan Button - Primary Action */}
              <button
                onClick={startWindshieldScan}
                disabled={loading}
                className="w-full p-4 rounded-xl flex items-center gap-4 transition-all hover:scale-[1.02] active:scale-[0.98]"
                style={{
                  background: 'linear-gradient(135deg, rgba(34, 211, 238, 0.15) 0%, rgba(34, 211, 238, 0.05) 100%)',
                  border: '1px solid rgba(34, 211, 238, 0.3)',
                }}
              >
                <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-cyan-500/20">
                  <Camera className="w-6 h-6 text-cyan-400" />
                </div>
                <div className="flex-1 text-left">
                  <p className="font-semibold text-white">Scan Windshield VIN</p>
                  <p className="text-xs text-zinc-400">Point camera at barcode on windshield</p>
                </div>
                {loading && <Loader2 className="w-5 h-5 text-cyan-400 animate-spin" />}
              </button>

              {/* Manual Entry Button */}
              <button
                onClick={() => setMode('manual')}
                className="w-full p-4 rounded-xl flex items-center gap-4 transition-all hover:bg-white/5"
                style={{
                  background: 'rgba(255, 255, 255, 0.03)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                }}
              >
                <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-white/5">
                  <Keyboard className="w-6 h-6 text-zinc-400" />
                </div>
                <div className="flex-1 text-left">
                  <p className="font-semibold text-white">Enter VIN Manually</p>
                  <p className="text-xs text-zinc-400">Type the 17-character VIN</p>
                </div>
              </button>

              {/* Recent Scans */}
              {recentScans.length > 0 && (
                <div className="mt-4">
                  <p className="text-xs font-medium text-zinc-500 uppercase tracking-wider mb-2 px-1">Recent Scans</p>
                  <div className="space-y-2 max-h-40 overflow-y-auto">
                    {recentScans.map((scan, i) => (
                      <button
                        key={scan.vin}
                        onClick={() => { setVin(scan.vin); lookupVin(scan.vin); }}
                        className="w-full p-3 rounded-lg flex items-center gap-3 text-left hover:bg-white/5 transition"
                        style={{ background: 'rgba(255, 255, 255, 0.02)' }}
                      >
                        <Car className="w-4 h-4 text-zinc-500" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-white truncate">{scan.vehicle}</p>
                          <p className="text-xs text-zinc-500 font-mono">{scan.vin}</p>
                        </div>
                        <RotateCcw className="w-4 h-4 text-zinc-600" />
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {mode === 'manual' && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-2">
                  Enter VIN Number
                </label>
                <input
                  type="text"
                  value={manualVin}
                  onChange={(e) => handleManualVinChange(e.target.value)}
                  placeholder="Enter 17-character VIN"
                  maxLength={17}
                  className="w-full px-4 py-3 rounded-xl bg-black/30 border border-white/10 text-white font-mono text-lg tracking-wider focus:outline-none focus:border-cyan-500/50 uppercase"
                  autoFocus
                  data-testid="vin-input"
                />
                {vinValidation.message && (
                  <p className={`mt-2 text-sm ${vinValidation.valid ? 'text-green-400' : 'text-zinc-400'}`}>
                    {vinValidation.message}
                  </p>
                )}
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => { setMode('menu'); setManualVin(''); }}
                  className="flex-1 py-3 rounded-xl bg-white/5 text-white font-medium hover:bg-white/10 transition"
                >
                  Cancel
                </button>
                <button
                  onClick={handleManualSubmit}
                  disabled={!vinValidation.valid || loading}
                  className="flex-1 py-3 rounded-xl font-medium transition disabled:opacity-50 flex items-center justify-center gap-2"
                  style={{
                    background: vinValidation.valid ? 'linear-gradient(135deg, #22d3ee 0%, #0891b2 100%)' : 'rgba(255,255,255,0.1)',
                    color: vinValidation.valid ? 'black' : 'white',
                  }}
                  data-testid="decode-vin-btn"
                >
                  {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Decode'}
                </button>
              </div>
            </div>
          )}

          {mode === 'result' && vehicleData && (
            <div className="space-y-4">
              {/* Vehicle Header */}
              <div className="text-center">
                <p className="text-2xl font-bold text-white">
                  {vehicleData.year} {vehicleData.make}
                </p>
                <p className="text-lg text-cyan-400">{vehicleData.model} {vehicleData.trim || ''}</p>
                
                {/* Confidence Score */}
                <div className="flex items-center justify-center gap-2 mt-2">
                  <div className={`px-3 py-1 rounded-full text-xs font-medium ${
                    (vehicleData.confidence || 0) >= 0.8 ? 'bg-green-500/20 text-green-400' :
                    (vehicleData.confidence || 0) >= 0.6 ? 'bg-amber-500/20 text-amber-400' :
                    'bg-red-500/20 text-red-400'
                  }`}>
                    {Math.round((vehicleData.confidence || 0.7) * 100)}% Confidence
                  </div>
                </div>
                
                <p className="text-xs text-zinc-500 font-mono mt-2">{vehicleData.vin}</p>
              </div>

              {/* Vehicle Details Grid */}
              <div className="grid grid-cols-2 gap-2">
                {vehicleData.engine && (
                  <div className="p-3 rounded-xl bg-white/5 border border-white/5">
                    <div className="flex items-center gap-2 text-zinc-400 mb-1">
                      <Gauge className="w-3.5 h-3.5" />
                      <span className="text-xs">Engine</span>
                    </div>
                    <p className="text-sm text-white truncate">{vehicleData.engine}</p>
                  </div>
                )}
                {vehicleData.transmission && (
                  <div className="p-3 rounded-xl bg-white/5 border border-white/5">
                    <div className="flex items-center gap-2 text-zinc-400 mb-1">
                      <Settings2 className="w-3.5 h-3.5" />
                      <span className="text-xs">Trans</span>
                    </div>
                    <p className="text-sm text-white truncate">{vehicleData.transmission}</p>
                  </div>
                )}
                {vehicleData.fuel_type && (
                  <div className="p-3 rounded-xl bg-white/5 border border-white/5">
                    <div className="flex items-center gap-2 text-zinc-400 mb-1">
                      <Fuel className="w-3.5 h-3.5" />
                      <span className="text-xs">Fuel</span>
                    </div>
                    <p className="text-sm text-white truncate">{vehicleData.fuel_type}</p>
                  </div>
                )}
                {vehicleData.plant_location && (
                  <div className="p-3 rounded-xl bg-white/5 border border-white/5">
                    <div className="flex items-center gap-2 text-zinc-400 mb-1">
                      <MapPin className="w-3.5 h-3.5" />
                      <span className="text-xs">Built In</span>
                    </div>
                    <p className="text-sm text-white truncate">{vehicleData.plant_location}</p>
                  </div>
                )}
              </div>

              {/* Safety Features */}
              {vehicleData.safety_features && vehicleData.safety_features.length > 0 && (
                <div className="p-3 rounded-xl bg-green-500/10 border border-green-500/20">
                  <div className="flex items-center gap-2 text-green-400 mb-2">
                    <Shield className="w-4 h-4" />
                    <span className="text-xs font-medium">Safety Features</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {vehicleData.safety_features.map((feature, i) => (
                      <span key={i} className="px-2 py-0.5 rounded-full text-xs bg-green-500/20 text-green-300">
                        {feature}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              {saved ? (
                <div className="flex items-center justify-center gap-2 py-4 text-green-400">
                  <CheckCircle2 className="w-6 h-6" />
                  <span className="font-medium">Saved Successfully!</span>
                </div>
              ) : (
                <div className="flex gap-3">
                  <button
                    onClick={() => saveToInventory(false)}
                    disabled={loading}
                    className="flex-1 py-3 rounded-xl font-medium transition flex items-center justify-center gap-2"
                    style={{
                      background: 'linear-gradient(135deg, #22d3ee 0%, #0891b2 100%)',
                      color: 'black',
                    }}
                  >
                    {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                    Save to Inventory
                  </button>
                  <button
                    onClick={() => saveToInventory(true)}
                    disabled={loading}
                    className="flex-1 py-3 rounded-xl font-medium transition flex items-center justify-center gap-2 bg-amber-500/20 text-amber-400 border border-amber-500/30"
                  >
                    <Car className="w-5 h-5" />
                    Trade-In
                  </button>
                </div>
              )}

              {/* Scan Another */}
              <button
                onClick={() => { setMode('menu'); setVehicleData(null); setVin(''); }}
                className="w-full py-2 text-sm text-zinc-400 hover:text-white transition"
              >
                Scan Another VIN
              </button>
            </div>
          )}
        </div>
      </div>
      
      {/* Scanning Overlay */}
      {renderScanningOverlay()}
    </div>,
    document.body
  );
};

export default VinScanner;

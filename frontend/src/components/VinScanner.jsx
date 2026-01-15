import React, { useState, useCallback, useEffect } from 'react';
import { X, Camera, Keyboard, Car, Save, Check, Loader2, AlertCircle, ScanLine } from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

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
  const [scannerReady, setScannerReady] = useState(false);

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
      
      // Check permissions
      const { camera } = await BarcodeScanner.checkPermissions();
      if (camera !== 'granted') {
        const { camera: newPermission } = await BarcodeScanner.requestPermissions();
        if (newPermission !== 'granted') {
          setError('Camera permission is required for scanning');
          return false;
        }
      }

      // Check if scanning is supported
      const { supported } = await BarcodeScanner.isSupported();
      if (!supported) {
        setError('Barcode scanning is not supported on this device');
        return false;
      }

      setScannerReady(true);
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
      
      // Add scanning UI class to body
      document.body.classList.add('barcode-scanning');

      const result = await BarcodeScanner.scan({
        formats: ['CODE_39', 'CODE_128', 'DATA_MATRIX', 'QR_CODE'],
      });

      document.body.classList.remove('barcode-scanning');

      if (result.barcodes && result.barcodes.length > 0) {
        const scannedVin = result.barcodes[0].rawValue;
        // VINs are 17 characters
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
      console.error('Scan error:', err);
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
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/80 backdrop-blur-sm"
        onClick={mode === 'scanning' ? stopScanning : onClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-md mx-4 animate-fade-in">
        <div 
          className="rounded-2xl overflow-hidden"
          style={{
            background: 'linear-gradient(180deg, hsla(220, 15%, 13%, 0.98) 0%, hsla(220, 15%, 8%, 0.98) 100%)',
            border: '1px solid hsla(220, 20%, 25%, 0.5)',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5), 0 0 40px hsla(200, 100%, 50%, 0.1)',
          }}
        >
          {/* Header */}
          <div 
            className="flex items-center justify-between px-5 py-4"
            style={{ borderBottom: '1px solid hsla(220, 15%, 20%, 0.5)' }}
          >
            <div className="flex items-center gap-3">
              <div 
                className="w-10 h-10 rounded-full flex items-center justify-center"
                style={{
                  background: 'linear-gradient(180deg, hsla(200, 80%, 50%, 0.2) 0%, hsla(200, 80%, 40%, 0.15) 100%)',
                  border: '1px solid hsla(200, 80%, 50%, 0.3)',
                }}
              >
                <ScanLine className="w-5 h-5" style={{ color: 'hsla(200, 90%, 60%, 1)' }} />
              </div>
              <div>
                <h2 className="text-lg font-bold" style={{ color: 'hsla(200, 90%, 70%, 1)' }}>
                  VIN Scanner
                </h2>
                <p className="text-xs text-muted-foreground">Decode any vehicle</p>
              </div>
            </div>
            <button
              onClick={mode === 'scanning' ? stopScanning : onClose}
              className="p-2 rounded-lg hover:bg-white/10 transition-colors"
            >
              <X className="w-5 h-5 text-muted-foreground" />
            </button>
          </div>

          {/* Content */}
          <div className="p-5">
            {/* Error Display */}
            {error && (
              <div 
                className="mb-4 p-3 rounded-lg flex items-start gap-2"
                style={{
                  background: 'hsla(0, 70%, 50%, 0.15)',
                  border: '1px solid hsla(0, 70%, 50%, 0.3)',
                }}
              >
                <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" style={{ color: 'hsla(0, 80%, 60%, 1)' }} />
                <p className="text-sm" style={{ color: 'hsla(0, 80%, 70%, 1)' }}>{error}</p>
              </div>
            )}

            {/* Menu Mode */}
            {mode === 'menu' && (
              <div className="space-y-3">
                <button
                  onClick={startBarcodeScanning}
                  disabled={loading}
                  className="w-full p-4 rounded-xl flex items-center gap-4 transition-all hover:scale-[1.02] active:scale-[0.98]"
                  style={{
                    background: 'linear-gradient(180deg, hsla(200, 70%, 45%, 0.2) 0%, hsla(200, 70%, 35%, 0.15) 100%)',
                    border: '1px solid hsla(200, 70%, 50%, 0.3)',
                  }}
                  data-testid="scan-barcode-btn"
                >
                  <div 
                    className="w-12 h-12 rounded-xl flex items-center justify-center"
                    style={{ background: 'hsla(200, 80%, 50%, 0.2)' }}
                  >
                    <Camera className="w-6 h-6" style={{ color: 'hsla(200, 90%, 65%, 1)' }} />
                  </div>
                  <div className="text-left">
                    <p className="font-semibold" style={{ color: 'hsla(200, 90%, 70%, 1)' }}>
                      Scan Barcode
                    </p>
                    <p className="text-xs text-muted-foreground">Door jamb sticker or window</p>
                  </div>
                </button>

                <button
                  onClick={() => setMode('manual')}
                  className="w-full p-4 rounded-xl flex items-center gap-4 transition-all hover:scale-[1.02] active:scale-[0.98]"
                  style={{
                    background: 'linear-gradient(180deg, hsla(40, 60%, 45%, 0.15) 0%, hsla(40, 60%, 35%, 0.1) 100%)',
                    border: '1px solid hsla(40, 60%, 50%, 0.25)',
                  }}
                  data-testid="manual-entry-btn"
                >
                  <div 
                    className="w-12 h-12 rounded-xl flex items-center justify-center"
                    style={{ background: 'hsla(40, 70%, 50%, 0.15)' }}
                  >
                    <Keyboard className="w-6 h-6" style={{ color: 'hsla(40, 80%, 60%, 1)' }} />
                  </div>
                  <div className="text-left">
                    <p className="font-semibold" style={{ color: 'hsla(40, 80%, 65%, 1)' }}>
                      Enter Manually
                    </p>
                    <p className="text-xs text-muted-foreground">Type the 17-digit VIN</p>
                  </div>
                </button>
              </div>
            )}

            {/* Scanning Mode */}
            {mode === 'scanning' && (
              <div className="text-center py-8">
                <div className="relative mx-auto w-48 h-32 mb-4 rounded-lg overflow-hidden" style={{ border: '2px solid hsla(200, 80%, 50%, 0.5)' }}>
                  <div className="absolute inset-0 bg-gradient-to-b from-transparent via-cyan-500/20 to-transparent animate-scan" />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <Loader2 className="w-8 h-8 animate-spin" style={{ color: 'hsla(200, 90%, 60%, 1)' }} />
                  </div>
                </div>
                <p className="text-sm text-muted-foreground mb-4">Point camera at VIN barcode</p>
                <button
                  onClick={stopScanning}
                  className="px-4 py-2 rounded-lg text-sm font-medium"
                  style={{
                    background: 'hsla(0, 70%, 50%, 0.2)',
                    border: '1px solid hsla(0, 70%, 50%, 0.3)',
                    color: 'hsla(0, 80%, 70%, 1)',
                  }}
                >
                  Cancel
                </button>
              </div>
            )}

            {/* Manual Entry Mode */}
            {mode === 'manual' && (
              <form onSubmit={handleManualSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-2">
                    Enter 17-digit VIN
                  </label>
                  <input
                    type="text"
                    value={manualVin}
                    onChange={(e) => setManualVin(e.target.value.toUpperCase())}
                    placeholder="1HGCM82633A123456"
                    maxLength={17}
                    className="w-full px-4 py-3 rounded-lg text-lg font-mono tracking-wider focus:outline-none focus:ring-2"
                    style={{
                      background: 'hsla(220, 15%, 12%, 0.8)',
                      border: '1px solid hsla(220, 15%, 25%, 0.5)',
                      color: 'inherit',
                    }}
                    autoFocus
                    data-testid="vin-input"
                  />
                  <p className="mt-2 text-xs text-muted-foreground text-right">
                    {manualVin.length}/17 characters
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setMode('menu')}
                    className="flex-1 py-3 rounded-lg font-medium transition-colors"
                    style={{
                      background: 'hsla(220, 15%, 20%, 0.5)',
                      border: '1px solid hsla(220, 15%, 30%, 0.5)',
                    }}
                  >
                    Back
                  </button>
                  <button
                    type="submit"
                    disabled={manualVin.length !== 17 || loading}
                    className="flex-1 py-3 rounded-lg font-medium transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                    style={{
                      background: 'linear-gradient(180deg, hsla(200, 70%, 45%, 0.3) 0%, hsla(200, 70%, 35%, 0.25) 100%)',
                      border: '1px solid hsla(200, 70%, 50%, 0.4)',
                      color: 'hsla(200, 90%, 70%, 1)',
                    }}
                    data-testid="decode-vin-btn"
                  >
                    {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ScanLine className="w-4 h-4" />}
                    Decode VIN
                  </button>
                </div>
              </form>
            )}

            {/* Result Mode */}
            {mode === 'result' && vehicleData && (
              <div className="space-y-4">
                {/* Vehicle Summary Card */}
                <div 
                  className="p-4 rounded-xl"
                  style={{
                    background: 'linear-gradient(180deg, hsla(145, 50%, 35%, 0.15) 0%, hsla(145, 50%, 25%, 0.1) 100%)',
                    border: '1px solid hsla(145, 50%, 40%, 0.25)',
                  }}
                >
                  <div className="flex items-start gap-3">
                    <div 
                      className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
                      style={{ background: 'hsla(145, 60%, 40%, 0.2)' }}
                    >
                      <Car className="w-6 h-6" style={{ color: 'hsla(145, 70%, 55%, 1)' }} />
                    </div>
                    <div>
                      <h3 className="font-bold text-lg" style={{ color: 'hsla(145, 70%, 60%, 1)' }}>
                        {vehicleData.year} {vehicleData.make}
                      </h3>
                      <p className="text-sm text-foreground">{vehicleData.model}</p>
                      <p className="text-xs text-muted-foreground font-mono mt-1">{vin}</p>
                    </div>
                  </div>
                </div>

                {/* Vehicle Details */}
                <div className="grid grid-cols-2 gap-2">
                  {vehicleData.trim && (
                    <DetailItem label="Trim" value={vehicleData.trim} />
                  )}
                  {vehicleData.body_class && (
                    <DetailItem label="Body" value={vehicleData.body_class} />
                  )}
                  {vehicleData.drive_type && (
                    <DetailItem label="Drive" value={vehicleData.drive_type} />
                  )}
                  {vehicleData.engine && (
                    <DetailItem label="Engine" value={vehicleData.engine} />
                  )}
                  {vehicleData.fuel_type && (
                    <DetailItem label="Fuel" value={vehicleData.fuel_type} />
                  )}
                  {vehicleData.transmission && (
                    <DetailItem label="Trans" value={vehicleData.transmission} />
                  )}
                  {vehicleData.plant_country && (
                    <DetailItem label="Made In" value={vehicleData.plant_country} />
                  )}
                  {vehicleData.doors && (
                    <DetailItem label="Doors" value={vehicleData.doors} />
                  )}
                </div>

                {/* Action Buttons */}
                <div className="flex gap-2 pt-2">
                  <button
                    onClick={() => {
                      setMode('menu');
                      setVehicleData(null);
                      setVin('');
                      setSaved(false);
                    }}
                    className="flex-1 py-3 rounded-lg font-medium transition-colors"
                    style={{
                      background: 'hsla(220, 15%, 20%, 0.5)',
                      border: '1px solid hsla(220, 15%, 30%, 0.5)',
                    }}
                  >
                    Scan Another
                  </button>
                  <button
                    onClick={saveToInventory}
                    disabled={loading || saved}
                    className="flex-1 py-3 rounded-lg font-medium transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                    style={{
                      background: saved 
                        ? 'linear-gradient(180deg, hsla(145, 60%, 40%, 0.3) 0%, hsla(145, 60%, 30%, 0.25) 100%)'
                        : 'linear-gradient(180deg, hsla(200, 70%, 45%, 0.3) 0%, hsla(200, 70%, 35%, 0.25) 100%)',
                      border: saved
                        ? '1px solid hsla(145, 60%, 45%, 0.4)'
                        : '1px solid hsla(200, 70%, 50%, 0.4)',
                      color: saved ? 'hsla(145, 80%, 60%, 1)' : 'hsla(200, 90%, 70%, 1)',
                    }}
                    data-testid="save-vehicle-btn"
                  >
                    {loading ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : saved ? (
                      <>
                        <Check className="w-4 h-4" />
                        Saved!
                      </>
                    ) : (
                      <>
                        <Save className="w-4 h-4" />
                        Save to Inventory
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
        @keyframes scan {
          0%, 100% { transform: translateY(-100%); }
          50% { transform: translateY(100%); }
        }
        .animate-scan {
          animation: scan 2s ease-in-out infinite;
        }
        body.barcode-scanning {
          background: transparent !important;
        }
        body.barcode-scanning > *:not(.barcode-scanner-active) {
          visibility: hidden;
        }
      `}</style>
    </div>
  );
};

// Helper component for detail items
const DetailItem = ({ label, value }) => (
  <div 
    className="p-2 rounded-lg"
    style={{
      background: 'hsla(220, 15%, 15%, 0.5)',
      border: '1px solid hsla(220, 15%, 22%, 0.4)',
    }}
  >
    <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{label}</p>
    <p className="text-sm font-medium truncate">{value}</p>
  </div>
);

export default VinScanner;

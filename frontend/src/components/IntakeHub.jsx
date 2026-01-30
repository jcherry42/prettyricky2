import React, { useState, useEffect } from 'react';
import { X, Car, IdCard, Gauge, AlertTriangle, Printer, Loader2 } from 'lucide-react';
import { useSales } from '../context/SalesContext';
import { toast } from 'sonner';
import { validateVIN } from '../utils/enterprise';
import { LicenseScanner } from './LicenseScanner';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || '';

// Local vehicle inventory limit
const MAX_VEHICLES = 150;

const IntakeHub = ({ isOpen, onClose, onOpenLicenseScanner }) => {
  const { vehicleInventory, setVehicleInventory } = useSales() || {};
  const [activeMode, setActiveMode] = useState('license');
  const [vin, setVin] = useState('');
  const [vinStatus, setVinStatus] = useState({ valid: false, message: '' });
  const [decoding, setDecoding] = useState(false);
  const [selectedVehicle, setSelectedVehicle] = useState(null);
  const [mileage, setMileage] = useState('');

  // Guard if context not yet extended
  const inventory = vehicleInventory || [];
  const updateInventory = (next) => {
    if (setVehicleInventory) {
      setVehicleInventory(next);
    }
  };

  useEffect(() => {
    if (!isOpen) {
      setActiveMode('license');
      setVin('');
      setVinStatus({ valid: false, message: '' });
      setDecoding(false);
      setSelectedVehicle(null);
      setMileage('');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleVINChange = (value) => {
    const clean = value.toUpperCase().replace(/[^A-HJ-NPR-Z0-9]/g, '');
    setVin(clean);
    setVinStatus(validateVIN(clean));
  };

  const handleDecodeVIN = async () => {
    if (!vinStatus.valid) return;
    
    if (inventory.length >= MAX_VEHICLES) {
      toast.error('Inventory full', {
        description: `You have ${inventory.length} vehicles in local inventory. Remove one before adding another.`
      });
      return;
    }

    try {
      setDecoding(true);
      const res = await fetch(`${BACKEND_URL}/api/vin/decode/${vin}`);
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || 'VIN decode failed');
      }
      const data = await res.json();

      const vehicle = {
        id: `${Date.now()}-${vin}`,
        vin,
        year: data.year || '',
        make: data.make || '',
        model: data.model || '',
        trim: data.trim || '',
        body_class: data.body_class || '',
        drive_type: data.drive_type || '',
        fuel_type: data.fuel_type || '',
        engine: data.engine || '',
        transmission: data.transmission || '',
        doors: data.doors || '',
        plant_country: data.plant_country || '',
        current_mileage: mileage ? parseInt(mileage.replace(/,/g, ''), 10) : null,
        createdAt: new Date().toISOString(),
      };

      const next = [...inventory, vehicle];
      updateInventory(next);
      setSelectedVehicle(vehicle);
      toast.success('Vehicle added to local inventory', {
        description: `${vehicle.year || ''} ${vehicle.make || ''} ${vehicle.model || ''}`.trim()
      });
    } catch (err) {
      toast.error('VIN decode failed', { description: err.message });
    } finally {
      setDecoding(false);
    }
  };

  const handlePrintSelected = async () => {
    if (!selectedVehicle) return;
    const printerIP = localStorage.getItem('printerIP');
    if (!printerIP) {
      toast.error('No printer connected', { description: 'Go to CHECK → Printer to connect' });
      return;
    }

    try {
      const res = await fetch(`${BACKEND_URL}/api/printer/print`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'vehicle_profile',
          printer_ip: printerIP,
          vehicle: selectedVehicle,
        })
      });
      if (!res.ok) throw new Error('Printer error');
      toast.success('Print job sent', {
        description: `${selectedVehicle.year || ''} ${selectedVehicle.make || ''} ${selectedVehicle.model || ''}`.trim()
      });
    } catch (err) {
      toast.error('Failed to send to printer', { description: err.message });
    }
  };

  return (
    <div className="intake-overlay" onClick={onClose}>
      <div className="intake-modal" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="intake-header">
          <div className="intake-title">
            <Gauge className="w-5 h-5" />
            <span>Intake</span>
            <span className="intake-badge">DUAL MODE</span>
          </div>
          <button onClick={onClose} className="intake-close" aria-label="Close">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Mode selector - instrument cluster style */}
        <div className="intake-modes">
          <button
            className={`intake-mode ${activeMode === 'license' ? 'active' : ''}`}
            onClick={() => setActiveMode('license')}
          >
            <IdCard className="w-4 h-4" />
            <span>License Scan</span>
          </button>
          <button
            className={`intake-mode ${activeMode === 'vin' ? 'active' : ''}`}
            onClick={() => setActiveMode('vin')}
          >
            <Car className="w-4 h-4" />
            <span>VIN Scanner</span>
          </button>
        </div>

        {/* Content */}
        <div className="intake-body">
          {activeMode === 'license' && (
            <div className="intake-license-panel">
              <p className="intake-copy">Use the License Scanner to capture and decode a driver&apos;s license.</p>
              <button
                className="intake-open-license-btn"
                onClick={() => {
                  if (onOpenLicenseScanner) {
                    onOpenLicenseScanner();
                  }
                }}
              >
                <IdCard className="w-4 h-4" />
                <span>Open License Scanner</span>
              </button>
            </div>
          )}

          {activeMode === 'vin' && (
            <div className="vin-panel">
              <div className="vin-input-row">
                <label>VIN</label>
                <input
                  type="text"
                  value={vin}
                  onChange={(e) => handleVINChange(e.target.value)}
                  maxLength={17}
                  placeholder="1HGCM82633A123456"
                  className="vin-input"
                />
                <input
                  type="text"
                  value={mileage}
                  onChange={(e) => setMileage(e.target.value.replace(/[^\d,]/g, ''))}
                  placeholder="Mileage (optional)"
                  className="vin-mileage-input"
                />
              </div>
              {vinStatus.message && (
                <p className={`vin-status ${vinStatus.valid ? 'valid' : 'error'}`}>{vinStatus.message}</p>
              )}
              <button
                className="vin-decode-btn"
                disabled={!vinStatus.valid || decoding}
                onClick={handleDecodeVIN}
              >
                {decoding ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Decode & Save to Inventory'}
              </button>

              {/* Inventory list */}
              <div className="vin-inventory-header">
                <span>Local Inventory</span>
                <span className="vin-inventory-count">{inventory.length}/{MAX_VEHICLES}</span>
              </div>
              {inventory.length === 0 ? (
                <div className="vin-empty">No vehicles in local inventory yet.</div>
              ) : (
                <div className="vin-list">
                  {inventory.map((v) => (
                    <button
                      key={v.id}
                      className={`vin-item ${selectedVehicle?.id === v.id ? 'selected' : ''}`}
                      onClick={() => setSelectedVehicle(v)}
                    >
                      <div className="vin-main">
                        <span className="vin-title">{v.year || ''} {v.make || ''} {v.model || ''}</span>
                        <span className="vin-sub">{v.vin}</span>
                      </div>
                      {v.current_mileage && (
                        <span className="vin-mileage">{v.current_mileage.toLocaleString()} mi</span>
                      )}
                    </button>
                  ))}
                </div>
              )}

              {/* Eject to printer for selected vehicle */}
              <button
                className="vin-eject-btn"
                disabled={!selectedVehicle}
                onClick={handlePrintSelected}
              >
                <Printer className="w-4 h-4" />
                Eject Vehicle Profile
              </button>

              {inventory.length >= MAX_VEHICLES && (
                <div className="vin-warning">
                  <AlertTriangle className="w-4 h-4" />
                  <span>Inventory at capacity. Remove vehicles before adding more.</span>
                </div>
              )}
            </div>
          )}
        </div>

        <style>{`
          .intake-overlay {
            position: fixed;
            inset: 0;
            background: rgba(0,0,0,0.85);
            z-index: 100;
            display: flex;
            align-items: flex-end;
            justify-content: center;
          }
          .intake-modal {
            width: 100%;
            max-width: 520px;
            max-height: 95vh;
            background:
              linear-gradient(180deg,
                rgba(22, 18, 14, 0.98) 0%,
                rgba(12, 10, 8, 0.99) 100%
              );
            border-radius: 24px 24px 0 0;
            overflow: hidden;
            display: flex;
            flex-direction: column;
            border: 1px solid rgba(139, 90, 43, 0.45);
            box-shadow:
              0 -16px 40px rgba(0,0,0,0.7),
              0 0 0 1px rgba(0,0,0,0.6);
            animation: slideUp 0.25s ease-out;
          }
          @keyframes slideUp {
            from { transform: translateY(100%); opacity: 0; }
            to { transform: translateY(0); opacity: 1; }
          }
          .intake-header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 16px 20px;
            background: linear-gradient(180deg,
              rgba(0, 0, 0, 0.3) 0%,
              rgba(0, 0, 0, 0.15) 100%
            );
            border-bottom: 1px solid rgba(139, 90, 43, 0.45);
          }
          .intake-title {
            display: flex;
            align-items: center;
            gap: 10px;
            font-family: 'Smooch Sans', system-ui, sans-serif;
            letter-spacing: 0.12em;
            text-transform: uppercase;
            color: #FBD38D;
            font-size: 20px;
          }
          .intake-badge {
            font-size: 10px;
            padding: 2px 8px;
            border-radius: 999px;
            background: rgba(15, 81, 140, 0.2);
            border: 1px solid rgba(15, 81, 140, 0.5);
            color: #BFDBFE;
          }
          .intake-close {
            width: 36px;
            height: 36px;
            border-radius: 12px;
            background: rgba(15,23,42,0.7);
            border: 1px solid rgba(148,163,184,0.4);
            color: rgba(248,250,252,0.8);
            display: flex;
            align-items: center;
            justify-content: center;
          }
          .intake-modes {
            display: grid;
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 6px;
            padding: 10px 14px 6px;
            background: radial-gradient(circle at top,
              rgba(20, 18, 15, 0.98) 0%,
              rgba(12, 10, 8, 0.99) 100%
            );
          }
          .intake-mode {
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 6px;
            padding: 10px 12px;
            border-radius: 999px;
            border: 1px solid rgba(139, 90, 43, 0.45);
            background: rgba(20, 16, 12, 0.9);
            color: rgba(248, 244, 235, 0.9);
            font-size: 12px;
            font-weight: 600;
            letter-spacing: 0.08em;
            text-transform: uppercase;
          }
          .intake-mode.active {
            border-color: rgba(15, 81, 140, 0.9);
            box-shadow: 0 0 20px rgba(15, 81, 140, 0.35);
            background: radial-gradient(circle at top,
              rgba(15, 81, 140, 0.5) 0%,
              rgba(20, 16, 12, 0.98) 60%
            );
            color: #E0F2FE;
          }
          .intake-body {
            flex: 1;
            overflow-y: auto;
          }
          .vin-panel {
            padding: 16px 18px 20px;
            display: flex;
            flex-direction: column;
            gap: 12px;
          }
          .vin-input-row {
            display: grid;
            grid-template-columns: 2fr 1.4fr;
            gap: 10px;
            align-items: end;
          }
          .vin-input-row label {
            grid-column: 1 / -1;
            font-size: 11px;
            text-transform: uppercase;
            letter-spacing: 0.12em;
            color: rgba(148,163,184,0.9);
            margin-bottom: 4px;
          }
          .vin-input, .vin-mileage-input {
            padding: 10px 12px;
            border-radius: 12px;
            border: 1px solid rgba(51,65,85,0.9);
            background: rgba(15,23,42,0.9);
            color: #e5f2ff;
            font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
            font-size: 13px;
          }
          .vin-status {
            font-size: 11px;
            padding-left: 2px;
          }
          .vin-status.valid {
            color: #4ade80;
          }
          .vin-status.error {
            color: #f97373;
          }
          .vin-decode-btn {
            margin-top: 4px;
            padding: 10px 14px;
            border-radius: 999px;
            border: none;
            background: linear-gradient(135deg, rgba(34,197,94,0.3), rgba(22,163,74,0.3));
            color: white;
            font-size: 13px;
            font-weight: 600;
          }
          .vin-inventory-header {
            margin-top: 12px;
            display: flex;
            align-items: center;
            justify-content: space-between;
            font-size: 12px;
            color: rgba(148,163,184,0.9);
          }
          .vin-inventory-count {
            font-variant-numeric: tabular-nums;
          }
          .vin-empty {
            margin-top: 6px;
            padding: 10px 12px;
            border-radius: 12px;
            background: rgba(15,23,42,0.95);
            border: 1px dashed rgba(55,65,81,0.9);
            font-size: 12px;
            color: rgba(148,163,184,0.9);
          }
          .vin-list {
            margin-top: 6px;
            max-height: 200px;
            overflow-y: auto;
            display: flex;
            flex-direction: column;
            gap: 6px;
          }
          .vin-item {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 8px;
            padding: 10px 12px;
            border-radius: 12px;
            background: rgba(15,23,42,0.9);
            border: 1px solid rgba(55,65,81,0.9);
            color: #e5e7eb;
            font-size: 12px;
          }
          .vin-item.selected {
            border-color: rgba(34,211,238,0.9);
            box-shadow: 0 0 16px rgba(34,211,238,0.25);
          }
          .vin-main {
            display: flex;
            flex-direction: column;
            gap: 2px;
          }
          .vin-title {
            font-weight: 600;
          }
          .vin-sub {
            font-family: ui-monospace, monospace;
            font-size: 11px;
            color: rgba(148,163,184,0.9);
          }
          .vin-mileage {
            font-size: 11px;
            color: rgba(248,250,252,0.9);
          }
          .vin-eject-btn {
            margin-top: 8px;
            padding: 10px 12px;
            border-radius: 12px;
            border: 1px solid rgba(248,113,113,0.85);
            background: linear-gradient(135deg, rgba(248,113,113,0.2), rgba(248,113,113,0.35));
            color: #fee2e2;
            font-size: 13px;
            font-weight: 600;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 6px;
          }
          .vin-warning {
            margin-top: 8px;
            display: flex;
            align-items: center;
            gap: 6px;
            font-size: 11px;
            color: #fed7aa;
          }
        `}</style>
      </div>
    </div>
  );
};

export default IntakeHub;

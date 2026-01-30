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
          <button onClick={onClose} className="intake-close" aria-label="Close Intake Hub" data-testid="intake-close-btn">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Mode selector - instrument cluster style */}
        <div className="intake-modes">
          <button
            className={`intake-mode ${activeMode === 'license' ? 'active' : ''}`}
            onClick={() => setActiveMode('license')}
            aria-label="License Scan mode"
            data-testid="intake-mode-license"
          >
            <IdCard className="w-4 h-4" />
            <span>License Scan</span>
          </button>
          <button
            className={`intake-mode ${activeMode === 'vin' ? 'active' : ''}`}
            onClick={() => setActiveMode('vin')}
            aria-label="VIN Scanner mode"
            data-testid="intake-mode-vin"
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
                aria-label="Open License Scanner"
                data-testid="intake-open-license-scanner"
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
                  aria-label="VIN number"
                  data-testid="vin-input"
                />
                <input
                  type="text"
                  value={mileage}
                  onChange={(e) => setMileage(e.target.value.replace(/[^\d,]/g, ''))}
                  placeholder="Mileage (optional)"
                  className="vin-mileage-input"
                  aria-label="Vehicle mileage"
                  data-testid="vin-mileage-input"
                />
              </div>
              {vinStatus.message && (
                <p className={`vin-status ${vinStatus.valid ? 'valid' : 'error'}`}>{vinStatus.message}</p>
              )}
              <button
                className="vin-decode-btn"
                disabled={!vinStatus.valid || decoding}
                onClick={handleDecodeVIN}
                aria-label={decoding ? 'Decoding VIN' : 'Decode VIN and save to inventory'}
                data-testid="vin-decode-btn"
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
            align-items: center;
            justify-content: center;
            padding: 16px;
            padding-top: env(safe-area-inset-top, 16px);
            padding-bottom: env(safe-area-inset-bottom, 16px);
          }
          .intake-modal {
            width: 100%;
            max-width: 520px;
            max-height: calc(100vh - 32px - env(safe-area-inset-top, 0px) - env(safe-area-inset-bottom, 0px));
            max-height: 85dvh;
            margin: auto;
            background:
              /* Picasso swirl pattern */
              radial-gradient(ellipse 180% 90% at 0% 40%, rgba(128, 40, 60, 0.08) 0%, transparent 55%),
              radial-gradient(ellipse 150% 100% at 100% 60%, rgba(40, 100, 120, 0.06) 0%, transparent 55%),
              /* Quilted nappa */
              repeating-linear-gradient(45deg, transparent, transparent 22px, rgba(180, 140, 80, 0.02) 22px, rgba(180, 140, 80, 0.02) 23px),
              repeating-linear-gradient(-45deg, transparent, transparent 22px, rgba(180, 140, 80, 0.02) 22px, rgba(180, 140, 80, 0.02) 23px),
              linear-gradient(165deg, #1a1816 0%, #0f0e0d 50%, #141210 100%);
            border-radius: 20px;
            overflow: hidden;
            display: flex;
            flex-direction: column;
            /* Wood bezel border */
            border: 3px solid;
            border-image: linear-gradient(135deg, #5C3A1E 0%, #7A4F2A 25%, #6B4324 50%, #8B5A2B 75%, #5C3A1E 100%) 1;
            box-shadow:
              0 0 0 1px rgba(60, 50, 40, 0.8),
              0 0 0 2px rgba(100, 80, 55, 0.4),
              0 30px 60px rgba(0,0,0,0.6),
              inset 0 1px 0 rgba(255, 200, 140, 0.05);
            animation: fadeIn 0.25s ease-out;
          }
          @keyframes fadeIn {
            from { transform: scale(0.95); opacity: 0; }
            to { transform: scale(1); opacity: 1; }
          }
          .intake-header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 16px 20px;
            /* Brushed aluminum */
            background: 
              repeating-linear-gradient(90deg, transparent, transparent 1px, rgba(255, 255, 255, 0.02) 1px, rgba(255, 255, 255, 0.02) 2px),
              linear-gradient(180deg, rgba(35, 32, 28, 0.95) 0%, rgba(25, 22, 18, 0.98) 100%);
            border-bottom: 2px solid rgba(120, 90, 50, 0.35);
          }
          .intake-title {
            display: flex;
            align-items: center;
            gap: 10px;
            font-family: 'Smooch Sans', system-ui, sans-serif;
            letter-spacing: 0.12em;
            text-transform: uppercase;
            /* Amber glow text */
            color: #FFB850;
            font-size: 20px;
            text-shadow: none;
          }
          .intake-badge {
            font-size: 10px;
            padding: 2px 8px;
            border-radius: 999px;
            background: rgba(139, 90, 43, 0.3);
            border: 1px solid rgba(200, 160, 80, 0.5);
            color: #FFD080;
          }
          .intake-close {
            width: 36px;
            height: 36px;
            border-radius: 12px;
            background: linear-gradient(180deg, #2a2725 0%, #1a1816 100%);
            border: 2px solid rgba(100, 80, 50, 0.5);
            color: rgba(255, 200, 140, 0.8);
            display: flex;
            align-items: center;
            justify-content: center;
            transition: all 0.2s;
          }
          .intake-close:hover {
            border-color: rgba(200, 160, 80, 0.6);
            color: #FFD080;
          }
          .intake-modes {
            display: grid;
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 8px;
            padding: 12px 16px;
            /* Wood bezel frame */
            background: 
              radial-gradient(ellipse 60% 40% at 30% 30%, rgba(120, 70, 30, 0.2) 0%, transparent 50%),
              linear-gradient(90deg, #5C3A1E 0%, #7A4F2A 50%, #6B4324 100%);
            margin: 12px;
            border-radius: 14px;
            box-shadow: 
              inset 0 2px 4px rgba(255, 200, 140, 0.1),
              inset 0 -2px 4px rgba(0, 0, 0, 0.3),
              0 4px 12px rgba(0, 0, 0, 0.3);
          }
          .intake-mode {
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 8px;
            padding: 12px 14px;
            border-radius: 10px;
            /* Gauge face */
            background: 
              radial-gradient(circle at 50% 30%, rgba(50, 45, 40, 0.5) 0%, transparent 50%),
              linear-gradient(180deg, #252220 0%, #1a1816 100%);
            border: 2px solid rgba(80, 60, 40, 0.5);
            color: rgba(255, 200, 140, 0.8);
            font-size: 12px;
            font-weight: 600;
            letter-spacing: 0.08em;
            text-transform: uppercase;
            transition: all 0.25s;
            box-shadow: 
              inset 0 1px 2px rgba(255, 200, 140, 0.05),
              inset 0 -1px 2px rgba(0, 0, 0, 0.3);
          }
          .intake-mode.active {
            border-color: rgba(200, 160, 80, 0.6);
            color: #FFD080;
            text-shadow: none;
            box-shadow: 
              inset 0 1px 2px rgba(255, 200, 140, 0.1),
              inset 0 -1px 2px rgba(0, 0, 0, 0.3),
              0 0 15px rgba(200, 160, 80, 0.2);
          }
          .intake-body {
            flex: 1;
            overflow-y: auto;
            padding: 16px;
          }
          .intake-license-panel {
            display: flex;
            flex-direction: column;
            gap: 16px;
          }
          .intake-copy {
            color: rgba(255, 200, 140, 0.7);
            font-size: 14px;
          }
          .intake-open-license-btn {
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 8px;
            padding: 14px 20px;
            border-radius: 12px;
            background: linear-gradient(180deg, #2a2725 0%, #1a1816 100%);
            border: 2px solid rgba(100, 80, 50, 0.5);
            color: #FFB850;
            font-size: 14px;
            font-weight: 600;
            text-shadow: 0 0 8px rgba(255, 180, 80, 0.4);
            box-shadow: 
              inset 0 1px 2px rgba(255, 200, 140, 0.08),
              0 3px 10px rgba(0, 0, 0, 0.3);
            transition: all 0.25s;
          }
          .intake-open-license-btn:hover {
            border-color: rgba(200, 160, 80, 0.6);
            color: #FFD080;
            transform: translateY(-2px);
            box-shadow: 
              inset 0 1px 2px rgba(255, 200, 140, 0.12),
              0 6px 16px rgba(0, 0, 0, 0.4),
              0 0 15px rgba(200, 160, 80, 0.15);
          }
          .vin-panel {
            padding: 0;
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
            color: rgba(255, 200, 140, 0.7);
            margin-bottom: 4px;
          }
          .vin-input, .vin-mileage-input {
            padding: 12px 14px;
            border-radius: 10px;
            border: 2px solid rgba(80, 60, 40, 0.5);
            background: linear-gradient(180deg, rgba(15, 13, 12, 0.95) 0%, rgba(20, 18, 16, 0.98) 100%);
            color: #FFB850;
            font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
            font-size: 13px;
            font-weight: 600;
            text-shadow: 0 0 8px rgba(255, 180, 80, 0.4);
            box-shadow: inset 0 2px 6px rgba(0, 0, 0, 0.4);
          }
          .vin-input:focus, .vin-mileage-input:focus {
            outline: none;
            border-color: rgba(200, 160, 80, 0.6);
            box-shadow: inset 0 2px 6px rgba(0, 0, 0, 0.3), 0 0 12px rgba(200, 160, 80, 0.15);
          }
          .vin-status {
            font-size: 11px;
            padding-left: 2px;
          }
          .vin-status.valid {
            color: #4ade80;
            text-shadow: 0 0 8px rgba(74, 222, 128, 0.4);
          }
          .vin-status.error {
            color: #f97373;
          }
          .vin-decode-btn {
            margin-top: 4px;
            padding: 12px 16px;
            border-radius: 10px;
            border: 2px solid rgba(74, 222, 128, 0.5);
            background: linear-gradient(180deg, rgba(34, 197, 94, 0.2) 0%, rgba(22, 163, 74, 0.3) 100%);
            color: #4ade80;
            font-size: 13px;
            font-weight: 600;
            text-shadow: 0 0 8px rgba(74, 222, 128, 0.4);
            transition: all 0.25s;
          }
          .vin-decode-btn:hover:not(:disabled) {
            border-color: rgba(74, 222, 128, 0.7);
            box-shadow: 0 0 15px rgba(74, 222, 128, 0.2);
            transform: translateY(-2px);
          }
          .vin-decode-btn:disabled {
            opacity: 0.5;
          }
          .vin-inventory-header {
            margin-top: 16px;
            display: flex;
            align-items: center;
            justify-content: space-between;
            font-size: 12px;
            color: rgba(255, 200, 140, 0.7);
            text-transform: uppercase;
            letter-spacing: 0.08em;
          }
          .vin-inventory-count {
            font-variant-numeric: tabular-nums;
            color: #FFB850;
          }
          .vin-empty {
            margin-top: 8px;
            padding: 12px 14px;
            border-radius: 10px;
            background: rgba(20, 18, 16, 0.8);
            border: 1px dashed rgba(100, 80, 50, 0.5);
            font-size: 12px;
            color: rgba(255, 200, 140, 0.5);
          }
          .vin-list {
            margin-top: 8px;
            max-height: 180px;
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
            border-radius: 10px;
            background: linear-gradient(180deg, #1f1d1b 0%, #151311 100%);
            border: 2px solid rgba(80, 60, 40, 0.4);
            color: rgba(255, 200, 140, 0.9);
            font-size: 12px;
            transition: all 0.2s;
          }
          .vin-item:hover {
            border-color: rgba(200, 160, 80, 0.5);
          }
          .vin-item.selected {
            border-color: rgba(200, 160, 80, 0.7);
            box-shadow: 0 0 15px rgba(200, 160, 80, 0.2);
          }
          .vin-main {
            display: flex;
            flex-direction: column;
            gap: 2px;
          }
          .vin-title {
            font-weight: 600;
            color: #FFD080;
          }
          .vin-sub {
            font-family: ui-monospace, monospace;
            font-size: 11px;
            color: rgba(255, 200, 140, 0.6);
          }
          .vin-mileage {
            font-size: 11px;
            color: #FFB850;
          }
          .vin-eject-btn {
            margin-top: 12px;
            padding: 12px 14px;
            border-radius: 10px;
            border: 2px solid rgba(220, 80, 80, 0.5);
            background: linear-gradient(180deg, rgba(220, 80, 80, 0.15) 0%, rgba(180, 60, 60, 0.25) 100%);
            color: #f87171;
            font-size: 13px;
            font-weight: 600;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 8px;
            text-shadow: 0 0 8px rgba(248, 113, 113, 0.4);
            transition: all 0.25s;
          }
          .vin-eject-btn:hover:not(:disabled) {
            border-color: rgba(248, 113, 113, 0.7);
            box-shadow: 0 0 15px rgba(248, 113, 113, 0.2);
            transform: translateY(-2px);
          }
          .vin-eject-btn:disabled {
            opacity: 0.5;
          }
          .vin-warning {
            margin-top: 12px;
            display: flex;
            align-items: center;
            gap: 8px;
            font-size: 11px;
            color: #fbbf24;
            padding: 10px 12px;
            border-radius: 8px;
            background: rgba(251, 191, 36, 0.1);
            border: 1px solid rgba(251, 191, 36, 0.3);
          }
          
          /* Light mode */
          html:not(.dark) .intake-modal {
            background:
              radial-gradient(ellipse 180% 90% at 5% 35%, rgba(180, 100, 120, 0.08) 0%, transparent 55%),
              radial-gradient(ellipse 140% 100% at 95% 65%, rgba(100, 140, 100, 0.06) 0%, transparent 55%),
              repeating-linear-gradient(45deg, transparent, transparent 22px, rgba(180, 150, 100, 0.03) 22px, rgba(180, 150, 100, 0.03) 23px),
              repeating-linear-gradient(-45deg, transparent, transparent 22px, rgba(180, 150, 100, 0.03) 22px, rgba(180, 150, 100, 0.03) 23px),
              linear-gradient(165deg, #FDFAF5 0%, #F5EFE5 50%, #FAF7F2 100%);
            border-image: linear-gradient(135deg, #C9A86C 0%, #DFC08A 25%, #CAAD72 50%, #D8BB82 75%, #C9A86C 100%) 1;
            box-shadow:
              0 0 0 1px rgba(200, 170, 120, 0.4),
              0 30px 60px rgba(0,0,0,0.15);
          }
          html:not(.dark) .intake-header {
            background: 
              repeating-linear-gradient(90deg, transparent, transparent 1px, rgba(255, 255, 255, 0.25) 1px, rgba(255, 255, 255, 0.25) 2px),
              linear-gradient(180deg, #F5F0E8 0%, #EDE5D8 100%);
            border-bottom-color: rgba(200, 170, 120, 0.3);
          }
          html:not(.dark) .intake-title {
            color: #5C3A1E;
            text-shadow: none;
          }
          html:not(.dark) .intake-badge {
            background: rgba(139, 90, 43, 0.15);
            border-color: rgba(180, 140, 80, 0.4);
            color: #6B4324;
          }
          html:not(.dark) .intake-close {
            background: linear-gradient(180deg, #FAF7F2 0%, #F0EBE2 100%);
            border-color: rgba(180, 150, 100, 0.4);
            color: #6B4324;
          }
          html:not(.dark) .intake-modes {
            background: 
              radial-gradient(circle 3px at 20% 30%, rgba(200, 160, 100, 0.3) 0%, transparent 100%),
              radial-gradient(circle 2px at 80% 70%, rgba(190, 150, 95, 0.25) 0%, transparent 100%),
              linear-gradient(90deg, #C9A86C 0%, #DFC08A 50%, #CAAD72 100%);
          }
          html:not(.dark) .intake-mode {
            background: linear-gradient(180deg, #FAF7F2 0%, #F0EBE2 100%);
            border-color: rgba(180, 150, 100, 0.4);
            color: #5C3A1E;
          }
          html:not(.dark) .intake-mode.active {
            border-color: rgba(180, 140, 80, 0.6);
            color: #4A2E15;
            text-shadow: none;
          }
          html:not(.dark) .intake-copy {
            color: #6B4324;
          }
          html:not(.dark) .intake-open-license-btn {
            background: linear-gradient(180deg, #FAF7F2 0%, #F0EBE2 100%);
            border-color: rgba(180, 150, 100, 0.4);
            color: #5C3A1E;
            text-shadow: none;
          }
          html:not(.dark) .vin-input-row label {
            color: #8B6914;
          }
          html:not(.dark) .vin-input, html:not(.dark) .vin-mileage-input {
            background: linear-gradient(180deg, #F5F0E8 0%, #EDE5D8 100%);
            border-color: rgba(180, 150, 100, 0.4);
            color: #5C3A1E;
            text-shadow: none;
          }
          html:not(.dark) .vin-inventory-header {
            color: #8B6914;
          }
          html:not(.dark) .vin-inventory-count {
            color: #5C3A1E;
          }
          html:not(.dark) .vin-empty {
            background: #F5F0E8;
            border-color: rgba(180, 150, 100, 0.4);
            color: #8B6914;
          }
          html:not(.dark) .vin-item {
            background: linear-gradient(180deg, #FFFFFF 0%, #FAF7F2 100%);
            border-color: rgba(180, 150, 100, 0.35);
            color: #5C3A1E;
          }
          html:not(.dark) .vin-title {
            color: #4A2E15;
          }
          html:not(.dark) .vin-sub {
            color: #8B6914;
          }
          html:not(.dark) .vin-mileage {
            color: #5C3A1E;
          }
        `}</style>
      </div>
    </div>
  );
};

export default IntakeHub;

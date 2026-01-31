import React, { useCallback, useMemo, useState } from 'react';
import { X, Plus, Trash2, Loader2, Camera } from 'lucide-react';
import { toast } from 'sonner';
import { validateVIN } from '../utils/enterprise';
import { useSales } from '../context/SalesContext';
import VinWindshieldScanner from './VinWindshieldScanner';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || window.location.origin;

// Batch VIN scan mode:
// - fast entry (manual or camera OCR)
// - decode each
// - save all to Local Inventory (as requested)
const BatchVinScanModal = ({ isOpen, onClose }) => {
  const { vehicleInventory, setVehicleInventory } = useSales();

  const [vinInput, setVinInput] = useState('');
  const [queue, setQueue] = useState([]); // { vin, status, vehicle?, error? }
  const [processing, setProcessing] = useState(false);
  const [scannerOpen, setScannerOpen] = useState(false);

  const existingSet = useMemo(() => {
    const inv = Array.isArray(vehicleInventory) ? vehicleInventory : [];
    return new Set(inv.map((v) => v?.vin).filter(Boolean));
  }, [vehicleInventory]);

  const addToQueue = useCallback(
    (raw) => {
      const clean = String(raw || '')
        .toUpperCase()
        .replace(/[^A-HJ-NPR-Z0-9]/g, '')
        .slice(0, 17);

      const { valid, message } = validateVIN(clean);
      if (!valid) {
        toast.error('Invalid VIN', { description: message || clean });
        return;
      }

      setQueue((prev) => {
        if (prev.some((q) => q.vin === clean)) return prev;
        if (existingSet.has(clean)) {
          toast.info('Already in Local Inventory', { description: clean });
          return prev;
        }
        return [...prev, { vin: clean, status: 'queued' }];
      });

      setVinInput('');
    },
    [existingSet]
  );

  const removeFromQueue = useCallback((vin) => {
    setQueue((prev) => prev.filter((q) => q.vin !== vin));
  }, []);

  const decodeAndSaveAll = useCallback(async () => {
    if (queue.length === 0) return;

    setProcessing(true);
    try {
      // decode sequentially to be kinder to NHTSA + keep UI deterministic
      const decodedVehicles = [];

      for (const item of queue) {
        setQueue((prev) => prev.map((q) => (q.vin === item.vin ? { ...q, status: 'decoding' } : q)));

        try {
          const res = await fetch(`${BACKEND_URL}/api/vin/decode/${item.vin}`);
          if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new Error(err.detail || 'VIN decode failed');
          }
          const data = await res.json();

          const vehicle = {
            id: `${Date.now()}-${item.vin}`,
            vin: item.vin,
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
            current_mileage: null,
            createdAt: new Date().toISOString(),
            source: 'batch_vin_scan',
          };

          decodedVehicles.push(vehicle);

          setQueue((prev) =>
            prev.map((q) => (q.vin === item.vin ? { ...q, status: 'done', vehicle } : q))
          );
        } catch (e) {
          setQueue((prev) => prev.map((q) => (q.vin === item.vin ? { ...q, status: 'error', error: e.message } : q)));
        }
      }

      if (decodedVehicles.length > 0) {
        const inv = Array.isArray(vehicleInventory) ? vehicleInventory : [];
        setVehicleInventory([...
          inv,
          ...decodedVehicles,
        ]);

        toast.success('Saved to Local Inventory', { description: `${decodedVehicles.length} vehicle(s)` });
      }

      const errors = queue.filter((q) => q.status === 'error').length;
      if (errors > 0) {
        toast.error('Some VINs failed', { description: `${errors} error(s)` });
      }
    } finally {
      setProcessing(false);
    }
  }, [queue, vehicleInventory, setVehicleInventory]);

  if (!isOpen) return null;

  return (
    <div className="bvin-overlay" onClick={onClose} role="dialog" aria-modal="true">
      <div className="bvin-modal" onClick={(e) => e.stopPropagation()}>
        <div className="bvin-header">
          <div className="bvin-title">
            <span>Batch VIN Scan</span>
            <span className="bvin-badge">{queue.length}</span>
          </div>
          <button className="bvin-close" onClick={onClose} aria-label="Close batch VIN scan">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="bvin-body">
          <div className="bvin-add">
            <input
              value={vinInput}
              onChange={(e) => setVinInput(e.target.value)}
              placeholder="Enter VIN"
              className="bvin-input"
              maxLength={32}
            />
            <button className="bvin-btn" onClick={() => addToQueue(vinInput)} disabled={processing}>
              <Plus className="w-4 h-4" />
              Add
            </button>
            <button className="bvin-btn-secondary" onClick={() => setScannerOpen(true)} disabled={processing}>
              <Camera className="w-4 h-4" />
              Scan
            </button>
          </div>

          {queue.length === 0 ? (
            <div className="bvin-empty">Add VINs manually or use Scan to OCR from the windshield plate.</div>
          ) : (
            <div className="bvin-list">
              {queue.map((q) => (
                <div key={q.vin} className={`bvin-item ${q.status}`}>
                  <div className="bvin-vin">{q.vin}</div>
                  <div className="bvin-status">
                    {q.status === 'queued' && 'Queued'}
                    {q.status === 'decoding' && (
                      <span className="bvin-decoding"><Loader2 className="w-4 h-4 animate-spin" /> Decoding</span>
                    )}
                    {q.status === 'done' && (
                      <span className="bvin-done">Saved: {`${q.vehicle?.year || ''} ${q.vehicle?.make || ''} ${q.vehicle?.model || ''}`.trim()}</span>
                    )}
                    {q.status === 'error' && <span className="bvin-error">{q.error || 'Failed'}</span>}
                  </div>
                  <button className="bvin-remove" onClick={() => removeFromQueue(q.vin)} aria-label={`Remove ${q.vin}`}>
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="bvin-actions">
            <button className="bvin-primary" onClick={decodeAndSaveAll} disabled={processing || queue.length === 0}>
              {processing ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Decode & Save All'}
            </button>
          </div>
        </div>

        <VinWindshieldScanner
          isOpen={scannerOpen}
          onClose={() => setScannerOpen(false)}
          onVinDetected={(vin) => {
            addToQueue(vin);
            setScannerOpen(false);
          }}
        />

        <style>{`
          .bvin-overlay {
            position: fixed;
            inset: 0;
            z-index: 150;
            background: rgba(0,0,0,0.86);
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 16px;
            padding-top: env(safe-area-inset-top, 16px);
            padding-bottom: env(safe-area-inset-bottom, 16px);
          }

          .bvin-modal {
            width: 100%;
            max-width: 720px;
            max-height: 85dvh;
            border-radius: 22px;
            overflow: hidden;
            border: 1px solid rgba(0, 170, 255, 0.22);
            background:
              radial-gradient(ellipse 140% 120% at 20% 10%, rgba(0, 153, 255, 0.18) 0%, transparent 55%),
              linear-gradient(165deg, #141312 0%, #0b0a0a 60%, #121110 100%);
            box-shadow: 0 30px 80px rgba(0,0,0,0.55);
            display: flex;
            flex-direction: column;
          }

          .bvin-header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 14px;
            border-bottom: 1px solid rgba(255,255,255,0.08);
            background: rgba(0,0,0,0.25);
            backdrop-filter: blur(10px);
          }

          .bvin-title {
            display: flex;
            align-items: center;
            gap: 10px;
            font-weight: 900;
            letter-spacing: 0.4px;
            color: rgba(200, 240, 255, 0.92);
          }

          .bvin-badge {
            font-size: 11px;
            padding: 4px 8px;
            border-radius: 999px;
            background: rgba(0, 170, 255, 0.14);
            border: 1px solid rgba(0, 170, 255, 0.22);
            color: rgba(190, 240, 255, 0.92);
          }

          .bvin-close {
            width: 40px;
            height: 40px;
            border-radius: 12px;
            border: 1px solid rgba(255,255,255,0.10);
            background: rgba(255,255,255,0.06);
            color: rgba(255,255,255,0.85);
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
          }

          .bvin-body {
            padding: 14px;
            overflow: auto;
            display: flex;
            flex-direction: column;
            gap: 12px;
          }

          .bvin-add {
            display: grid;
            grid-template-columns: 1fr auto auto;
            gap: 10px;
            align-items: center;
          }

          .bvin-input {
            width: 100%;
            padding: 12px 14px;
            border-radius: 12px;
            border: 1px solid rgba(255,255,255,0.12);
            background: rgba(0,0,0,0.25);
            color: rgba(255,255,255,0.92);
            font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
            font-weight: 800;
            letter-spacing: 0.08em;
          }

          .bvin-btn {
            padding: 12px 14px;
            border-radius: 12px;
            border: 1px solid rgba(0, 170, 255, 0.22);
            background: rgba(0, 170, 255, 0.12);
            color: rgba(200, 240, 255, 0.92);
            font-weight: 900;
            display: inline-flex;
            align-items: center;
            gap: 8px;
          }

          .bvin-btn-secondary {
            padding: 12px 14px;
            border-radius: 12px;
            border: 1px solid rgba(255,255,255,0.14);
            background: rgba(255,255,255,0.06);
            color: rgba(255,255,255,0.88);
            font-weight: 850;
            display: inline-flex;
            align-items: center;
            gap: 8px;
          }

          .bvin-empty {
            padding: 14px;
            border-radius: 14px;
            background: rgba(255,255,255,0.04);
            border: 1px solid rgba(255,255,255,0.08);
            color: rgba(255,255,255,0.62);
            font-size: 13px;
            line-height: 1.3;
          }

          .bvin-list {
            display: flex;
            flex-direction: column;
            gap: 10px;
          }

          .bvin-item {
            padding: 12px;
            border-radius: 14px;
            background: rgba(255,255,255,0.03);
            border: 1px solid rgba(255,255,255,0.10);
            display: grid;
            grid-template-columns: 1fr auto;
            gap: 10px;
            align-items: center;
          }

          .bvin-vin {
            font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
            font-weight: 900;
            letter-spacing: 0.08em;
            color: rgba(255,255,255,0.92);
            font-size: 13px;
          }

          .bvin-status {
            margin-top: 6px;
            color: rgba(255,255,255,0.70);
            font-size: 12px;
          }

          .bvin-decoding {
            display: inline-flex;
            align-items: center;
            gap: 8px;
          }

          .bvin-done {
            color: rgba(74, 222, 128, 0.92);
          }

          .bvin-error {
            color: rgba(248, 113, 113, 0.92);
          }

          .bvin-remove {
            width: 38px;
            height: 38px;
            border-radius: 12px;
            border: 1px solid rgba(255,255,255,0.10);
            background: rgba(0,0,0,0.22);
            color: rgba(255,255,255,0.80);
            display: flex;
            align-items: center;
            justify-content: center;
          }

          .bvin-actions {
            display: flex;
          }

          .bvin-primary {
            width: 100%;
            padding: 12px 14px;
            border-radius: 14px;
            border: 1px solid rgba(0, 170, 255, 0.28);
            background: rgba(0, 170, 255, 0.12);
            color: rgba(200, 240, 255, 0.92);
            font-weight: 950;
            font-size: 13px;
            display: inline-flex;
            justify-content: center;
            gap: 10px;
            align-items: center;
          }

          .bvin-primary:disabled {
            opacity: 0.55;
          }

          @media (max-width: 520px) {
            .bvin-add {
              grid-template-columns: 1fr;
            }
            .bvin-btn, .bvin-btn-secondary {
              width: 100%;
              justify-content: center;
            }
          }
        `}</style>
      </div>
    </div>
  );
};

export default BatchVinScanModal;

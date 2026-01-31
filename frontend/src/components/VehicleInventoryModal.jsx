import React, { memo, useMemo } from 'react';
import { X, Car, Hash, Calendar, Gauge } from 'lucide-react';
import { useSales } from '../context/SalesContext';

const VehicleInventoryModal = ({ isOpen, onClose }) => {
  const { vehicleInventory } = useSales();

  const inventory = useMemo(() => {
    const list = Array.isArray(vehicleInventory) ? vehicleInventory : [];
    return [...list].sort((a, b) => (b?.createdAt || '').localeCompare(a?.createdAt || ''));
  }, [vehicleInventory]);

  if (!isOpen) return null;

  return (
    <div className="inventory-overlay" onClick={onClose} role="dialog" aria-modal="true">
      <div className="inventory-modal" onClick={(e) => e.stopPropagation()}>
        <div className="inventory-header">
          <div className="inventory-title">
            <Car className="w-5 h-5" />
            <span>Local Inventory</span>
            <span className="inventory-badge">{inventory.length}</span>
          </div>
          <button className="inventory-close" onClick={onClose} aria-label="Close Inventory">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="inventory-body">
          {inventory.length === 0 ? (
            <div className="inventory-empty">
              <p className="inventory-empty-title">No vehicles saved yet</p>
              <p className="inventory-empty-sub">Use INTAKE → VIN to decode and save vehicles locally.</p>
            </div>
          ) : (
            <div className="inventory-list">
              {inventory.map((v) => (
                <div key={v.id} className="inventory-item">
                  <div className="inventory-item-main">
                    <div className="inventory-item-name">
                      {`${v.year || ''} ${v.make || ''} ${v.model || ''}`.trim() || 'Vehicle'}
                    </div>
                    <div className="inventory-item-meta">
                      <span className="inventory-meta-chip">
                        <Hash className="w-3 h-3" />
                        {v.vin}
                      </span>
                      {typeof v.current_mileage === 'number' && (
                        <span className="inventory-meta-chip">
                          <Gauge className="w-3 h-3" />
                          {v.current_mileage.toLocaleString()} mi
                        </span>
                      )}
                      {v.createdAt && (
                        <span className="inventory-meta-chip">
                          <Calendar className="w-3 h-3" />
                          {new Date(v.createdAt).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <style>{`
          .inventory-overlay {
            position: fixed;
            inset: 0;
            z-index: 120;
            background: rgba(0,0,0,0.82);
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 16px;
            padding-top: env(safe-area-inset-top, 16px);
            padding-bottom: env(safe-area-inset-bottom, 16px);
          }

          .inventory-modal {
            width: 100%;
            max-width: 780px;
            height: min(86dvh, 720px);
            overflow: hidden;
            border-radius: 22px;
            background:
              radial-gradient(ellipse 140% 100% at 20% 10%, rgba(0, 153, 255, 0.18) 0%, transparent 55%),
              linear-gradient(165deg, #141312 0%, #0b0a0a 60%, #121110 100%);
            border: 1px solid rgba(0, 170, 255, 0.22);
            box-shadow: 0 30px 80px rgba(0,0,0,0.55);
            display: flex;
            flex-direction: column;
          }

          @media (max-width: 520px) {
            .inventory-overlay {
              align-items: flex-end;
              padding: 0;
              padding-bottom: env(safe-area-inset-bottom, 0px);
            }

            .inventory-modal {
              max-width: 100%;
              width: 100%;
              height: 86dvh;
              border-radius: 24px 24px 0 0;
              border-left: none;
              border-right: none;
              border-bottom: none;
            }

            .inventory-header {
              padding-top: calc(14px + env(safe-area-inset-top, 0px));
            }
          }

          .inventory-header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 14px 14px;
            border-bottom: 1px solid rgba(255,255,255,0.08);
          }

          .inventory-title {
            display: flex;
            align-items: center;
            gap: 10px;
            font-weight: 800;
            letter-spacing: 0.4px;
            color: rgba(180, 230, 255, 0.92);
          }

          .inventory-badge {
            font-size: 11px;
            padding: 4px 8px;
            border-radius: 999px;
            background: rgba(0, 170, 255, 0.14);
            border: 1px solid rgba(0, 170, 255, 0.22);
            color: rgba(190, 240, 255, 0.92);
          }

          .inventory-close {
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

          .inventory-body {
            padding: 14px;
            overflow: auto;
          }

          .inventory-empty {
            padding: 18px;
            border-radius: 16px;
            background: rgba(255,255,255,0.04);
            border: 1px solid rgba(255,255,255,0.08);
          }

          .inventory-empty-title {
            margin: 0;
            font-weight: 800;
            font-size: 14px;
            color: rgba(255,255,255,0.92);
          }

          .inventory-empty-sub {
            margin: 8px 0 0;
            font-size: 12px;
            color: rgba(255,255,255,0.62);
            line-height: 1.35;
          }

          .inventory-list {
            display: flex;
            flex-direction: column;
            gap: 10px;
          }

          .inventory-item {
            padding: 12px 12px;
            border-radius: 16px;
            background:
              radial-gradient(ellipse 140% 120% at 10% 20%, rgba(0, 170, 255, 0.10) 0%, transparent 60%),
              rgba(255,255,255,0.03);
            border: 1px solid rgba(255,255,255,0.10);
            box-shadow: inset 0 1px 0 rgba(255,255,255,0.04);
          }

          .inventory-item-name {
            font-weight: 850;
            font-size: 13px;
            color: rgba(255,255,255,0.92);
            margin-bottom: 8px;
          }

          .inventory-item-meta {
            display: flex;
            flex-wrap: wrap;
            gap: 8px;
          }

          .inventory-meta-chip {
            display: inline-flex;
            align-items: center;
            gap: 6px;
            padding: 6px 10px;
            border-radius: 999px;
            background: rgba(0,0,0,0.20);
            border: 1px solid rgba(255,255,255,0.10);
            color: rgba(255,255,255,0.72);
            font-size: 11px;
          }
        `}</style>
      </div>
    </div>
  );
};

VehicleInventoryModal.displayName = 'VehicleInventoryModal';

export default memo(VehicleInventoryModal);

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { X, User, Phone, Mail, Tag, MessageSquare, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import haptics from '../utils/haptics';
import { announceToScreenReader, createFocusTrap } from '../utils/accessibility';
import { useSales } from '../context/SalesContext';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || window.location.origin;

/**
 * Enterprise-Grade Quick Add Customer Button
 * Features:
 * - Haptic feedback
 * - Form validation with error messages
 * - Accessibility support
 * - Liquid glass modal design
 * - Loading and success states
 */
export const QuickAddButton = () => {
  const { setCustomers } = useSales();
  const [isOpen, setIsOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [errors, setErrors] = useState({});
  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    phone: '',
    email: '',
    policy_number: '',
    vehicle_vin: '',
    trade_vin: '',
    trade_mileage: '',
    lead_source: 'walk_in',
    notes: ''
  });
  
  const modalRef = useRef(null);
  const firstInputRef = useRef(null);

  // Focus trap and cleanup
  useEffect(() => {
    if (isOpen) {
      const cleanup = createFocusTrap(modalRef);
      document.body.style.overflow = 'hidden';
      
      // Focus first input
      setTimeout(() => firstInputRef.current?.focus(), 100);
      
      return () => {
        cleanup();
        document.body.style.overflow = '';
      };
    }
  }, [isOpen]);

  const handleClose = useCallback(() => {
    if (saving) return;
    haptics.tap();
    setIsOpen(false);
    setSaved(false);
    setErrors({});
    setFormData({
      first_name: '',
      last_name: '',
      phone: '',
      email: '',
      policy_number: '',
      vehicle_vin: '',
      trade_vin: '',
      trade_mileage: '',
      lead_source: 'walk_in',
      notes: ''
    });
  }, [saving]);

  // Handle escape key
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape' && isOpen && !saving) {
        handleClose();
      }
    };
    
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, saving, handleClose]);

  const handleOpen = () => {
    haptics.button();
    setIsOpen(true);
    announceToScreenReader('Quick add customer form opened');
  };

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: null }));
    }
  };

  const validateForm = () => {
    const newErrors = {};
    
    if (!formData.first_name.trim()) {
      newErrors.first_name = 'First name is required';
    }
    
    if (formData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Invalid email format';
    }
    
    if (formData.phone && !/^[\d\s\-\(\)\+]+$/.test(formData.phone)) {
      newErrors.phone = 'Invalid phone format';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = async () => {
    if (!validateForm()) {
      haptics.error();
      announceToScreenReader('Please fix the form errors');
      return;
    }
    
    setSaving(true);
    haptics.button();
    
    try {
      // Build trade-in object if trade VIN provided
      let tradeVehicle = null;
      if (formData.trade_vin.trim()) {
        tradeVehicle = {
          vin: formData.trade_vin.trim(),
          mileage: formData.trade_mileage.trim() ? parseInt(formData.trade_mileage.replace(/,/g, '')) : null
        };
      }

      const res = await fetch(`${BACKEND_URL}/api/customers/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          first_name: formData.first_name,
          last_name: formData.last_name,
          phone: formData.phone,
          email: formData.email,
          policy_number: formData.policy_number.trim() || null,
          vehicle_of_interest: formData.vehicle_vin.trim() || null,
          trade_vehicle: tradeVehicle,
          lead_source: formData.lead_source,
          notes: formData.notes,
          lead_status: 'new'
        })
      });
      
      if (res.ok) {
        // Immediately refresh global customer list so the new customer appears everywhere
        try {
          // Refresh using the primary customers endpoint (returns frontend-friendly shape)
          const listRes = await fetch(`${BACKEND_URL}/api/customers?limit=200`);
          const listData = await listRes.json();
          setCustomers(listData.customers || []);
        } catch {
          // If refresh fails, still allow close
        }

        haptics.success();
        // Play subtle success chime for new customer
        import('../utils/notificationSound').then(mod => {
          mod.playCustomerAddedSound?.();
        }).catch(() => {});
        setSaved(true);
        announceToScreenReader('Customer added successfully');
        
        setTimeout(() => {
          handleClose();
        }, 1500);
      } else {
        throw new Error('Failed to save');
      }
    } catch {
      haptics.error();
      setErrors({ submit: 'Failed to save customer. Please try again.' });
      announceToScreenReader('Failed to save customer');
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      {/* Floating Bluetooth-style Button */}
      <button 
        className="quick-add-fab"
        onClick={handleOpen}
        data-testid="quick-add-btn"
        title="Quick Add Customer"
        aria-label="Quick add new customer"
      >
        {/* User Plus Icon - Luxury Amber Style */}
        <svg viewBox="0 0 24 24" className="bluetooth-icon" aria-hidden="true">
          <defs>
            <linearGradient id="btGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#FFB347" />
              <stop offset="50%" stopColor="#FF9F43" />
              <stop offset="100%" stopColor="#E67E22" />
            </linearGradient>
            <filter id="btGlow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="1" result="glow"/>
              <feMerge>
                <feMergeNode in="glow"/>
                <feMergeNode in="SourceGraphic"/>
              </feMerge>
            </filter>
          </defs>
          {/* User Plus icon shape */}
          <circle cx="10" cy="8" r="4" fill="url(#btGradient)" filter="url(#btGlow)" />
          <path 
            d="M10 14C5.58 14 2 16.24 2 19V20H15V19C15 16.24 13.42 14 10 14Z"
            fill="url(#btGradient)"
            filter="url(#btGlow)"
          />
          <path 
            d="M19 10H21V13H24V15H21V18H19V15H16V13H19V10Z"
            fill="url(#btGradient)"
            filter="url(#btGlow)"
          />
        </svg>
        <span className="fab-pulse" aria-hidden="true"></span>
      </button>

      {/* Quick Add Modal */}
      {isOpen && createPortal(
        <div 
          className="quick-add-overlay" 
          onClick={handleClose}
          role="presentation"
        >
          <div 
            ref={modalRef}
            className="quick-add-modal" 
            onClick={e => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="quick-add-title"
          >
            <div className="quick-add-header">
              <div className="qa-icon">
                <User className="w-5 h-5" />
              </div>
              <h3 id="quick-add-title">Quick Add Customer</h3>
              <button 
                onClick={handleClose} 
                className="qa-close"
                disabled={saving}
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {saved ? (
              <div className="quick-add-success" role="alert">
                <CheckCircle2 className="w-12 h-12" />
                <span>Customer Added!</span>
              </div>
            ) : (
              <div className="quick-add-form">
                {errors.submit && (
                  <div className="qa-error-banner" role="alert">
                    <AlertCircle className="w-4 h-4" />
                    {errors.submit}
                  </div>
                )}

                <div className="qa-row">
                  <div className="qa-field">
                    <label htmlFor="qa-first-name">
                      <User className="w-3 h-3" /> First Name *
                    </label>
                    <input 
                      ref={firstInputRef}
                      id="qa-first-name"
                      type="text"
                      inputMode="text"
                      placeholder="John"
                      value={formData.first_name}
                      onChange={e => handleChange('first_name', e.target.value)}
                      className={errors.first_name ? 'error' : ''}
                      aria-invalid={!!errors.first_name}
                      aria-describedby={errors.first_name ? 'fn-error' : undefined}
                    />
                    {errors.first_name && (
                      <span id="fn-error" className="qa-error">{errors.first_name}</span>
                    )}
                  </div>
                  <div className="qa-field">
                    <label htmlFor="qa-last-name">Last Name</label>
                    <input 
                      id="qa-last-name"
                      type="text"
                      inputMode="text"
                      placeholder="Smith"
                      value={formData.last_name}
                      onChange={e => handleChange('last_name', e.target.value)}
                    />
                  </div>
                </div>

                <div className="qa-field">
                  <label htmlFor="qa-phone">
                    <Phone className="w-3 h-3" /> Phone
                  </label>
                  <input 
                    id="qa-phone"
                    type="tel"
                    inputMode="tel"
                    placeholder="555-123-4567"
                    value={formData.phone}
                    onChange={e => handleChange('phone', e.target.value)}
                    className={errors.phone ? 'error' : ''}
                    aria-invalid={!!errors.phone}
                    aria-describedby={errors.phone ? 'phone-error' : undefined}
                  />
                  {errors.phone && (
                    <span id="phone-error" className="qa-error">{errors.phone}</span>
                  )}
                </div>

                <div className="qa-field">
                  <label htmlFor="qa-email">
                    <Mail className="w-3 h-3" /> Email
                  </label>
                  <input 
                    id="qa-email"
                    type="email"
                    inputMode="email"
                    placeholder="john@example.com"
                    value={formData.email}
                    onChange={e => handleChange('email', e.target.value)}
                    className={errors.email ? 'error' : ''}
                    aria-invalid={!!errors.email}
                    aria-describedby={errors.email ? 'email-error' : undefined}
                  />
                  {errors.email && (
                    <span id="email-error" className="qa-error">{errors.email}</span>
                  )}
                </div>

                <div className="qa-field">
                  <label htmlFor="qa-policy">
                    <Tag className="w-3 h-3" /> Policy #
                  </label>
                  <input 
                    id="qa-policy"
                    type="text"
                    placeholder="POL-123456"
                    value={formData.policy_number}
                    onChange={e => handleChange('policy_number', e.target.value)}
                  />
                </div>

                <div className="qa-field">
                  <label htmlFor="qa-vehicle-vin">Vehicle of Interest (VIN)</label>
                  <input 
                    id="qa-vehicle-vin"
                    type="text"
                    placeholder="1HGCM82633A123456"
                    value={formData.vehicle_vin}
                    onChange={e => handleChange('vehicle_vin', e.target.value.toUpperCase())}
                    maxLength={17}
                    className="font-mono uppercase"
                  />
                </div>

                {/* Trade-In Section */}
                <div className="qa-trade-section">
                  <label className="qa-section-label">Trade-In Vehicle</label>
                  <div className="qa-field">
                    <label htmlFor="qa-trade-vin">Trade VIN</label>
                    <input 
                      id="qa-trade-vin"
                      type="text"
                      placeholder="5YJSA1E26HF123456"
                      value={formData.trade_vin}
                      onChange={e => handleChange('trade_vin', e.target.value.toUpperCase())}
                      maxLength={17}
                      className="font-mono uppercase"
                    />
                  </div>
                  <div className="qa-field">
                    <label htmlFor="qa-trade-mileage">Trade Mileage</label>
                    <input 
                      id="qa-trade-mileage"
                      type="text"
                      placeholder="45,000"
                      value={formData.trade_mileage}
                      onChange={e => handleChange('trade_mileage', e.target.value.replace(/[^\d,]/g, ''))}
                    />
                  </div>
                </div>

                <div className="qa-field">
                  <label htmlFor="qa-source">
                    <Tag className="w-3 h-3" /> Lead Source
                  </label>
                  <select 
                    id="qa-source"
                    value={formData.lead_source}
                    onChange={e => handleChange('lead_source', e.target.value)}
                  >
                    <option value="walk_in">Walk-In</option>
                    <option value="phone">Phone Call</option>
                    <option value="website">Website</option>
                    <option value="referral">Referral</option>
                    <option value="social">Social Media</option>
                    <option value="other">Other</option>
                  </select>
                </div>

                <div className="qa-field">
                  <label htmlFor="qa-notes">
                    <MessageSquare className="w-3 h-3" /> Quick Note
                  </label>
                  <textarea 
                    id="qa-notes"
                    placeholder="Looking for a family SUV..."
                    value={formData.notes}
                    onChange={e => handleChange('notes', e.target.value)}
                    rows={2}
                  />
                </div>

                <button 
                  className="qa-save-btn"
                  onClick={handleSave}
                  disabled={saving || !formData.first_name.trim()}
                  data-testid="quick-add-save"
                >
                  {saving ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    'Add Customer'
                  )}
                </button>
              </div>
            )}
          </div>
        </div>,
        document.body
      )}

      <style>{`
        /* Floating Action Button - Luxury Amber Style */
        .quick-add-fab {
          position: fixed;
          bottom: 90px;
          right: 20px;
          width: 56px;
          height: 56px;
          border-radius: 50%;
          background: linear-gradient(145deg, 
            rgba(255, 140, 0, 0.2) 0%, 
            rgba(200, 100, 0, 0.3) 100%
          );
          border: 2px solid rgba(255, 159, 67, 0.5);
          box-shadow: 
            0 4px 20px rgba(255, 140, 0, 0.25),
            0 0 30px rgba(255, 159, 67, 0.15),
            inset 0 1px 0 rgba(255,255,255,0.1);
          cursor: pointer;
          z-index: 50;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.3s ease;
          overflow: visible;
        }

        .quick-add-fab:hover {
          transform: scale(1.1);
          border-color: rgba(255, 180, 80, 0.7);
          box-shadow: 
            0 6px 30px rgba(255, 140, 0, 0.35),
            0 0 40px rgba(255, 159, 67, 0.25),
            inset 0 1px 0 rgba(255,255,255,0.2);
        }

        .quick-add-fab:active {
          transform: scale(0.95);
        }

        .quick-add-fab:focus-visible {
          outline: 2px solid #FF9F43;
          outline-offset: 3px;
        }

        .bluetooth-icon {
          width: 28px;
          height: 28px;
          filter: drop-shadow(0 0 4px rgba(255, 159, 67, 0.7));
        }

        .fab-pulse {
          position: absolute;
          inset: -4px;
          border-radius: 50%;
          border: 2px solid rgba(255, 159, 67, 0.35);
          animation: fabPulse 2s ease-out infinite;
        }

        @keyframes fabPulse {
          0% { transform: scale(1); opacity: 1; }
          100% { transform: scale(1.4); opacity: 0; }
        }

        /* Quick Add Modal - Luxury Infotainment */
        .quick-add-overlay {
          position: fixed;
          inset: 0;
          background: rgba(10, 8, 6, 0.94);
          backdrop-filter: blur(calc(16px - (var(--reduced-effects) * 8px)));
          z-index: 9999;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 16px;
          animation: fadeIn 0.2s ease;
        }

        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }

        .quick-add-modal {
          width: 100%;
          max-width: 360px;
          background: linear-gradient(180deg, 
            rgba(25, 20, 15, 0.95) 0%, 
            rgba(15, 12, 8, 0.98) 100%
          );
          backdrop-filter: blur(calc(24px - (var(--reduced-effects) * 12px))) saturate(calc(180% - (var(--reduced-effects) * 40%)));
          -webkit-backdrop-filter: blur(calc(24px - (var(--reduced-effects) * 12px))) saturate(calc(180% - (var(--reduced-effects) * 40%)));
          border-radius: 24px;
          border: 1px solid rgba(255, 140, 0, 0.2);
          box-shadow: 
            0 25px 50px rgba(0,0,0,0.5),
            0 0 60px rgba(255, 140, 0, 0.1),
            inset 0 1px 0 rgba(255,255,255,0.08),
            inset 0 0 30px rgba(255, 140, 0, 0.03);
          overflow: hidden;
          animation: slideUp 0.25s ease;
        }

        @keyframes slideUp {
          from { opacity: 0; transform: translateY(20px) scale(0.95); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }

        .quick-add-header {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 16px 20px;
          border-bottom: 1px solid rgba(255, 140, 0, 0.12);
          background: linear-gradient(180deg, rgba(255, 140, 0, 0.06) 0%, transparent 100%);
        }

        .qa-icon {
          width: 36px;
          height: 36px;
          border-radius: 10px;
          background: rgba(255, 159, 67, 0.15);
          border: 1px solid rgba(255, 159, 67, 0.3);
          display: flex;
          align-items: center;
          justify-content: center;
          color: #FF9F43;
        }

        .quick-add-header h3 {
          flex: 1;
          font-family: 'Bebas Neue', system-ui, sans-serif;
          font-size: 16px;
          font-weight: 400;
          letter-spacing: 0.08em;
          color: #FF9F43;
          margin: 0;
          text-shadow: 0 0 12px rgba(255, 159, 67, 0.4);
        }

        .qa-close {
          width: 32px;
          height: 32px;
          border-radius: 8px;
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.08);
          color: rgba(255, 200, 150, 0.5);
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.2s;
        }

        .qa-close:hover:not(:disabled) {
          background: rgba(255, 255, 255, 0.1);
          color: #fff;
        }

        .qa-close:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .quick-add-form {
          padding: 20px;
          display: flex;
          flex-direction: column;
          gap: 14px;
        }

        .qa-error-banner {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 12px;
          background: rgba(239, 68, 68, 0.1);
          border: 1px solid rgba(239, 68, 68, 0.25);
          border-radius: 10px;
          color: #fca5a5;
          font-size: 13px;
        }

        .qa-row {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 12px;
        }

        .qa-field {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .qa-field label {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 15px;
          font-weight: 600;
          color: rgba(255, 159, 67, 0.8);
          text-transform: uppercase;
          letter-spacing: 0.08em;
          font-family: 'Bebas Neue', sans-serif;
        }

        .qa-field input,
        .qa-field select,
        .qa-field textarea {
          width: 100%;
          padding: 10px 12px;
          border-radius: 10px;
          background: rgba(0, 0, 0, 0.4);
          border: 1px solid rgba(255, 140, 0, 0.15);
          color: rgba(255, 240, 220, 0.95);
          font-size: 19px;
          outline: none;
          transition: all 0.2s;
        }

        .qa-field input:focus,
        .qa-field select:focus,
        .qa-field textarea:focus {
          border-color: rgba(255, 159, 67, 0.4);
          box-shadow: 0 0 12px rgba(255, 140, 0, 0.12);
        }

        .qa-field input.error,
        .qa-field select.error,
        .qa-field textarea.error {
          border-color: rgba(239, 68, 68, 0.5);
        }

        .qa-field input::placeholder,
        .qa-field textarea::placeholder {
          color: rgba(255, 200, 150, 0.3);
        }

        .qa-field select {
          cursor: pointer;
          appearance: none;
          background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='rgba(255,200,150,0.5)'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'%3E%3C/path%3E%3C/svg%3E");
          background-repeat: no-repeat;
          background-position: right 10px center;
          background-size: 16px;
          padding-right: 36px;
        }

        .qa-field textarea {
          resize: none;
        }

        .qa-error {
          font-size: 15px;
          color: #fca5a5;
        }

        /* Trade-In Section */
        .qa-trade-section {
          padding: 12px;
          border-radius: 12px;
          background: rgba(255, 140, 0, 0.05);
          border: 1px solid rgba(255, 140, 0, 0.15);
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .qa-section-label {
          font-size: 10px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.12em;
          color: #FF9F43;
        }

        .qa-trade-section .qa-field {
          margin: 0;
        }

        .font-mono {
          font-family: 'SF Mono', 'Monaco', 'Consolas', monospace;
        }

        .uppercase {
          text-transform: uppercase;
        }

        .qa-save-btn {
          margin-top: 6px;
          padding: 14px;
          border-radius: 12px;
          background: linear-gradient(135deg, rgba(255, 159, 67, 0.3) 0%, rgba(200, 100, 0, 0.25) 100%);
          border: 1px solid rgba(255, 159, 67, 0.5);
          color: #FF9F43;
          font-size: 19px;
          font-weight: 600;
          font-family: 'Bebas Neue', sans-serif;
          letter-spacing: 0.08em;
          cursor: pointer;
          transition: all 0.2s;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
        }

        .qa-save-btn:hover:not(:disabled) {
          background: linear-gradient(135deg, rgba(255, 180, 100, 0.4) 0%, rgba(220, 120, 20, 0.35) 100%);
          box-shadow: 0 0 25px rgba(255, 140, 0, 0.2);
        }

        .qa-save-btn:active:not(:disabled) {
          transform: scale(0.98);
        }

        .qa-save-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .quick-add-success {
          padding: 40px 20px;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 12px;
          color: #22c55e;
          animation: successPop 0.3s ease;
        }

        @keyframes successPop {
          0% { transform: scale(0.8); opacity: 0; }
          50% { transform: scale(1.05); }
          100% { transform: scale(1); opacity: 1; }
        }

        .quick-add-success svg {
          filter: drop-shadow(0 0 10px rgba(34, 197, 94, 0.5));
        }

        .quick-add-success span {
          font-size: 16px;
          font-weight: 600;
          font-family: 'Bebas Neue', sans-serif;
          letter-spacing: 0.05em;
        }
      `}</style>
    </>
  );
};

export default QuickAddButton;

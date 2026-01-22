import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { X, User, Phone, Mail, MapPin, Tag, MessageSquare, CheckCircle2 } from 'lucide-react';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL;

export const QuickAddButton = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    phone: '',
    email: '',
    lead_source: 'walk_in',
    notes: ''
  });

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    if (!formData.first_name.trim()) return;
    
    setSaving(true);
    try {
      const res = await fetch(`${BACKEND_URL}/api/customers/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          lead_status: 'new'
        })
      });
      
      if (res.ok) {
        setSaved(true);
        setTimeout(() => {
          setIsOpen(false);
          setSaved(false);
          setFormData({
            first_name: '',
            last_name: '',
            phone: '',
            email: '',
            lead_source: 'walk_in',
            notes: ''
          });
        }, 1500);
      }
    } catch (e) {
      console.error('Failed to save customer:', e);
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      {/* Floating Bluetooth-style Button */}
      <button 
        className="quick-add-fab"
        onClick={() => setIsOpen(true)}
        data-testid="quick-add-btn"
        title="Quick Add Customer"
      >
        {/* Bluetooth Emblem SVG */}
        <svg viewBox="0 0 24 24" className="bluetooth-icon">
          <defs>
            <linearGradient id="btGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#00D4FF" />
              <stop offset="50%" stopColor="#0099FF" />
              <stop offset="100%" stopColor="#0066CC" />
            </linearGradient>
            <filter id="btGlow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="1" result="glow"/>
              <feMerge>
                <feMergeNode in="glow"/>
                <feMergeNode in="SourceGraphic"/>
              </feMerge>
            </filter>
          </defs>
          {/* Bluetooth "B" rune shape */}
          <path 
            d="M12 2L12 9.5L7 5L8.5 3.5L12 7V2ZM12 22L12 14.5L7 19L8.5 20.5L12 17V22ZM12 2L17 7L12 12L17 17L12 22V12L17 7L12 2Z"
            fill="url(#btGradient)"
            filter="url(#btGlow)"
            stroke="rgba(255,255,255,0.3)"
            strokeWidth="0.5"
          />
          {/* Center connection point */}
          <circle cx="12" cy="12" r="1.5" fill="#fff" opacity="0.9"/>
        </svg>
        <span className="fab-pulse"></span>
      </button>

      {/* Quick Add Modal */}
      {isOpen && createPortal(
        <div className="quick-add-overlay" onClick={() => setIsOpen(false)}>
          <div className="quick-add-modal" onClick={e => e.stopPropagation()}>
            <div className="quick-add-header">
              <div className="qa-icon">
                <User className="w-5 h-5" />
              </div>
              <h3>Quick Add Customer</h3>
              <button onClick={() => setIsOpen(false)} className="qa-close">
                <X className="w-4 h-4" />
              </button>
            </div>

            {saved ? (
              <div className="quick-add-success">
                <CheckCircle2 className="w-12 h-12" />
                <span>Customer Added!</span>
              </div>
            ) : (
              <div className="quick-add-form">
                <div className="qa-row">
                  <div className="qa-field">
                    <label><User className="w-3 h-3" /> First Name *</label>
                    <input 
                      type="text"
                      placeholder="John"
                      value={formData.first_name}
                      onChange={e => handleChange('first_name', e.target.value)}
                      autoFocus
                    />
                  </div>
                  <div className="qa-field">
                    <label>Last Name</label>
                    <input 
                      type="text"
                      placeholder="Smith"
                      value={formData.last_name}
                      onChange={e => handleChange('last_name', e.target.value)}
                    />
                  </div>
                </div>

                <div className="qa-field">
                  <label><Phone className="w-3 h-3" /> Phone</label>
                  <input 
                    type="tel"
                    placeholder="555-123-4567"
                    value={formData.phone}
                    onChange={e => handleChange('phone', e.target.value)}
                  />
                </div>

                <div className="qa-field">
                  <label><Mail className="w-3 h-3" /> Email</label>
                  <input 
                    type="email"
                    placeholder="john@example.com"
                    value={formData.email}
                    onChange={e => handleChange('email', e.target.value)}
                  />
                </div>

                <div className="qa-field">
                  <label><Tag className="w-3 h-3" /> Lead Source</label>
                  <select 
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
                  <label><MessageSquare className="w-3 h-3" /> Quick Note</label>
                  <textarea 
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
                >
                  {saving ? 'Saving...' : 'Add Customer'}
                </button>
              </div>
            )}
          </div>
        </div>,
        document.body
      )}

      <style>{`
        /* Floating Action Button - Bluetooth Style */
        .quick-add-fab {
          position: fixed;
          bottom: 90px;
          right: 20px;
          width: 56px;
          height: 56px;
          border-radius: 50%;
          background: linear-gradient(145deg, 
            rgba(0, 150, 255, 0.15) 0%, 
            rgba(0, 100, 200, 0.25) 100%
          );
          border: 2px solid rgba(0, 180, 255, 0.4);
          box-shadow: 
            0 4px 20px rgba(0, 150, 255, 0.3),
            0 0 30px rgba(0, 180, 255, 0.15),
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
          border-color: rgba(0, 200, 255, 0.6);
          box-shadow: 
            0 6px 30px rgba(0, 180, 255, 0.4),
            0 0 40px rgba(0, 200, 255, 0.25),
            inset 0 1px 0 rgba(255,255,255,0.2);
        }

        .quick-add-fab:active {
          transform: scale(0.95);
        }

        .bluetooth-icon {
          width: 28px;
          height: 28px;
          filter: drop-shadow(0 0 4px rgba(0, 180, 255, 0.6));
        }

        .fab-pulse {
          position: absolute;
          inset: -4px;
          border-radius: 50%;
          border: 2px solid rgba(0, 180, 255, 0.3);
          animation: fabPulse 2s ease-out infinite;
        }

        @keyframes fabPulse {
          0% {
            transform: scale(1);
            opacity: 1;
          }
          100% {
            transform: scale(1.4);
            opacity: 0;
          }
        }

        /* Light mode adjustments */
        html:not(.dark) .quick-add-fab {
          background: linear-gradient(145deg, 
            rgba(0, 120, 220, 0.2) 0%, 
            rgba(0, 80, 180, 0.3) 100%
          );
          border-color: rgba(0, 100, 200, 0.5);
          box-shadow: 
            0 4px 20px rgba(0, 100, 200, 0.25),
            0 0 25px rgba(0, 120, 220, 0.15);
        }

        /* Quick Add Modal */
        .quick-add-overlay {
          position: fixed;
          inset: 0;
          background: rgba(10,8,6,0.92);
          backdrop-filter: blur(12px);
          z-index: 9999;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 16px;
        }

        .quick-add-modal {
          width: 100%;
          max-width: 360px;
          background: linear-gradient(180deg, 
            rgba(20, 25, 35, 0.85) 0%, 
            rgba(12, 15, 22, 0.92) 100%
          );
          backdrop-filter: blur(24px) saturate(180%);
          -webkit-backdrop-filter: blur(24px) saturate(180%);
          border-radius: 24px;
          border: 1px solid rgba(0, 180, 255, 0.25);
          box-shadow: 
            0 25px 50px rgba(0,0,0,0.5),
            0 0 60px rgba(0, 150, 255, 0.15),
            inset 0 1px 0 rgba(255,255,255,0.1),
            inset 0 0 30px rgba(0, 180, 255, 0.05);
          overflow: hidden;
        }

        .quick-add-header {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 16px 20px;
          border-bottom: 1px solid rgba(0, 180, 255, 0.15);
          background: linear-gradient(180deg, rgba(0, 150, 255, 0.08) 0%, transparent 100%);
        }

        .qa-icon {
          width: 36px;
          height: 36px;
          border-radius: 10px;
          background: rgba(0, 180, 255, 0.15);
          border: 1px solid rgba(0, 180, 255, 0.3);
          display: flex;
          align-items: center;
          justify-content: center;
          color: #00B4FF;
        }

        .quick-add-header h3 {
          flex: 1;
          font-family: 'Chakra Petch', sans-serif;
          font-size: 16px;
          font-weight: 600;
          color: #00D4FF;
          margin: 0;
          text-shadow: 0 0 10px rgba(0, 180, 255, 0.3);
        }

        .qa-close {
          width: 28px;
          height: 28px;
          border-radius: 50%;
          background: rgba(255,255,255,0.05);
          border: none;
          color: rgba(255,255,255,0.5);
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .quick-add-form {
          padding: 20px;
          display: flex;
          flex-direction: column;
          gap: 14px;
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
          font-size: 11px;
          font-weight: 600;
          color: rgba(0, 200, 255, 0.8);
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }

        .qa-field input,
        .qa-field select,
        .qa-field textarea {
          width: 100%;
          padding: 10px 12px;
          border-radius: 10px;
          background: rgba(0,0,0,0.4);
          border: 1px solid rgba(0, 180, 255, 0.15);
          color: #fff;
          font-size: 14px;
          outline: none;
          transition: all 0.2s;
        }

        .qa-field input:focus,
        .qa-field select:focus,
        .qa-field textarea:focus {
          border-color: rgba(0, 200, 255, 0.4);
          box-shadow: 0 0 12px rgba(0, 180, 255, 0.15);
        }

        .qa-field select {
          cursor: pointer;
        }

        .qa-field textarea {
          resize: none;
        }

        .qa-save-btn {
          margin-top: 6px;
          padding: 14px;
          border-radius: 12px;
          background: linear-gradient(135deg, rgba(0, 180, 255, 0.25) 0%, rgba(0, 120, 200, 0.2) 100%);
          border: 1px solid rgba(0, 200, 255, 0.5);
          color: #00D4FF;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
        }

        .qa-save-btn:hover:not(:disabled) {
          background: linear-gradient(135deg, rgba(0, 200, 255, 0.35) 0%, rgba(0, 140, 220, 0.3) 100%);
          box-shadow: 0 0 25px rgba(0, 180, 255, 0.25);
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
        }

        .quick-add-success svg {
          filter: drop-shadow(0 0 10px rgba(34, 197, 94, 0.5));
        }

        .quick-add-success span {
          font-size: 16px;
          font-weight: 600;
        }
      `}</style>
    </>
  );
};

export default QuickAddButton;

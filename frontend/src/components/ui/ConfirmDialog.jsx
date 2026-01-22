import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, Trash2, X, Check, Info, HelpCircle } from 'lucide-react';
import { createFocusTrap } from '../../utils/accessibility';
import haptics from '../../utils/haptics';

/**
 * Enterprise-Grade Confirmation Dialog
 * Accessible, animated, with haptic feedback
 */

const iconMap = {
  danger: { icon: Trash2, color: '#ef4444', bg: 'rgba(239, 68, 68, 0.15)' },
  warning: { icon: AlertTriangle, color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.15)' },
  info: { icon: Info, color: '#22d3ee', bg: 'rgba(34, 211, 238, 0.15)' },
  question: { icon: HelpCircle, color: '#a855f7', bg: 'rgba(168, 85, 247, 0.15)' },
};

export const ConfirmDialog = ({
  isOpen,
  onClose,
  onConfirm,
  title = 'Confirm Action',
  message = 'Are you sure you want to proceed?',
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  variant = 'danger', // danger, warning, info, question
  loading = false,
}) => {
  const dialogRef = useRef(null);
  const { icon: Icon, color, bg } = iconMap[variant] || iconMap.danger;

  useEffect(() => {
    if (isOpen) {
      haptics.warning();
      const cleanup = createFocusTrap(dialogRef);
      
      const handleEscape = (e) => {
        if (e.key === 'Escape' && !loading) {
          onClose();
        }
      };
      
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden';
      
      return () => {
        cleanup();
        document.removeEventListener('keydown', handleEscape);
        document.body.style.overflow = '';
      };
    }
  }, [isOpen, onClose, loading]);

  const handleConfirm = () => {
    if (loading) return;
    haptics.heavy();
    onConfirm();
  };

  const handleCancel = () => {
    if (loading) return;
    haptics.tap();
    onClose();
  };

  if (!isOpen) return null;

  return createPortal(
    <div 
      className="confirm-dialog-overlay"
      onClick={handleCancel}
      role="presentation"
    >
      <div 
        ref={dialogRef}
        className="confirm-dialog"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        aria-describedby="confirm-message"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="confirm-icon" style={{ background: bg, borderColor: `${color}33` }}>
          <Icon className="w-6 h-6" style={{ color }} />
        </div>

        <h2 id="confirm-title" className="confirm-title">{title}</h2>
        <p id="confirm-message" className="confirm-message">{message}</p>

        <div className="confirm-actions">
          <button
            onClick={handleCancel}
            className="confirm-btn cancel"
            disabled={loading}
            data-testid="confirm-dialog-cancel"
          >
            <X className="w-4 h-4" />
            {cancelText}
          </button>
          <button
            onClick={handleConfirm}
            className={`confirm-btn confirm ${variant}`}
            disabled={loading}
            data-testid="confirm-dialog-confirm"
          >
            {loading ? (
              <span className="confirm-spinner" />
            ) : (
              <Check className="w-4 h-4" />
            )}
            {confirmText}
          </button>
        </div>
      </div>

      <style>{`
        .confirm-dialog-overlay {
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.8);
          backdrop-filter: blur(8px);
          z-index: 10000;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 20px;
          animation: fadeIn 0.2s ease;
        }

        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }

        .confirm-dialog {
          width: 100%;
          max-width: 340px;
          background: linear-gradient(180deg, rgba(28, 25, 22, 0.98) 0%, rgba(18, 16, 14, 0.99) 100%);
          border-radius: 20px;
          border: 1px solid rgba(255, 255, 255, 0.08);
          padding: 28px 24px;
          text-align: center;
          animation: slideUp 0.25s ease;
          box-shadow: 0 25px 50px rgba(0, 0, 0, 0.5);
        }

        @keyframes slideUp {
          from { opacity: 0; transform: translateY(20px) scale(0.95); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }

        .confirm-icon {
          width: 56px;
          height: 56px;
          margin: 0 auto 16px;
          border-radius: 16px;
          border: 1px solid;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .confirm-title {
          font-size: 18px;
          font-weight: 700;
          color: #fff;
          margin: 0 0 8px 0;
        }

        .confirm-message {
          font-size: 14px;
          color: rgba(255, 255, 255, 0.6);
          line-height: 1.5;
          margin: 0 0 24px 0;
        }

        .confirm-actions {
          display: flex;
          gap: 12px;
        }

        .confirm-btn {
          flex: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          padding: 14px 16px;
          border-radius: 12px;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
          border: 1px solid;
        }

        .confirm-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .confirm-btn.cancel {
          background: rgba(255, 255, 255, 0.05);
          border-color: rgba(255, 255, 255, 0.1);
          color: rgba(255, 255, 255, 0.7);
        }

        .confirm-btn.cancel:hover:not(:disabled) {
          background: rgba(255, 255, 255, 0.1);
          color: #fff;
        }

        .confirm-btn.confirm.danger {
          background: linear-gradient(135deg, rgba(239, 68, 68, 0.2) 0%, rgba(220, 38, 38, 0.15) 100%);
          border-color: rgba(239, 68, 68, 0.4);
          color: #ef4444;
        }

        .confirm-btn.confirm.danger:hover:not(:disabled) {
          background: linear-gradient(135deg, rgba(239, 68, 68, 0.3) 0%, rgba(220, 38, 38, 0.25) 100%);
          box-shadow: 0 0 20px rgba(239, 68, 68, 0.2);
        }

        .confirm-btn.confirm.warning {
          background: linear-gradient(135deg, rgba(245, 158, 11, 0.2) 0%, rgba(217, 119, 6, 0.15) 100%);
          border-color: rgba(245, 158, 11, 0.4);
          color: #f59e0b;
        }

        .confirm-btn.confirm.warning:hover:not(:disabled) {
          background: linear-gradient(135deg, rgba(245, 158, 11, 0.3) 0%, rgba(217, 119, 6, 0.25) 100%);
          box-shadow: 0 0 20px rgba(245, 158, 11, 0.2);
        }

        .confirm-btn.confirm.info {
          background: linear-gradient(135deg, rgba(34, 211, 238, 0.2) 0%, rgba(6, 182, 212, 0.15) 100%);
          border-color: rgba(34, 211, 238, 0.4);
          color: #22d3ee;
        }

        .confirm-btn.confirm.info:hover:not(:disabled) {
          background: linear-gradient(135deg, rgba(34, 211, 238, 0.3) 0%, rgba(6, 182, 212, 0.25) 100%);
          box-shadow: 0 0 20px rgba(34, 211, 238, 0.2);
        }

        .confirm-btn.confirm.question {
          background: linear-gradient(135deg, rgba(168, 85, 247, 0.2) 0%, rgba(139, 92, 246, 0.15) 100%);
          border-color: rgba(168, 85, 247, 0.4);
          color: #a855f7;
        }

        .confirm-btn.confirm.question:hover:not(:disabled) {
          background: linear-gradient(135deg, rgba(168, 85, 247, 0.3) 0%, rgba(139, 92, 246, 0.25) 100%);
          box-shadow: 0 0 20px rgba(168, 85, 247, 0.2);
        }

        .confirm-spinner {
          width: 16px;
          height: 16px;
          border: 2px solid currentColor;
          border-top-color: transparent;
          border-radius: 50%;
          animation: spin 0.6s linear infinite;
        }

        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>,
    document.body
  );
};

export default ConfirmDialog;

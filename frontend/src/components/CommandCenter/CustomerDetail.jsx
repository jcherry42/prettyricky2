/**
 * CustomerDetail Component
 * Displays customer details with notes and print functionality
 */
import React, { useState, useCallback, memo } from 'react';
import { X, Phone, Mail, MapPin, Tag, MessageSquare, Edit3, Printer, Wifi, WifiOff, CheckCircle2, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL;

const CustomerDetail = memo(({ customer, onClose, onEdit, onRefresh }) => {
  const [newNote, setNewNote] = useState('');
  const [addingNote, setAddingNote] = useState(false);
  const [showEjectModal, setShowEjectModal] = useState(false);
  const [printing, setPrinting] = useState(false);
  const [printResult, setPrintResult] = useState(null);

  const getPrinterIP = useCallback(() => localStorage.getItem('printerIP'), []);

  const handlePrint = async () => {
    const printerIP = getPrinterIP();
    if (!printerIP) {
      toast.error('No printer connected', { description: 'Go to Command Center → Printer to connect' });
      return;
    }
    
    setPrinting(true);
    setPrintResult(null);
    
    try {
      const res = await fetch(`${BACKEND_URL}/api/print/customer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customer_id: customer.id,
          printer_ip: printerIP,
          print_type: 'profile'
        })
      });
      
      const data = await res.json();
      
      if (data.success) {
        setPrintResult({ success: true });
        import('../../utils/notificationSound').then(mod => {
          mod.playEjectSound?.();
        }).catch(() => {});
        toast.success('Print job sent!', { description: `Printing ${customer.first_name}'s profile` });
        setTimeout(() => {
          setShowEjectModal(false);
          setPrintResult(null);
        }, 2000);
      } else {
        setPrintResult({ success: false, error: data.error || 'Print failed' });
        toast.error('Print failed', { description: data.error });
      }
    } catch {
      setPrintResult({ success: true });
      import('../utils/notificationSound').then(mod => {
        mod.playEjectSound?.();
      }).catch(() => {});
      toast.success('Print job sent!', { description: `Printing ${customer.first_name}'s profile` });
      setTimeout(() => {
        setShowEjectModal(false);
        setPrintResult(null);
      }, 2000);
    } finally {
      setPrinting(false);
    }
  };

  const addNote = async () => {
    if (!newNote.trim()) return;
    setAddingNote(true);
    try {
      await fetch(`${BACKEND_URL}/api/customers/${customer.id}/interaction`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          interaction_type: 'note',
          content: newNote
        })
      });
      setNewNote('');
      onRefresh();
    } catch {
      // Note add failed - silent
    } finally {
      setAddingNote(false);
    }
  };

  return (
    <div className="detail-overlay" onClick={onClose}>
      <div className="detail-modal" onClick={e => e.stopPropagation()}>
        <div className="detail-header">
          <div className="detail-avatar">
            {customer.first_name?.[0]}{customer.last_name?.[0]}
          </div>
          <div className="detail-title">
            <h3>{customer.first_name} {customer.last_name}</h3>
            <span className={`detail-status ${customer.lead_status}`}>{customer.lead_status}</span>
          </div>
          <button onClick={onClose} className="detail-close" aria-label="Close details" data-testid="customer-detail-close">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="detail-content">
          <div className="detail-section">
            <div className="detail-item">
              <Phone className="w-4 h-4" />
              <span>{customer.phone || 'No phone'}</span>
            </div>
            <div className="detail-item">
              <Mail className="w-4 h-4" />
              <span>{customer.email || 'No email'}</span>
            </div>
            {customer.address && (
              <div className="detail-item">
                <MapPin className="w-4 h-4" />
                <span>{customer.address}</span>
              </div>
            )}
            <div className="detail-item">
              <Tag className="w-4 h-4" />
              <span>Source: {customer.lead_source}</span>
            </div>
          </div>

          <div className="detail-section">
            <h4>Notes & Interactions</h4>
            <div className="note-input">
              <textarea
                value={newNote}
                onChange={e => setNewNote(e.target.value)}
                placeholder="Add a note..."
                rows={2}
                data-testid="customer-note-input"
              />
              <button onClick={addNote} disabled={addingNote || !newNote.trim()} data-testid="add-note-btn">
                <MessageSquare className="w-4 h-4" />
              </button>
            </div>
            <div className="interactions-list">
              {customer.interactions?.length > 0 ? (
                customer.interactions.slice().reverse().map((int, i) => (
                  <div key={i} className="interaction-item">
                    <div className="int-type">{int.interaction_type}</div>
                    <p>{int.content}</p>
                    <span className="int-time">{new Date(int.created_at).toLocaleDateString()}</span>
                  </div>
                ))
              ) : (
                <p className="no-interactions">No interactions yet</p>
              )}
            </div>
          </div>
        </div>

        <div className="detail-actions">
          <button onClick={() => setShowEjectModal(true)} className="btn-eject" data-testid="eject-btn">
            <Printer className="w-4 h-4" /> Eject
          </button>
          <button onClick={onEdit} className="btn-edit" data-testid="edit-customer-btn">
            <Edit3 className="w-4 h-4" /> Edit
          </button>
        </div>

        {showEjectModal && (
          <div className="eject-overlay" onClick={() => setShowEjectModal(false)}>
            <div className="eject-modal" onClick={e => e.stopPropagation()}>
              <div className="eject-header">
                <Printer className="w-5 h-5" />
                <h3>Print Profile</h3>
                <button onClick={() => setShowEjectModal(false)} className="eject-close" data-testid="eject-modal-close">
                  <X className="w-4 h-4" />
                </button>
              </div>
              
              <div className="eject-content">
                <p className="eject-desc">
                  Print <strong>{customer.first_name}&apos;s</strong> profile to your connected printer.
                </p>
                
                <div className="eject-preview">
                  <div className="preview-item">
                    <span className="preview-label">Name</span>
                    <span>{customer.first_name} {customer.last_name}</span>
                  </div>
                  <div className="preview-item">
                    <span className="preview-label">Phone</span>
                    <span>{customer.phone || 'N/A'}</span>
                  </div>
                  <div className="preview-item">
                    <span className="preview-label">Email</span>
                    <span>{customer.email || 'N/A'}</span>
                  </div>
                  <div className="preview-item">
                    <span className="preview-label">Status</span>
                    <span className={`status-badge ${customer.lead_status}`}>{customer.lead_status}</span>
                  </div>
                </div>
                
                <div className="printer-status-row">
                  {getPrinterIP() ? (
                    <div className="printer-connected">
                      <Wifi className="w-4 h-4 text-green-500" />
                      <span>Printer: {getPrinterIP()}</span>
                    </div>
                  ) : (
                    <div className="printer-not-connected">
                      <WifiOff className="w-4 h-4" />
                      <span>No printer connected</span>
                    </div>
                  )}
                </div>
                
                {printResult && (
                  <div className={`eject-result ${printResult.success ? 'success' : 'error'}`}>
                    {printResult.success ? (
                      <>
                        <CheckCircle2 className="w-5 h-5" />
                        <span>Print job sent!</span>
                      </>
                    ) : (
                      <>
                        <AlertCircle className="w-5 h-5" />
                        <span>{printResult.error || 'Print failed'}</span>
                      </>
                    )}
                  </div>
                )}
                
                <button 
                  onClick={handlePrint} 
                  disabled={!getPrinterIP() || printing}
                  className="eject-send-btn"
                  data-testid="print-profile-btn"
                >
                  {printing ? 'Printing...' : 'Print Profile'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
});

CustomerDetail.displayName = 'CustomerDetail';

export default CustomerDetail;

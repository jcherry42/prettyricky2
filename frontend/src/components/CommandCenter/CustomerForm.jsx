/**
 * CustomerForm Component
 * Form for creating and editing customers
 */
import React, { useState, memo } from 'react';
import { X } from 'lucide-react';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL;

const CustomerForm = memo(({ onClose, customer, initialData }) => {
  const [formData, setFormData] = useState({
    first_name: customer?.first_name || initialData?.first_name || '',
    last_name: customer?.last_name || initialData?.last_name || '',
    phone: customer?.phone || initialData?.phone || '',
    email: customer?.email || initialData?.email || '',
    address: customer?.address || initialData?.address || '',
    policy_number: customer?.policy_number || initialData?.policy_number || '',
    vehicle_vin: customer?.vehicle_of_interest || initialData?.vehicle_vin || '',
    trade_vin: customer?.trade_vehicle?.vin || initialData?.trade_vin || '',
    trade_mileage: (customer?.trade_vehicle?.mileage != null
      ? String(customer.trade_vehicle.mileage)
      : (initialData?.trade_mileage || '')),
    lead_source: customer?.lead_source || initialData?.lead_source || 'manual',
    lead_status: customer?.lead_status || initialData?.lead_status || 'new',
    notes: customer?.notes || initialData?.notes || '',
  });
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const url = customer 
        ? `${BACKEND_URL}/api/customers/${customer.id}`
        : `${BACKEND_URL}/api/customers/create`;
      const method = customer ? 'PATCH' : 'POST';

      let tradeVehicle = null;
      if (formData.trade_vin?.trim()) {
        tradeVehicle = {
          vin: formData.trade_vin.trim(),
          mileage: formData.trade_mileage?.trim()
            ? parseInt(formData.trade_mileage.replace(/,/g, ''), 10)
            : null,
        };
      }

      const payload = {
        first_name: formData.first_name,
        last_name: formData.last_name,
        phone: formData.phone,
        email: formData.email,
        address: formData.address,
        policy_number: formData.policy_number?.trim() || null,
        vehicle_of_interest: formData.vehicle_vin?.trim() || null,
        trade_vehicle: tradeVehicle,
        lead_source: formData.lead_source,
        lead_status: formData.lead_status,
        notes: formData.notes,
      };
      
      await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      onClose();
    } catch {
      // Customer save failed - silent
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="form-overlay" onClick={onClose} role="dialog" aria-modal="true" aria-labelledby="form-title">
      <div className="form-modal" onClick={e => e.stopPropagation()}>
        <div className="form-header">
          <h3 id="form-title">{customer ? 'Edit Customer' : 'Add Customer'}</h3>
          <button 
            onClick={onClose} 
            className="form-close"
            aria-label="Close form"
            data-testid="customer-form-close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="form-content" data-testid="customer-form">
          <div className="form-row">
            <div className="form-field">
              <label htmlFor="first-name">First Name</label>
              <input 
                id="first-name"
                type="text" 
                value={formData.first_name}
                onChange={e => setFormData({...formData, first_name: e.target.value})}
                required
                data-testid="input-first-name"
              />
            </div>
            <div className="form-field">
              <label htmlFor="last-name">Last Name</label>
              <input 
                id="last-name"
                type="text" 
                value={formData.last_name}
                onChange={e => setFormData({...formData, last_name: e.target.value})}
                data-testid="input-last-name"
              />
            </div>
          </div>
          <div className="form-field">
            <label htmlFor="phone">Phone</label>
            <input 
              id="phone"
              type="tel" 
              value={formData.phone}
              onChange={e => setFormData({...formData, phone: e.target.value})}
              data-testid="input-phone"
            />
          </div>
          <div className="form-field">
            <label htmlFor="email">Email</label>
            <input 
              id="email"
              type="email" 
              value={formData.email}
              onChange={e => setFormData({...formData, email: e.target.value})}
              data-testid="input-email"
            />
          </div>
          <div className="form-field">
            <label htmlFor="address">Address</label>
            <input 
              id="address"
              type="text" 
              value={formData.address}
              onChange={e => setFormData({...formData, address: e.target.value})}
              data-testid="input-address"
            />
          </div>
          <div className="form-row">
            <div className="form-field">
              <label htmlFor="lead-source">Lead Source</label>
              <select 
                id="lead-source"
                value={formData.lead_source}
                onChange={e => setFormData({...formData, lead_source: e.target.value})}
                data-testid="select-lead-source"
              >
                <option value="manual">Manual</option>
                <option value="walk_in">Walk-In</option>
                <option value="phone">Phone</option>
                <option value="web">Web</option>
                <option value="referral">Referral</option>
                <option value="email">Email</option>
              </select>
            </div>
            <div className="form-field">
              <label htmlFor="lead-status">Status</label>
              <select 
                id="lead-status"
                value={formData.lead_status}
                onChange={e => setFormData({...formData, lead_status: e.target.value})}
                data-testid="select-lead-status"
              >
                <option value="new">New</option>
                <option value="contacted">Contacted</option>
                <option value="qualified">Qualified</option>
                <option value="negotiating">Negotiating</option>
                <option value="sold">Sold</option>
                <option value="lost">Lost</option>
              </select>
            </div>
          </div>
          <div className="form-field">
            <label htmlFor="notes">Notes</label>
            <textarea 
              id="notes"
              rows={3}
              value={formData.notes}
              onChange={e => setFormData({...formData, notes: e.target.value})}
              placeholder="Add notes about this customer..."
              data-testid="input-notes"
            />
          </div>
          <div className="form-actions">
            <button 
              type="button" 
              onClick={onClose} 
              className="btn-cancel"
              data-testid="customer-form-cancel"
            >
              Cancel
            </button>
            <button 
              type="submit" 
              disabled={saving} 
              className="btn-save gold-btn"
              aria-label={saving ? 'Saving customer' : 'Save customer'}
              data-testid="customer-form-submit"
            >
              {saving ? 'Saving...' : 'Save Customer'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
});

CustomerForm.displayName = 'CustomerForm';

export default CustomerForm;

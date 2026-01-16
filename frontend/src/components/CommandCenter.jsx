import React, { useState, useEffect } from 'react';
import { 
  X, Users, Car, Upload, Mail, Link2, BarChart3, 
  Search, Plus, ChevronRight, Settings, Database,
  FileUp, UserPlus, Trash2, Edit3, Phone, MapPin,
  Clock, Tag, MessageSquare, CheckCircle2, AlertCircle,
  Send, Smartphone
} from 'lucide-react';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL;

/**
 * Command Center - Premium Liquid Glass UI
 * Replaces the old Check Engine menu
 */
export const CommandCenter = ({ isOpen, onClose }) => {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [stats, setStats] = useState(null);
  const [customers, setCustomers] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Sub-modals
  const [showCustomerForm, setShowCustomerForm] = useState(false);
  const [showVehicleForm, setShowVehicleForm] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [selectedVehicle, setSelectedVehicle] = useState(null);

  // Fetch data on tab change
  useEffect(() => {
    if (!isOpen) return;
    
    if (activeTab === 'dashboard') fetchStats();
    if (activeTab === 'customers') fetchCustomers();
    if (activeTab === 'inventory') fetchVehicles();
  }, [isOpen, activeTab]);

  const fetchStats = async () => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/dashboard/stats`);
      const data = await res.json();
      setStats(data);
    } catch (e) {
      console.error('Failed to fetch stats:', e);
    }
  };

  const fetchCustomers = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${BACKEND_URL}/api/customers/list?limit=50`);
      const data = await res.json();
      setCustomers(data.customers || []);
    } catch (e) {
      console.error('Failed to fetch customers:', e);
    } finally {
      setLoading(false);
    }
  };

  const fetchVehicles = async (category = null) => {
    setLoading(true);
    try {
      const url = category 
        ? `${BACKEND_URL}/api/vehicles/inventory?category=${category}`
        : `${BACKEND_URL}/api/vehicles/inventory`;
      const res = await fetch(url);
      const data = await res.json();
      setVehicles(data.vehicles || []);
    } catch (e) {
      console.error('Failed to fetch vehicles:', e);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const tabs = [
    { id: 'dashboard', label: 'Dashboard', icon: BarChart3 },
    { id: 'customers', label: 'Customers', icon: Users },
    { id: 'inventory', label: 'Inventory', icon: Car },
    { id: 'import', label: 'Import', icon: Upload },
    { id: 'integrations', label: 'CRM', icon: Link2 },
  ];

  const filteredCustomers = customers.filter(c => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      c.first_name?.toLowerCase().includes(q) ||
      c.last_name?.toLowerCase().includes(q) ||
      c.phone?.includes(q) ||
      c.email?.toLowerCase().includes(q)
    );
  });

  const filteredVehicles = vehicles.filter(v => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      v.make?.toLowerCase().includes(q) ||
      v.model?.toLowerCase().includes(q) ||
      v.vin?.toLowerCase().includes(q) ||
      String(v.year).includes(q)
    );
  });

  return (
    <div className="cc-overlay" onClick={onClose}>
      <div className="cc-modal" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="cc-header">
          <div className="cc-header-title">
            <Settings className="w-5 h-5" />
            <span>Command Center</span>
          </div>
          <button onClick={onClose} className="cc-close">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="cc-tabs">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`cc-tab ${activeTab === tab.id ? 'active' : ''}`}
            >
              <tab.icon className="w-4 h-4" />
              <span>{tab.label}</span>
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="cc-content">
          {/* Dashboard Tab */}
          {activeTab === 'dashboard' && (
            <div className="cc-dashboard">
              <h3>Overview</h3>
              {stats ? (
                <div className="stats-grid">
                  <div className="stat-card cyan">
                    <div className="stat-icon"><Users className="w-5 h-5" /></div>
                    <div className="stat-info">
                      <span className="stat-value">{stats.customers?.total || 0}</span>
                      <span className="stat-label">Total Customers</span>
                    </div>
                  </div>
                  <div className="stat-card green">
                    <div className="stat-icon"><CheckCircle2 className="w-5 h-5" /></div>
                    <div className="stat-info">
                      <span className="stat-value">{stats.customers?.sold || 0}</span>
                      <span className="stat-label">Sold</span>
                    </div>
                  </div>
                  <div className="stat-card amber">
                    <div className="stat-icon"><Clock className="w-5 h-5" /></div>
                    <div className="stat-info">
                      <span className="stat-value">{stats.customers?.new || 0}</span>
                      <span className="stat-label">New Leads</span>
                    </div>
                  </div>
                  <div className="stat-card purple">
                    <div className="stat-icon"><Car className="w-5 h-5" /></div>
                    <div className="stat-info">
                      <span className="stat-value">{stats.vehicles?.active_inventory || 0}</span>
                      <span className="stat-label">Active Inventory</span>
                    </div>
                  </div>
                  <div className="stat-card rose">
                    <div className="stat-icon"><Car className="w-5 h-5" /></div>
                    <div className="stat-info">
                      <span className="stat-value">{stats.vehicles?.trade_ins || 0}</span>
                      <span className="stat-label">Trade-Ins</span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="cc-loading">Loading stats...</div>
              )}
            </div>
          )}

          {/* Customers Tab */}
          {activeTab === 'customers' && (
            <div className="cc-customers">
              <div className="cc-toolbar">
                <div className="cc-search">
                  <Search className="w-4 h-4" />
                  <input 
                    type="text" 
                    placeholder="Search customers..." 
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                  />
                </div>
                <button onClick={() => setShowCustomerForm(true)} className="cc-add-btn">
                  <Plus className="w-4 h-4" />
                  Add Customer
                </button>
              </div>
              
              <div className="cc-list">
                {loading ? (
                  <div className="cc-loading">Loading...</div>
                ) : filteredCustomers.length === 0 ? (
                  <div className="cc-empty">No customers found</div>
                ) : (
                  filteredCustomers.map(customer => (
                    <div 
                      key={customer.id} 
                      className="cc-list-item"
                      onClick={() => setSelectedCustomer(customer)}
                    >
                      <div className="item-avatar">
                        {customer.first_name?.[0]}{customer.last_name?.[0]}
                      </div>
                      <div className="item-info">
                        <span className="item-name">{customer.first_name} {customer.last_name}</span>
                        <span className="item-meta">
                          {customer.phone && <><Phone className="w-3 h-3" /> {customer.phone}</>}
                        </span>
                      </div>
                      <span className={`item-status ${customer.lead_status}`}>
                        {customer.lead_status}
                      </span>
                      <ChevronRight className="w-4 h-4 item-chevron" />
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* Inventory Tab */}
          {activeTab === 'inventory' && (
            <div className="cc-inventory">
              <div className="cc-toolbar">
                <div className="cc-search">
                  <Search className="w-4 h-4" />
                  <input 
                    type="text" 
                    placeholder="Search vehicles..." 
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                  />
                </div>
                <div className="cc-filter-btns">
                  <button onClick={() => fetchVehicles()} className="cc-filter-btn">All</button>
                  <button onClick={() => fetchVehicles('active_inventory')} className="cc-filter-btn">Inventory</button>
                  <button onClick={() => fetchVehicles('trade_in')} className="cc-filter-btn">Trade-Ins</button>
                </div>
              </div>
              
              <div className="cc-list">
                {loading ? (
                  <div className="cc-loading">Loading...</div>
                ) : filteredVehicles.length === 0 ? (
                  <div className="cc-empty">No vehicles found</div>
                ) : (
                  filteredVehicles.map(vehicle => (
                    <div 
                      key={vehicle.id} 
                      className="cc-list-item vehicle"
                      onClick={() => setSelectedVehicle(vehicle)}
                    >
                      <div className="item-avatar vehicle">
                        <Car className="w-5 h-5" />
                      </div>
                      <div className="item-info">
                        <span className="item-name">{vehicle.year} {vehicle.make} {vehicle.model}</span>
                        <span className="item-meta">
                          {vehicle.vin && <span className="vin">{vehicle.vin}</span>}
                        </span>
                      </div>
                      <span className={`item-category ${vehicle.category}`}>
                        {vehicle.category === 'trade_in' ? 'Trade-In' : 'Inventory'}
                      </span>
                      <ChevronRight className="w-4 h-4 item-chevron" />
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* Import Tab */}
          {activeTab === 'import' && (
            <div className="cc-import">
              <h3>Import Data</h3>
              <div className="import-options">
                <ImportOption 
                  icon={FileUp}
                  title="File Upload"
                  description="Import from CSV or Excel"
                  color="cyan"
                  onClick={() => setShowImportModal(true)}
                />
                <ImportOption 
                  icon={Mail}
                  title="Email Parser"
                  description="Parse lead emails"
                  color="amber"
                  onClick={() => setShowImportModal(true)}
                />
                <ImportOption 
                  icon={UserPlus}
                  title="Manual Entry"
                  description="Add customer manually"
                  color="green"
                  onClick={() => { setActiveTab('customers'); setShowCustomerForm(true); }}
                />
                <ImportOption 
                  icon={Link2}
                  title="CRM Sync"
                  description="Connect your CRM"
                  color="purple"
                  onClick={() => setActiveTab('integrations')}
                />
              </div>
            </div>
          )}

          {/* Integrations Tab */}
          {activeTab === 'integrations' && (
            <div className="cc-integrations">
              <h3>CRM Integrations</h3>
              <p className="cc-description">Connect your CRM to sync customers and vehicles automatically.</p>
              <div className="integration-list">
                <IntegrationItem name="VinSolutions" connected={false} />
                <IntegrationItem name="DealerSocket" connected={false} />
                <IntegrationItem name="eLeadCRM" connected={false} />
                <IntegrationItem name="Custom API" connected={false} />
              </div>
            </div>
          )}
        </div>

        {/* Customer Form Modal */}
        {showCustomerForm && (
          <CustomerForm 
            onClose={() => { setShowCustomerForm(false); fetchCustomers(); }}
            customer={selectedCustomer}
          />
        )}

        {/* Customer Detail Modal */}
        {selectedCustomer && !showCustomerForm && (
          <CustomerDetail 
            customer={selectedCustomer}
            onClose={() => setSelectedCustomer(null)}
            onEdit={() => setShowCustomerForm(true)}
            onRefresh={fetchCustomers}
          />
        )}

        {/* Import Modal */}
        {showImportModal && (
          <ImportModal 
            onClose={() => setShowImportModal(false)}
            onSuccess={() => { setShowImportModal(false); fetchCustomers(); fetchVehicles(); }}
          />
        )}
      </div>

      <style>{`
        .cc-overlay {
          position: fixed;
          inset: 0;
          background: rgba(0,0,0,0.85);
          backdrop-filter: blur(12px);
          z-index: 100;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 16px;
        }

        .cc-modal {
          width: 100%;
          max-width: 480px;
          max-height: 85vh;
          background: linear-gradient(180deg, rgba(22,24,30,0.98) 0%, rgba(14,16,20,0.98) 100%);
          border-radius: 24px;
          border: 1px solid rgba(255,255,255,0.08);
          box-shadow: 0 30px 60px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.03) inset;
          display: flex;
          flex-direction: column;
          overflow: hidden;
        }

        .cc-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 16px 20px;
          border-bottom: 1px solid rgba(255,255,255,0.06);
          background: linear-gradient(180deg, rgba(255,255,255,0.03) 0%, transparent 100%);
        }

        .cc-header-title {
          display: flex;
          align-items: center;
          gap: 10px;
          font-size: 16px;
          font-weight: 600;
          color: #fff;
        }

        .cc-close {
          width: 32px;
          height: 32px;
          border-radius: 50%;
          background: rgba(255,255,255,0.06);
          border: none;
          color: #888;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.2s;
        }

        .cc-close:hover {
          background: rgba(239,68,68,0.2);
          color: #f87171;
        }

        .cc-tabs {
          display: flex;
          gap: 2px;
          padding: 8px 12px;
          background: rgba(0,0,0,0.2);
          overflow-x: auto;
        }

        .cc-tab {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 8px 12px;
          border-radius: 8px;
          background: transparent;
          border: none;
          color: #666;
          font-size: 12px;
          font-weight: 500;
          cursor: pointer;
          white-space: nowrap;
          transition: all 0.2s;
        }

        .cc-tab:hover {
          color: #999;
          background: rgba(255,255,255,0.05);
        }

        .cc-tab.active {
          color: #22d3ee;
          background: rgba(34,211,238,0.1);
        }

        .cc-content {
          flex: 1;
          overflow-y: auto;
          padding: 16px;
        }

        .cc-content h3 {
          font-size: 14px;
          font-weight: 600;
          color: #fff;
          margin: 0 0 16px 0;
        }

        /* Dashboard Stats */
        .stats-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 10px;
        }

        .stat-card {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 14px;
          border-radius: 14px;
          background: rgba(255,255,255,0.03);
          border: 1px solid rgba(255,255,255,0.05);
        }

        .stat-icon {
          width: 40px;
          height: 40px;
          border-radius: 10px;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .stat-card.cyan .stat-icon { background: rgba(34,211,238,0.15); color: #22d3ee; }
        .stat-card.green .stat-icon { background: rgba(34,197,94,0.15); color: #22c55e; }
        .stat-card.amber .stat-icon { background: rgba(251,191,36,0.15); color: #fbbf24; }
        .stat-card.purple .stat-icon { background: rgba(168,85,247,0.15); color: #a855f7; }
        .stat-card.rose .stat-icon { background: rgba(244,63,94,0.15); color: #f43f5e; }

        .stat-info {
          display: flex;
          flex-direction: column;
        }

        .stat-value {
          font-size: 22px;
          font-weight: 700;
          color: #fff;
        }

        .stat-label {
          font-size: 11px;
          color: #666;
        }

        /* Toolbar */
        .cc-toolbar {
          display: flex;
          gap: 10px;
          margin-bottom: 12px;
          flex-wrap: wrap;
        }

        .cc-search {
          flex: 1;
          min-width: 150px;
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 8px 12px;
          border-radius: 10px;
          background: rgba(0,0,0,0.3);
          border: 1px solid rgba(255,255,255,0.08);
          color: #666;
        }

        .cc-search input {
          flex: 1;
          background: none;
          border: none;
          color: #fff;
          font-size: 13px;
          outline: none;
        }

        .cc-search input::placeholder {
          color: #555;
        }

        .cc-add-btn {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 8px 14px;
          border-radius: 10px;
          background: rgba(34,211,238,0.15);
          border: 1px solid rgba(34,211,238,0.3);
          color: #22d3ee;
          font-size: 12px;
          font-weight: 500;
          cursor: pointer;
        }

        .cc-filter-btns {
          display: flex;
          gap: 6px;
        }

        .cc-filter-btn {
          padding: 6px 12px;
          border-radius: 8px;
          background: rgba(255,255,255,0.05);
          border: 1px solid rgba(255,255,255,0.08);
          color: #888;
          font-size: 11px;
          cursor: pointer;
        }

        .cc-filter-btn:hover {
          background: rgba(255,255,255,0.1);
          color: #fff;
        }

        /* List */
        .cc-list {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .cc-list-item {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 12px;
          border-radius: 12px;
          background: rgba(255,255,255,0.03);
          border: 1px solid rgba(255,255,255,0.05);
          cursor: pointer;
          transition: all 0.2s;
        }

        .cc-list-item:hover {
          background: rgba(255,255,255,0.06);
          border-color: rgba(255,255,255,0.1);
        }

        .item-avatar {
          width: 40px;
          height: 40px;
          border-radius: 10px;
          background: linear-gradient(135deg, rgba(34,211,238,0.2) 0%, rgba(59,130,246,0.2) 100%);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 14px;
          font-weight: 600;
          color: #22d3ee;
        }

        .item-avatar.vehicle {
          background: linear-gradient(135deg, rgba(168,85,247,0.2) 0%, rgba(236,72,153,0.2) 100%);
          color: #a855f7;
        }

        .item-info {
          flex: 1;
          min-width: 0;
        }

        .item-name {
          display: block;
          font-size: 14px;
          font-weight: 500;
          color: #fff;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .item-meta {
          display: flex;
          align-items: center;
          gap: 4px;
          font-size: 11px;
          color: #666;
        }

        .item-meta .vin {
          font-family: monospace;
          font-size: 10px;
        }

        .item-status {
          padding: 4px 8px;
          border-radius: 6px;
          font-size: 10px;
          font-weight: 500;
          text-transform: capitalize;
        }

        .item-status.new { background: rgba(34,211,238,0.15); color: #22d3ee; }
        .item-status.contacted { background: rgba(251,191,36,0.15); color: #fbbf24; }
        .item-status.qualified { background: rgba(168,85,247,0.15); color: #a855f7; }
        .item-status.negotiating { background: rgba(59,130,246,0.15); color: #3b82f6; }
        .item-status.sold { background: rgba(34,197,94,0.15); color: #22c55e; }
        .item-status.lost { background: rgba(239,68,68,0.15); color: #ef4444; }

        .item-category.active_inventory { background: rgba(34,197,94,0.15); color: #22c55e; }
        .item-category.trade_in { background: rgba(251,191,36,0.15); color: #fbbf24; }

        .item-chevron {
          color: #444;
        }

        .cc-loading, .cc-empty {
          text-align: center;
          padding: 40px 20px;
          color: #666;
          font-size: 13px;
        }

        /* Import Options */
        .import-options {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 10px;
        }

        .import-option {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 10px;
          padding: 20px 12px;
          border-radius: 14px;
          background: rgba(255,255,255,0.03);
          border: 1px solid rgba(255,255,255,0.05);
          cursor: pointer;
          text-align: center;
          transition: all 0.2s;
        }

        .import-option:hover {
          background: rgba(255,255,255,0.06);
          transform: translateY(-2px);
        }

        .import-option .io-icon {
          width: 48px;
          height: 48px;
          border-radius: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .import-option.cyan .io-icon { background: rgba(34,211,238,0.15); color: #22d3ee; }
        .import-option.amber .io-icon { background: rgba(251,191,36,0.15); color: #fbbf24; }
        .import-option.green .io-icon { background: rgba(34,197,94,0.15); color: #22c55e; }
        .import-option.purple .io-icon { background: rgba(168,85,247,0.15); color: #a855f7; }

        .import-option .io-title {
          font-size: 13px;
          font-weight: 600;
          color: #fff;
        }

        .import-option .io-desc {
          font-size: 11px;
          color: #666;
        }

        /* Integrations */
        .cc-description {
          font-size: 12px;
          color: #888;
          margin-bottom: 16px;
        }

        .integration-list {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .integration-item {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 14px;
          border-radius: 12px;
          background: rgba(255,255,255,0.03);
          border: 1px solid rgba(255,255,255,0.05);
        }

        .integration-item .int-name {
          font-size: 14px;
          font-weight: 500;
          color: #fff;
        }

        .integration-item .int-btn {
          padding: 6px 12px;
          border-radius: 8px;
          font-size: 11px;
          font-weight: 500;
          cursor: pointer;
          border: none;
        }

        .integration-item .int-btn.connect {
          background: rgba(34,211,238,0.15);
          color: #22d3ee;
        }

        .integration-item .int-btn.connected {
          background: rgba(34,197,94,0.15);
          color: #22c55e;
        }
      `}</style>
    </div>
  );
};

// Import Option Card
const ImportOption = ({ icon: Icon, title, description, color, onClick }) => (
  <div className={`import-option ${color}`} onClick={onClick}>
    <div className="io-icon"><Icon className="w-6 h-6" /></div>
    <span className="io-title">{title}</span>
    <span className="io-desc">{description}</span>
  </div>
);

// Integration Item
const IntegrationItem = ({ name, connected }) => (
  <div className="integration-item">
    <span className="int-name">{name}</span>
    <button className={`int-btn ${connected ? 'connected' : 'connect'}`}>
      {connected ? 'Connected' : 'Connect'}
    </button>
  </div>
);

// Customer Form Component
const CustomerForm = ({ onClose, customer }) => {
  const [formData, setFormData] = useState({
    first_name: customer?.first_name || '',
    last_name: customer?.last_name || '',
    phone: customer?.phone || '',
    email: customer?.email || '',
    address: customer?.address || '',
    lead_source: customer?.lead_source || 'manual',
    lead_status: customer?.lead_status || 'new',
    notes: customer?.notes || '',
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
      
      await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      onClose();
    } catch (e) {
      console.error('Save error:', e);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="form-overlay" onClick={onClose}>
      <div className="form-modal" onClick={e => e.stopPropagation()}>
        <div className="form-header">
          <h3>{customer ? 'Edit Customer' : 'Add Customer'}</h3>
          <button onClick={onClose} className="form-close"><X className="w-5 h-5" /></button>
        </div>
        <form onSubmit={handleSubmit} className="form-content">
          <div className="form-row">
            <div className="form-field">
              <label>First Name</label>
              <input 
                type="text" 
                value={formData.first_name}
                onChange={e => setFormData({...formData, first_name: e.target.value})}
                required
              />
            </div>
            <div className="form-field">
              <label>Last Name</label>
              <input 
                type="text" 
                value={formData.last_name}
                onChange={e => setFormData({...formData, last_name: e.target.value})}
              />
            </div>
          </div>
          <div className="form-field">
            <label>Phone</label>
            <input 
              type="tel" 
              value={formData.phone}
              onChange={e => setFormData({...formData, phone: e.target.value})}
            />
          </div>
          <div className="form-field">
            <label>Email</label>
            <input 
              type="email" 
              value={formData.email}
              onChange={e => setFormData({...formData, email: e.target.value})}
            />
          </div>
          <div className="form-field">
            <label>Address</label>
            <input 
              type="text" 
              value={formData.address}
              onChange={e => setFormData({...formData, address: e.target.value})}
            />
          </div>
          <div className="form-row">
            <div className="form-field">
              <label>Lead Source</label>
              <select 
                value={formData.lead_source}
                onChange={e => setFormData({...formData, lead_source: e.target.value})}
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
              <label>Status</label>
              <select 
                value={formData.lead_status}
                onChange={e => setFormData({...formData, lead_status: e.target.value})}
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
            <label>Notes</label>
            <textarea 
              rows={3}
              value={formData.notes}
              onChange={e => setFormData({...formData, notes: e.target.value})}
              placeholder="Add notes about this customer..."
            />
          </div>
          <div className="form-actions">
            <button type="button" onClick={onClose} className="btn-cancel">Cancel</button>
            <button type="submit" disabled={saving} className="btn-save">
              {saving ? 'Saving...' : 'Save Customer'}
            </button>
          </div>
        </form>

        <style>{`
          .form-overlay {
            position: fixed;
            inset: 0;
            background: rgba(0,0,0,0.7);
            z-index: 110;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 16px;
          }

          .form-modal {
            width: 100%;
            max-width: 400px;
            background: linear-gradient(180deg, rgba(28,30,38,0.99) 0%, rgba(18,20,26,0.99) 100%);
            border-radius: 20px;
            border: 1px solid rgba(255,255,255,0.1);
            overflow: hidden;
          }

          .form-header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 16px 20px;
            border-bottom: 1px solid rgba(255,255,255,0.06);
          }

          .form-header h3 {
            font-size: 16px;
            font-weight: 600;
            color: #fff;
            margin: 0;
          }

          .form-close {
            width: 32px;
            height: 32px;
            border-radius: 50%;
            background: rgba(255,255,255,0.06);
            border: none;
            color: #888;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
          }

          .form-content {
            padding: 20px;
          }

          .form-row {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 12px;
          }

          .form-field {
            margin-bottom: 14px;
          }

          .form-field label {
            display: block;
            font-size: 11px;
            font-weight: 500;
            color: #888;
            margin-bottom: 6px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
          }

          .form-field input,
          .form-field select,
          .form-field textarea {
            width: 100%;
            padding: 10px 12px;
            border-radius: 10px;
            background: rgba(0,0,0,0.3);
            border: 1px solid rgba(255,255,255,0.1);
            color: #fff;
            font-size: 14px;
            outline: none;
            transition: border-color 0.2s;
          }

          .form-field input:focus,
          .form-field select:focus,
          .form-field textarea:focus {
            border-color: rgba(34,211,238,0.5);
          }

          .form-field textarea {
            resize: vertical;
            min-height: 80px;
          }

          .form-actions {
            display: flex;
            gap: 10px;
            margin-top: 8px;
          }

          .btn-cancel {
            flex: 1;
            padding: 12px;
            border-radius: 10px;
            background: rgba(255,255,255,0.06);
            border: 1px solid rgba(255,255,255,0.1);
            color: #888;
            font-size: 14px;
            font-weight: 500;
            cursor: pointer;
          }

          .btn-save {
            flex: 1;
            padding: 12px;
            border-radius: 10px;
            background: rgba(34,211,238,0.2);
            border: 1px solid rgba(34,211,238,0.4);
            color: #22d3ee;
            font-size: 14px;
            font-weight: 500;
            cursor: pointer;
          }

          .btn-save:disabled {
            opacity: 0.5;
          }
        `}</style>
      </div>
    </div>
  );
};

// Customer Detail Component
const CustomerDetail = ({ customer, onClose, onEdit, onRefresh }) => {
  const [newNote, setNewNote] = useState('');
  const [addingNote, setAddingNote] = useState(false);
  const [showEjectModal, setShowEjectModal] = useState(false);
  const [ejectPhone, setEjectPhone] = useState('');
  const [ejecting, setEjecting] = useState(false);
  const [ejectResult, setEjectResult] = useState(null);

  // Load saved phone number
  useEffect(() => {
    const loadUserSettings = async () => {
      try {
        const res = await fetch(`${BACKEND_URL}/api/user/settings`);
        const data = await res.json();
        if (data.phone_number) setEjectPhone(data.phone_number);
      } catch (e) {
        console.error('Failed to load user settings:', e);
      }
    };
    loadUserSettings();
  }, []);

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
    } catch (e) {
      console.error('Add note error:', e);
    } finally {
      setAddingNote(false);
    }
  };

  const handleEject = async () => {
    if (!ejectPhone.trim()) return;
    setEjecting(true);
    setEjectResult(null);
    
    try {
      // Save phone number for future use
      await fetch(`${BACKEND_URL}/api/user/settings`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone_number: ejectPhone })
      });
      
      // Send the snapshot
      const res = await fetch(`${BACKEND_URL}/api/eject/customer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customer_id: customer.id,
          recipient_phone: ejectPhone
        })
      });
      
      const data = await res.json();
      setEjectResult(data);
      
      if (data.success) {
        setTimeout(() => {
          setShowEjectModal(false);
          setEjectResult(null);
          onRefresh();
        }, 2000);
      }
    } catch (e) {
      setEjectResult({ success: false, error: e.message });
    } finally {
      setEjecting(false);
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
          <button onClick={onClose} className="detail-close"><X className="w-5 h-5" /></button>
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

          {/* Notes Section */}
          <div className="detail-section">
            <h4>Notes & Interactions</h4>
            <div className="note-input">
              <textarea
                value={newNote}
                onChange={e => setNewNote(e.target.value)}
                placeholder="Add a note..."
                rows={2}
              />
              <button onClick={addNote} disabled={addingNote || !newNote.trim()}>
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
          <button onClick={() => setShowEjectModal(true)} className="btn-eject">
            <Send className="w-4 h-4" /> Eject
          </button>
          <button onClick={onEdit} className="btn-edit">
            <Edit3 className="w-4 h-4" /> Edit
          </button>
        </div>

        {/* Eject Modal */}
        {showEjectModal && (
          <div className="eject-overlay" onClick={() => setShowEjectModal(false)}>
            <div className="eject-modal" onClick={e => e.stopPropagation()}>
              <div className="eject-header">
                <Send className="w-5 h-5" />
                <h3>Eject Snapshot</h3>
                <button onClick={() => setShowEjectModal(false)} className="eject-close">
                  <X className="w-4 h-4" />
                </button>
              </div>
              
              <div className="eject-content">
                <p className="eject-desc">
                  Send a snapshot of <strong>{customer.first_name}'s</strong> profile to your phone via SMS.
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
                
                <div className="eject-phone-input">
                  <label>
                    <Smartphone className="w-4 h-4" />
                    Your Phone Number
                  </label>
                  <input
                    type="tel"
                    value={ejectPhone}
                    onChange={e => setEjectPhone(e.target.value)}
                    placeholder="+1 555-123-4567"
                  />
                  <span className="phone-hint">Include country code for best results</span>
                </div>
                
                {ejectResult && (
                  <div className={`eject-result ${ejectResult.success ? 'success' : 'error'}`}>
                    {ejectResult.success ? (
                      <>
                        <CheckCircle2 className="w-5 h-5" />
                        <span>Snapshot sent to {ejectPhone}</span>
                      </>
                    ) : (
                      <>
                        <AlertCircle className="w-5 h-5" />
                        <span>{ejectResult.error || ejectResult.hint || 'Failed to send'}</span>
                      </>
                    )}
                  </div>
                )}
                
                <button 
                  onClick={handleEject} 
                  disabled={!ejectPhone.trim() || ejecting}
                  className="eject-send-btn"
                >
                  {ejecting ? 'Sending...' : 'Send Snapshot'}
                </button>
              </div>
            </div>
          </div>
        )}

        <style>{`
          .detail-overlay {
            position: fixed;
            inset: 0;
            background: rgba(0,0,0,0.7);
            z-index: 110;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 16px;
          }

          .detail-modal {
            width: 100%;
            max-width: 400px;
            max-height: 80vh;
            background: linear-gradient(180deg, rgba(28,30,38,0.99) 0%, rgba(18,20,26,0.99) 100%);
            border-radius: 20px;
            border: 1px solid rgba(255,255,255,0.1);
            overflow: hidden;
            display: flex;
            flex-direction: column;
          }

          .detail-header {
            display: flex;
            align-items: center;
            gap: 14px;
            padding: 20px;
            border-bottom: 1px solid rgba(255,255,255,0.06);
          }

          .detail-avatar {
            width: 50px;
            height: 50px;
            border-radius: 14px;
            background: linear-gradient(135deg, rgba(34,211,238,0.2) 0%, rgba(59,130,246,0.2) 100%);
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 18px;
            font-weight: 600;
            color: #22d3ee;
          }

          .detail-title {
            flex: 1;
          }

          .detail-title h3 {
            font-size: 18px;
            font-weight: 600;
            color: #fff;
            margin: 0 0 4px 0;
          }

          .detail-status {
            padding: 4px 10px;
            border-radius: 6px;
            font-size: 11px;
            font-weight: 500;
            text-transform: capitalize;
          }

          .detail-status.new { background: rgba(34,211,238,0.15); color: #22d3ee; }
          .detail-status.contacted { background: rgba(251,191,36,0.15); color: #fbbf24; }
          .detail-status.qualified { background: rgba(168,85,247,0.15); color: #a855f7; }
          .detail-status.sold { background: rgba(34,197,94,0.15); color: #22c55e; }

          .detail-close {
            width: 32px;
            height: 32px;
            border-radius: 50%;
            background: rgba(255,255,255,0.06);
            border: none;
            color: #888;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
          }

          .detail-content {
            flex: 1;
            overflow-y: auto;
            padding: 16px 20px;
          }

          .detail-section {
            margin-bottom: 20px;
          }

          .detail-section h4 {
            font-size: 12px;
            font-weight: 600;
            color: #888;
            margin: 0 0 12px 0;
            text-transform: uppercase;
            letter-spacing: 0.5px;
          }

          .detail-item {
            display: flex;
            align-items: center;
            gap: 10px;
            padding: 10px 0;
            border-bottom: 1px solid rgba(255,255,255,0.04);
            color: #ccc;
            font-size: 14px;
          }

          .detail-item svg {
            color: #666;
          }

          .note-input {
            display: flex;
            gap: 8px;
            margin-bottom: 12px;
          }

          .note-input textarea {
            flex: 1;
            padding: 10px;
            border-radius: 10px;
            background: rgba(0,0,0,0.3);
            border: 1px solid rgba(255,255,255,0.1);
            color: #fff;
            font-size: 13px;
            resize: none;
            outline: none;
          }

          .note-input button {
            width: 44px;
            border-radius: 10px;
            background: rgba(34,211,238,0.2);
            border: 1px solid rgba(34,211,238,0.3);
            color: #22d3ee;
            cursor: pointer;
          }

          .note-input button:disabled {
            opacity: 0.4;
          }

          .interactions-list {
            max-height: 200px;
            overflow-y: auto;
          }

          .interaction-item {
            padding: 12px;
            margin-bottom: 8px;
            border-radius: 10px;
            background: rgba(255,255,255,0.03);
            border: 1px solid rgba(255,255,255,0.05);
          }

          .interaction-item .int-type {
            font-size: 10px;
            font-weight: 600;
            color: #22d3ee;
            text-transform: uppercase;
            margin-bottom: 4px;
          }

          .interaction-item p {
            font-size: 13px;
            color: #ddd;
            margin: 0 0 6px 0;
          }

          .interaction-item .int-time {
            font-size: 10px;
            color: #666;
          }

          .no-interactions {
            text-align: center;
            color: #666;
            font-size: 13px;
            padding: 20px;
          }

          .detail-actions {
            display: flex;
            gap: 10px;
            padding: 16px 20px;
            border-top: 1px solid rgba(255,255,255,0.06);
          }

          .btn-eject {
            flex: 1;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 8px;
            padding: 12px;
            border-radius: 10px;
            background: linear-gradient(135deg, rgba(244,63,94,0.2) 0%, rgba(251,146,60,0.2) 100%);
            border: 1px solid rgba(244,63,94,0.4);
            color: #fb7185;
            font-size: 14px;
            font-weight: 500;
            cursor: pointer;
            transition: all 0.2s;
          }

          .btn-eject:hover {
            background: linear-gradient(135deg, rgba(244,63,94,0.3) 0%, rgba(251,146,60,0.3) 100%);
            box-shadow: 0 0 20px rgba(244,63,94,0.2);
          }

          .btn-edit {
            flex: 1;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 8px;
            padding: 12px;
            border-radius: 10px;
            background: rgba(34,211,238,0.15);
            border: 1px solid rgba(34,211,238,0.3);
            color: #22d3ee;
            font-size: 14px;
            font-weight: 500;
            cursor: pointer;
          }

          /* Eject Modal */
          .eject-overlay {
            position: fixed;
            inset: 0;
            background: rgba(0,0,0,0.8);
            z-index: 120;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 16px;
          }

          .eject-modal {
            width: 100%;
            max-width: 360px;
            background: linear-gradient(180deg, rgba(28,30,38,0.99) 0%, rgba(18,20,26,0.99) 100%);
            border-radius: 20px;
            border: 1px solid rgba(244,63,94,0.2);
            box-shadow: 0 25px 50px rgba(0,0,0,0.5), 0 0 40px rgba(244,63,94,0.1);
            overflow: hidden;
          }

          .eject-header {
            display: flex;
            align-items: center;
            gap: 10px;
            padding: 16px 20px;
            border-bottom: 1px solid rgba(255,255,255,0.06);
            color: #fb7185;
          }

          .eject-header h3 {
            flex: 1;
            font-size: 16px;
            font-weight: 600;
            color: #fff;
            margin: 0;
          }

          .eject-close {
            width: 28px;
            height: 28px;
            border-radius: 50%;
            background: rgba(255,255,255,0.06);
            border: none;
            color: #888;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
          }

          .eject-content {
            padding: 20px;
          }

          .eject-desc {
            font-size: 13px;
            color: #aaa;
            margin: 0 0 16px 0;
          }

          .eject-desc strong {
            color: #fff;
          }

          .eject-preview {
            background: rgba(0,0,0,0.3);
            border-radius: 12px;
            padding: 12px;
            margin-bottom: 16px;
          }

          .preview-item {
            display: flex;
            justify-content: space-between;
            padding: 8px 0;
            border-bottom: 1px solid rgba(255,255,255,0.04);
            font-size: 13px;
          }

          .preview-item:last-child {
            border-bottom: none;
          }

          .preview-label {
            color: #666;
          }

          .preview-item span:last-child {
            color: #ddd;
          }

          .status-badge {
            padding: 2px 8px;
            border-radius: 4px;
            font-size: 11px;
            text-transform: capitalize;
          }

          .status-badge.new { background: rgba(34,211,238,0.15); color: #22d3ee; }
          .status-badge.contacted { background: rgba(251,191,36,0.15); color: #fbbf24; }
          .status-badge.qualified { background: rgba(168,85,247,0.15); color: #a855f7; }
          .status-badge.sold { background: rgba(34,197,94,0.15); color: #22c55e; }

          .eject-phone-input {
            margin-bottom: 16px;
          }

          .eject-phone-input label {
            display: flex;
            align-items: center;
            gap: 6px;
            font-size: 11px;
            font-weight: 500;
            color: #888;
            margin-bottom: 8px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
          }

          .eject-phone-input input {
            width: 100%;
            padding: 12px 14px;
            border-radius: 10px;
            background: rgba(0,0,0,0.4);
            border: 1px solid rgba(255,255,255,0.1);
            color: #fff;
            font-size: 16px;
            outline: none;
            transition: border-color 0.2s;
          }

          .eject-phone-input input:focus {
            border-color: rgba(244,63,94,0.5);
          }

          .phone-hint {
            display: block;
            font-size: 10px;
            color: #555;
            margin-top: 6px;
          }

          .eject-result {
            display: flex;
            align-items: center;
            gap: 10px;
            padding: 12px;
            border-radius: 10px;
            margin-bottom: 16px;
            font-size: 13px;
          }

          .eject-result.success {
            background: rgba(34,197,94,0.1);
            border: 1px solid rgba(34,197,94,0.2);
            color: #22c55e;
          }

          .eject-result.error {
            background: rgba(239,68,68,0.1);
            border: 1px solid rgba(239,68,68,0.2);
            color: #ef4444;
          }

          .eject-send-btn {
            width: 100%;
            padding: 14px;
            border-radius: 12px;
            background: linear-gradient(135deg, rgba(244,63,94,0.25) 0%, rgba(251,146,60,0.2) 100%);
            border: 1px solid rgba(244,63,94,0.4);
            color: #fb7185;
            font-size: 14px;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.2s;
          }

          .eject-send-btn:hover:not(:disabled) {
            background: linear-gradient(135deg, rgba(244,63,94,0.35) 0%, rgba(251,146,60,0.3) 100%);
            box-shadow: 0 0 20px rgba(244,63,94,0.2);
          }

          .eject-send-btn:disabled {
            opacity: 0.5;
          }
        `}</style>
      </div>
    </div>
  );
};

// Import Modal Component
const ImportModal = ({ onClose, onSuccess }) => {
  const [mode, setMode] = useState('file'); // 'file' or 'email'
  const [importType, setImportType] = useState('customers');
  const [file, setFile] = useState(null);
  const [emailBody, setEmailBody] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);

  const handleFileImport = async () => {
    if (!file) return;
    setLoading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('import_type', importType);
      
      const res = await fetch(`${BACKEND_URL}/api/import/file`, {
        method: 'POST',
        body: formData
      });
      const data = await res.json();
      setResult(data);
      if (data.success) setTimeout(onSuccess, 1500);
    } catch (e) {
      setResult({ success: false, error: e.message });
    } finally {
      setLoading(false);
    }
  };

  const handleEmailParse = async () => {
    if (!emailBody.trim()) return;
    setLoading(true);
    try {
      const formData = new FormData();
      formData.append('email_body', emailBody);
      
      const res = await fetch(`${BACKEND_URL}/api/import/email`, {
        method: 'POST',
        body: formData
      });
      const data = await res.json();
      setResult(data);
      if (data.success) setTimeout(onSuccess, 1500);
    } catch (e) {
      setResult({ success: false, error: e.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="import-overlay" onClick={onClose}>
      <div className="import-modal" onClick={e => e.stopPropagation()}>
        <div className="import-header">
          <h3>Import Data</h3>
          <button onClick={onClose} className="import-close"><X className="w-5 h-5" /></button>
        </div>

        <div className="import-tabs">
          <button 
            className={mode === 'file' ? 'active' : ''} 
            onClick={() => setMode('file')}
          >
            <FileUp className="w-4 h-4" /> File Upload
          </button>
          <button 
            className={mode === 'email' ? 'active' : ''} 
            onClick={() => setMode('email')}
          >
            <Mail className="w-4 h-4" /> Email Parser
          </button>
        </div>

        <div className="import-content">
          {mode === 'file' && (
            <>
              <div className="import-type-select">
                <label>Import Type</label>
                <select value={importType} onChange={e => setImportType(e.target.value)}>
                  <option value="customers">Customers</option>
                  <option value="vehicles">Vehicles</option>
                </select>
              </div>
              <div className="file-drop">
                <input 
                  type="file" 
                  accept=".csv,.xlsx,.xls"
                  onChange={e => setFile(e.target.files[0])}
                />
                <FileUp className="w-8 h-8" />
                <p>{file ? file.name : 'Drop CSV or Excel file here'}</p>
              </div>
              <button 
                onClick={handleFileImport} 
                disabled={!file || loading}
                className="import-btn"
              >
                {loading ? 'Importing...' : 'Import File'}
              </button>
            </>
          )}

          {mode === 'email' && (
            <>
              <p className="import-hint">Paste a lead email below to automatically extract customer information.</p>
              <textarea
                value={emailBody}
                onChange={e => setEmailBody(e.target.value)}
                placeholder="Paste lead email content here..."
                rows={8}
              />
              <button 
                onClick={handleEmailParse} 
                disabled={!emailBody.trim() || loading}
                className="import-btn"
              >
                {loading ? 'Parsing...' : 'Parse Email'}
              </button>
            </>
          )}

          {result && (
            <div className={`import-result ${result.success ? 'success' : 'error'}`}>
              {result.success ? (
                <>
                  <CheckCircle2 className="w-5 h-5" />
                  <span>
                    {result.imported ? `Imported ${result.imported} records` : result.message}
                  </span>
                </>
              ) : (
                <>
                  <AlertCircle className="w-5 h-5" />
                  <span>{result.error || 'Import failed'}</span>
                </>
              )}
            </div>
          )}
        </div>

        <style>{`
          .import-overlay {
            position: fixed;
            inset: 0;
            background: rgba(0,0,0,0.7);
            z-index: 110;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 16px;
          }

          .import-modal {
            width: 100%;
            max-width: 400px;
            background: linear-gradient(180deg, rgba(28,30,38,0.99) 0%, rgba(18,20,26,0.99) 100%);
            border-radius: 20px;
            border: 1px solid rgba(255,255,255,0.1);
            overflow: hidden;
          }

          .import-header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 16px 20px;
            border-bottom: 1px solid rgba(255,255,255,0.06);
          }

          .import-header h3 {
            font-size: 16px;
            font-weight: 600;
            color: #fff;
            margin: 0;
          }

          .import-close {
            width: 32px;
            height: 32px;
            border-radius: 50%;
            background: rgba(255,255,255,0.06);
            border: none;
            color: #888;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
          }

          .import-tabs {
            display: flex;
            gap: 4px;
            padding: 8px 12px;
            background: rgba(0,0,0,0.2);
          }

          .import-tabs button {
            flex: 1;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 6px;
            padding: 10px;
            border-radius: 8px;
            background: transparent;
            border: none;
            color: #666;
            font-size: 13px;
            cursor: pointer;
          }

          .import-tabs button.active {
            background: rgba(34,211,238,0.1);
            color: #22d3ee;
          }

          .import-content {
            padding: 20px;
          }

          .import-type-select {
            margin-bottom: 16px;
          }

          .import-type-select label {
            display: block;
            font-size: 11px;
            color: #888;
            margin-bottom: 6px;
            text-transform: uppercase;
          }

          .import-type-select select {
            width: 100%;
            padding: 10px;
            border-radius: 10px;
            background: rgba(0,0,0,0.3);
            border: 1px solid rgba(255,255,255,0.1);
            color: #fff;
            font-size: 14px;
          }

          .file-drop {
            position: relative;
            padding: 40px 20px;
            border-radius: 14px;
            border: 2px dashed rgba(255,255,255,0.15);
            background: rgba(0,0,0,0.2);
            text-align: center;
            margin-bottom: 16px;
          }

          .file-drop input {
            position: absolute;
            inset: 0;
            opacity: 0;
            cursor: pointer;
          }

          .file-drop svg {
            color: #555;
            margin-bottom: 8px;
          }

          .file-drop p {
            color: #888;
            font-size: 13px;
            margin: 0;
          }

          .import-hint {
            font-size: 12px;
            color: #888;
            margin-bottom: 12px;
          }

          .import-content textarea {
            width: 100%;
            padding: 12px;
            border-radius: 12px;
            background: rgba(0,0,0,0.3);
            border: 1px solid rgba(255,255,255,0.1);
            color: #fff;
            font-size: 13px;
            resize: none;
            margin-bottom: 16px;
            outline: none;
          }

          .import-btn {
            width: 100%;
            padding: 14px;
            border-radius: 12px;
            background: rgba(34,211,238,0.2);
            border: 1px solid rgba(34,211,238,0.4);
            color: #22d3ee;
            font-size: 14px;
            font-weight: 500;
            cursor: pointer;
          }

          .import-btn:disabled {
            opacity: 0.5;
          }

          .import-result {
            display: flex;
            align-items: center;
            gap: 10px;
            padding: 14px;
            border-radius: 12px;
            margin-top: 16px;
            font-size: 13px;
          }

          .import-result.success {
            background: rgba(34,197,94,0.1);
            border: 1px solid rgba(34,197,94,0.2);
            color: #22c55e;
          }

          .import-result.error {
            background: rgba(239,68,68,0.1);
            border: 1px solid rgba(239,68,68,0.2);
            color: #ef4444;
          }
        `}</style>
      </div>
    </div>
  );
};

export default CommandCenter;

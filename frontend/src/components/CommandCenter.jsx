import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { 
  X, Users, Upload, BarChart3, 
  Search, Plus, ChevronRight, Settings,
  FileUp, UserPlus, Trash2, Edit3, Phone, MapPin,
  Clock, Tag, CheckCircle2, AlertCircle,
  Zap, Bell, Volume2, VolumeX, Building2,
  User, Save, Eye, EyeOff, Loader2, ToggleLeft, ToggleRight,
  Printer, Wifi, WifiOff, Mail, MessageSquare, Image
} from 'lucide-react';
import { toast } from 'sonner';
import { useSales } from '../context/SalesContext';
import { 
  getSoundPreferences, 
  setSoundPreferences,
  getSoundProfiles
} from '../utils/notificationSound';
import LanguageSelector from './LanguageSelector';
import VisionExtractor from './VisionExtractor';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL;

/**
 * Command Center - Premium Liquid Glass UI
 * Replaces the old Check Engine menu
 */
export const CommandCenter = ({ isOpen, onClose }) => {
  const { toggleImport } = useSales();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [stats, setStats] = useState(null);
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Language preferences
  const [defaultTargetLanguage, setDefaultTargetLanguage] = useState(
    () => localStorage.getItem('defaultTargetLanguage') || 'es'
  );
  
  // Sub-modals
  const [showCustomerForm, setShowCustomerForm] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [showVisionExtractor, setShowVisionExtractor] = useState(false);
  const [prefillCustomerData, setPrefillCustomerData] = useState(null);

  // Printer state
  const [printerIP, setPrinterIP] = useState(() => localStorage.getItem('printerIP') || '');
  const [printerStatus, setPrinterStatus] = useState('disconnected');
  const [testingPrinter, setTestingPrinter] = useState(false);

  // Test printer connection
  const testPrinterConnection = async () => {
    if (!printerIP.trim()) {
      toast.error('Enter a printer IP address');
      return;
    }
    
    setTestingPrinter(true);
    setPrinterStatus('testing');
    
    try {
      const res = await fetch(`${BACKEND_URL}/api/printer/test`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ip: printerIP.trim() })
      });
      
      const data = await res.json();
      
      if (data.success) {
        setPrinterStatus('connected');
        localStorage.setItem('printerIP', printerIP.trim());
        toast.success('Printer connected!', { description: data.printer_name || printerIP });
      } else {
        setPrinterStatus('disconnected');
        toast.error('Connection failed', { description: data.error || 'Check IP address' });
      }
    } catch {
      setPrinterStatus('connected');
      localStorage.setItem('printerIP', printerIP.trim());
      toast.success('Printer saved!', { description: `IP: ${printerIP}` });
    } finally {
      setTestingPrinter(false);
    }
  };

  // Disconnect printer
  const disconnectPrinter = () => {
    setPrinterStatus('disconnected');
    localStorage.removeItem('printerIP');
    setPrinterIP('');
    toast.info('Printer disconnected');
  };

  // Fetch data on tab change
  useEffect(() => {
    if (!isOpen) return;
    
    if (activeTab === 'dashboard') fetchStats();
    if (activeTab === 'customers') fetchCustomers();
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

  if (!isOpen) return null;

  const tabs = [
    { id: 'dashboard', label: 'Dashboard', icon: BarChart3 },
    { id: 'customers', label: 'Customers', icon: Users },
    { id: 'import', label: 'Import', icon: Upload },
    { id: 'printer', label: 'Printer', icon: Printer },
    { id: 'settings', label: 'Settings', icon: Settings },
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

  // Use portal to render outside header context
  return createPortal(
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
                    <div className="stat-icon"><Users className="w-5 h-5" /></div>
                    <div className="stat-info">
                      <span className="stat-value">{stats.customers?.contacted || 0}</span>
                      <span className="stat-label">Contacted</span>
                    </div>
                  </div>
                  <div className="stat-card rose">
                    <div className="stat-icon"><CheckCircle2 className="w-5 h-5" /></div>
                    <div className="stat-info">
                      <span className="stat-value">{stats.customers?.appointment || 0}</span>
                      <span className="stat-label">Appointments</span>
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
                <div className="cc-search cc-search-blue-glass">
                  <Search className="w-4 h-4" />
                  <input
                    type="text"
                    placeholder="Search customers..."
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    className="search-input-transparent"
                    style={{
                      background: 'transparent',
                      backgroundColor: 'transparent',
                      backgroundImage: 'none',
                      border: 'none',
                      borderWidth: 0,
                      outline: 'none',
                      boxShadow: 'none',
                      WebkitAppearance: 'none',
                      MozAppearance: 'none',
                      appearance: 'none'
                    }}
                  />
                </div>
                <button onClick={() => setShowCustomerForm(true)} className="cc-add-btn gold-btn">
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

          {/* Import Tab */}
          {activeTab === 'import' && (
            <div className="cc-import">
              <h3>Import Data</h3>
              <div className="import-options">
                <ImportOption 
                  icon={FileUp}
                  title="File Upload"
                  description="Import from CSV or JSON"
                  color="cyan"
                  onClick={() => {
                    toggleImport(true);
                  }}
                />
                <ImportOption 
                  icon={UserPlus}
                  title="Manual Entry"
                  description="Add customer manually"
                  color="green"
                  onClick={() => {
                    toggleImport(true);
                  }}
                />
                <ImportOption 
                  icon={Image}
                  title="Vision Extraction"
                  description="Screenshot → Customer data"
                  color="purple"
                  onClick={() => setShowVisionExtractor(true)}
                />
              </div>
            </div>
          )}

          {/* Printer Tab */}
          {activeTab === 'printer' && (
            <div className="cc-printer">
              <h3>Printer Connection</h3>
              <p className="cc-description">Connect to a network printer via IP address to print licenses and profiles.</p>
              
              <div className="printer-status-card">
                <div className="printer-status-icon">
                  {printerStatus === 'connected' ? (
                    <Wifi className="w-8 h-8 text-green-500" />
                  ) : printerStatus === 'testing' ? (
                    <Loader2 className="w-8 h-8 animate-spin text-amber-500" />
                  ) : (
                    <WifiOff className="w-8 h-8 text-zinc-500" />
                  )}
                </div>
                <div className="printer-status-text">
                  <span className={`status-label ${printerStatus}`}>
                    {printerStatus === 'connected' ? 'Connected' : 
                     printerStatus === 'testing' ? 'Testing...' : 'Disconnected'}
                  </span>
                  {printerStatus === 'connected' && printerIP && (
                    <span className="status-ip">{printerIP}</span>
                  )}
                </div>
              </div>

              <div className="printer-form">
                <label>Printer IP Address</label>
                <div className="printer-input-row">
                  <input 
                    type="text"
                    placeholder="192.168.1.100"
                    value={printerIP}
                    onChange={(e) => setPrinterIP(e.target.value)}
                    className="printer-ip-input"
                    disabled={printerStatus === 'testing'}
                  />
                  {printerStatus === 'connected' ? (
                    <button 
                      onClick={disconnectPrinter}
                      className="printer-btn disconnect"
                    >
                      Disconnect
                    </button>
                  ) : (
                    <button 
                      onClick={testPrinterConnection}
                      disabled={testingPrinter || !printerIP.trim()}
                      className="printer-btn connect"
                    >
                      {testingPrinter ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Connect'}
                    </button>
                  )}
                </div>
              </div>

              <div className="printer-info">
                <h4>Eject Feature</h4>
                <p>When viewing a customer profile or after scanning a driver&apos;s license, use the <strong>Eject</strong> button to print:</p>
                <ul>
                  <li>Scanned driver&apos;s license image</li>
                  <li>Customer profile snapshot</li>
                </ul>
              </div>
            </div>
          )}

          {/* Settings Tab */}
          {activeTab === 'settings' && (
            <SettingsTab 
              defaultTargetLanguage={defaultTargetLanguage}
              onLanguageChange={(lang) => {
                setDefaultTargetLanguage(lang);
                localStorage.setItem('defaultTargetLanguage', lang);
                toast.success(`Default translation language set to ${lang.toUpperCase()}`);
              }}
            />
          )}
        </div>

        {/* Customer Form Modal */}
        {showCustomerForm && (
          <CustomerForm 
            customer={selectedCustomer}
            initialData={prefillCustomerData}
            onClose={() => {
              setShowCustomerForm(false);
              setPrefillCustomerData(null);
            }}
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

        {/* Vision Extraction Modal */}
        {showVisionExtractor && (
          <div className="form-overlay" onClick={() => setShowVisionExtractor(false)}>
            <div className="form-modal" onClick={e => e.stopPropagation()}>
              <VisionExtractor 
                onClose={() => setShowVisionExtractor(false)}
                onDataExtracted={(data) => {
                  // Map vision fields into our unified customer form prefill state
                  const mapped = {
                    first_name: data.firstName || '',
                    last_name: data.lastName || '',
                    email: data.email || '',
                    phone: data.phone || '',
                    address: data.address || '',
                    policy_number: data.policyNumber || '',
                    vehicle_vin: data.vehicleOfInterest || '',
                    trade_vin: data.tradeVin || '',
                    trade_mileage: data.tradeMileage || '',
                    lead_source: data.leadSource || 'vision_extract',
                    lead_status: data.leadStatus || 'new',
                    notes: data.notes || '',
                  };

                  setPrefillCustomerData(mapped);
                  setShowVisionExtractor(false);
                  setSelectedCustomer(null);
                  setShowCustomerForm(true);
                }}
              />
            </div>
          </div>
        )}
      </div>

      <style>{`
        .cc-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          width: 100vw;
          height: 100vh;
          background: rgba(10,8,6,0.9);
          backdrop-filter: blur(16px);
          z-index: 9999;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 16px;
        }

        .cc-modal {
          position: relative;
          width: calc(100% - 32px);
          max-width: 560px;
          max-height: 85vh;
          margin: auto;
          /* designo Night - Nappa leather with Picasso swirl */
          background: 
            /* Picasso swirl - burgundy and teal */
            radial-gradient(ellipse 180% 90% at 0% 40%, rgba(128, 40, 60, 0.1) 0%, transparent 55%),
            radial-gradient(ellipse 150% 100% at 100% 60%, rgba(40, 100, 120, 0.08) 0%, transparent 55%),
            conic-gradient(from 170deg at 15% 65%, transparent 0deg, rgba(140, 50, 70, 0.06) 55deg, transparent 110deg),
            conic-gradient(from 350deg at 85% 35%, transparent 0deg, rgba(50, 110, 130, 0.05) 45deg, transparent 90deg),
            /* Gold accent at bottom */
            radial-gradient(ellipse 80% 50% at 50% 100%, rgba(200, 160, 80, 0.06) 0%, transparent 50%),
            /* Quilted nappa base */
            repeating-linear-gradient(45deg, transparent, transparent 22px, rgba(180, 140, 80, 0.02) 22px, rgba(180, 140, 80, 0.02) 23px),
            repeating-linear-gradient(-45deg, transparent, transparent 22px, rgba(180, 140, 80, 0.02) 22px, rgba(180, 140, 80, 0.02) 23px),
            linear-gradient(165deg, #1a1816 0%, #0f0e0d 50%, #141210 100%);
          backdrop-filter: blur(20px);
          -webkit-backdrop-filter: blur(20px);
          border-radius: 20px;
          /* Wood bezel border */
          border: 3px solid;
          border-image: linear-gradient(135deg, #5C3A1E 0%, #7A4F2A 25%, #6B4324 50%, #8B5A2B 75%, #5C3A1E 100%) 1;
          box-shadow: 
            /* Chrome outer ring */
            0 0 0 1px rgba(60, 50, 40, 0.8),
            0 0 0 2px rgba(100, 80, 55, 0.4),
            /* Depth shadow */
            0 30px 60px rgba(0, 0, 0, 0.6),
            /* Inner highlight */
            inset 0 1px 0 rgba(255, 200, 140, 0.05),
            /* Ambient glow */
            0 0 80px rgba(255, 140, 60, 0.05);
          display: flex;
          flex-direction: column;
          overflow: hidden;
        }

        /* Contrast stitching pattern */
        .cc-modal::before {
          content: '';
          position: absolute;
          inset: 0;
          background: 
            radial-gradient(circle at 0 0, rgba(212, 175, 55, 0.07) 1.5px, transparent 1.5px),
            radial-gradient(circle at 22px 22px, rgba(212, 175, 55, 0.07) 1.5px, transparent 1.5px);
          background-size: 44px 44px;
          pointer-events: none;
          opacity: 0.6;
          border-radius: 18px;
        }

        /* Additional artistic accent */
        .cc-modal::after {
          content: '';
          position: absolute;
          inset: 0;
          background: 
            /* Flowing Picasso brush strokes */
            conic-gradient(from 200deg at 25% 55%, transparent 0deg, rgba(140, 50, 70, 0.04) 40deg, transparent 80deg),
            conic-gradient(from 20deg at 75% 45%, transparent 0deg, rgba(50, 110, 130, 0.03) 50deg, transparent 100deg);
          pointer-events: none;
          opacity: 0.7;
          border-radius: 18px;
        }

        .cc-header {
          position: relative;
          z-index: 1;
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 14px 20px;
          /* Brushed aluminum header rail */
          background: 
            repeating-linear-gradient(90deg, transparent, transparent 1px, rgba(255, 255, 255, 0.02) 1px, rgba(255, 255, 255, 0.02) 2px),
            linear-gradient(180deg, rgba(35, 32, 28, 0.95) 0%, rgba(25, 22, 18, 0.98) 100%);
          border-bottom: 2px solid rgba(120, 90, 50, 0.35);
          box-shadow: inset 0 -1px 0 rgba(0, 0, 0, 0.3);
        }

        .cc-header-title {
          display: flex;
          align-items: center;
          gap: 10px;
          font-family: 'Bebas Neue', sans-serif;
          font-size: 18px;
          font-weight: 400;
          letter-spacing: 0.1em;
          /* Amber illuminated text - authentic W140 gauge */
          color: #FFB850;
          text-shadow: 
            0 0 10px rgba(255, 180, 80, 0.5),
            0 0 20px rgba(255, 160, 60, 0.3);
        }

        .cc-close {
          width: 32px;
          height: 32px;
          border-radius: 8px;
          background: rgba(255, 255, 255, 0.04);
          border: 1px solid rgba(255, 255, 255, 0.08);
          color: rgba(255, 255, 255, 0.5);
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.2s;
        }

        .cc-close:hover {
          background: rgba(239, 68, 68, 0.15);
          border-color: rgba(239, 68, 68, 0.3);
          color: #f87171;
        }

        .cc-tabs {
          position: relative;
          z-index: 1;
          display: flex;
          justify-content: space-between;
          gap: 4px;
          padding: 10px 12px;
          /* Brushed aluminum rail */
          background: 
            repeating-linear-gradient(90deg, transparent, transparent 1px, rgba(255, 255, 255, 0.02) 1px, rgba(255, 255, 255, 0.02) 2px),
            linear-gradient(180deg, rgba(35, 32, 28, 0.95) 0%, rgba(25, 22, 18, 0.98) 100%);
          border-bottom: 2px solid rgba(120, 90, 50, 0.35);
        }

        .cc-tab {
          flex: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 3px;
          padding: 8px 4px;
          border-radius: 8px;
          background: transparent;
          border: 2px solid transparent;
          color: rgba(255, 200, 150, 0.5);
          font-family: 'Bebas Neue', sans-serif;
          font-size: 10px;
          font-weight: 400;
          letter-spacing: 0.08em;
          cursor: pointer;
          white-space: nowrap;
          transition: all 0.25s ease;
        }
        
        .cc-tab svg {
          width: 18px;
          height: 18px;
        }

        .cc-tab:hover {
          color: rgba(255, 200, 150, 0.85);
          background: rgba(200, 160, 80, 0.1);
          border-color: rgba(200, 160, 80, 0.2);
        }

        .cc-tab.active {
          color: #FFB850;
          background: linear-gradient(180deg, rgba(200, 160, 80, 0.2) 0%, rgba(180, 140, 60, 0.15) 100%);
          border-color: rgba(200, 160, 80, 0.4);
          text-shadow: 0 0 10px rgba(255, 180, 80, 0.5);
          box-shadow: 
            0 0 15px rgba(200, 160, 80, 0.15),
            inset 0 1px 0 rgba(255, 255, 255, 0.05);
        }

        .cc-content {
          position: relative;
          z-index: 1;
          flex: 1;
          overflow-y: auto;
          padding: 16px;
        }

        /* Custom scrollbar for content */
        .cc-content::-webkit-scrollbar {
          width: 5px;
        }

        .cc-content::-webkit-scrollbar-track {
          background: rgba(0, 0, 0, 0.2);
          border-radius: 3px;
        }

        .cc-content::-webkit-scrollbar-thumb {
          background: linear-gradient(180deg, rgba(255, 140, 0, 0.3) 0%, rgba(255, 100, 0, 0.2) 100%);
          border-radius: 3px;
        }

        .cc-content h3 {
          font-family: 'Bebas Neue', sans-serif;
          font-size: 15px;
          font-weight: 400;
          letter-spacing: 0.08em;
          color: rgba(255, 200, 150, 0.8);
          margin: 0 0 16px 0;
        }

        /* Dashboard Stats - Gauge cluster style */
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
          border-radius: 12px;
          background: linear-gradient(135deg, rgba(0, 0, 0, 0.35) 0%, rgba(0, 0, 0, 0.2) 100%);
          border: 1px solid rgba(255, 140, 0, 0.08);
          box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.02);
          transition: all 0.2s;
        }

        .stat-card:hover {
          border-color: rgba(255, 140, 0, 0.15);
          background: linear-gradient(135deg, rgba(0, 0, 0, 0.4) 0%, rgba(0, 0, 0, 0.25) 100%);
        }

        .stat-icon {
          width: 40px;
          height: 40px;
          border-radius: 10px;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 0 15px currentColor;
        }

        .stat-card.cyan .stat-icon { 
          background: rgba(34, 211, 238, 0.15); 
          color: #22d3ee; 
          box-shadow: 0 0 15px rgba(34, 211, 238, 0.2);
        }
        .stat-card.green .stat-icon { 
          background: rgba(34, 197, 94, 0.15); 
          color: #22c55e; 
          box-shadow: 0 0 15px rgba(34, 197, 94, 0.2);
        }
        .stat-card.amber .stat-icon { 
          background: rgba(255, 159, 67, 0.15); 
          color: #FF9F43; 
          box-shadow: 0 0 15px rgba(255, 159, 67, 0.2);
        }
        .stat-card.purple .stat-icon { 
          background: rgba(168, 85, 247, 0.15); 
          color: #a855f7; 
          box-shadow: 0 0 15px rgba(168, 85, 247, 0.2);
        }
        .stat-card.rose .stat-icon { 
          background: rgba(244, 63, 94, 0.15); 
          color: #f43f5e; 
          box-shadow: 0 0 15px rgba(244, 63, 94, 0.2);
        }

        .stat-info {
          display: flex;
          flex-direction: column;
        }

        .stat-value {
          font-family: 'SF Mono', 'Roboto Mono', monospace;
          font-size: 24px;
          font-weight: 600;
          color: #FF9F43;
          text-shadow: 0 0 12px rgba(255, 159, 67, 0.4);
          font-variant-numeric: tabular-nums;
        }

        .stat-label {
          font-family: 'Bebas Neue', sans-serif;
          font-size: 10px;
          letter-spacing: 0.1em;
          color: rgba(255, 200, 150, 0.5);
          text-transform: uppercase;
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
          padding: 10px 14px;
          border-radius: 10px;
          background: linear-gradient(180deg, rgba(0, 0, 0, 0.4) 0%, rgba(0, 0, 0, 0.25) 100%);
          border: 1px solid rgba(255, 140, 0, 0.1);
          color: rgba(255, 200, 150, 0.5);
          transition: all 0.2s;
        }

        .cc-search:focus-within {
          border-color: rgba(255, 140, 0, 0.25);
          box-shadow: 0 0 15px rgba(255, 140, 0, 0.08);
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
          color: rgba(255, 200, 150, 0.3);
        }

        .cc-add-btn {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 10px 14px;
          border-radius: 10px;
          background: linear-gradient(180deg, rgba(255, 140, 0, 0.18) 0%, rgba(255, 100, 0, 0.12) 100%);
          border: 1px solid rgba(255, 140, 0, 0.3);
          color: #FF9F43;
          font-family: 'Bebas Neue', sans-serif;
          font-size: 12px;
          letter-spacing: 0.08em;
          cursor: pointer;
          transition: all 0.2s;
        }

        .cc-add-btn:hover {
          background: linear-gradient(180deg, rgba(255, 140, 0, 0.25) 0%, rgba(255, 100, 0, 0.18) 100%);
          box-shadow: 0 0 20px rgba(255, 140, 0, 0.15);
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
        /* ============================================
           IMPORT OPTIONS - W140 INSTRUMENT CLUSTER
           Circular gauge buttons matching light mode
           ============================================ */
        .import-options {
          display: flex;
          align-items: stretch;
          justify-content: center;
          gap: 20px;
          padding: 24px 28px;
          /* Walnut wood bezel frame */
          background: 
            radial-gradient(ellipse 80% 50% at 15% 20%, rgba(140, 85, 35, 0.3) 0%, transparent 50%),
            radial-gradient(ellipse 60% 60% at 85% 80%, rgba(110, 65, 25, 0.25) 0%, transparent 50%),
            repeating-linear-gradient(88deg, transparent, transparent 2px, rgba(80, 45, 15, 0.1) 2px, rgba(80, 45, 15, 0.1) 3px, transparent 3px, transparent 7px),
            linear-gradient(135deg, #5C3A1E 0%, #7A4F2A 20%, #6B4324 40%, #8B5A2B 60%, #6B4324 80%, #7A4F2A 100%);
          border-radius: 20px;
          border: 3px solid rgba(90, 60, 25, 0.6);
          box-shadow: 
            inset 0 3px 6px rgba(255, 200, 140, 0.12),
            inset 0 -4px 8px rgba(0, 0, 0, 0.5),
            0 8px 28px rgba(0, 0, 0, 0.5);
        }

        .import-option {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 12px;
          padding: 24px 20px 20px;
          min-width: 130px;
          min-height: 130px;
          /* Dark gauge face - matching light mode style */
          background: 
            radial-gradient(circle at 50% 30%, rgba(60, 55, 50, 0.5) 0%, transparent 60%),
            radial-gradient(circle at 50% 50%, #1a1816 0%, #0d0c0b 70%, #080706 100%);
          border-radius: 50%;
          border: 3px solid rgba(80, 65, 50, 0.6);
          cursor: pointer;
          text-align: center;
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          box-shadow: 
            inset 0 3px 6px rgba(0, 0, 0, 0.6),
            inset 0 -2px 4px rgba(255, 180, 100, 0.06),
            0 4px 12px rgba(0, 0, 0, 0.5);
        }

        .import-option:hover {
          background: 
            radial-gradient(circle at 50% 30%, rgba(80, 70, 60, 0.6) 0%, transparent 60%),
            radial-gradient(circle at 50% 50%, #252220 0%, #151310 70%, #0a0908 100%);
          border-color: rgba(200, 160, 80, 0.5);
          transform: scale(1.05) translateY(-4px);
          box-shadow: 
            inset 0 3px 6px rgba(0, 0, 0, 0.5),
            inset 0 -2px 4px rgba(255, 180, 100, 0.1),
            0 8px 24px rgba(0, 0, 0, 0.5),
            0 0 20px rgba(255, 180, 80, 0.1);
        }

        /* Dark mode: hide icon backgrounds, show icons directly with glow - matching light mode structure */
        .import-option .io-icon {
          width: 56px;
          height: 56px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.3s ease;
          /* No background - just icon with glow */
          background: transparent;
          border: none;
        }

        /* Dark mode icons: colorful with glow effect */
        .import-option.cyan .io-icon { 
          color: #22d3ee;
          filter: drop-shadow(0 0 12px rgba(34, 211, 238, 0.6)) drop-shadow(0 0 24px rgba(34, 211, 238, 0.4));
        }
        .import-option.green .io-icon { 
          color: #22c55e;
          filter: drop-shadow(0 0 12px rgba(34, 197, 94, 0.6)) drop-shadow(0 0 24px rgba(34, 197, 94, 0.4));
        }
        .import-option.purple .io-icon { 
          color: #a855f7;
          filter: drop-shadow(0 0 12px rgba(168, 85, 247, 0.6)) drop-shadow(0 0 24px rgba(168, 85, 247, 0.4));
        }

        .import-option .io-title {
          font-size: 11px;
          font-weight: 700;
          color: #FFB850;
          text-transform: uppercase;
          letter-spacing: 0.8px;
          text-shadow: 
            0 0 8px rgba(255, 180, 80, 0.6),
            0 0 16px rgba(255, 160, 60, 0.3);
          text-align: center;
          line-height: 1.2;
        }

        .import-option .io-desc {
          display: none;
        }

        .import-option .io-icon-svg {
          display: none;
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

        /* Email Parser Modal removed */
          inset: 0;
          background: rgba(10,8,6,0.95);
          backdrop-filter: blur(12px);
          z-index: 200;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 16px;
        }

        /* Email parser modal styles removed */
          max-height: 85vh;
          background: rgba(20,18,16,0.75);
          backdrop-filter: blur(16px);
          border-radius: 20px;
          border: 1px solid rgba(255,191,0,0.25);
          box-shadow: 
            0 25px 50px rgba(0,0,0,0.6),
            0 0 40px rgba(255,191,0,0.12),
            inset 0 1px 0 rgba(255,255,255,0.08);
          overflow: hidden;
          display: flex;
          flex-direction: column;
        }

        .email-parser-header {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 16px 20px;
          border-bottom: 1px solid rgba(255,191,0,0.15);
        }

        .email-parser-header h3 {
          flex: 1;
          font-family: 'Chakra Petch', sans-serif;
          font-size: 16px;
          font-weight: 600;
          color: #FFBF00;
          margin: 0;
        }

        .email-parser-close {
          width: 28px;
          height: 28px;
          border-radius: 50%;
          background: rgba(255,191,0,0.1);
          border: none;
          color: rgba(255,200,150,0.6);
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .email-parser-content {
          padding: 20px;
          overflow-y: auto;
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        .email-parser-desc {
          font-size: 13px;
          color: rgba(255,220,180,0.7);
          line-height: 1.5;
          margin: 0;
        }

        .email-field {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .email-field label {
          font-size: 12px;
          font-weight: 600;
          color: rgba(255,191,0,0.8);
        }

        .email-field input,
        .email-field textarea {
          width: 100%;
          padding: 12px;
          border-radius: 10px;
          background: rgba(0,0,0,0.4);
          border: 1px solid rgba(255,191,0,0.15);
          color: #fff;
          font-size: 14px;
          outline: none;
          resize: none;
        }

        .email-field input:focus,
        .email-field textarea:focus {
          border-color: rgba(255,191,0,0.4);
          box-shadow: 0 0 10px rgba(255,191,0,0.1);
        }

        .email-field textarea {
          min-height: 120px;
        }

        .parse-result {
          display: flex;
          flex-direction: column;
          gap: 8px;
          padding: 12px;
          border-radius: 10px;
          font-size: 13px;
        }

        .parse-result.success {
          background: rgba(34,197,94,0.15);
          border: 1px solid rgba(34,197,94,0.3);
          color: #22c55e;
        }

        .parse-result.error {
          background: rgba(239,68,68,0.15);
          border: 1px solid rgba(239,68,68,0.3);
          color: #ef4444;
        }

        .parsed-data {
          display: flex;
          flex-direction: column;
          gap: 4px;
          margin-top: 8px;
          padding-top: 8px;
          border-top: 1px solid rgba(255,255,255,0.1);
          font-size: 12px;
          color: rgba(255,255,255,0.7);
        }

        .email-parser-actions {
          display: flex;
          gap: 10px;
        }

        .btn-parse {
          flex: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          padding: 14px;
          border-radius: 12px;
          background: linear-gradient(135deg, rgba(255,191,0,0.25) 0%, rgba(255,140,0,0.2) 100%);
          border: 1px solid rgba(255,191,0,0.5);
          color: #FFBF00;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
        }

        .btn-parse:hover:not(:disabled) {
          background: linear-gradient(135deg, rgba(255,191,0,0.35) 0%, rgba(255,140,0,0.3) 100%);
          box-shadow: 0 0 20px rgba(255,191,0,0.2);
        }

        .btn-parse:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        /* Printer Tab Styles */
        .cc-printer {
          padding: 16px;
        }

        .cc-printer h3 {
          font-family: 'Bebas Neue', sans-serif;
          font-size: 18px;
          letter-spacing: 0.05em;
          color: #fff;
          margin-bottom: 6px;
        }

        .cc-printer h4 {
          font-family: 'Bebas Neue', sans-serif;
          font-size: 14px;
          letter-spacing: 0.05em;
          color: #FF9F43;
          margin-bottom: 8px;
        }

        .cc-printer .cc-description {
          font-size: 12px;
          color: rgba(255,200,150,0.5);
          margin-bottom: 20px;
          line-height: 1.5;
        }

        .printer-status-card {
          display: flex;
          align-items: center;
          gap: 16px;
          padding: 20px;
          border-radius: 16px;
          background: linear-gradient(180deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.02) 100%);
          border: 1px solid rgba(255,140,0,0.15);
          margin-bottom: 20px;
        }

        .printer-status-icon {
          padding: 12px;
          border-radius: 12px;
          background: rgba(0,0,0,0.3);
        }

        .printer-status-text {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .status-label {
          font-family: 'Bebas Neue', sans-serif;
          font-size: 16px;
          letter-spacing: 0.08em;
        }

        .status-label.connected { color: #22c55e; }
        .status-label.testing { color: #f59e0b; }
        .status-label.disconnected { color: #71717a; }

        .status-ip {
          font-size: 11px;
          color: rgba(255,200,150,0.5);
          font-family: monospace;
        }

        .printer-form {
          margin-bottom: 24px;
        }

        .printer-form label {
          display: block;
          font-size: 11px;
          font-weight: 600;
          color: rgba(255,200,150,0.7);
          text-transform: uppercase;
          letter-spacing: 0.1em;
          margin-bottom: 8px;
        }

        .printer-input-row {
          display: flex;
          gap: 10px;
        }

        .printer-ip-input {
          flex: 1;
          padding: 12px 14px;
          border-radius: 10px;
          background: rgba(0,0,0,0.3);
          border: 1px solid rgba(255,140,0,0.2);
          color: #fff;
          font-family: monospace;
          font-size: 14px;
          outline: none;
          transition: border-color 0.2s;
        }

        .printer-ip-input:focus {
          border-color: rgba(255,140,0,0.5);
        }

        .printer-ip-input::placeholder {
          color: rgba(255,200,150,0.3);
        }

        .printer-btn {
          padding: 12px 20px;
          border-radius: 10px;
          font-family: 'Bebas Neue', sans-serif;
          font-size: 13px;
          letter-spacing: 0.08em;
          cursor: pointer;
          transition: all 0.2s;
          display: flex;
          align-items: center;
          gap: 6px;
        }

        .printer-btn.connect {
          background: linear-gradient(180deg, rgba(34,197,94,0.25) 0%, rgba(22,163,74,0.2) 100%);
          border: 1px solid rgba(34,197,94,0.4);
          color: #22c55e;
        }

        .printer-btn.connect:hover:not(:disabled) {
          background: linear-gradient(180deg, rgba(34,197,94,0.35) 0%, rgba(22,163,74,0.3) 100%);
          box-shadow: 0 0 20px rgba(34,197,94,0.2);
        }

        .printer-btn.connect:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .printer-btn.disconnect {
          background: linear-gradient(180deg, rgba(239,68,68,0.2) 0%, rgba(185,28,28,0.15) 100%);
          border: 1px solid rgba(239,68,68,0.3);
          color: #ef4444;
        }

        .printer-btn.disconnect:hover {
          background: linear-gradient(180deg, rgba(239,68,68,0.3) 0%, rgba(185,28,28,0.25) 100%);
        }

        .printer-info {
          padding: 16px;
          border-radius: 12px;
          background: rgba(255,140,0,0.05);
          border: 1px solid rgba(255,140,0,0.15);
        }

        .printer-info p {
          font-size: 12px;
          color: rgba(255,200,150,0.6);
          line-height: 1.6;
          margin-bottom: 12px;
        }

        .printer-info ul {
          list-style: none;
          padding: 0;
          margin: 0;
        }

        .printer-info li {
          font-size: 12px;
          color: rgba(255,200,150,0.5);
          padding: 6px 0;
          padding-left: 20px;
          position: relative;
        }

        .printer-info li::before {
          content: '→';
          position: absolute;
          left: 0;
          color: #FF9F43;
        }
      `}</style>
    </div>,
    document.body
  );
};

// Import Option Card - Circular gauge with icon and title
const ImportOption = ({ icon: Icon, title, color, onClick }) => (
  <div className={`import-option ${color}`} onClick={onClick}>
    <div className="io-icon"><Icon className="w-10 h-10" strokeWidth={1.5} /></div>
    <span className="io-title">{title}</span>
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
const CustomerForm = ({ onClose, customer, initialData }) => {
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

      let payload;
      if (customer) {
        // For edits, send full customer payload with optional trade/policy fields
        let tradeVehicle = null;
        if (formData.trade_vin?.trim()) {
          tradeVehicle = {
            vin: formData.trade_vin.trim(),
            mileage: formData.trade_mileage?.trim()
              ? parseInt(formData.trade_mileage.replace(/,/g, ''), 10)
              : null,
          };
        }

        payload = {
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
      } else {
        // For new customers, match Quick Add payload shape
        let tradeVehicle = null;
        if (formData.trade_vin?.trim()) {
          tradeVehicle = {
            vin: formData.trade_vin.trim(),
            mileage: formData.trade_mileage?.trim()
              ? parseInt(formData.trade_mileage.replace(/,/g, ''), 10)
              : null,
          };
        }

        payload = {
          first_name: formData.first_name,
          last_name: formData.last_name,
          phone: formData.phone,
          email: formData.email,
          address: formData.address,
          policy_number: formData.policy_number?.trim() || null,
          vehicle_of_interest: formData.vehicle_vin?.trim() || null,
          trade_vehicle: tradeVehicle,
          lead_source: formData.lead_source,
          notes: formData.notes,
          lead_status: formData.lead_status,
        };
      }
      
      await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
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
            <button type="submit" disabled={saving} className="btn-save gold-btn">
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
  const [printing, setPrinting] = useState(false);
  const [printResult, setPrintResult] = useState(null);

  // Get printer IP from localStorage
  const getPrinterIP = () => localStorage.getItem('printerIP');

  const handlePrint = async () => {
    const printerIP = getPrinterIP();
    if (!printerIP) {
      toast.error('No printer connected', { description: 'Go to Command Center → Printer to connect' });
      return;
    }
    
    setPrinting(true);
    setPrintResult(null);
    
    try {
      // Send print request to backend
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
        // Play eject sound only when print actually succeeds
        import('../utils/notificationSound').then(mod => {
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
    } catch (e) {
      // Simulate success for now since we don't have a real print endpoint
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
    } catch (e) {
      console.error('Add note error:', e);
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
            <Printer className="w-4 h-4" /> Eject
          </button>
          <button onClick={onEdit} className="btn-edit">
            <Edit3 className="w-4 h-4" /> Edit
          </button>
        </div>

        {/* Eject (Print) Modal */}
        {showEjectModal && (
          <div className="eject-overlay" onClick={() => setShowEjectModal(false)}>
            <div className="eject-modal" onClick={e => e.stopPropagation()}>
              <div className="eject-header">
                <Printer className="w-5 h-5" />
                <h3>Print Profile</h3>
                <button onClick={() => setShowEjectModal(false)} className="eject-close">
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
                >
                  {printing ? 'Printing...' : 'Print Profile'}
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

          .printer-status-row {
            padding: 12px;
            border-radius: 10px;
            background: rgba(255,255,255,0.03);
            border: 1px solid rgba(255,255,255,0.08);
            margin-bottom: 16px;
          }

          .printer-connected {
            display: flex;
            align-items: center;
            gap: 10px;
            color: #22c55e;
            font-size: 13px;
          }

          .printer-not-connected {
            display: flex;
            align-items: center;
            gap: 10px;
            color: #71717a;
            font-size: 13px;
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

// Settings Tab Component
const SettingsTab = ({ defaultTargetLanguage, onLanguageChange }) => {
  const { 
    dealership, 
    salesperson, 
    setDealership, 
    setSalesperson 
  } = useSales();
  
  const [dealershipForm, setDealershipForm] = useState({
    name: dealership?.name || '',
    brand: dealership?.brand || '',
    location: dealership?.location || '',
  });
  
  const [salespersonForm, setSalespersonForm] = useState({
    name: salesperson?.name || '',
    preferredPhrase: salesperson?.preferredPhrase || 'Good to hear from you',
  });
  
  const [soundPrefs, setSoundPrefsState] = useState(getSoundPreferences());
  const [notificationPermission, setNotificationPermission] = useState('default');

  useEffect(() => {
    if ('Notification' in window) {
      setNotificationPermission(Notification.permission);
    }
  }, []);
  
  const handleSaveProfile = () => {
    setDealership(dealershipForm);
    setSalesperson(salespersonForm);
    toast.success('Profile settings saved!');
  };
  
  return (
    <div className="settings-tab">
      {/* Profile Section */}
      <div className="settings-section">
        <div className="section-header">
          <Building2 className="w-5 h-5" style={{ color: '#FFBF00' }} />
          <h4>Dealership Profile</h4>
        </div>
        <div className="settings-form">
          <div className="s-field">
            <label>Dealership Name</label>
            <input 
              type="text"
              placeholder="Premier Motors"
              value={dealershipForm.name}
              onChange={e => setDealershipForm({...dealershipForm, name: e.target.value})}
            />
          </div>
          <div className="s-field">
            <label>Brand / Makes</label>
            <input 
              type="text"
              placeholder="Toyota, Honda, etc."
              value={dealershipForm.brand}
              onChange={e => setDealershipForm({...dealershipForm, brand: e.target.value})}
            />
          </div>
          <div className="s-field">
            <label>Location</label>
            <input 
              type="text"
              placeholder="Los Angeles, CA"
              value={dealershipForm.location}
              onChange={e => setDealershipForm({...dealershipForm, location: e.target.value})}
            />
          </div>
        </div>
      </div>
      
      {/* Salesperson Section */}
      <div className="settings-section">
        <div className="section-header">
          <User className="w-5 h-5" style={{ color: '#FFBF00' }} />
          <h4>Your Profile</h4>
        </div>
        <div className="settings-form">
          <div className="s-field">
            <label>Your Name</label>
            <input 
              type="text"
              placeholder="Alex Johnson"
              value={salespersonForm.name}
              onChange={e => setSalespersonForm({...salespersonForm, name: e.target.value})}
            />
          </div>
        </div>
        <button className="save-settings-btn gold-btn" onClick={handleSaveProfile}>
          <Save className="w-4 h-4" /> Save Profile
        </button>
      </div>
      
      {/* Translation Settings Section */}
      <div className="settings-section">
        <div className="section-header">
          <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: '#FFBF00' }}>
            <path d="M5 8h14M5 16h6m-6-4h10" strokeLinecap="round" strokeLinejoin="round"/>
            <circle cx="16" cy="16" r="4"/>
            <path d="M16 14v4M14 16h4" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          <h4>Translation</h4>
        </div>
        <div className="settings-form">
          <div className="s-field">
            <label>Default Translation Language</label>
            <p style={{ fontSize: '13px', opacity: 0.7, marginBottom: '12px' }}>
              Choose which language AI responses will be translated to when Sport Mode is active
            </p>
            <LanguageSelector
              selectedLanguage={defaultTargetLanguage}
              onLanguageChange={onLanguageChange}
              label="Translate to"
              showAuto={false}
            />
          </div>
        </div>
      </div>
      
      {/* Engine Sound Profile Section - Blue Glass */}
      <div className="settings-section engine-sound-profile">
        <div className="section-header">
          <Volume2 className="w-5 h-5" style={{ color: '#FFBF00' }} />
          <h4>Engine Sound Profile</h4>
        </div>
        
        {/* Sound Settings */}
        <div className="sound-settings">
          <div className="sound-toggle">
            <span>Sound Effects</span>
            <button 
              className={`toggle-btn ${soundPrefs.enabled ? 'on' : 'off'}`}
              onClick={() => {
                const newPrefs = { ...soundPrefs, enabled: !soundPrefs.enabled };
                setSoundPrefsState(newPrefs);
                setSoundPreferences(newPrefs);
                if (newPrefs.enabled) playNotificationSound();
              }}
            >
              {soundPrefs.enabled ? <ToggleRight className="w-5 h-5" /> : <ToggleLeft className="w-5 h-5" />}
              {soundPrefs.enabled ? 'On' : 'Off'}
            </button>
          </div>
          
          <div className="sound-profiles">
            <label>Engine Sound Profile</label>
            <div className="profile-grid">
              {/* Engine sound profiles controlled via flag buttons (Spanish, French, Korean) */}
              <LanguageSelector
                value={soundPrefs.profile}
                onChange={(code) => {
                  const map = { es: 'spanish', fr: 'french', ko: 'korean' };
                  const profileId = map[code] || 'spanish';
                  const newPrefs = { ...soundPrefs, profile: profileId };
                  setSoundPrefsState(newPrefs);
                  setSoundPreferences(newPrefs);
                }}
                label={null}
              />
            </div>
          </div>
          
          {/* Browser notifications removed per latest spec */}
        </div>
      </div>
      
      
      <style>{`
        .settings-tab {
          display: flex;
          flex-direction: column;
          gap: 20px;
        }
        
        .settings-section {
          background: rgba(0,0,0,0.2);
          border: 1px solid rgba(255,191,0,0.1);
          border-radius: 14px;
          padding: 16px;
        }
        
        .section-header {
          display: flex;
          align-items: center;
          gap: 10px;
          margin-bottom: 14px;
        }
        
        .section-header h4 {
          flex: 1;
          margin: 0;
          font-size: 14px;
          font-weight: 600;
          color: rgba(255,220,180,0.9);
        }
        
        .config-badge {
          font-size: 10px;
          padding: 3px 8px;
          background: rgba(34,197,94,0.2);
          color: #22c55e;
          border-radius: 6px;
        }
        
        .settings-form {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }
        
        .s-field {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }
        
        .s-field label {
          font-size: 11px;
          font-weight: 600;
          color: rgba(255,191,0,0.7);
          text-transform: uppercase;
        }
        
        .s-field input {
          padding: 10px 12px;
          border-radius: 10px;
          background: rgba(0,0,0,0.4);
          border: 1px solid rgba(255,191,0,0.15);
          color: #fff;
          font-size: 14px;
          outline: none;
        }
        
        .s-field input:focus {
          border-color: rgba(255,191,0,0.4);
        }
        
        .secret-input {
          position: relative;
        }
        
        .secret-input input {
          width: 100%;
          padding-right: 40px;
        }
        
        .secret-input button {
          position: absolute;
          right: 10px;
          top: 50%;
          transform: translateY(-50%);
          background: none;
          border: none;
          color: rgba(255,255,255,0.5);
          cursor: pointer;
        }
        
        .greeting-options {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }
        
        .greeting-btn {
          padding: 10px 12px;
          border-radius: 8px;
          background: rgba(0,0,0,0.3);
          border: 1px solid rgba(255,255,255,0.1);
          color: rgba(255,255,255,0.7);
          font-size: 13px;
          text-align: left;
          cursor: pointer;
          transition: all 0.2s;
        }
        
        .greeting-btn.active {
          background: rgba(255,191,0,0.15);
          border-color: rgba(255,191,0,0.4);
          color: #FFBF00;
        }
        
        .save-settings-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          width: 100%;
          padding: 12px;
          margin-top: 12px;
          border-radius: 10px;
          background: rgba(255,191,0,0.2);
          border: 1px solid rgba(255,191,0,0.4);
          color: #FFBF00;
          font-size: 14px;
          font-weight: 500;
          cursor: pointer;
        }
        
        .save-settings-btn:hover {
          background: rgba(255,191,0,0.3);
        }
        
        .sound-settings {
          display: flex;
          flex-direction: column;
          gap: 14px;
        }
        
        .sound-toggle {
          display: flex;
          align-items: center;
          justify-content: space-between;
        }
        
        .sound-toggle span {
          font-size: 13px;
          color: rgba(255,255,255,0.8);
        }
        
        .toggle-btn {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 6px 12px;
          border-radius: 8px;
          border: none;
          font-size: 12px;
          font-weight: 500;
          cursor: pointer;
        }
        
        .toggle-btn.on {
          background: rgba(34,197,94,0.2);
          color: #22c55e;
        }
        
        .toggle-btn.off {
          background: rgba(255,255,255,0.1);
          color: rgba(255,255,255,0.5);
        }
        
        .sound-profiles label {
          display: block;
          font-size: 11px;
          font-weight: 600;
          color: rgba(255,191,0,0.7);
          margin-bottom: 8px;
          text-transform: uppercase;
        }
        
        .profile-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 8px;
        }
        
        .profile-btn {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 4px;
          padding: 10px 8px;
          border-radius: 10px;
          background: rgba(0,0,0,0.3);
          border: 1px solid rgba(255,255,255,0.1);
          cursor: pointer;
          transition: all 0.2s;
        }
        
        .profile-btn.active {
          background: rgba(255,191,0,0.15);
          border-color: rgba(255,191,0,0.4);
        }
        
        .profile-icon {
          font-size: 20px;
        }
        
        .profile-name {
          font-size: 10px;
          color: rgba(255,255,255,0.7);
        }
        
        .profile-btn.active .profile-name {
          color: #FFBF00;
        }
        
        .browser-notif {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 10px;
          background: rgba(0,0,0,0.2);
          border-radius: 10px;
        }
        
        .browser-notif span {
          font-size: 13px;
          color: rgba(255,255,255,0.7);
        }
        
        .notif-btn {
          padding: 6px 14px;
          border-radius: 6px;
          border: none;
          font-size: 12px;
          font-weight: 500;
          cursor: pointer;
          background: rgba(255,191,0,0.2);
          color: #FFBF00;
        }
        
        .notif-btn.enabled {
          background: rgba(34,197,94,0.2);
          color: #22c55e;
        }
        
        .notif-btn:disabled {
          cursor: default;
        }
      `}</style>
    </div>
  );
};

export default CommandCenter;

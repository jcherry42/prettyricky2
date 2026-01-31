import React, { useState, useEffect, useMemo, useCallback, memo } from 'react';
import { createPortal } from 'react-dom';
import { 
  X, Users, Upload, BarChart3, 
  Search, Plus, ChevronRight, Settings,
  FileUp, UserPlus, Trash2, Phone, MapPin,
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
  getSoundProfiles,
  playNotificationSound
} from '../utils/notificationSound';
import LanguageSelector from './LanguageSelector';
import VisionExtractor from './VisionExtractor';
import CustomerForm from './CommandCenter/CustomerForm';
import CustomerDetail from './CommandCenter/CustomerDetail';
import './CommandCenter/styles.css';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || window.location.origin;

/**
 * Command Center - Premium Liquid Glass UI
 * Performance optimized with memoization
 */
export const CommandCenter = memo(({ isOpen, onClose }) => {
  const { toggleImport, setCustomers: setGlobalCustomers } = useSales();
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
  const disconnectPrinter = useCallback(() => {
    setPrinterStatus('disconnected');
    localStorage.removeItem('printerIP');
    setPrinterIP('');
    toast.info('Printer disconnected');
  }, []);

  // Fetch data on tab change
  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/dashboard/stats`);
      const data = await res.json();
      setStats(data);
    } catch {
      // Stats fetch failed - silent
    }
  }, []);

  const fetchCustomers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${BACKEND_URL}/api/customers/list?limit=50`);
      const data = await res.json();
      setCustomers(data.customers || []);
    } catch {
      // Customers fetch failed - silent
    } finally {
      setLoading(false);
    }
  }, []);

  const refreshGlobalCustomers = useCallback(async () => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/customers?limit=200`);
      const data = await res.json();
      setGlobalCustomers(data.customers || []);
    } catch {
      // Silent
    }
  }, [setGlobalCustomers]);


  useEffect(() => {
    if (!isOpen) return;
    
    if (activeTab === 'dashboard') fetchStats();
    if (activeTab === 'customers') fetchCustomers();
  }, [isOpen, activeTab, fetchStats, fetchCustomers]);

  // Memoized filtered customers for search
  const filteredCustomers = useMemo(() => {
    if (!searchQuery.trim()) return customers;
    const q = searchQuery.toLowerCase();
    return customers.filter(c => 
      c.first_name?.toLowerCase().includes(q) ||
      c.last_name?.toLowerCase().includes(q) ||
      c.phone?.includes(q) ||
      c.email?.toLowerCase().includes(q)
    );
  }, [customers, searchQuery]);

  // Tab change handler
  const handleTabChange = useCallback((tabId) => {
    setActiveTab(tabId);
  }, []);

  // Language change handler
  const handleLanguageChange = useCallback((lang) => {
    setDefaultTargetLanguage(lang);
    localStorage.setItem('defaultTargetLanguage', lang);
    toast.success(`Translation language set to ${lang.toUpperCase()}`);
  }, []);

  if (!isOpen) return null;

  const tabs = [
    { id: 'dashboard', label: 'Dashboard', icon: BarChart3 },
    { id: 'customers', label: 'Customers', icon: Users },
    { id: 'import', label: 'Import', icon: Upload },
    { id: 'printer', label: 'Printer', icon: Printer },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

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
          <button 
            onClick={onClose} 
            className="cc-close"
            aria-label="Close Command Center"
            data-testid="cc-close-btn"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="cc-tabs" role="tablist" aria-label="Command Center tabs">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`cc-tab ${activeTab === tab.id ? 'active' : ''}`}
              role="tab"
              aria-selected={activeTab === tab.id}
              aria-controls={`${tab.id}-panel`}
              data-testid={`cc-tab-${tab.id}`}
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
                <button 
                  onClick={() => setShowCustomerForm(true)} 
                  className="cc-add-btn gold-btn"
                  aria-label="Add new customer"
                  data-testid="add-customer-btn"
                >
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
                <label htmlFor="printer-ip">Printer IP Address</label>
                <div className="printer-input-row">
                  <input 
                    id="printer-ip"
                    type="text"
                    placeholder="192.168.1.100"
                    value={printerIP}
                    onChange={(e) => setPrinterIP(e.target.value)}
                    className="printer-ip-input"
                    disabled={printerStatus === 'testing'}
                    aria-label="Printer IP address"
                    data-testid="printer-ip-input"
                  />
                  {printerStatus === 'connected' ? (
                    <button 
                      onClick={disconnectPrinter}
                      className="printer-btn disconnect"
                      aria-label="Disconnect printer"
                      data-testid="printer-disconnect-btn"
                    >
                      Disconnect
                    </button>
                  ) : (
                    <button 
                      onClick={testPrinterConnection}
                      disabled={testingPrinter || !printerIP.trim()}
                      className="printer-btn connect"
                      aria-label="Connect to printer"
                      data-testid="printer-connect-btn"
                    >
                      {testingPrinter ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Connect'}
                    </button>
                  )}
                </div>
              </div>

              <div className="printer-info eject-info">
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
            onSaved={async () => {
              await fetchCustomers();
              await refreshGlobalCustomers();
            }}
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

    </div>,
    document.body
  );
});

// Import Option Card - Circular gauge with icon and title (memoized)
const ImportOption = memo(({ icon: Icon, title, color, onClick }) => (
  <div 
    className={`import-option ${color}`} 
    onClick={onClick}
    role="button"
    tabIndex={0}
    onKeyDown={(e) => e.key === 'Enter' && onClick()}
    aria-label={`Import via ${title}`}
    data-testid={`import-option-${color}`}
  >
    <div className="io-icon"><Icon className="w-10 h-10" strokeWidth={1.5} /></div>
    <span className="io-title">{title}</span>
  </div>
));

ImportOption.displayName = 'ImportOption';

// Integration Item (memoized)
const IntegrationItem = memo(({ name, connected }) => (
  <div className="integration-item" data-testid={`integration-${name.toLowerCase().replace(/\s/g, '-')}`}>
    <span className="int-name">{name}</span>
    <button 
      className={`int-btn ${connected ? 'connected' : 'connect'}`}
      aria-label={connected ? `${name} connected` : `Connect to ${name}`}
      data-testid={`integration-btn-${name.toLowerCase().replace(/\s/g, '-')}`}
    >
      {connected ? 'Connected' : 'Connect'}
    </button>
  </div>
));

IntegrationItem.displayName = 'IntegrationItem';



// Ambient Lighting Section Component (memoized)
const AmbientLightingSection = memo(() => {
  const [enabled, setEnabled] = useState(() => {
    return localStorage.getItem('ambientLightingEnabled') === 'true';
  });
  const [intensity, setIntensity] = useState(() => {
    return localStorage.getItem('ambientLightingIntensity') || 'medium';
  });

  useEffect(() => {
    const html = document.documentElement;
    
    // Remove all ambient classes first
    html.classList.remove('ambient-lighting-enabled', 'ambient-lighting-low', 'ambient-lighting-high');
    
    if (enabled) {
      html.classList.add('ambient-lighting-enabled');
      if (intensity === 'low') html.classList.add('ambient-lighting-low');
      if (intensity === 'high') html.classList.add('ambient-lighting-high');
    }
    
    localStorage.setItem('ambientLightingEnabled', enabled);
    localStorage.setItem('ambientLightingIntensity', intensity);
  }, [enabled, intensity]);

  return (
    <div className="settings-section ambient-section">
      <div className="section-header">
        <Zap className="w-5 h-5" style={{ color: '#FFBF00' }} />
        <h4>64-Color Ambient Lighting</h4>
      </div>
      
      <div className="ambient-settings">
        <div className="ambient-toggle">
          <span>Ambient Effects</span>
          <button 
            className={`toggle-btn ${enabled ? 'on' : 'off'}`}
            onClick={() => setEnabled(!enabled)}
          >
            {enabled ? <ToggleRight className="w-5 h-5" /> : <ToggleLeft className="w-5 h-5" />}
            {enabled ? 'On' : 'Off'}
          </button>
        </div>
        
        {enabled && (
          <div className="intensity-control">
            <label>Intensity</label>
            <div className="intensity-buttons">
              <button 
                className={`intensity-btn ${intensity === 'low' ? 'active' : ''}`}
                onClick={() => setIntensity('low')}
              >
                Subtle
              </button>
              <button 
                className={`intensity-btn ${intensity === 'medium' ? 'active' : ''}`}
                onClick={() => setIntensity('medium')}
              >
                Medium
              </button>
              <button 
                className={`intensity-btn ${intensity === 'high' ? 'active' : ''}`}
                onClick={() => setIntensity('high')}
              >
                Vivid
              </button>
            </div>
          </div>
        )}
        
        <p className="ambient-desc">
          64-color ambient lighting cycles through the full spectrum behind cards and UI elements.
        </p>
      </div>
      
    </div>
  );
});

AmbientLightingSection.displayName = 'AmbientLightingSection';

// Settings Tab Component (memoized)
const SettingsTab = memo(({ defaultTargetLanguage, onLanguageChange }) => {
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
  const [notificationPermission, setNotificationPermission] = useState(() => {
    if ('Notification' in window) {
      return Notification.permission;
    }
    return 'default';
  });
  
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
            <div className="sound-profile-grid">
              {[
                { id: 'merica', label: "'Merica", icon: '🇺🇸' },
                { id: 'euro', label: 'Euro', icon: '🇮🇹' },
                { id: 'jdm', label: 'JDM', icon: '🇯🇵' },
              ].map((p) => (
                <button
                  key={p.id}
                  type="button"
                  className={`sound-profile-btn ${soundPrefs.profile === p.id ? 'active' : ''}`}
                  onClick={() => {
                    const newPrefs = { ...soundPrefs, profile: p.id };
                    setSoundPrefsState(newPrefs);
                    setSoundPreferences(newPrefs);

                    // Preview if enabled
                    if (newPrefs.enabled) {
                      playNotificationSound(p.id);
                    }
                  }}
                  aria-label={`Engine sound ${p.label}`}
                >
                  <span className="sound-profile-icon" aria-hidden="true">{p.icon}</span>
                  <span className="sound-profile-label" aria-hidden="true">{p.label}</span>
                </button>
              ))}
            </div>
          </div>
          
          {/* Browser notifications removed per latest spec */}
        </div>
      </div>
      
      {/* Ambient Lighting Section */}
      <AmbientLightingSection />
      
      
    </div>
  );
});

SettingsTab.displayName = 'SettingsTab';
CommandCenter.displayName = 'CommandCenter';

export default CommandCenter;

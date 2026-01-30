// CommandCenter - Performance optimized with lazy loading
import React, { lazy, Suspense, memo, useState, useMemo, useCallback } from 'react';
import { X, LayoutDashboard, Users, Download, Printer, Settings, Plus, Search, ChevronRight, RefreshCw } from 'lucide-react';
import { useSales } from '../../context/SalesContext';
import { toast } from 'sonner';
import './styles.css';

// Lazy load heavy tabs
const SettingsTab = lazy(() => import('./SettingsTab'));
const ImportTab = lazy(() => import('./ImportTab'));

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL;

// Tab loading fallback
const TabLoader = () => (
  <div className="tab-loader">
    <RefreshCw className="w-5 h-5 animate-spin" style={{ color: '#FFBF00' }} />
  </div>
);

// Tab configuration
const TABS = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'customers', label: 'Customers', icon: Users },
  { id: 'import', label: 'Import', icon: Download },
  { id: 'printer', label: 'Printer', icon: Printer },
  { id: 'settings', label: 'Settings', icon: Settings },
];

// Memoized tab button
const TabButton = memo(({ tab, isActive, onClick }) => {
  const Icon = tab.icon;
  return (
    <button
      className={`cc-tab ${isActive ? 'active' : ''}`}
      onClick={() => onClick(tab.id)}
    >
      <Icon className="w-4 h-4" />
      <span>{tab.label}</span>
    </button>
  );
});

TabButton.displayName = 'TabButton';

// Customer list item
const CustomerItem = memo(({ customer, isSelected, onClick, onSelect }) => (
  <div 
    className={`cc-list-item ${isSelected ? 'selected' : ''}`}
    onClick={() => onClick(customer)}
  >
    <div className="cust-info">
      <span className="cust-name">{customer.first_name} {customer.last_name}</span>
      <span className="cust-phone">{customer.phone}</span>
    </div>
    <ChevronRight className="w-4 h-4" style={{ opacity: 0.4 }} />
  </div>
));

CustomerItem.displayName = 'CustomerItem';

// Main CommandCenter export (re-exported from original for backwards compatibility)
export { CommandCenter } from '../CommandCenter.jsx';

// Also export the optimized version
export const CommandCenterOptimized = memo(({ isOpen, onClose }) => {
  const { customers, toggleImport } = useSales();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [searchQuery, setSearchQuery] = useState('');
  const [defaultTargetLanguage, setDefaultTargetLanguage] = useState(() => 
    localStorage.getItem('defaultTargetLanguage') || 'es'
  );

  const handleLanguageChange = useCallback((lang) => {
    setDefaultTargetLanguage(lang);
    localStorage.setItem('defaultTargetLanguage', lang);
    toast.success(`Translation language set to ${lang.toUpperCase()}`);
  }, []);

  const filteredCustomers = useMemo(() => {
    if (!searchQuery.trim()) return customers;
    const q = searchQuery.toLowerCase();
    return customers.filter(c => 
      c.first_name?.toLowerCase().includes(q) ||
      c.last_name?.toLowerCase().includes(q) ||
      c.phone?.includes(q)
    );
  }, [customers, searchQuery]);

  const handleTabChange = useCallback((tabId) => {
    setActiveTab(tabId);
  }, []);

  if (!isOpen) return null;

  return (
    <div className="cc-overlay" onClick={onClose}>
      <div className="cc-modal" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="cc-header">
          <span className="cc-title">Command Center</span>
          <button className="cc-close" onClick={onClose}>
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tabs */}
        <div className="cc-tabs">
          {TABS.map(tab => (
            <TabButton
              key={tab.id}
              tab={tab}
              isActive={activeTab === tab.id}
              onClick={handleTabChange}
            />
          ))}
        </div>

        {/* Content */}
        <div className="cc-content">
          <Suspense fallback={<TabLoader />}>
            {activeTab === 'dashboard' && (
              <div className="dashboard-tab">
                <div className="stat-card">
                  <span className="stat-value">{customers.length}</span>
                  <span className="stat-label">Total Customers</span>
                </div>
              </div>
            )}

            {activeTab === 'customers' && (
              <div className="customers-tab">
                <div className="cc-search-blue-glass">
                  <Search className="w-4 h-4" style={{ color: 'rgba(0,150,255,0.6)' }} />
                  <input
                    type="text"
                    placeholder="Search customers..."
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                  />
                </div>
                <div className="cc-list">
                  {filteredCustomers.map(customer => (
                    <CustomerItem
                      key={customer.id}
                      customer={customer}
                      onClick={() => {}}
                    />
                  ))}
                </div>
                <button className="cc-add-btn">
                  <Plus className="w-4 h-4" />
                  <span>Add Customer</span>
                </button>
              </div>
            )}

            {activeTab === 'import' && (
              <ImportTab
                onFileUpload={() => toggleImport()}
                onManualEntry={() => {}}
                onVisionExtract={() => {}}
              />
            )}

            {activeTab === 'settings' && (
              <SettingsTab
                defaultTargetLanguage={defaultTargetLanguage}
                onLanguageChange={handleLanguageChange}
              />
            )}
          </Suspense>
        </div>
      </div>
    </div>
  );
});

CommandCenterOptimized.displayName = 'CommandCenterOptimized';

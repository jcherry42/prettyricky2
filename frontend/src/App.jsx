import React, { useEffect, useState } from 'react';
import { SalesProvider } from './context/SalesContext';
import { Header } from './components/Header';
import CustomerSelector from './components/CustomerSelector';
import InquiryTypeSelector from './components/InquiryTypeSelector';
import ResponseCards from './components/ResponseCards';
import TowerTalkButton from './components/TowerTalkButton';
import TowerTalkModal from './components/TowerTalkModal';
import SetupModal from './components/SetupModal';
import ImportModal from './components/ImportModal';
import AdminSettingsPanel from './components/AdminSettingsPanel';
import VoiceTranslator from './components/VoiceTranslator';
import QuickAddButton from './components/QuickAddButton';
import { Toaster } from './components/ui/sonner';
import { useSales } from './context/SalesContext';
import { initializeNative, updateStatusBarTheme, isNative } from './utils/native';
import ErrorBoundary from './components/ErrorBoundary';
import performanceManager from './utils/performanceManager';
import PerformanceMonitor from './components/PerformanceMonitor';
import { offlineSync } from './utils/offlineSync';
import './utils/keyboardManager'; // Auto-initializes on import
import DesignoSwirlBackground from './components/DesignoSwirlBackground';


// Start Performance Manager on app load
performanceManager.start();

function AppContent() {
  const {
    showAdminSettings,
    toggleAdminSettings,
    showImport,
    showTowerTalk,
    showSetup,
    showFavorites,
  } = useSales();
  const [showPerfMonitor, setShowPerfMonitor] = useState(false);

  // Adaptive swirl intensity: more prominent on the home surface, calmer behind any modal.
  // NOTE: some modals are owned by Header (Command Center, Intake Hub, Local Inventory),
  // so we detect them by presence of their overlay elements.
  const [hasHeaderModalOpen, setHasHeaderModalOpen] = useState(false);

  useEffect(() => {
    const recompute = () => {
      const open = Boolean(
        document.querySelector('.cc-overlay') ||
          document.querySelector('.intake-overlay') ||
          document.querySelector('.inventory-overlay')
      );
      setHasHeaderModalOpen(open);
    };

    recompute();

    const mo = new MutationObserver(recompute);
    mo.observe(document.body, { childList: true, subtree: true });

    return () => mo.disconnect();
  }, []);

  const swirlProminence = showImport || showTowerTalk || hasHeaderModalOpen ? 0.7 : 1.45;
  
  // Initialize native capabilities on mount
  useEffect(() => {
    if (isNative) {
      initializeNative();
    }
    
    // Optimize scroll performance
    let ticking = false;
    const handleScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          // Handle scroll events here if needed
          ticking = false;
        });
        ticking = true;
      }
    };
    
    window.addEventListener('scroll', handleScroll, { passive: true });
    
    // Preconnect to backend for faster API calls
    const link = document.createElement('link');
    link.rel = 'preconnect';
    link.href = import.meta.env.VITE_BACKEND_URL || window.location.origin;
    document.head.appendChild(link);
    
    return () => {
      window.removeEventListener('scroll', handleScroll);
    };
  }, []);
  
  // Update status bar (dark-only)
  useEffect(() => {
    if (isNative) {
      updateStatusBarTheme(true);
    }
  }, []);
  
  return (
    <div className="min-h-screen bg-background max-w-[100vw] overflow-x-hidden quilted-leather-amber">
      {/* Prominent on the home surface; adaptively dampened while modals are open */}
      <DesignoSwirlBackground prominence={swirlProminence} />

      {/* Ambient lighting overlay */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-transparent to-black/60" />
        <div className="absolute top-0 left-0 right-0 h-40 bg-gradient-to-b from-orange-500/[0.03] to-transparent" />
        <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-cyan-500/[0.02] to-transparent" />
      </div>
      
      {/* Skip Link for Accessibility */}
      <a href="#main-content" className="skip-link">
        Skip to main content
      </a>
      
      {/* Fixed Header */}
      <Header />

      {/* Main Content - padding-top accounts for fixed header */}
      <main 
        id="main-content" 
        className="relative z-10 px-4 py-4 pb-safe space-y-4" 
        style={{ paddingTop: '160px' }}
        role="main"
        aria-label="Sales Command Center"
      >
        {/* Step 1: Select Customer */}
        <section aria-label="Customer Selection">
          <ErrorBoundary minimal message="Failed to load customers">
            <CustomerSelector />
          </ErrorBoundary>
        </section>

        {/* Step 2: Select Inquiry Type */}
        <section aria-label="Inquiry Type Selection">
          <ErrorBoundary minimal>
            <InquiryTypeSelector />
          </ErrorBoundary>
        </section>

        {/* Step 3: Review Generated Responses (2 pre-generated + 1 custom) */}
        <section aria-label="Generated Responses">
          <ErrorBoundary minimal message="Failed to load responses">
            <ResponseCards />
          </ErrorBoundary>
        </section>

        {/* Tower Talk Button (appears when customer selected) */}
        <section aria-label="Tower Talk">
          <TowerTalkButton />
        </section>
      </main>

      {/* Modals */}
      <SetupModal />
      <ImportModal />
      <TowerTalkModal />
      {showAdminSettings && <AdminSettingsPanel onClose={() => toggleAdminSettings(false)} />}
      
      {/* Voice Translator - Right Side Panel */}
      <VoiceTranslator />
      
      {/* Quick Add Customer - Floating Bluetooth Button */}
      <QuickAddButton />
      
      {/* Performance Monitor - Dev Mode or triple-tap to show */}
      <PerformanceMonitor 
        visible={showPerfMonitor} 
        position="bottom-left"
        compact={true}
      />
      
      {/* Toast notifications */}
      <Toaster position="top-center" />
    </div>
  );
}

function App() {
  return (
    <ErrorBoundary message="Something went wrong. Please refresh the page.">
      <SalesProvider>
        <AppContent />
      </SalesProvider>
    </ErrorBoundary>
  );
}

export default App;

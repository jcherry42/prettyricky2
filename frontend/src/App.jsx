import React, { useEffect, Suspense, lazy } from 'react';
import { SalesProvider } from './context/SalesContext';
import { Header } from './components/Header';

// Lazy load components for better performance
const CustomerSelector = lazy(() => import('./components/CustomerSelector'));
const InquiryTypeSelector = lazy(() => import('./components/InquiryTypeSelector'));
const ToneSelector = lazy(() => import('./components/ToneSelector'));
const ResponseCards = lazy(() => import('./components/ResponseCards'));
const TowerTalkButton = lazy(() => import('./components/TowerTalkButton'));
const TowerTalkModal = lazy(() => import('./components/TowerTalkModal'));
const SetupModal = lazy(() => import('./components/SetupModal'));
const ImportModal = lazy(() => import('./components/ImportModal'));
const AdminSettingsPanel = lazy(() => import('./components/AdminSettingsPanel'));
const VoiceTranslator = lazy(() => import('./components/VoiceTranslator'));
const QuickAddButton = lazy(() => import('./components/QuickAddButton'));
import { Toaster } from './components/ui/sonner';
import { useSales } from './context/SalesContext';
import { initializeNative, updateStatusBarTheme, isNative } from './utils/native';

// Loading skeleton component
const LoadingSkeleton = () => (
  <div className="space-y-4 animate-pulse">
    <div className="h-24 bg-gray-700/50 rounded-lg skeleton"></div>
  </div>
);

function AppContent() {
  const { showAdminSettings, toggleAdminSettings, theme } = useSales();
  
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
    link.href = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8001';
    document.head.appendChild(link);
    
    return () => {
      window.removeEventListener('scroll', handleScroll);
    };
  }, []);
  
  // Update status bar when theme changes
  useEffect(() => {
    if (isNative) {
      updateStatusBarTheme(theme === 'dark');
    }
  }, [theme]);
  
  return (
    <div className="min-h-screen bg-background max-w-[100vw] overflow-x-hidden">
      {/* Fixed Header */}
      <Header />

      {/* Main Content - padding-top accounts for fixed header */}
      <main className="px-4 py-4 pb-safe space-y-4" style={{ paddingTop: '120px' }}>
        {/* Step 1: Select Customer */}
        <section>
          <CustomerSelector />
        </section>

        {/* Step 2: Select Inquiry Type */}
        <section>
          <InquiryTypeSelector />
        </section>

        {/* Step 3: Select Tone */}
        <section>
          <ToneSelector />
        </section>

        {/* Step 4: Review Generated Responses */}
        <section>
          <ResponseCards />
        </section>

        {/* Tower Talk Button (appears when customer selected) */}
        <section>
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
      
      {/* Toast notifications */}
      <Toaster position="top-center" />
    </div>
  );
}

function App() {
  return (
    <SalesProvider>
      <AppContent />
    </SalesProvider>
  );
}

export default App;

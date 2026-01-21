import React, { useEffect, useState } from 'react';
import { SalesProvider } from './context/SalesContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Header } from './components/Header';
import CustomerSelector from './components/CustomerSelector';
import InquiryTypeSelector from './components/InquiryTypeSelector';
import ToneSelector from './components/ToneSelector';
import ResponseCards from './components/ResponseCards';
import TowerTalkButton from './components/TowerTalkButton';
import TowerTalkModal from './components/TowerTalkModal';
import SetupModal from './components/SetupModal';
import ImportModal from './components/ImportModal';
import AdminSettingsPanel from './components/AdminSettingsPanel';
import VoiceTranslator from './components/VoiceTranslator';
import QuickAddButton from './components/QuickAddButton';
import LoginModal from './components/LoginModal';
import { Toaster } from './components/ui/sonner';
import { useSales } from './context/SalesContext';
import { initializeNative, updateStatusBarTheme, isNative } from './utils/native';

function AppContent() {
  const { showAdminSettings, toggleAdminSettings, theme } = useSales();
  const { isAuthenticated, isLoading, user, logout } = useAuth();
  const [showLogin, setShowLogin] = useState(false);
  
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

  // Show login modal for unauthenticated users (after loading complete)
  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      setShowLogin(true);
    }
  }, [isLoading, isAuthenticated]);

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-orange-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-zinc-400">Loading Supercharg'd...</p>
        </div>
      </div>
    );
  }
  
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

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
import { ErrorBoundary } from './components/ui/ErrorBoundary';

function AppContent() {
  const { showAdminSettings, toggleAdminSettings, theme } = useSales();
  const { isAuthenticated, isLoading, user, logout } = useAuth();
  const [showLogin, setShowLogin] = useState(true);  // Show login by default
  
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

  // Derive showLogin from auth state instead of using effect
  const shouldShowLogin = !isLoading && !isAuthenticated && showLogin;

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-orange-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-zinc-400">Loading Supercharg&apos;d...</p>
        </div>
      </div>
    );
  }
  
  return (
    <div className="min-h-screen bg-background max-w-[100vw] overflow-x-hidden">
      {/* Skip Link for Accessibility */}
      <a href="#main-content" className="skip-link">
        Skip to main content
      </a>
      
      {/* Fixed Header */}
      <Header />

      {/* Main Content - padding-top accounts for fixed header */}
      <main 
        id="main-content" 
        className="px-4 py-4 pb-safe space-y-4" 
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

        {/* Step 3: Select Tone */}
        <section aria-label="Response Tone Selection">
          <ErrorBoundary minimal>
            <ToneSelector />
          </ErrorBoundary>
        </section>

        {/* Step 4: Review Generated Responses */}
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
      
      {/* Login Modal */}
      {shouldShowLogin && (
        <LoginModal 
          onClose={() => setShowLogin(false)} 
          onSuccess={() => setShowLogin(false)} 
        />
      )}
      
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
    <AuthProvider>
      <SalesProvider>
        <AppContent />
      </SalesProvider>
    </AuthProvider>
  );
}

export default App;

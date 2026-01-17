import React, { useEffect, Suspense, lazy } from 'react';
import { SalesProvider } from './context/SalesContext';
import { Header } from './components/Header';
import { CustomerSelector } from './components/CustomerSelector';
import { InquiryTypeSelector } from './components/InquiryTypeSelector';
import { ToneSelector } from './components/ToneSelector';
import { ResponseCards } from './components/ResponseCards';
import { TowerTalkButton } from './components/TowerTalkButton';
import { TowerTalkModal } from './components/TowerTalkModal';
import { SetupModal } from './components/SetupModal';
import { ImportModal } from './components/ImportModal';
import { AdminSettingsPanel } from './components/AdminSettingsPanel';
import { VoiceTranslator } from './components/VoiceTranslator';
import { QuickAddButton } from './components/QuickAddButton';
import { Toaster } from './components/ui/sonner';
import { useSales } from './context/SalesContext';
import { initializeNative, updateStatusBarTheme, isNative } from './utils/native';

function AppContent() {
  const { showAdminSettings, toggleAdminSettings, theme } = useSales();
  
  // Initialize native capabilities on mount
  useEffect(() => {
    if (isNative) {
      initializeNative();
    }
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

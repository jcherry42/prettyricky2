import React, { useState, useEffect } from 'react';
import { SalesProvider } from './context/SalesContext';
import { Header } from './components/Header';
import { ProspectSelector } from './components/ProspectSelector';
import { ObjectionChips } from './components/ObjectionChips';
import { ResponseCards } from './components/ResponseCards';
import { ProspectDetails } from './components/ProspectDetails';
import { ImportModal } from './components/ImportModal';
import { SettingsModal } from './components/SettingsModal';
import { KeyboardShortcuts } from './components/KeyboardShortcuts';
import { Toaster } from './components/ui/sonner';

function AppContent() {
  const [showImport, setShowImport] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  return (
    <div className="min-h-screen bg-background">
      {/* Keyboard shortcuts handler */}
      <KeyboardShortcuts 
        onSettingsOpen={() => setShowSettings(true)}
        onImportOpen={() => setShowImport(true)}
      />

      {/* Header */}
      <Header 
        onSettingsClick={() => setShowSettings(true)}
        onImportClick={() => setShowImport(true)}
      />

      {/* Main Content */}
      <main className="container mx-auto px-4 py-6 max-w-7xl">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column - Main Workflow */}
          <div className="lg:col-span-8 space-y-6">
            {/* Prospect Selector */}
            <section>
              <ProspectSelector />
            </section>

            {/* Objection Chips */}
            <section className="glass-card rounded-xl p-4 md:p-5">
              <ObjectionChips />
            </section>

            {/* Response Cards */}
            <section className="glass-card rounded-xl p-4 md:p-5">
              <ResponseCards />
            </section>
          </div>

          {/* Right Column - Prospect Details */}
          <aside className="lg:col-span-4">
            <div className="lg:sticky lg:top-24">
              <ProspectDetails />

              {/* Keyboard shortcuts help */}
              <div className="mt-4 p-4 rounded-xl bg-muted/30 border border-border/30">
                <p className="text-xs font-medium text-foreground mb-3">Keyboard Shortcuts</p>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="flex items-center gap-2">
                    <kbd className="kbd">/</kbd>
                    <span className="text-muted-foreground">Search</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <kbd className="kbd">C</kbd>
                    <span className="text-muted-foreground">Copy response</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <kbd className="kbd">1-8</kbd>
                    <span className="text-muted-foreground">Select objection</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <kbd className="kbd">S</kbd>
                    <span className="text-muted-foreground">Settings</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <kbd className="kbd">I</kbd>
                    <span className="text-muted-foreground">Import</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <kbd className="kbd">Esc</kbd>
                    <span className="text-muted-foreground">Close</span>
                  </div>
                </div>
              </div>
            </div>
          </aside>
        </div>
      </main>

      {/* Modals */}
      <ImportModal open={showImport} onOpenChange={setShowImport} />
      <SettingsModal open={showSettings} onOpenChange={setShowSettings} />
      
      {/* Toast notifications */}
      <Toaster position="bottom-right" />
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

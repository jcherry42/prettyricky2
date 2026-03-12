import React, { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import * as ScreenOrientation from 'expo-screen-orientation';
import { NavigationContainer } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import Constants from 'expo-constants';
import { enableScreens } from 'react-native-screens';
import { InfotainmentShell } from './src/components/InfotainmentShell';
import { RootNavigator } from './src/navigation/RootNavigator';
import { ErrorBoundary } from './src/components/ErrorBoundary';
import { OfflineBanner } from './src/components/OfflineBanner';
import { AppSettingsProvider } from './src/context/AppSettingsContext';
import { AmbientLightingProvider } from './src/context/AmbientLightingContext';
import { PttProvider } from './src/context/PttContext';
import { TaillightFlashProvider } from './src/context/TaillightFlashContext';
import { CustomerProvider } from './src/context/CustomerContext';
import { InventoryProvider } from './src/context/InventoryContext';
import { NetworkProvider } from './src/context/NetworkContext';
import { ToastProvider } from './src/context/ToastContext';
import { useFontsReady } from './src/hooks/useFontsReady';
import { AuthProvider, useAuth } from './src/context/AuthContext';
import { WebSocketProvider } from './src/context/WebSocketContext';
import { SessionPersistenceProvider } from './src/context/SessionContext';
import { PinScreen } from './src/screens/PinScreen';
import { View, ActivityIndicator } from 'react-native';

// Disable native screens (RNSScreen Fabric component) to prevent a Codegen
// TypeSpec boolean/string mismatch that crashes Expo Go during tab navigator
// initialisation. Without this, the Freeze→Suspender→AnimatedComponent→RNSScreen
// chain triggers a JSI type error: "expected dynamic type 'boolean', had 'string'".
// Using JS-based screen rendering is a safe fallback for Expo Go testing.
// Enable native screens in production builds for optimal performance.
// Disable in Expo Go to avoid JSI boolean/string type mismatch
// in react-native-screens 4.16.0 + SDK 54.
const isExpoGo = Constants.appOwnership === 'expo';
enableScreens(!isExpoGo);

/**
 * ComposeProviders — reduces deep nesting from 11 levels to a flat list.
 * Renders providers inside-out: last in the array is innermost.
 */
function ComposeProviders({ providers, children }: { providers: React.ComponentType<{ children: React.ReactNode }>[]; children: React.ReactNode }) {
  return providers.reduceRight(
    (acc: React.ReactNode, Provider: React.ComponentType<{ children: React.ReactNode }>) => <Provider>{acc}</Provider>,
    children
  );
}

/**
 * AuthGate — shows PIN screen when not authenticated, main app when authenticated.
 * Must be inside AuthProvider to access useAuth().
 */
function AuthGate() {
  const { isAuthenticated, isLoading, needsSetup } = useAuth();

  if (isLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: '#040608', justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#C0C0C0" />
      </View>
    );
  }

  if (!isAuthenticated || needsSetup) {
    return <PinScreen />;
  }

  return <MainApp />;
}

/**
 * MainApp — the actual app content (only rendered when authenticated).
 */
function MainApp() {
  // Provider order matters: outermost first, innermost last.
  // Network/Toast/Settings must be before Customer/Inventory (data deps).
  // AmbientLighting/TaillightFlash are visual-only — innermost.
  const providers = [
    ErrorBoundary,
    NetworkProvider,
    ToastProvider,
    AppSettingsProvider,
    WebSocketProvider,
    SessionPersistenceProvider,    // Session persistence — captures & restores all app state
    CustomerProvider,
    InventoryProvider,
    PttProvider,
    AmbientLightingProvider,
    TaillightFlashProvider,
  ];

  return (
    <ComposeProviders providers={providers}>
      <InfotainmentShell>
        <NavigationContainer>
          <RootNavigator />
        </NavigationContainer>
        <OfflineBanner />
        <StatusBar style="light" />
      </InfotainmentShell>
    </ComposeProviders>
  );
}

export default function App() {
  const fontsReady = useFontsReady();

  // Hard lock to portrait mode
  useEffect(() => {
    ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP).catch(() => {});
  }, []);

  if (!fontsReady) {
    return <View style={{ flex: 1, backgroundColor: '#040608' }} />;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <AuthProvider>
          <AuthGate />
        </AuthProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

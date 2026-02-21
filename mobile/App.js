import React, { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import * as ScreenOrientation from 'expo-screen-orientation';
import { NavigationContainer } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
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
import { View } from 'react-native';

// Disable native screens (RNSScreen Fabric component) to prevent a Codegen
// TypeSpec boolean/string mismatch that crashes Expo Go during tab navigator
// initialisation. Without this, the Freeze→Suspender→AnimatedComponent→RNSScreen
// chain triggers a JSI type error: "expected dynamic type 'boolean', had 'string'".
// Using JS-based screen rendering is a safe fallback for Expo Go testing.
enableScreens(false);

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
        <ErrorBoundary>
          <NetworkProvider>
            <ToastProvider>
              <AppSettingsProvider>
                <AmbientLightingProvider>
                  <CustomerProvider>
                    <InventoryProvider>
                      <PttProvider>
                        <TaillightFlashProvider>
                          <InfotainmentShell>
                            <NavigationContainer>
                              <RootNavigator />
                            </NavigationContainer>
                            <OfflineBanner />
                            <StatusBar style="light" />
                          </InfotainmentShell>
                        </TaillightFlashProvider>
                      </PttProvider>
                    </InventoryProvider>
                  </CustomerProvider>
                </AmbientLightingProvider>
              </AppSettingsProvider>
            </ToastProvider>
          </NetworkProvider>
        </ErrorBoundary>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

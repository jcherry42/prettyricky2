import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { InfotainmentShell } from './src/components/InfotainmentShell';
import { RootNavigator } from './src/navigation/RootNavigator';
import { AppSettingsProvider } from './src/context/AppSettingsContext';
import { PttProvider } from './src/context/PttContext';
import { useFontsReady } from './src/hooks/useFontsReady';
import { View } from 'react-native';

export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <AppSettingsProvider>
          <PttProvider>
            <InfotainmentShell>
              <NavigationContainer>
                <Tabs />
              </NavigationContainer>
              <StatusBar style="light" />
            </InfotainmentShell>
          </PttProvider>
        </AppSettingsProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

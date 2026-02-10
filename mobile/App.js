import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { InfotainmentShell } from './src/components/InfotainmentShell';
import { Tabs } from './src/navigation/Tabs';
import { AppSettingsProvider } from './src/context/AppSettingsContext';
import { PttProvider } from './src/context/PttContext';

export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <AppSettingsProvider>
          <InfotainmentShell>
            <NavigationContainer>
              <Tabs />
            </NavigationContainer>
            <StatusBar style="light" />
          </InfotainmentShell>
        </AppSettingsProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

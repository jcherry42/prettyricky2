import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { InfotainmentShell } from './src/components/InfotainmentShell';
import { RootNavigator } from './src/navigation/RootNavigator';
import { AppSettingsProvider } from './src/context/AppSettingsContext';
import { PttProvider } from './src/context/PttContext';
import { TaillightFlashProvider } from './src/context/TaillightFlashContext';
import { useFontsReady } from './src/hooks/useFontsReady';
import { View } from 'react-native';

export default function App() {
  const fontsReady = useFontsReady();

  if (!fontsReady) {
    return <View style={{ flex: 1, backgroundColor: '#040608' }} />;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <AppSettingsProvider>
          <PttProvider>
            <TaillightFlashProvider>
              <InfotainmentShell>
                <NavigationContainer>
                  <RootNavigator />
                </NavigationContainer>
                <StatusBar style="light" />
              </InfotainmentShell>
            </TaillightFlashProvider>
          </PttProvider>
        </AppSettingsProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

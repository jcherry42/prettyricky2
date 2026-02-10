import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { ScanHubScreen } from '../screens/ScanHubScreen';
import { VinScanScreen } from '../screens/VinScanScreen';
import { DlScanScreen } from '../screens/DlScanScreen';
import { colors } from '../theme/colors';

const Stack = createNativeStackNavigator();

export function ScanStack() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: true,
        headerStyle: { backgroundColor: 'rgba(4,6,8,0.95)' },
        headerTintColor: colors.gold,
        headerTitleStyle: {
          color: colors.text,
          fontWeight: '800',
          fontSize: 14,
          letterSpacing: 1.2,
        },
        headerBackTitleVisible: false,
        headerShadowVisible: false,
      }}
    >
      <Stack.Screen name="ScanHub" component={ScanHubScreen} options={{ headerShown: false }} />
      <Stack.Screen name="VinScan" component={VinScanScreen} options={{ title: 'VIN SCANNER' }} />
      <Stack.Screen name="DlScan" component={DlScanScreen} options={{ title: "DRIVER'S LICENSE" }} />
    </Stack.Navigator>
  );
}

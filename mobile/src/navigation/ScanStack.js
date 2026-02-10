import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { ScanHubScreen } from '../screens/ScanHubScreen';
import { VinScanScreen } from '../screens/VinScanScreen';
import { DlScanScreen } from '../screens/DlScanScreen';

const Stack = createNativeStackNavigator();

export function ScanStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="ScanHub" component={ScanHubScreen} />
      <Stack.Screen name="VinScan" component={VinScanScreen} />
      <Stack.Screen name="DlScan" component={DlScanScreen} />
    </Stack.Navigator>
  );
}

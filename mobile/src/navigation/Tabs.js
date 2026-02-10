import React, { useState } from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Text } from 'react-native';
import { HomeScreen } from '../screens/HomeScreen';
import { ConnectivityScreen } from '../screens/ConnectivityScreen';
import { VinScanScreen } from '../screens/VinScanScreen';
import { InventoryScreen } from '../screens/InventoryScreen';
import { DlScanScreen } from '../screens/DlScanScreen';
import { colors } from '../theme/colors';
import { FloatingCheckButton } from '../components/FloatingCheckButton';
import { CommandCenterModal } from '../components/CommandCenterModal';

const Tab = createBottomTabNavigator();

function TabIcon({ label, focused }) {
  return (
    <Text
      style={{
        color: focused ? colors.gold : colors.textMute,
        fontSize: 11,
        fontWeight: '900',
        letterSpacing: 1.1,
      }}
    >
      {label}
    </Text>
  );
}

export function Tabs() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: 'rgba(0,0,0,0.55)',
          borderTopColor: 'rgba(255,255,255,0.10)',
          borderTopWidth: 1,
          height: 64,
          paddingBottom: 10,
          paddingTop: 8,
        },
      }}
    >
      <Tab.Screen
        name="Home"
        component={HomeScreen}
        options={{ tabBarIcon: ({ focused }) => <TabIcon label="HOME" focused={focused} /> }}
      />
      <Tab.Screen
        name="VIN"
        component={VinScanScreen}
        options={{ tabBarIcon: ({ focused }) => <TabIcon label="VIN" focused={focused} /> }}
      />
      <Tab.Screen
        name="Inventory"
        component={InventoryScreen}
        options={{ tabBarIcon: ({ focused }) => <TabIcon label="INV" focused={focused} /> }}
      />
      <Tab.Screen
        name="DL"
        component={DlScanScreen}
        options={{ tabBarIcon: ({ focused }) => <TabIcon label="DL" focused={focused} /> }}
      />
      <Tab.Screen
        name="Link"
        component={ConnectivityScreen}
        options={{ tabBarIcon: ({ focused }) => <TabIcon label="LINK" focused={focused} /> }}
      />
    </Tab.Navigator>
  );
}

import React, { useState } from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Text } from 'react-native';
import { FloatingPttButton } from '../components/FloatingPttButton';
import { PttOverlay } from '../components/PttOverlay';
import { useAppSettings } from '../context/AppSettingsContext';
import { HomeScreen } from '../screens/HomeScreen';
import { ConnectivityScreen } from '../screens/ConnectivityScreen';
import { VinScanScreen } from '../screens/VinScanScreen';
import { InventoryScreen } from '../screens/InventoryScreen';
import { DlScanScreen } from '../screens/DlScanScreen';
import { colors } from '../theme/colors';
import { FloatingCheckButton } from '../components/FloatingCheckButton';
import { CommandCenterModal } from '../components/CommandCenterModal';
import { PrintCenterModal } from '../screens/PrintCenterModal';

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

function flagFor(lang) {
  if (lang === 'es') return '🇲🇽';
  if (lang === 'fr') return '🇫🇷';
  if (lang === 'ko') return '🇰🇷';
  return '🏁';
}

export function Tabs() {
  const [ccOpen, setCcOpen] = useState(false);
  const [pttOpen, setPttOpen] = useState(false);
  const [printOpen, setPrintOpen] = useState(false);
  const { settings } = useAppSettings();

  return (
    <>
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

      <FloatingCheckButton onPress={() => setCcOpen(true)} />
      <CommandCenterModal visible={ccOpen} onClose={() => setCcOpen(false)} />

      {settings.sportMode ? (
        <>
          <FloatingPttButton
            flagLabel={flagFor(settings.defaultTargetLanguage || 'es')}
            recording={false}
            disabled={false}
            onPressIn={() => setPttOpen(true)}
            onPressOut={() => {}}
          />
          <PttOverlay visible={pttOpen} onClose={() => setPttOpen(false)} />
        </>
      ) : null}
    </>
  );
}

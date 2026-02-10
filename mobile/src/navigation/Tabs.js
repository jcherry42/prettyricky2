import React, { useState } from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Text } from 'react-native';
import { FloatingPttButton } from '../components/FloatingPttButton';
import { PttOverlayView } from '../components/PttOverlayView';
import { usePtt } from '../context/PttContext';
// (Tabs navigator deprecated; RootNavigator is used in App.js)
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
  const [talkOpen, setTalkOpen] = useState(false);
  const { settings } = useAppSettings();
  const ptt = usePtt();

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

      <FloatingCheckButton onPress={() => setCcOpen(true)} onLongPress={() => setPrintOpen(true)} />
      <CommandCenterModal visible={ccOpen} onClose={() => setCcOpen(false)} />
      <PrintCenterModal visible={printOpen} onClose={() => setPrintOpen(false)} />

      {/* Tower Talk moved to RootNavigator */}

      {settings.sportMode ? (
        <>
          <FloatingPttButton
            flagLabel={flagFor(settings.defaultTargetLanguage || 'es')}
            badgeDirection={settings.pttDirection === 'target_to_en' ? '→ EN' : 'EN →'}
            recording={ptt.status === 'recording'}
            disabled={ptt.status === 'processing' || ptt.status === 'speaking'}
            onPressIn={async () => {
              setPttOpen(true);
              await ptt.startRecording();
            }}
            onPressOut={async () => {
              await ptt.stopRecording();
            }}
          />
          <PttOverlayView visible={pttOpen} onClose={() => setPttOpen(false)} />
        </>
      ) : null}
    </>
  );
}

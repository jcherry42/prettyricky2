import React, { useMemo, useState } from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { colors } from '../theme/colors';
import { type } from '../theme/typography';

import { useAppSettings } from '../context/AppSettingsContext';
import { usePtt } from '../context/PttContext';

import { HomeScreen } from '../screens/HomeScreen';
import { IntakeScreen } from '../screens/IntakeScreen';
import { ScanStack } from './ScanStack';

import { FloatingCheckButton } from '../components/FloatingCheckButton';
import { CommandCenterModal } from '../components/CommandCenterModal';
import { PrintCenterModal } from '../screens/PrintCenterModal';

import { FloatingPttButton } from '../components/FloatingPttButton';
import { PttOverlayView } from '../components/PttOverlayView';

import { FloatingOnStarButton } from '../components/FloatingOnStarButton';
import { TowerTalkOverlay } from '../components/TowerTalkOverlay';

const Tab = createBottomTabNavigator();

function flagFor(lang) {
  if (lang === 'es') return '🇲🇽';
  if (lang === 'fr') return '🇫🇷';
  if (lang === 'ko') return '🇰🇷';
  return '🏁';
}

function TabLabel({ children, focused }) {
  return (
    <Text
      style={{
        color: focused ? colors.gold : colors.textMute,
        ...type.label,
        fontSize: 10,
        letterSpacing: 1.1,
      }}
    >
      {children}
    </Text>
  );
}

export function RootNavigator() {
  const [ccOpen, setCcOpen] = useState(false);
  const [printOpen, setPrintOpen] = useState(false);
  const [pttOpen, setPttOpen] = useState(false);
  const [talkOpen, setTalkOpen] = useState(false);

  const { settings } = useAppSettings();
  const ptt = usePtt();

  const tabBarStyle = useMemo(
    () => ({
      backgroundColor: 'rgba(0,0,0,0.62)',
      borderTopColor: 'rgba(255,255,255,0.10)',
      borderTopWidth: 1,
      height: 64,
      paddingTop: 8,
      paddingBottom: 10,
    }),
    []
  );

  return (
    <>
      <Tab.Navigator
        screenOptions={{
          headerShown: false,
          tabBarStyle,
          tabBarHideOnKeyboard: true,
        }}
      >
        <Tab.Screen
          name="Home"
          component={HomeScreen}
          options={{
            tabBarIcon: ({ focused }) => (
              <Ionicons name={focused ? 'home' : 'home-outline'} size={20} color={focused ? colors.gold : colors.textMute} />
            ),
            tabBarLabel: ({ focused }) => <TabLabel focused={focused}>HOME</TabLabel>,
          }}
        />

        <Tab.Screen
          name="Scan"
          component={ScanStack}
          options={{
            tabBarIcon: ({ focused }) => (
              <Ionicons name={focused ? 'scan' : 'scan-outline'} size={20} color={focused ? colors.gold : colors.textMute} />
            ),
            tabBarLabel: ({ focused }) => <TabLabel focused={focused}>SCAN</TabLabel>,
          }}
        />

        <Tab.Screen
          name="Intake"
          component={IntakeScreen}
          options={{
            tabBarIcon: ({ focused }) => (
              <Ionicons name={focused ? 'clipboard' : 'clipboard-outline'} size={20} color={focused ? colors.gold : colors.textMute} />
            ),
            tabBarLabel: ({ focused }) => <TabLabel focused={focused}>INTAKE</TabLabel>,
          }}
        />
      </Tab.Navigator>

      {/* Floating actions (A): CHECK left, ONSTAR right, PTT appears in SPORT */}
      <FloatingCheckButton onPress={() => setCcOpen(true)} onLongPress={() => setPrintOpen(true)} />
      <CommandCenterModal visible={ccOpen} onClose={() => setCcOpen(false)} />
      <PrintCenterModal visible={printOpen} onClose={() => setPrintOpen(false)} />

      <FloatingOnStarButton onPress={() => setTalkOpen(true)} />
      <TowerTalkOverlay visible={talkOpen} onClose={() => setTalkOpen(false)} />

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

      {/* Spacer view to prevent RN warning about fragments in some versions */}
      <View style={{ width: 0, height: 0 }} />
    </>
  );
}

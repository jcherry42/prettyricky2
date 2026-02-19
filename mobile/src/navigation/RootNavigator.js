import React, { useMemo, useState } from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Text } from 'react-native';

import { CustomerEntryMenuModal } from '../components/CustomerEntryMenuModal';
import { Ionicons } from '@expo/vector-icons';

import { colors } from '../theme/colors';
import { type } from '../theme/typography';

import { useAppSettings } from '../context/AppSettingsContext';
import { usePtt } from '../context/PttContext';

import { HomeScreen } from '../screens/HomeScreen';
import { BrandTaillights } from '../components/BrandTaillights';
import { IntakeScreen } from '../screens/IntakeScreen';

import { FloatingButtonCluster } from '../components/FloatingButtonCluster';
import { CommandCenterModal } from '../components/CommandCenterModal';
import { PrintCenterModal } from '../screens/PrintCenterModal';

import { FloatingPttButton } from '../components/FloatingPttButton';
import { FloatingCustomerButton } from '../components/FloatingCustomerButton';
import { PttOverlayView } from '../components/PttOverlayView';

import { TowerTalkOverlay } from '../components/TowerTalkOverlay';
import { CustomerListModal } from '../screens/CustomerListModal';
import { flagFor } from '../utils/language';

const Tab = createBottomTabNavigator();

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
  const [customersOpen, setCustomersOpen] = useState(false);
  const [currentRoute, setCurrentRoute] = useState('Home');

  const { settings } = useAppSettings();
  const ptt = usePtt();

  const isHome = currentRoute === 'Home';

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
        screenListeners={{
          state: (e) => {
            const route = e.data?.state?.routes[e.data?.state?.index];
            if (route?.name) {
              setCurrentRoute(route.name);
            }
          },
        }}
      >
        <Tab.Screen
          name="Home"
          component={HomeScreen}
          options={{
            headerShown: true,
            headerTransparent: true,
            headerTitleAlign: 'center',
            headerTitle: () => <BrandTaillights compact />,
            headerStyle: { backgroundColor: 'transparent' },
            tabBarIcon: ({ focused }) => (
              <Ionicons name={focused ? 'speedometer' : 'speedometer-outline'} size={20} color={focused ? colors.gold : colors.textMute} />
            ),
            tabBarLabel: ({ focused }) => <TabLabel focused={focused}>HOME</TabLabel>,
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

      {/* Floating button cluster: CHECK | EJECT | TOWER TALK */}
      <FloatingButtonCluster
        onCheck={() => setCcOpen(true)}
        onEject={() => setPrintOpen(true)}
        onTowerTalk={() => setTalkOpen(true)}
      />

      {/* Modals */}
      <CommandCenterModal visible={ccOpen} onClose={() => setCcOpen(false)} />
      <PrintCenterModal visible={printOpen} onClose={() => setPrintOpen(false)} />
      <TowerTalkOverlay visible={talkOpen} onClose={() => setTalkOpen(false)} />
      <CustomerListModal visible={customersOpen} onClose={() => setCustomersOpen(false)} />

      {/* Bluetooth customer button - always on Home */}
      {isHome && (
        <FloatingCustomerButton onPress={() => setCustomersOpen(true)} />
      )}

      {/* PTT (only in SPORT mode) */}
      {settings.sportMode ? (
        <>
          <FloatingPttButton
            flagLabel={flagFor(settings.defaultTargetLanguage)}
            badgeDirection={settings.pttDirection === 'target_to_en' ? '\u2192 EN' : 'EN \u2192'}
            recording={ptt.status === 'recording'}
            disabled={ptt.status === 'processing' || ptt.status === 'speaking'}
            onPress={() => {
              if (ptt.status === 'recording') {
                ptt.stopRecording?.();
              } else if (ptt.status === 'idle' || ptt.status === 'done' || ptt.status === 'error') {
                setPttOpen(true);
                ptt.startRecording?.();
              }
            }}
          />
          <PttOverlayView visible={pttOpen} onClose={() => setPttOpen(false)} />
        </>
      ) : null}
    </>
  );
}
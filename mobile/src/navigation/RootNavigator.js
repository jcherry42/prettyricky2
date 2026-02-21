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
  const [ccTab, setCcTab] = useState(null);
  const [ccSection, setCcSection] = useState(null);
  const [printOpen, setPrintOpen] = useState(false);
  const [pttOpen, setPttOpen] = useState(false);
  const [talkOpen, setTalkOpen] = useState(false);
  const [customersOpen, setCustomersOpen] = useState(false);
  const [customerEntryOpen, setCustomerEntryOpen] = useState(false);
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
          // Disable react-freeze for tab screens — prevents the
          // Freeze→Suspender→AnimatedComponent→RNSScreen chain that triggers
          // a JSI boolean/string type error in Expo Go.
          freezeOnBlur: false,
          // Inactive screens are detached from the tree to save memory
          // (works fine with enableScreens(false) in App.js).
          detachInactiveScreens: false,
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
        onCheck={() => { setCcTab(null); setCcSection(null); setCcOpen(true); }}
        onEject={() => setPrintOpen(true)}
        onTowerTalk={() => setTalkOpen(true)}
      />

      {/* Modals */}
      <CommandCenterModal
        visible={ccOpen}
        initialTab={ccTab}
        initialSection={ccSection}
        onClose={() => {
          setCcOpen(false);
          setCcTab(null);
          setCcSection(null);
        }}
      />
      <PrintCenterModal visible={printOpen} onClose={() => setPrintOpen(false)} />
      <TowerTalkOverlay
        visible={talkOpen}
        onClose={() => setTalkOpen(false)}
        onOpenSettings={() => {
          setTalkOpen(false);
          setCcTab('settings');
          setCcSection('backend');
          setCcOpen(true);
        }}
      />
      <CustomerListModal visible={customersOpen} onClose={() => setCustomersOpen(false)} />
      <CustomerEntryMenuModal
        visible={customerEntryOpen}
        onClose={() => setCustomerEntryOpen(false)}
        onAddCustomer={() => {
          setCustomerEntryOpen(false);
          // Let HomeScreen's existing "New Customer" modal handle the actual form.
          // We trigger via a global event bridge.
          globalThis.__sc_open_new_customer?.();
        }}
        onLicenseScans={() => {
          setCustomerEntryOpen(false);
          setCustomersOpen(true);
        }}
      />

      {/* Bluetooth customer button - always on Home - directly opens Add Customer */}
      {isHome && (
        <FloatingCustomerButton onPress={() => {
          // Directly open the Add Customer form (skip the menu since License Scans was removed)
          globalThis.__sc_open_new_customer?.();
        }} />
      )}

      {/* PTT (only in SPORT mode) */}
      {settings.sportMode ? (
        <>
          <FloatingPttButton
            flagLabel={flagFor(settings.defaultTargetLanguage)}
            badgeDirection={settings.pttDirection === 'target_to_en' ? '\u2192 EN' : 'EN \u2192'}
            recording={ptt.status === 'recording' || ptt.status === 'requesting'}
            disabled={ptt.status === 'uploading' || ptt.status === 'translating' || ptt.status === 'speaking'}
            onPress={() => {
              // While recording or requesting permission, a second press cancels/stops.
              if (ptt.status === 'recording' || ptt.status === 'requesting') {
                ptt.stopRecording?.();
                return;
              }

              // Clean start states: open overlay and begin recording.
              if (ptt.status === 'idle' || ptt.status === 'done' || ptt.status === 'error') {
                setPttOpen(true);
                ptt.startRecording?.();
                return;
              }

              // Uploading / translating / speaking: open overlay to show progress.
              if (!pttOpen) setPttOpen(true);
            }}
          />
          <PttOverlayView visible={pttOpen} onClose={() => setPttOpen(false)} />
        </>
      ) : null}
    </>
  );
}
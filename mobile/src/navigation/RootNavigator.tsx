import React, { useMemo, useState } from 'react';
import Constants from 'expo-constants';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Ionicons } from '@expo/vector-icons';

import { colors } from '../theme/colors';
import { type } from '../theme/typography';

import { useAppSettings } from '../context/AppSettingsContext';
import { usePtt } from '../context/PttContext';
import { emit } from '../lib/events';

import { HomeScreen } from '../screens/HomeScreen';
import { BrandTaillights } from '../components/BrandTaillights';
import { IntakeScreen } from '../screens/IntakeScreen';

import { FloatingButtonCluster } from '../components/FloatingButtonCluster';
import { CommandCenterModal } from '../components/CommandCenterModal';
import { PrintCenterModal } from '../screens/PrintCenterModal';

import { FloatingPttButton } from '../components/FloatingPttButton';
import { FloatingCustomerButton } from '../components/FloatingCustomerButton';
import { EmergencyButton } from '../components/EmergencyButton';
import { EmergencyInquiryModal } from '../components/EmergencyInquiryModal';
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
        ...type.overline,
        fontSize: 9,
        letterSpacing: 1.4,
      }}
    >
      {children}
    </Text>
  );
}

// Tab bar content height (icons + labels, no safe area)
export const TAB_BAR_CONTENT_HEIGHT = 52;

export function RootNavigator() {
  const [ccOpen, setCcOpen] = useState(false);
  const [ccTab, setCcTab] = useState(null);
  const [ccSection, setCcSection] = useState(null);
  const [printOpen, setPrintOpen] = useState(false);
  const [pttOpen, setPttOpen] = useState(false);
  const [talkOpen, setTalkOpen] = useState(false);
  const [customersOpen, setCustomersOpen] = useState(false);
  const [emergencyOpen, setEmergencyOpen] = useState(false);
  const [currentRoute, setCurrentRoute] = useState('Home');

  const { settings } = useAppSettings();
  const ptt = usePtt();
  const insets = useSafeAreaInsets();

  const isHome = currentRoute === 'Home';

  // Safe-area-aware tab bar: height = content + bottom inset
  // This ensures the tab bar never intrudes into the home indicator zone on iPhone X+
  const tabBarStyle = useMemo(
    () => ({
      backgroundColor: 'rgba(4,6,8,0.92)',
      borderTopColor: 'rgba(214,178,94,0.14)',
      borderTopWidth: 1,
      height: TAB_BAR_CONTENT_HEIGHT + Math.max(insets.bottom, 4),
      paddingTop: 8,
      paddingBottom: Math.max(insets.bottom, 4) + 2,
      shadowColor: '#000',
      shadowOpacity: 0.65,
      shadowRadius: 24,
      shadowOffset: { width: 0, height: -6 },
      elevation: 24,
    }),
    [insets.bottom]
  );

  return (
    <>
      <Tab.Navigator
        screenOptions={{
          headerShown: false,
          tabBarStyle,
          tabBarHideOnKeyboard: true,
          tabBarActiveTintColor: colors.gold,
          tabBarInactiveTintColor: colors.textMute,
          // Enable native screen optimizations in production builds.
          // Disable in Expo Go to avoid JSI boolean/string type error.
          freezeOnBlur: Constants.appOwnership !== 'expo',
          // @ts-ignore - detachInactiveScreens works in native but typing conflict in newer @react-navigation
          detachInactiveScreens: Constants.appOwnership !== 'expo',
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
              <View style={{ alignItems: 'center' }}>
                {focused && <View style={{ width: 20, height: 2, borderRadius: 1, backgroundColor: colors.gold, marginBottom: 4, shadowColor: colors.gold, shadowOpacity: 0.8, shadowRadius: 6, shadowOffset: { width: 0, height: 0 } }} />}
                <Ionicons name={focused ? 'speedometer' : 'speedometer-outline'} size={21} color={focused ? colors.gold : colors.textMute} />
              </View>
            ),
            tabBarLabel: ({ focused }) => <TabLabel focused={focused}>HOME</TabLabel>,
          }}
        />

        <Tab.Screen
          name="Intake"
          component={IntakeScreen}
          options={{
            tabBarIcon: ({ focused }) => (
              <View style={{ alignItems: 'center' }}>
                {focused && <View style={{ width: 20, height: 2, borderRadius: 1, backgroundColor: colors.gold, marginBottom: 4, shadowColor: colors.gold, shadowOpacity: 0.8, shadowRadius: 6, shadowOffset: { width: 0, height: 0 } }} />}
                <Ionicons name={focused ? 'clipboard' : 'clipboard-outline'} size={21} color={focused ? colors.gold : colors.textMute} />
              </View>
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

      {/* Bluetooth customer button - always on Home - directly opens Add Customer */}
      {isHome && (
        <FloatingCustomerButton onPress={() => {
          // Directly open the Add Customer form (skip the menu since License Scans was removed)
          emit('openNewCustomer');
        }} />
      )}

      {/* Emergency button — centered between Bluetooth and PTT, Home only */}
      {isHome && (
        <>
          <EmergencyButton onPress={() => setEmergencyOpen(true)} />
          <EmergencyInquiryModal
            visible={emergencyOpen}
            onClose={() => setEmergencyOpen(false)}
          />
        </>
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
import React, { useEffect, useMemo, useState } from 'react';
import Constants from 'expo-constants';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Ionicons } from '@expo/vector-icons';

import { colors } from '../theme/colors';
import { type } from '../theme/typography';

import { useAppSettings } from '../context/AppSettingsContext';
import { usePtt } from '../context/PttContext';
import { useLingo } from '../context/ModeContext';
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
import { useSession } from '../context/SessionContext';
import { TAB_BAR_CONTENT_HEIGHT } from './layout';

// Re-export for backward compatibility with any external code that
// imported this constant from RootNavigator directly. Prefer importing
// from './layout' in new code to avoid require cycles.
export { TAB_BAR_CONTENT_HEIGHT };

const Tab = createBottomTabNavigator();

function TabLabel({ children, focused }: { children: React.ReactNode; focused: boolean }) {
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
// Kept as a re-export from ./layout for source-compat with older imports.
// See ./layout.ts for the canonical definition.

export function RootNavigator() {
  const session = useSession();
  const lingo = useLingo();

  // Convenience: pre-compute the tab labels (uppercase) so we don't do work on every render
  const lingoRef = useMemo(() => ({
    homeTab: lingo.customerPlural.toUpperCase(),
    intakeTab: lingo.intakeTitle.toUpperCase(),
  }), [lingo]);

  // Restore modal states from session, default to closed
  const [ccOpen, setCcOpen] = useState(session.modalStates?.commandCenter || false);
  const [ccTab, setCcTab] = useState<string | null>(null);
  const [ccSection, setCcSection] = useState<string | null>(null);
  const [printOpen, setPrintOpen] = useState(false);
  const [pttOpen, setPttOpen] = useState(false);
  const [talkOpen, setTalkOpen] = useState(session.modalStates?.towerTalk || false);
  const [customersOpen, setCustomersOpen] = useState(false);
  const [emergencyOpen, setEmergencyOpen] = useState(false);
  const [currentRoute, setCurrentRoute] = useState('Home');

  const { settings } = useAppSettings();
  const ptt = usePtt();
  const insets = useSafeAreaInsets();

  // Persist modal states to session (only meaningful modals that have context)
  useEffect(() => {
    session.setModalState('towerTalk', talkOpen);
  }, [talkOpen]);
  useEffect(() => {
    session.setModalState('commandCenter', ccOpen);
  }, [ccOpen]);

  const isHome = currentRoute === 'Home';

  // Safe-area-aware tab bar: height = content + bottom inset
  // This ensures the tab bar never intrudes into the home indicator zone on iPhone X+
  // Safe-area-aware tab bar with glass effect
  const tabBarStyle = useMemo(
    () => ({
      backgroundColor: 'rgba(4,6,10,0.88)',
      borderTopColor: 'rgba(214,178,94,0.12)',
      borderTopWidth: 0.5,
      height: TAB_BAR_CONTENT_HEIGHT + Math.max(insets.bottom, 4),
      paddingTop: 8,
      paddingBottom: Math.max(insets.bottom, 4) + 2,
      shadowColor: '#000',
      shadowOpacity: 0.85,
      shadowRadius: 32,
      shadowOffset: { width: 0, height: -10 },
      elevation: 28,
    }),
    [insets.bottom]
  );

  return (
    <>
      {/* @ts-ignore */}
      <Tab.Navigator
        screenOptions={{
          headerShown: false,
          tabBarStyle,
          tabBarHideOnKeyboard: true,
          tabBarActiveTintColor: colors.gold,
          tabBarInactiveTintColor: colors.textMute,
          // @ts-ignore - sceneContainerStyle works at runtime
          sceneContainerStyle: { backgroundColor: colors.bg0 },
          freezeOnBlur: Constants.appOwnership !== 'expo',
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
            tabBarLabel: ({ focused }) => <TabLabel focused={focused}>{lingoRef.intakeTab}</TabLabel>,
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
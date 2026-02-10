import React, { useCallback, useMemo, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, TextInput, View, ActivityIndicator, FlatList, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { impactLight, selectionTap } from '../lib/haptics';
import { colors } from '../theme/colors';
import { GlassCard } from './GlassCard';
import { useAppSettings } from '../context/AppSettingsContext';
import { apiFetch } from '../lib/api';

const TABS = [
  { key: 'dashboard', label: 'DASH' },
  { key: 'settings', label: 'SETTINGS' },
  { key: 'printers', label: 'PRINTERS' },
];

function TabButton({ label, active, onPress }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.tabBtn, active && styles.tabBtnActive, pressed && { opacity: 0.9 }]}>
      <Text style={[styles.tabText, active && styles.tabTextActive]}>{label}</Text>
    </Pressable>
  );
}

function SectionTitle({ children }) {
  return <Text style={styles.sectionTitle}>{children}</Text>;
}

function LangChip({ code, label, active, onPress }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.langChip, active && styles.langChipActive, pressed && { opacity: 0.9 }]}>
      <Text style={[styles.langChipText, active && styles.langChipTextActive]}>{label}</Text>
      <Text style={[styles.langChipCode, active && styles.langChipTextActive]}>{code.toUpperCase()}</Text>
    </Pressable>
  );
}

const LANGS = [
  { code: 'es', label: '🇲🇽 Spanish' },
  { code: 'fr', label: '🇫🇷 French' },
  { code: 'ko', label: '🇰🇷 Korean' },
];

function PrinterRow({ item, active, onSetActive, onRemove }) {
  return (
    <View style={styles.printerRow}>
      <Pressable onPress={() => onSetActive(item.id)} style={({ pressed }) => [styles.radio, active && styles.radioActive, pressed && { opacity: 0.9 }]}>
        <View style={[styles.radioDot, active && { backgroundColor: colors.gold }]} />
      </Pressable>
      <View style={{ flex: 1 }}>
        <Text style={styles.printerName}>{item.name}</Text>
        <Text style={styles.printerIp}>{item.ip}</Text>
      </View>
      <Pressable onPress={() => onRemove(item.id)} style={({ pressed }) => [styles.smallBtn, pressed && { opacity: 0.85 }]}>
        <Text style={styles.smallBtnText}>REMOVE</Text>
      </Pressable>
    </View>
  );
}

export function CommandCenterModal({ visible, onClose }) {
  const { settings, setDefaultTargetLanguage, setSportMode, setEcoMode, upsertPrinter, removePrinter, setActivePrinter, activePrinter } = useAppSettings();
  const [activeTab, setActiveTab] = useState('settings');

  const [printerName, setPrinterName] = useState('');
  const [printerIp, setPrinterIp] = useState('');
  const [printerTest, setPrinterTest] = useState({ state: 'idle', message: '' });

  const selectedLang = settings.defaultTargetLanguage || 'es';

  const canTestPrinter = useMemo(() => Boolean(activePrinter?.ip), [activePrinter]);

  const testActivePrinter = useCallback(async () => {
    if (!activePrinter?.ip) return;
    try {
      setPrinterTest({ state: 'loading', message: '' });
      const res = await apiFetch('/api/printer/test', {
        method: 'POST',
        body: JSON.stringify({ ip: activePrinter.ip }),
      });
      if (res?.success) {
        setPrinterTest({ state: 'ok', message: res.printer_name || 'Connected' });
      } else {
        setPrinterTest({ state: 'error', message: res?.error || 'Connection failed' });
      }
    } catch (e) {
      setPrinterTest({ state: 'error', message: String(e?.message || e) });
    }
  }, [activePrinter]);

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="overFullScreen" transparent>
      <View style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />

        <View style={styles.sheet}>
          <View style={styles.header}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Ionicons name="settings" size={16} color={colors.gold} />
              <View>
                <Text style={styles.headerTitle}>COMMAND CENTER</Text>
                <Text style={styles.headerSub}>Mobile-optimized · Infotainment spec</Text>
              </View>
            </View>
            <Pressable onPress={onClose} style={({ pressed }) => [styles.closeBtn, pressed && { opacity: 0.85 }]}>
              <Ionicons name="close" size={16} color={colors.text} />
            </Pressable>
          </View>

          <View style={styles.tabs}>
            {TABS.map((t) => (
              <TabButton key={t.key} label={t.label} active={activeTab === t.key} onPress={() => setActiveTab(t.key)} />
            ))}
          </View>

          {activeTab === 'dashboard' ? (
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 20 }}>
            <GlassCard style={{ marginTop: 14 }}>
              <SectionTitle>Dashboard</SectionTitle>
              <Text style={styles.body}>Porting in progress. Next: customer KPIs, import status, and pipeline.</Text>
            </GlassCard>
            </ScrollView>
          ) : null}

          {activeTab === 'settings' ? (
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 20 }}>
              <GlassCard style={{ marginTop: 14 }}>
                <SectionTitle>Language</SectionTitle>
                <Text style={styles.body}>Used by SPORT translation, voice translate, and TTS voices.</Text>
                <View style={{ height: 10 }} />
                <View style={styles.langRow}>
                  {LANGS.map((l) => (
                    <LangChip
                      key={l.code}
                      code={l.code}
                      label={l.label}
                      active={selectedLang === l.code}
                      onPress={() => setDefaultTargetLanguage(l.code)}
                    />
                  ))}
                </View>
              </GlassCard>

              <GlassCard style={{ marginTop: 14 }}>
                <SectionTitle>SPORT Mode</SectionTitle>
                <Text style={styles.body}>When ON, translation tools become available system-wide.</Text>
                <View style={{ height: 12 }} />
                <Pressable
                  onPress={() => setSportMode(!settings.sportMode)}
                  style={({ pressed }) => [styles.toggle, settings.sportMode && styles.toggleOn, pressed && { opacity: 0.9 }]}
                >
                  <View style={[styles.toggleDot, settings.sportMode && styles.toggleDotOn]} />
                  <Text style={[styles.toggleText, settings.sportMode && { color: colors.gold }]}> {settings.sportMode ? 'ON' : 'OFF'}</Text>
                </Pressable>
              </GlassCard>

              <GlassCard style={{ marginTop: 14 }}>
                <SectionTitle>Eco Mode</SectionTitle>
                <Text style={styles.body}>Reduce blur + animation intensity for older devices (native-smooth).</Text>
                <View style={{ height: 12 }} />
                <Pressable
                  onPress={() => setEcoMode(!settings.ecoMode)}
                  style={({ pressed }) => [styles.toggle, settings.ecoMode && styles.toggleOn, pressed && { opacity: 0.9 }]}
                >
                  <View style={[styles.toggleDot, settings.ecoMode && styles.toggleDotOn]} />
                  <Text style={[styles.toggleText, settings.ecoMode && { color: colors.gold }]}> {settings.ecoMode ? 'ON' : 'OFF'}</Text>
                </Pressable>
              </GlassCard>
            </>
          ) : null}

          {activeTab === 'printers' ? (
            <>
              <GlassCard style={{ marginTop: 14 }}>
                <SectionTitle>Active printer</SectionTitle>
                <Text style={styles.body}>One global default printer (matches web behavior).</Text>
                <View style={{ height: 10 }} />
                {activePrinter ? (
                  <View style={styles.activePrinterBox}>
                    <Text style={styles.printerName}>{activePrinter.name}</Text>
                    <Text style={styles.printerIp}>{activePrinter.ip}</Text>
                  </View>
                ) : (
                  <Text style={styles.body}>No printers saved yet.</Text>
                )}

                <View style={{ height: 12 }} />

                <Pressable
                  onPress={testActivePrinter}
                  disabled={!canTestPrinter || printerTest.state === 'loading'}
                  style={({ pressed }) => [styles.btn, (!canTestPrinter || printerTest.state === 'loading' || pressed) && { opacity: 0.85 }]}
                >
                  <Text style={styles.btnText}>Test connection</Text>
                  {printerTest.state === 'loading' ? (
                    <View style={{ marginLeft: 10 }}>
                      <ActivityIndicator color={colors.gold} />
                    </View>
                  ) : null}
                </Pressable>

                {printerTest.state === 'ok' ? <Text style={[styles.body, { color: colors.green, marginTop: 10 }]}>{printerTest.message}</Text> : null}
                {printerTest.state === 'error' ? <Text style={[styles.body, { color: colors.red, marginTop: 10 }]}>{printerTest.message}</Text> : null}
              </GlassCard>

              <GlassCard style={{ marginTop: 14, flex: 1 }}>
                <SectionTitle>Printers</SectionTitle>
                <Text style={styles.body}>Tap the radio to set active. Named printers supported.</Text>

                <View style={{ height: 12 }} />

                <FlatList
                  data={settings.printers || []}
                  keyExtractor={(i) => i.id}
                  renderItem={({ item }) => (
                    <PrinterRow
                      item={item}
                      active={settings.activePrinterId === item.id}
                      onSetActive={setActivePrinter}
                      onRemove={removePrinter}
                    />
                  )}
                  ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
                  contentContainerStyle={{ paddingBottom: 14 }}
                />
              </GlassCard>

              <GlassCard style={{ marginTop: 14 }}>
                <SectionTitle>Add printer</SectionTitle>
                <View style={{ height: 10 }} />
                <TextInput
                  value={printerName}
                  onChangeText={setPrinterName}
                  placeholder="Name (e.g., Front Desk)"
                  placeholderTextColor={colors.textMute}
                  style={styles.input}
                />
                <View style={{ height: 10 }} />
                <TextInput
                  value={printerIp}
                  onChangeText={setPrinterIp}
                  placeholder="IP (e.g., 192.168.1.42)"
                  placeholderTextColor={colors.textMute}
                  style={styles.input}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                <View style={{ height: 12 }} />
                <Pressable
                  onPress={async () => {
                    if (!printerIp.trim()) return;
                    await upsertPrinter({ name: printerName, ip: printerIp });
                    setPrinterName('');
                    setPrinterIp('');
                  }}
                  style={({ pressed }) => [styles.btn, pressed && { opacity: 0.85 }]}
                >
                  <Text style={styles.btnText}>Save printer</Text>
                </Pressable>
              </GlassCard>
            </>
          ) : null}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.50)',
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    backgroundColor: 'rgba(0,0,0,0.72)',
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 18,
    maxHeight: '92%',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerTitle: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 2.4,
  },
  headerSub: {
    marginTop: 6,
    color: colors.textMute,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.0,
    textTransform: 'uppercase',
  },
  closeBtn: {
    width: 40,
    height: 40,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.stroke2,
    backgroundColor: 'rgba(0,0,0,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeText: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '900',
  },
  tabs: {
    marginTop: 12,
    flexDirection: 'row',
    gap: 10,
  },
  tabBtn: {
    flex: 1,
    height: 40,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.stroke,
    backgroundColor: 'rgba(0,0,0,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabBtnActive: {
    borderColor: 'rgba(214,178,94,0.60)',
    backgroundColor: 'rgba(214,178,94,0.10)',
  },
  tabText: {
    color: colors.textMute,
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 1.1,
  },
  tabTextActive: {
    color: colors.gold,
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '900',
  },
  body: {
    marginTop: 8,
    color: colors.textDim,
    fontSize: 12,
    lineHeight: 16,
  },
  langRow: {
    flexDirection: 'row',
    gap: 10,
    flexWrap: 'wrap',
  },
  langChip: {
    flexGrow: 1,
    minWidth: 110,
    height: 52,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.stroke2,
    backgroundColor: 'rgba(0,0,0,0.30)',
    paddingHorizontal: 12,
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  langChipActive: {
    borderColor: 'rgba(214,178,94,0.70)',
    backgroundColor: 'rgba(214,178,94,0.12)',
  },
  langChipText: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '900',
  },
  langChipCode: {
    marginTop: 4,
    color: colors.textMute,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.2,
  },
  langChipTextActive: {
    color: colors.gold,
  },
  toggle: {
    height: 44,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.stroke2,
    backgroundColor: 'rgba(0,0,0,0.30)',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
  },
  toggleOn: {
    borderColor: 'rgba(214,178,94,0.70)',
    backgroundColor: 'rgba(214,178,94,0.12)',
  },
  toggleDot: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  toggleDotOn: {
    backgroundColor: colors.gold,
  },
  toggleText: {
    marginLeft: 10,
    color: colors.textMute,
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 1.2,
  },
  btn: {
    height: 46,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.stroke2,
    backgroundColor: 'rgba(0,0,0,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  btnText: {
    color: colors.gold,
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  input: {
    height: 46,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.stroke2,
    paddingHorizontal: 14,
    color: colors.text,
    backgroundColor: 'rgba(0,0,0,0.28)',
    fontSize: 13,
    fontWeight: '700',
  },
  activePrinterBox: {
    padding: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.stroke,
    backgroundColor: 'rgba(0,0,0,0.22)',
  },
  printerRow: {
    padding: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.stroke,
    backgroundColor: 'rgba(0,0,0,0.22)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  radio: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: colors.stroke2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioActive: {
    borderColor: 'rgba(214,178,94,0.80)',
  },
  radioDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: 'transparent',
  },
  printerName: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '900',
  },
  printerIp: {
    marginTop: 6,
    color: colors.textMute,
    fontSize: 11,
    fontWeight: '700',
  },
  smallBtn: {
    height: 34,
    paddingHorizontal: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.stroke2,
    backgroundColor: 'rgba(255,45,45,0.10)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  smallBtnText: {
    color: colors.red,
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1.0,
  },
});

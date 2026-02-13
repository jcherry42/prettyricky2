import React, { useCallback, useMemo, useRef, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, TextInput, View, ActivityIndicator, FlatList, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { impactLight } from '../lib/haptics';
import { colors } from '../theme/colors';
import { GlassCard } from './GlassCard';
import { useAppSettings } from '../context/AppSettingsContext';
import { apiFetch } from '../lib/api';

const TABS = [
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

/* --- Liquid Glass Language Button --- */
function LangGlass({ flag, active, onPress }) {
  return (
    <Pressable
      onPress={() => { impactLight(); onPress(); }}
      style={({ pressed }) => [pressed && { transform: [{ scale: 0.95 }] }]}
    >
      <View style={[styles.langGlassOuter, active && styles.langGlassOuterActive]}>
        <LinearGradient
          colors={
            active
              ? ['rgba(214,178,94,0.18)', 'rgba(214,178,94,0.06)', 'rgba(0,0,0,0.10)']
              : ['rgba(255,255,255,0.12)', 'rgba(255,255,255,0.04)', 'rgba(0,0,0,0.12)']
          }
          locations={[0, 0.5, 1]}
          style={[StyleSheet.absoluteFill, { borderRadius: 22 }]}
        />
        <View style={[styles.langGlassInner, active && styles.langGlassInnerActive]}>
          <LinearGradient
            colors={
              active
                ? ['rgba(214,178,94,0.10)', 'rgba(214,178,94,0.03)', 'rgba(0,0,0,0.08)']
                : ['rgba(255,255,255,0.06)', 'rgba(255,255,255,0.01)', 'rgba(0,0,0,0.10)']
            }
            locations={[0, 0.45, 1]}
            style={[StyleSheet.absoluteFill, { borderRadius: 20 }]}
          />
          <Text style={styles.langFlag}>{flag}</Text>
        </View>
      </View>
    </Pressable>
  );
}

const LANGS = [
  { code: 'es', flag: '\ud83c\uddf2\ud83c\uddfd' },
  { code: 'fr', flag: '\ud83c\uddeb\ud83c\uddf7' },
  { code: 'ko', flag: '\ud83c\uddf0\ud83c\uddf7' },
];

function PrinterRow({ item, active, onSetActive, onRemove }) {
  return (
    <View style={styles.printerRow}>
      <Pressable onPress={() => { impactLight(); onSetActive(item.id); }} style={({ pressed }) => [styles.radio, active && styles.radioActive, pressed && { opacity: 0.9 }]}>
        <View style={[styles.radioDot, active && { backgroundColor: colors.gold }]} />
      </Pressable>
      <View style={{ flex: 1 }}>
        <Text style={styles.printerName}>{item.name}</Text>
        <Text style={styles.printerIp}>{item.ip}</Text>
      </View>
      <Pressable onPress={() => onRemove(item.id)} style={({ pressed }) => [styles.smallBtn, pressed && { opacity: 0.85 }]}>
        <Ionicons name="trash-outline" size={14} color={colors.red} />
      </Pressable>
    </View>
  );
}

export function CommandCenterModal({ visible, onClose }) {
  const { settings, setDefaultTargetLanguage, setEcoMode, upsertPrinter, removePrinter, setActivePrinter, activePrinter } = useAppSettings();
  const [activeTab, setActiveTab] = useState('settings');

  const [printerName, setPrinterName] = useState('');
  const [ipParts, setIpParts] = useState(['', '', '', '']);
  const [printerTest, setPrinterTest] = useState({ state: 'idle', message: '' });

  const ipInputRefs = useRef([]);

  const fullIp = useMemo(() => ipParts.join('.'), [ipParts]);

  const selectedLang = settings.defaultTargetLanguage || 'es';
  const canTestPrinter = useMemo(() => Boolean(activePrinter?.ip), [activePrinter]);

  const canSavePrinter = useMemo(() => {
    if (!fullIp || !/^\d{1,3}(\.\d{1,3}){3}$/.test(fullIp)) return false;
    const octets = fullIp.split('.');
    return octets.every((part) => {
      const n = Number(part);
      return Number.isFinite(n) && n >= 0 && n <= 255;
    });
  }, [fullIp]);

  const updateIpPart = useCallback((index, value) => {
    const cleaned = value.replace(/[^0-9]/g, '').slice(0, 3);
    setIpParts((prev) => {
      const next = [...prev];
      next[index] = cleaned;
      return next;
    });

    if (cleaned.length === 3 && index < 3) {
      const nextRef = ipInputRefs.current[index + 1];
      if (nextRef && typeof nextRef.focus === 'function') {
        nextRef.focus();
      }
    }
  }, []);

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
        setPrinterTest({ state: 'error', message: res?.error || 'Failed' });
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
          {/* Header */}
          <View style={styles.header}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Ionicons name="settings" size={16} color={colors.gold} />
              <Text style={styles.headerTitle}>COMMAND CENTER</Text>
            </View>
            <Pressable onPress={onClose} style={({ pressed }) => [styles.closeBtn, pressed && { opacity: 0.85 }]}>
              <Ionicons name="close" size={16} color={colors.text} />
            </Pressable>
          </View>

          {/* Tabs */}
          <View style={styles.tabs}>
            {TABS.map((t) => (
              <TabButton key={t.key} label={t.label} active={activeTab === t.key} onPress={() => setActiveTab(t.key)} />
            ))}
          </View>

          {/* SETTINGS */}
          {activeTab === 'settings' ? (
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 20 }}>
              <GlassCard style={{ marginTop: 14 }}>
                <SectionTitle>Language</SectionTitle>
                <View style={{ height: 14 }} />
                <View style={styles.langRow}>
                  {LANGS.map((l) => (
                    <LangGlass
                      key={l.code}
                      flag={l.flag}
                      active={selectedLang === l.code}
                      onPress={() => setDefaultTargetLanguage(l.code)}
                    />
                  ))}
                </View>
              </GlassCard>

              <GlassCard style={{ marginTop: 14 }}>
                <SectionTitle>Eco Mode</SectionTitle>
                <View style={{ height: 12 }} />
                <Pressable
                  onPress={() => { impactLight(); setEcoMode(!settings.ecoMode); }}
                  style={({ pressed }) => [styles.toggle, settings.ecoMode && styles.toggleOn, pressed && { opacity: 0.9 }]}
                >
                  <View style={[styles.toggleDot, settings.ecoMode && styles.toggleDotOn]} />
                  <Text style={[styles.toggleText, settings.ecoMode && { color: colors.gold }]}>{settings.ecoMode ? 'ON' : 'OFF'}</Text>
                </Pressable>
              </GlassCard>
            </ScrollView>
          ) : null}

          {/* PRINTERS */}
          {activeTab === 'printers' ? (
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 20 }}>
              {/* Active printer */}
              <GlassCard style={{ marginTop: 14 }}>
                <SectionTitle>Active Printer</SectionTitle>
                <View style={{ height: 10 }} />
                {activePrinter ? (
                  <View style={styles.activePrinterBox}>
                    <Text style={styles.printerName}>{activePrinter.name}</Text>
                    <Text style={styles.printerIp}>{activePrinter.ip}</Text>
                  </View>
                ) : (
                  <View style={styles.activePrinterBox}>
                    <Text style={[styles.printerIp, { marginTop: 0 }]}>None configured</Text>
                  </View>
                )}

                <View style={{ height: 12 }} />

                <Pressable
                  onPress={testActivePrinter}
                  disabled={!canTestPrinter || printerTest.state === 'loading'}
                  style={({ pressed }) => [styles.btn, (!canTestPrinter || printerTest.state === 'loading' || pressed) && { opacity: 0.7 }]}
                >
                  <Ionicons name="wifi" size={14} color={colors.gold} />
                  <Text style={styles.btnText}>Test</Text>
                  {printerTest.state === 'loading' && <ActivityIndicator color={colors.gold} style={{ marginLeft: 8 }} />}
                </Pressable>

                {printerTest.state === 'ok' && (
                  <View style={styles.statusRow}>
                    <Ionicons name="checkmark-circle" size={14} color={colors.green} />
                    <Text style={[styles.statusText, { color: colors.green }]}>{printerTest.message}</Text>
                  </View>
                )}
                {printerTest.state === 'error' && (
                  <View style={styles.statusRow}>
                    <Ionicons name="alert-circle" size={14} color={colors.red} />
                    <Text style={[styles.statusText, { color: colors.red }]}>{printerTest.message}</Text>
                  </View>
                )}
              </GlassCard>

              {/* Saved printers */}
              <GlassCard style={{ marginTop: 14 }}>
                <SectionTitle>Saved Printers</SectionTitle>
                <View style={{ height: 10 }} />

                {(settings.printers || []).length === 0 ? (
                  <View style={styles.activePrinterBox}>
                    <Text style={[styles.printerIp, { marginTop: 0 }]}>No printers saved</Text>
                  </View>
                ) : (
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
                    ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
                    scrollEnabled={false}
                  />
                )}
              </GlassCard>

              {/* Add printer */}
              <GlassCard style={{ marginTop: 14 }}>
                <SectionTitle>Add Printer</SectionTitle>
                <View style={{ height: 10 }} />
                <TextInput
                  value={printerName}
                  onChangeText={setPrinterName}
                  placeholder="Name"
                  placeholderTextColor={colors.textMute}
                  style={styles.input}
                />
                <View style={{ height: 8 }} />
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  {[0, 1, 2, 3].map((idx) => (
                    <TextInput
                      key={idx}
                      value={printerIp}
                      onChangeText={setPrinterIp}
                      placeholder={idx === 0 ? '192' : '0'}
                      placeholderTextColor={colors.textMute}
                      style={[styles.input, { flex: 1 }]}
                      autoCapitalize="none"
                      autoCorrect={false}
                      keyboardType="numeric"
                    />
                  ))}
                </View>
                <View style={{ height: 12 }} />
                <Pressable
                  onPress={async () => {
                    if (!printerIp.trim()) return;
                    impactLight();
                    await upsertPrinter({ name: printerName.trim() || 'Printer', ip: printerIp.trim() });
                    setPrinterName('');
                    setPrinterIp('');
                  }}
                  disabled={!printerIp.trim()}
                  style={({ pressed }) => [styles.btn, (!printerIp.trim() || pressed) && { opacity: 0.7 }]}
                >
                  <Ionicons name="add-circle" size={16} color={colors.gold} />
                  <Text style={styles.btnText}>Save</Text>
                </Pressable>
              </GlassCard>
            </ScrollView>
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
    backgroundColor: 'rgba(10,12,16,0.96)',
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 18,
    maxHeight: '88%',
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
  closeBtn: {
    width: 40,
    height: 40,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    backgroundColor: 'rgba(0,0,0,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
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
    borderColor: 'rgba(255,255,255,0.08)',
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
  langRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  langGlassOuter: {
    flex: 1,
    height: 72,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    backgroundColor: 'rgba(20,24,30,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    shadowColor: 'rgba(0,0,0,0.30)',
    shadowOpacity: 0.3,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
  },
  langGlassOuterActive: {
    borderColor: 'rgba(214,178,94,0.50)',
    shadowColor: 'rgba(214,178,94,0.30)',
    shadowOpacity: 0.4,
    shadowRadius: 12,
  },
  langGlassInner: {
    width: '90%',
    height: '85%',
    borderRadius: 20,
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.06)',
    backgroundColor: 'rgba(25,28,35,0.40)',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  langGlassInnerActive: {
    borderColor: 'rgba(214,178,94,0.20)',
    backgroundColor: 'rgba(214,178,94,0.06)',
  },
  langFlag: {
    fontSize: 32,
  },
  toggle: {
    height: 44,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    backgroundColor: 'rgba(0,0,0,0.30)',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
  },
  toggleOn: {
    borderColor: 'rgba(214,178,94,0.60)',
    backgroundColor: 'rgba(214,178,94,0.10)',
  },
  toggleDot: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(255,255,255,0.15)',
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
    borderColor: 'rgba(255,255,255,0.08)',
    backgroundColor: 'rgba(0,0,0,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  btnText: {
    color: colors.gold,
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 1.2,
  },
  input: {
    height: 46,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
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
    borderColor: 'rgba(255,255,255,0.06)',
    backgroundColor: 'rgba(0,0,0,0.20)',
  },
  printerRow: {
    padding: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    backgroundColor: 'rgba(0,0,0,0.20)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  radio: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
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
    marginTop: 4,
    color: colors.textMute,
    fontSize: 11,
    fontWeight: '700',
    fontFamily: 'monospace',
  },
  smallBtn: {
    width: 36,
    height: 36,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,45,45,0.20)',
    backgroundColor: 'rgba(255,45,45,0.06)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 10,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '700',
  },
});

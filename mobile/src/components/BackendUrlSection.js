import React, { useEffect, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme/colors';
import { type } from '../theme/typography';
import { impactLight, impactMedium, notificationSuccess } from '../lib/haptics';
import { getBackendUrlAsync } from '../config/backend';
import { clearBackendUrlOverride, setBackendUrlOverride } from '../config/backendOverride';

function isValidHttpsUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:';
  } catch {
    return false;
  }
}

export function BackendUrlSection() {
  const [current, setCurrent] = useState('');
  const [input, setInput] = useState('');

  useEffect(() => {
    (async () => {
      const base = await getBackendUrlAsync();
      setCurrent(base);
      setInput(base);
    })();
  }, []);

  const handleSave = async () => {
    const trimmed = String(input || '').trim().replace(/\/$/, '');
    if (!trimmed) {
      impactMedium();
      Alert.alert('Invalid URL', 'Please enter a valid https:// backend base URL.');
      return;
    }
    if (!isValidHttpsUrl(trimmed)) {
      impactMedium();
      Alert.alert('Invalid URL', 'Backend URL must be a valid https:// URL reachable from your iPhone.');
      return;
    }

    impactLight();
    await setBackendUrlOverride(trimmed);
    setCurrent(trimmed);
    notificationSuccess();
    Alert.alert('Saved', 'Backend URL updated. (You may need to reopen modals that were already open.)');
  };

  const handleReset = async () => {
    impactLight();
    await clearBackendUrlOverride();
    const base = await getBackendUrlAsync();
    setCurrent(base);
    setInput(base);
    Alert.alert('Reset', 'Backend URL override cleared.');
  };

  return (
    <View>
      <Text style={styles.sectionTitle}>Backend</Text>
      <View style={{ height: 10 }} />

      <View style={styles.card}>
        <View style={styles.row}>
          <Ionicons name="link" size={16} color={colors.gold} />
          <Text style={styles.label} numberOfLines={1}>Current</Text>
        </View>
        <Text style={styles.currentValue} numberOfLines={2}>{current || '—'}</Text>

        <View style={{ height: 12 }} />

        <TextInput
          value={input}
          onChangeText={setInput}
          placeholder="https://your-backend-domain.com"
          placeholderTextColor={colors.textMute}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="url"
          style={styles.input}
        />

        <View style={{ height: 10 }} />

        <View style={styles.actions}>
          <Pressable onPress={handleSave} style={({ pressed }) => [styles.btn, pressed && { opacity: 0.85 }]}>
            <Ionicons name="save" size={14} color={colors.gold} />
            <Text style={styles.btnText}>Save</Text>
          </Pressable>
          <Pressable onPress={handleReset} style={({ pressed }) => [styles.btn, pressed && { opacity: 0.85 }]}>
            <Ionicons name="refresh" size={14} color={colors.textMute} />
            <Text style={[styles.btnText, { color: colors.textMute }]}>Reset</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  sectionTitle: {
    color: colors.text,
    ...type.label,
    fontSize: 12,
    letterSpacing: 1.6,
  },
  card: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    backgroundColor: 'rgba(0,0,0,0.22)',
    padding: 12,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  label: {
    color: colors.textMute,
    ...type.label,
    fontSize: 11,
    letterSpacing: 1.2,
  },
  currentValue: {
    marginTop: 6,
    color: colors.text,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '700',
  },
  input: {
    height: 44,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.stroke,
    paddingHorizontal: 12,
    color: colors.text,
    fontSize: 13,
    fontWeight: '600',
    backgroundColor: 'rgba(0,0,0,0.30)',
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  btn: {
    flex: 1,
    height: 42,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    backgroundColor: 'rgba(0,0,0,0.28)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  btnText: {
    color: colors.gold,
    ...type.label,
    fontSize: 12,
    letterSpacing: 1.2,
  },
});

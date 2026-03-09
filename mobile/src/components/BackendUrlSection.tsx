import React, { useEffect, useState } from 'react';
import { invalidateUrlCache } from '../lib/api';
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme/colors';
import { type } from '../theme/typography';
import { impactLight, impactMedium, notificationSuccess } from '../lib/haptics';
import { getBackendUrlAsync, getBackendUrl } from '../config/backend';
import { clearBackendUrlOverride, getBackendUrlOverride, setBackendUrlOverride } from '../config/backendOverride';

function isValidHttpsUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:';
  } catch {
    return false;
  }
}

/** Strip a trailing /api segment — the app adds /api itself to every path */
function sanitize(url) {
  return String(url || '').trim().replace(/\/$/, '').replace(/\/api$/, '');
}

export function BackendUrlSection() {
  const [current, setCurrent] = useState('');
  const [override, setOverride] = useState('');
  const [input, setInput] = useState('');
  const [dirty, setDirty] = useState(false);

  const reload = async () => {
    const ov = await getBackendUrlOverride();
    const base = await getBackendUrlAsync();
    const envBase = getBackendUrl();
    setOverride(ov || '');
    setCurrent(base || '');
    setInput(ov || envBase || '');
    setDirty(false);
  };

  useEffect(() => { reload(); }, []);

  const handleSave = async () => {
    const trimmed = sanitize(input);
    if (!trimmed) {
      impactMedium();
      Alert.alert('Invalid URL', 'Please enter a valid https:// backend base URL (e.g. https://your-domain.com)');
      return;
    }
    if (!isValidHttpsUrl(trimmed)) {
      impactMedium();
      Alert.alert(
        'Invalid URL',
        'Backend URL must start with https://native-build-test.preview.emergentagent.com',
      );
      return;
    }
    impactLight();
    await setBackendUrlOverride(trimmed);
    invalidateUrlCache();
    await reload();
    notificationSuccess();
    Alert.alert('Saved', `Backend URL set to:\n${trimmed}\n\nAll API calls will now use this address.`);
  };

  const handleReset = async () => {
    impactLight();
    await clearBackendUrlOverride();
    invalidateUrlCache();
    await reload();
    const env = getBackendUrl();
    Alert.alert(
      'Reset Complete',
      env
        ? `Override cleared.\n\nNow using .env URL:\n${env}`
        : 'Override cleared. No .env URL found — add EXPO_PUBLIC_BACKEND_URL to mobile/.env and restart with --clear.',
    );
  };

  // Warn user if their saved URL has /api in it (common mistake)
  const hasApiSuffix = override.endsWith('/api');
  const envBase = getBackendUrl();

  return (
    <View>
      <Text style={styles.sectionTitle}>Backend</Text>
      <View style={{ height: 10 }} />

      <View style={styles.card}>
        {/* Status row */}
        <View style={styles.statusRow}>
          <Ionicons
            name={current ? 'checkmark-circle' : 'alert-circle'}
            size={14}
            color={current ? '#34C759' : '#FF3B30'}
          />
          <Text style={[styles.statusLabel, { color: current ? '#34C759' : '#FF3B30' }]}>
            {current ? 'CONNECTED' : 'NOT CONFIGURED'}
          </Text>
        </View>

        <View style={{ height: 6 }} />

        {/* Current URL */}
        <View style={styles.row}>
          <Ionicons name="link" size={15} color={colors.gold} />
          <Text style={styles.label}>Active URL</Text>
        </View>
        <Text style={styles.currentValue} numberOfLines={3} selectable>
          {current || '— not set —'}
        </Text>

        {/* Override indicator */}
        {override ? (
          <View style={styles.overrideBadge}>
            <Ionicons name="pencil" size={11} color="#FFD60A" />
            <Text style={styles.overrideText}>Manual override active</Text>
          </View>
        ) : envBase ? (
          <View style={styles.overrideBadge}>
            <Ionicons name="document-text" size={11} color={colors.textMute} />
            <Text style={[styles.overrideText, { color: colors.textMute }]}>Using .env value</Text>
          </View>
        ) : null}

        {/* /api warning */}
        {hasApiSuffix && (
          <View style={styles.warningRow}>
            <Ionicons name="warning" size={13} color="#FF9500" />
            <Text style={styles.warningText}>
              URL ends with /api — the app adds /api automatically. This causes double-/api and 404s. Tap Reset to fix.
            </Text>
          </View>
        )}

        <View style={{ height: 14 }} />

        {/* Input */}
        <TextInput
          value={input}
          onChangeText={(v) => { setInput(v); setDirty(true); }}
          placeholder="https://your-backend-domain.com"
          placeholderTextColor={colors.textMute}
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="off"
          spellCheck={false}
          keyboardType="url"
          textContentType="URL"
          returnKeyType="done"
          onSubmitEditing={handleSave}
          style={[styles.input, dirty && { borderColor: 'rgba(214,178,94,0.4)' }]}
          selectTextOnFocus
        />
        <Text style={styles.hint}>
          Do NOT include /api at the end — the app appends it automatically.
        </Text>

        <View style={{ height: 10 }} />

        {/* Actions */}
        <View style={styles.actions}>
          <Pressable onPress={handleSave} style={({ pressed }) => [styles.btn, styles.btnPrimary, pressed && { opacity: 0.85 }]}>
            <Ionicons name="save-outline" size={14} color={colors.gold} />
            <Text style={styles.btnText}>Save</Text>
          </Pressable>
          <Pressable onPress={handleReset} style={({ pressed }) => [styles.btn, pressed && { opacity: 0.85 }]}>
            <Ionicons name="refresh-outline" size={14} color={colors.textMute} />
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
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(214,178,94,0.06)',
    backgroundColor: 'rgba(0,0,0,0.25)',
    padding: 14,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statusLabel: {
    ...type.overline,
    fontSize: 10,
    letterSpacing: 1.6,
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
    lineHeight: 18,
    fontWeight: '700',
  },
  overrideBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 6,
  },
  overrideText: {
    color: '#FFD60A',
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  warningRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    marginTop: 8,
    backgroundColor: 'rgba(255,149,0,0.12)',
    borderRadius: 8,
    padding: 8,
  },
  warningText: {
    flex: 1,
    color: '#FF9500',
    fontSize: 11,
    lineHeight: 15,
    fontWeight: '500',
  },
  input: {
    height: 46,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(214,178,94,0.06)',
    paddingHorizontal: 14,
    color: colors.text,
    fontSize: 13,
    fontWeight: '600',
    backgroundColor: 'rgba(0,0,0,0.40)',
  },
  hint: {
    marginTop: 5,
    color: colors.textMute,
    fontSize: 10,
    lineHeight: 14,
    letterSpacing: 0.3,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  btn: {
    flex: 1,
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(214,178,94,0.06)',
    backgroundColor: 'rgba(0,0,0,0.28)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  btnPrimary: {
    borderColor: 'rgba(214,178,94,0.25)',
    backgroundColor: 'rgba(214,178,94,0.10)',
  },
  btnText: {
    color: colors.gold,
    ...type.label,
    fontSize: 12,
    letterSpacing: 1.2,
  },
});

import React, { useCallback, useMemo, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ActivityIndicator } from 'react-native';
import * as Network from 'expo-network';
import { colors } from '../theme/colors';
import { GlassCard } from '../components/GlassCard';
import { getBackendUrl } from '../config/backend';
import { apiFetch } from '../lib/api';

export function ConnectivityScreen() {
  const backendUrl = useMemo(() => getBackendUrl(), []);
  const [status, setStatus] = useState({ state: 'idle', payload: null, error: null });

  const runCheck = useCallback(async () => {
    try {
      setStatus({ state: 'loading', payload: null, error: null });
      const net = await Network.getNetworkStateAsync();
      const health = await apiFetch('/api/health');
      setStatus({
        state: 'ok',
        payload: { net, health },
        error: null,
      });
    } catch (e) {
      setStatus({ state: 'error', payload: null, error: String(e?.message || e) });
    }
  }, []);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Connectivity</Text>
      <Text style={styles.subtitle}>Confirm backend reachability before the shift starts.</Text>

      <GlassCard style={{ marginTop: 14 }}>
        <Text style={styles.kvLabel}>Backend</Text>
        <Text style={styles.kvValue}>{backendUrl || 'Not set (EXPO_PUBLIC_BACKEND_URL missing)'}</Text>

        <View style={{ height: 12 }} />

        <Pressable
          onPress={runCheck}
          style={({ pressed }) => [styles.btn, pressed && { opacity: 0.85 }]}
        >
          <Text style={styles.btnText}>Run health check</Text>
          {status.state === 'loading' && (
            <View style={{ marginLeft: 10 }}>
              <ActivityIndicator color={colors.gold} />
            </View>
          )}
        </Pressable>

        {status.state === 'ok' && (
          <View style={{ marginTop: 14 }}>
            <Text style={styles.ok}>ONLINE · /api/health 200</Text>
            <Text style={styles.jsonLine}>
              status={String(status.payload?.health?.status)}
            </Text>
            <Text style={styles.jsonLine}>
              internetReachable={String(status.payload?.net?.isInternetReachable)}
            </Text>
          </View>
        )}

        {status.state === 'error' && (
          <View style={{ marginTop: 14 }}>
            <Text style={styles.err}>FAILED</Text>
            <Text style={styles.errBody}>{status.error}</Text>
          </View>
        )}
      </GlassCard>

      <GlassCard style={{ marginTop: 14 }}>
        <Text style={styles.kvLabel}>Setup</Text>
        <Text style={styles.body}>
          Set EXPO_PUBLIC_BACKEND_URL in your Expo environment. Example:
        </Text>
        <Text style={styles.code}>EXPO_PUBLIC_BACKEND_URL=https://infotainment-dealer.preview.emergentagent.com</Text>
        <Text style={[styles.body, { marginTop: 10 }]}>
          All API calls are made to {backendUrl ? `${backendUrl}/api/*` : '[backend]/api/*'}.
        </Text>
      </GlassCard>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 18,
    paddingTop: 16,
  },
  title: {
    color: colors.text,
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: 0.2,
  },
  subtitle: {
    marginTop: 6,
    color: colors.textMute,
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  kvLabel: {
    color: colors.textMute,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
  kvValue: {
    marginTop: 6,
    color: colors.text,
    fontSize: 13,
    fontWeight: '700',
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
  ok: {
    color: colors.green,
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0.9,
  },
  err: {
    color: colors.red,
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0.9,
  },
  errBody: {
    marginTop: 6,
    color: colors.textDim,
    fontSize: 12,
    lineHeight: 16,
  },
  jsonLine: {
    marginTop: 6,
    color: colors.textDim,
    fontSize: 12,
  },
  body: {
    marginTop: 8,
    color: colors.textDim,
    fontSize: 12,
    lineHeight: 16,
  },
  code: {
    marginTop: 8,
    color: colors.text,
    fontSize: 12,
    fontFamily: 'monospace',
  },
});

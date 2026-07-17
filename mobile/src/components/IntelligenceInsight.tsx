/**
 * IntelligenceInsight — displays the enriched output from the Apex Intelligence
 * Framework: next-best-action, risk flags, missing info, sentiment, objection.
 *
 * Persona-aware via useLingo(). Non-blocking: safe to render when data is null
 * (returns null OR a skeleton if `pending=true`). Zero regression risk to the
 * primary reply flow.
 *
 * Motion:
 *   - Fade + slide-up entrance (280ms) on data arrival.
 *   - Pulsing halo around the sentiment pill when the customer is frustrated/angry.
 *   - Shimmer skeleton while pending.
 */
import React, { useEffect, useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme/colors';
import { useLingo } from '../context/ModeContext';
import {
  AnalyzeOutput,
  INTENT_LABELS,
  OBJECTION_LABELS,
  REPAIR_STAGE_LABELS,
  RISK_FLAG_LABELS,
  SENTIMENT_COLOR,
  SENTIMENT_LABEL,
  STRATEGY_LABELS,
  URGENCY_COLOR,
  URGENCY_LABELS,
} from '../lib/intelligence';

interface Props {
  data: AnalyzeOutput | null;
  pending?: boolean;
}

export function IntelligenceInsight({ data, pending = false }: Props) {
  const lingo = useLingo();

  // Skeleton motion — shimmer while pending
  const shimmer = useSharedValue(0);
  useEffect(() => {
    if (pending) {
      shimmer.value = withRepeat(
        withSequence(
          withTiming(1, { duration: 900, easing: Easing.inOut(Easing.ease) }),
          withTiming(0, { duration: 900, easing: Easing.inOut(Easing.ease) }),
        ),
        -1,
        false,
      );
    } else {
      shimmer.value = 0;
    }
  }, [pending, shimmer]);
  const shimmerStyle = useAnimatedStyle(() => ({
    opacity: 0.35 + shimmer.value * 0.55,
  }));

  // Entrance motion — fade + slide-up when data first arrives
  const entrance = useSharedValue(0);
  useEffect(() => {
    if (data) {
      entrance.value = 0;
      entrance.value = withTiming(1, { duration: 320, easing: Easing.out(Easing.cubic) });
    }
  }, [data, entrance]);
  const entranceStyle = useAnimatedStyle(() => ({
    opacity: entrance.value,
    transform: [{ translateY: (1 - entrance.value) * 10 }],
  }));

  // Sentiment pulse — only for hot sentiments (frustrated, angry)
  const pulse = useSharedValue(1);
  const isHot = useMemo(
    () => data?.customerSentiment.label === 'frustrated' || data?.customerSentiment.label === 'angry',
    [data?.customerSentiment.label],
  );
  useEffect(() => {
    if (isHot) {
      pulse.value = withRepeat(
        withSequence(
          withTiming(1.08, { duration: 500, easing: Easing.out(Easing.ease) }),
          withTiming(1.0, { duration: 500, easing: Easing.in(Easing.ease) }),
        ),
        -1,
        false,
      );
    } else {
      pulse.value = withTiming(1, { duration: 200 });
    }
  }, [isHot, pulse]);
  const pulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulse.value }],
  }));

  // ── Pending skeleton ────────────────────────────────────────────
  if (pending && !data) {
    return (
      <View style={styles.container} data-testid="intelligence-insight-skeleton">
        <View style={styles.headerRow}>
          <View style={styles.headerLeft}>
            <Ionicons name="analytics" size={16} color="#00E5FF" />
            <Text style={styles.headerTitle}>{lingo.insightPanelTitle}</Text>
          </View>
          <Animated.View style={[styles.skeletonPill, shimmerStyle]} />
        </View>
        <Animated.View style={[styles.skeletonRow, shimmerStyle]} />
        <Animated.View style={[styles.skeletonRow, shimmerStyle, { width: '75%' }]} />
        <Animated.View style={[styles.skeletonBlock, shimmerStyle]} />
      </View>
    );
  }

  if (!data) return null;

  const isEscalate = data.recommendedStrategy === 'escalate_to_human';
  const hasRisk = data.riskFlags && data.riskFlags.length > 0;
  const hasObjection = data.objection?.detected;
  const hasMissing = data.missingInformation && data.missingInformation.length > 0;

  return (
    <Animated.View style={[styles.container, entranceStyle]} data-testid="intelligence-insight">
      {/* Header row */}
      <View style={styles.headerRow}>
        <View style={styles.headerLeft}>
          <Ionicons name="analytics" size={16} color="#00E5FF" />
          <Text style={styles.headerTitle}>{lingo.insightPanelTitle}</Text>
        </View>
        <View style={styles.headerRight}>
          <Animated.View
            style={[
              styles.sentimentPill,
              {
                backgroundColor: SENTIMENT_COLOR[data.customerSentiment.label] + '22',
                borderColor: SENTIMENT_COLOR[data.customerSentiment.label],
                shadowColor: SENTIMENT_COLOR[data.customerSentiment.label],
                shadowOpacity: isHot ? 0.9 : 0,
                shadowRadius: 8,
              },
              pulseStyle,
            ]}
          >
            <View style={[styles.sentimentDot, { backgroundColor: SENTIMENT_COLOR[data.customerSentiment.label] }]} />
            <Text style={[styles.sentimentText, { color: SENTIMENT_COLOR[data.customerSentiment.label] }]}>
              {SENTIMENT_LABEL[data.customerSentiment.label]}
            </Text>
          </Animated.View>
        </View>
      </View>

      {/* Escalation banner — only when escalate_to_human */}
      {isEscalate && (
        <View style={styles.escalateBanner} data-testid="intelligence-escalate">
          <Ionicons name="warning" size={16} color="#E53935" />
          <Text style={styles.escalateText}>ESCALATE — bring in a manager NOW</Text>
        </View>
      )}

      {/* Intent + Strategy row */}
      <View style={styles.chipRow}>
        <View style={styles.chip}>
          <Text style={styles.chipLabel}>Intent</Text>
          <Text style={styles.chipValue} numberOfLines={1}>
            {INTENT_LABELS[data.primaryIntent] || data.primaryIntent}
          </Text>
        </View>
        <View style={styles.chip}>
          <Text style={styles.chipLabel}>{lingo.insightStrategyLabel}</Text>
          <Text style={[styles.chipValue, isEscalate && { color: '#E53935' }]} numberOfLines={1}>
            {STRATEGY_LABELS[data.recommendedStrategy] || data.recommendedStrategy}
          </Text>
        </View>
      </View>

      {/* Objection block */}
      {hasObjection && (
        <View style={styles.objectionBlock} data-testid="intelligence-objection">
          <Text style={styles.blockLabel}>{lingo.insightObjection}</Text>
          <Text style={styles.blockValue}>
            {data.objection.category
              ? OBJECTION_LABELS[data.objection.category] || data.objection.category
              : 'Unspecified'}
          </Text>
          {data.objection.underlyingConcern ? (
            <Text style={styles.blockSubtext}>{data.objection.underlyingConcern}</Text>
          ) : null}
        </View>
      )}

      {/* Risk flags */}
      {hasRisk && (
        <View style={styles.riskBlock} data-testid="intelligence-risk-flags">
          <Text style={styles.riskLabel}>{lingo.insightRiskFlags}</Text>
          <View style={styles.riskChipRow}>
            {data.riskFlags.map((flag) => (
              <Pressable
                key={flag}
                onPress={() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)}
                style={styles.riskChip}
              >
                <Ionicons name="alert-circle" size={11} color="#FF7043" />
                <Text style={styles.riskChipText}>{RISK_FLAG_LABELS[flag] || flag}</Text>
              </Pressable>
            ))}
          </View>
        </View>
      )}

      {/* ── Service-mode-only extensions (iter26) ─────────────────── */}
      {data.mode === 'service' && (data.urgencyClassification || data.repairStage) ? (
        <View style={styles.serviceStagesRow} data-testid="intelligence-service-stages">
          {data.urgencyClassification ? (
            <View
              style={[
                styles.urgencyPill,
                {
                  backgroundColor: URGENCY_COLOR[data.urgencyClassification] + '20',
                  borderColor: URGENCY_COLOR[data.urgencyClassification],
                },
              ]}
              data-testid="intelligence-urgency"
            >
              <View
                style={[
                  styles.urgencyDot,
                  { backgroundColor: URGENCY_COLOR[data.urgencyClassification] },
                ]}
              />
              <Text
                style={[
                  styles.urgencyText,
                  { color: URGENCY_COLOR[data.urgencyClassification] },
                ]}
              >
                {URGENCY_LABELS[data.urgencyClassification]}
              </Text>
            </View>
          ) : null}
          {data.repairStage ? (
            <View style={styles.stageChip} data-testid="intelligence-repair-stage">
              <Ionicons name="git-branch" size={11} color="#00E5FF" />
              <Text style={styles.stageChipText}>{REPAIR_STAGE_LABELS[data.repairStage]}</Text>
            </View>
          ) : null}
        </View>
      ) : null}

      {data.mode === 'service' && data.guestConcern ? (
        <View style={styles.concernBlock} data-testid="intelligence-guest-concern">
          <Text style={styles.blockLabel}>Guest Concern</Text>
          <Text style={styles.blockSubtext}>{data.guestConcern}</Text>
        </View>
      ) : null}

      {data.mode === 'service' && data.serviceFramework ? (
        <View style={styles.frameworkBlock} data-testid="intelligence-service-framework">
          <Text style={styles.blockLabel}>Service Response Framework</Text>
          <View style={styles.frameworkRow}>
            <Text style={styles.frameworkPhase}>1. Acknowledge</Text>
            <Text style={styles.frameworkText}>{data.serviceFramework.acknowledge}</Text>
          </View>
          <View style={styles.frameworkRow}>
            <Text style={styles.frameworkPhase}>2. Verified Facts</Text>
            <Text style={styles.frameworkText}>{data.serviceFramework.verifiedFactsStatement}</Text>
          </View>
          <View style={styles.frameworkRow}>
            <Text style={styles.frameworkPhase}>3. Impact</Text>
            <Text style={styles.frameworkText}>{data.serviceFramework.impact}</Text>
          </View>
          <View style={styles.frameworkRow}>
            <Text style={styles.frameworkPhase}>4. Next Step</Text>
            <Text style={styles.frameworkText}>{data.serviceFramework.nextStep}</Text>
          </View>
        </View>
      ) : null}

      {/* Next Best Action */}
      <Pressable
        onPress={() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)}
        style={styles.nbaBlock}
        data-testid="intelligence-next-action"
      >
        <Text style={styles.blockLabel}>{lingo.insightNextAction}</Text>
        <Text style={styles.nbaAction}>{data.nextBestAction.action}</Text>
        {data.nextBestAction.reason ? (
          <Text style={styles.blockSubtext}>Why: {data.nextBestAction.reason}</Text>
        ) : null}
      </Pressable>

      {/* Missing information */}
      {hasMissing && (
        <View style={styles.missingBlock} data-testid="intelligence-missing-info">
          <Text style={styles.blockLabel}>{lingo.insightMissingInfo}</Text>
          <View style={styles.missingChipRow}>
            {data.missingInformation.map((item, i) => (
              <View key={`${item}-${i}`} style={styles.missingChip}>
                <Text style={styles.missingChipText}>{item}</Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {/* Translated meaning (if non-English input) */}
      {data.translatedCustomerMeaning ? (
        <View style={styles.translatedBlock}>
          <Ionicons name="language" size={13} color={colors.textMute} />
          <Text style={styles.translatedText}>
            <Text style={{ color: colors.textMute }}>{data.detectedLanguage.toUpperCase()} → EN: </Text>
            {data.translatedCustomerMeaning}
          </Text>
        </View>
      ) : null}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: 14,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(0,229,255,0.20)',
    backgroundColor: 'rgba(0,229,255,0.05)',
    gap: 12,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  headerTitle: {
    color: '#00E5FF',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  headerRight: { flexDirection: 'row', alignItems: 'center' },
  sentimentPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    borderWidth: 1,
  },
  sentimentDot: { width: 6, height: 6, borderRadius: 3 },
  sentimentText: { fontSize: 11, fontWeight: '700' },
  escalateBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 10,
    borderRadius: 10,
    backgroundColor: 'rgba(229,57,53,0.10)',
    borderWidth: 1,
    borderColor: 'rgba(229,57,53,0.35)',
  },
  escalateText: { color: '#E53935', fontSize: 12, fontWeight: '800', letterSpacing: 0.8 },
  chipRow: { flexDirection: 'row', gap: 8 },
  chip: {
    flex: 1,
    padding: 10,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  chipLabel: {
    color: colors.textMute,
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 2,
  },
  chipValue: { color: '#FFFFFF', fontSize: 13, fontWeight: '600' },
  blockLabel: {
    color: colors.textMute,
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  blockValue: { color: '#FFFFFF', fontSize: 13, fontWeight: '700' },
  blockSubtext: { color: colors.textMute, fontSize: 12, marginTop: 3, lineHeight: 16 },
  objectionBlock: {
    padding: 10,
    borderRadius: 10,
    backgroundColor: 'rgba(255,183,77,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,183,77,0.20)',
  },
  riskBlock: {
    padding: 10,
    borderRadius: 10,
    backgroundColor: 'rgba(255,112,67,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,112,67,0.28)',
  },
  riskLabel: {
    color: '#FF7043',
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 6,
  },
  riskChipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  riskChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: 'rgba(255,112,67,0.15)',
    borderWidth: 1,
    borderColor: 'rgba(255,112,67,0.35)',
  },
  riskChipText: { color: '#FFAB91', fontSize: 11, fontWeight: '700' },
  nbaBlock: {
    padding: 10,
    borderRadius: 10,
    backgroundColor: 'rgba(0,229,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(0,229,255,0.20)',
  },
  nbaAction: { color: '#FFFFFF', fontSize: 13, fontWeight: '700', lineHeight: 18 },
  missingBlock: { paddingHorizontal: 2 },
  missingChipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  missingChip: {
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
  },
  missingChipText: { color: '#FFFFFF', fontSize: 11, fontWeight: '600' },
  translatedBlock: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    paddingTop: 4,
  },
  translatedText: { color: '#FFFFFF', fontSize: 11, flex: 1, lineHeight: 15, fontStyle: 'italic' },
  // ── Service Mode Extension (iter26) ──
  serviceStagesRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  urgencyPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
    borderWidth: 1,
  },
  urgencyDot: { width: 7, height: 7, borderRadius: 4 },
  urgencyText: { fontSize: 11, fontWeight: '800', letterSpacing: 0.5, textTransform: 'uppercase' },
  stageChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 10,
    backgroundColor: 'rgba(0,229,255,0.10)',
    borderWidth: 1,
    borderColor: 'rgba(0,229,255,0.35)',
  },
  stageChipText: { color: '#00E5FF', fontSize: 11, fontWeight: '700' },
  concernBlock: {
    padding: 10,
    borderRadius: 10,
    backgroundColor: 'rgba(255,183,77,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,183,77,0.15)',
  },
  frameworkBlock: {
    padding: 12,
    borderRadius: 10,
    backgroundColor: 'rgba(0,229,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(0,229,255,0.15)',
    gap: 8,
  },
  frameworkRow: { gap: 2 },
  frameworkPhase: {
    color: '#00E5FF',
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  frameworkText: { color: '#FFFFFF', fontSize: 12, lineHeight: 16 },
  // Skeleton shimmer while analyze() is in-flight
  skeletonPill: {
    width: 72,
    height: 18,
    borderRadius: 9,
    backgroundColor: 'rgba(0,229,255,0.18)',
  },
  skeletonRow: {
    height: 14,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.10)',
    marginTop: 8,
  },
  skeletonBlock: {
    height: 56,
    borderRadius: 10,
    backgroundColor: 'rgba(0,229,255,0.06)',
    marginTop: 4,
  },
});

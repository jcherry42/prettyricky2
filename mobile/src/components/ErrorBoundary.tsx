/**
 * Error Boundary Component
 * Catches JavaScript errors in child component tree.
 * Designo-styled error screen with retry functionality.
 */

import React, { ReactNode } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { colors } from '../theme/colors';

interface ErrorBoundaryProps {
  children: ReactNode;
  onReset?: () => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: React.ErrorInfo | null;
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    this.setState({ errorInfo });
    // Log error (could send to backend later)
    console.error('ErrorBoundary caught:', error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
    this.props.onReset?.();
  };

  render() {
    if (this.state.hasError) {
      return (
        <View style={styles.container}>
          <LinearGradient
            colors={[colors.bg0, colors.bg1, '#05070A']}
            style={StyleSheet.absoluteFill}
          />

          <View style={styles.content}>
            {/* Error icon */}
            <View style={styles.iconContainer}>
              <Ionicons name="warning" size={48} color={colors.red} />
            </View>

            <Text style={styles.title}>SYSTEM ERROR</Text>
            <Text style={styles.subtitle}>Something went wrong</Text>

            {/* Error details */}
            <View style={styles.errorBox}>
              <Text style={styles.errorLabel}>DIAGNOSTIC</Text>
              <ScrollView style={styles.errorScroll} showsVerticalScrollIndicator={false}>
                <Text style={styles.errorText}>
                  {this.state.error?.message || 'Unknown error'}
                </Text>
              </ScrollView>
            </View>

            {/* Retry button */}
            <Pressable
              onPress={this.handleReset}
              style={({ pressed }) => [styles.retryBtn, pressed && { opacity: 0.85 }]}
            >
              <Ionicons name="refresh" size={18} color={colors.gold} />
              <Text style={styles.retryText}>RETRY</Text>
            </Pressable>

            {/* Subtitle */}
            <Text style={styles.hint}>
              If the issue persists, try restarting the app
            </Text>
          </View>
        </View>
      );
    }

    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    alignItems: 'center',
    paddingHorizontal: 32,
    gap: 16,
  },
  iconContainer: {
    width: 88,
    height: 88,
    borderRadius: 44,
    borderWidth: 2,
    borderColor: 'rgba(255,59,48,0.30)',
    backgroundColor: 'rgba(255,59,48,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  title: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: 3,
  },
  subtitle: {
    color: colors.textDim,
    fontSize: 14,
    fontWeight: '600',
  },
  errorBox: {
    width: '100%',
    maxHeight: 120,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,59,48,0.20)',
    backgroundColor: 'rgba(255,59,48,0.05)',
    padding: 14,
    gap: 6,
  },
  errorLabel: {
    color: colors.red,
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1.5,
  },
  errorScroll: {
    maxHeight: 80,
  },
  errorText: {
    color: colors.textDim,
    fontSize: 11,
    fontWeight: '500',
    lineHeight: 16,
  },
  retryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(214,178,94,0.40)',
    backgroundColor: 'rgba(214,178,94,0.08)',
  },
  retryText: {
    color: colors.gold,
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 2,
  },
  hint: {
    color: colors.textMute,
    fontSize: 11,
    fontWeight: '600',
    textAlign: 'center',
  },
});

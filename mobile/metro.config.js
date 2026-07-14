// Sentry Metro plugin — wraps the default config so source-maps are
// emitted during `eas build` and uploaded via `expo-cli publish` /
// EAS Update. If Sentry isn't configured, the wrapper is a no-op.
//
// Required env vars at build time (typically EAS secrets, NOT in mobile .env):
//   SENTRY_ORG           — your Sentry org slug
//   SENTRY_PROJECT       — your Sentry project slug
//   SENTRY_AUTH_TOKEN    — from https://sentry.io/settings/account/api/auth-tokens/
//
// When any of these are missing, the plugin skips upload without failing the build.
const { getDefaultConfig } = require('expo/metro-config');
const { getSentryExpoConfig } = require('@sentry/react-native/metro');

const defaultConfig = getDefaultConfig(__dirname);
const config = getSentryExpoConfig(__dirname, defaultConfig);

module.exports = config;

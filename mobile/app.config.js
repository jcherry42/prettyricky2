// Expo config with runtime environment variables.
// NOTE: We do NOT hardcode backend URLs. Set EXPO_PUBLIC_BACKEND_URL at runtime.

export default ({ config }) => ({
  ...config,
  name: "Supercharg'd",
  slug: "superchargd",
  scheme: "superchargd",
  extra: {
    backendUrl: process.env.EXPO_PUBLIC_BACKEND_URL || "",
  },
  ios: {
    ...config.ios,
    supportsTablet: true,
  },
  android: {
    ...config.android,
    adaptiveIcon: config.android?.adaptiveIcon,
  },
});

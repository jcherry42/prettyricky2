/**
 * Core color system — Supercharg'd
 *
 * Ferrari-infotainment-inspired elevation model:
 *   Deep obsidian blacks with warm gold accents, precision gradients,
 *   and jewel-like status indicators. Every surface conveys depth.
 *
 * Elevation model — panels darken with depth for spatial hierarchy:
 *   panel  → panel2 → panel3 → panel4
 *   (surface-0 through surface-3)
 */

export const colors = {
  // Base UI colors — deep obsidian backdrop
  bg0: '#040608',
  bg1: '#070A0E',
  bg2: '#0B0E14',
  panel: 'rgba(255,255,255,0.06)',
  panel2: 'rgba(255,255,255,0.09)',
  panel3: 'rgba(255,255,255,0.12)',
  panel4: 'rgba(255,255,255,0.16)',
  stroke: 'rgba(255,255,255,0.10)',
  stroke2: 'rgba(255,255,255,0.16)',
  stroke3: 'rgba(255,255,255,0.22)',
  text: 'rgba(255,255,255,0.94)',
  textDim: 'rgba(255,255,255,0.70)',
  textMute: 'rgba(255,255,255,0.45)',
  textGhost: 'rgba(255,255,255,0.28)',
  gold: '#D6B25E',
  goldDim: 'rgba(214,178,94,0.55)',
  goldGlow: 'rgba(214,178,94,0.18)',
  goldMicro: 'rgba(214,178,94,0.08)',
  red: '#FF2D2D',
  green: '#40FF9B',
  blue: '#5EA7FF',
  shadow: 'rgba(0,0,0,0.6)',
  shadowDeep: 'rgba(0,0,0,0.85)',

  // Premium depth layers — for layered shadow effects
  shadowAmbient: 'rgba(0,0,0,0.35)',
  shadowKey: 'rgba(0,0,0,0.70)',

  // Warm tint for premium surfaces (very subtle warm shift)
  warmBlack: '#080604',
  warmPanel: 'rgba(214,178,94,0.03)',

  // designo colors
  leatherBurgundy: '#4A1F2F',
  leatherCream: '#E8DCC8',
  leatherBlack: '#1A1714',
  contrastStitching: '#D6B25E',

  woodBurrWalnut: '#3D2817',
  woodBurrWalnutLight: '#5C3D28',
  woodBirdsEyeMaple: '#C9A876',
  woodBirdsEyeMapleLight: '#E0C49A',

  metalBrushedAluminum: '#A8B2BC',
  metalChrome: '#C0C8D0',
  metalDarkChrome: '#6B7480',

  picassoBurgundy: '#7D2E4A',
  picassoTeal: '#2E6B7D',
  picassoDustyRose: '#C49B9B',
  picassoSageGreen: '#8BB09B',
  picassoIvory: '#F5F1E8',

  // Branded accent colors
  electricBlue: '#00D4FF',
  chrome: '#C0C8D0',
} as const;

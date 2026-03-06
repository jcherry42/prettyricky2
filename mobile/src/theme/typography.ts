export const fontFamilies = {
  regular: 'SpaceGrotesk_400Regular',
  medium: 'SpaceGrotesk_500Medium',
  semiBold: 'SpaceGrotesk_600SemiBold',
  bold: 'SpaceGrotesk_700Bold',
};

export const type = {
  // Display — hero headings, feature titles
  display: { fontFamily: fontFamilies.bold, fontSize: 32, letterSpacing: -0.2, lineHeight: 38 },
  // H1 — section headers
  h1: { fontFamily: fontFamilies.bold, fontSize: 24, letterSpacing: 0.3 },
  // H2 — card titles, modal headings
  h2: { fontFamily: fontFamilies.bold, fontSize: 18, letterSpacing: 0.15 },
  // Subtitle — supporting text under headings
  subtitle: { fontFamily: fontFamilies.semiBold, fontSize: 15, letterSpacing: 0.2, lineHeight: 21 },
  // Label — uppercase identifiers, badges, tabs
  label: { fontFamily: fontFamilies.bold, fontSize: 12, letterSpacing: 1.4, textTransform: 'uppercase' as const },
  // Overline — tiny uppercase section identifiers (bumped to 10 for mobile legibility)
  overline: { fontFamily: fontFamilies.bold, fontSize: 10, letterSpacing: 2.0, textTransform: 'uppercase' as const },
  // Body — primary readable text
  body: { fontFamily: fontFamilies.medium, fontSize: 14, letterSpacing: 0.15 },
  // Body dim — secondary readable text
  bodyDim: { fontFamily: fontFamilies.medium, fontSize: 13, letterSpacing: 0.15 },
  // Caption — timestamps, metadata, helper text
  caption: { fontFamily: fontFamilies.regular, fontSize: 12, letterSpacing: 0.2, lineHeight: 16 },
  // Mono — VINs, codes, technical data
  mono: { fontFamily: fontFamilies.semiBold, fontSize: 13, letterSpacing: 1.8 },
} as const;

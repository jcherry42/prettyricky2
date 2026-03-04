export const fontFamilies = {
  regular: 'SpaceGrotesk_400Regular',
  medium: 'SpaceGrotesk_500Medium',
  semiBold: 'SpaceGrotesk_600SemiBold',
  bold: 'SpaceGrotesk_700Bold',
};

export const type = {
  // Display — hero headings, feature titles
  display: { fontFamily: fontFamilies.bold, fontSize: 32, letterSpacing: -0.3, lineHeight: 38 },
  // H1 — section headers
  h1: { fontFamily: fontFamilies.bold, fontSize: 24, letterSpacing: 0.2 },
  // H2 — card titles, modal headings
  h2: { fontFamily: fontFamilies.bold, fontSize: 18, letterSpacing: 0.1 },
  // Subtitle — supporting text under headings
  subtitle: { fontFamily: fontFamilies.semiBold, fontSize: 15, letterSpacing: 0.15, lineHeight: 21 },
  // Label — uppercase identifiers, badges, tabs
  label: { fontFamily: fontFamilies.bold, fontSize: 12, letterSpacing: 1.2, textTransform: 'uppercase' },
  // Overline — tiny uppercase section identifiers (bumped to 10 for mobile legibility)
  overline: { fontFamily: fontFamilies.bold, fontSize: 10, letterSpacing: 1.8, textTransform: 'uppercase' },
  // Body — primary readable text
  body: { fontFamily: fontFamilies.medium, fontSize: 14, letterSpacing: 0.1 },
  // Body dim — secondary readable text
  bodyDim: { fontFamily: fontFamilies.medium, fontSize: 13, letterSpacing: 0.1 },
  // Caption — timestamps, metadata, helper text
  caption: { fontFamily: fontFamilies.regular, fontSize: 12, letterSpacing: 0.15, lineHeight: 16 },
  // Mono — VINs, codes, technical data
  mono: { fontFamily: fontFamilies.semiBold, fontSize: 13, letterSpacing: 1.5 },
};

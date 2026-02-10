export const fontFamilies = {
  regular: 'SpaceGrotesk_400Regular',
  medium: 'SpaceGrotesk_500Medium',
  semiBold: 'SpaceGrotesk_600SemiBold',
  bold: 'SpaceGrotesk_700Bold',
};

export const type = {
  h1: { fontFamily: fontFamilies.bold, fontSize: 24, letterSpacing: 0.2 },
  h2: { fontFamily: fontFamilies.bold, fontSize: 18, letterSpacing: 0.1 },
  label: { fontFamily: fontFamilies.bold, fontSize: 12, letterSpacing: 1.2, textTransform: 'uppercase' },
  body: { fontFamily: fontFamilies.medium, fontSize: 13, letterSpacing: 0.1 },
  bodyDim: { fontFamily: fontFamilies.medium, fontSize: 12, letterSpacing: 0.1 },
};

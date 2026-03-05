import { Dimensions, PixelRatio } from 'react-native';

const BASE_WIDTH = 390; // iPhone 12/13/14 baseline
const BASE_HEIGHT = 844;

const { width, height } = Dimensions.get('window');

// Uniform scale factor based on smaller axis for consistency
const scaleFactor = Math.min(width / BASE_WIDTH, height / BASE_HEIGHT);

export function scaleSize(size) {
  return Math.round(PixelRatio.roundToNearestPixel(size * scaleFactor));
}

export function scaleFont(size) {
  // Slightly dampen font scaling so text doesn't explode on tablets
  const fontScale = 0.85 + scaleFactor * 0.15;
  return Math.round(PixelRatio.roundToNearestPixel(size * fontScale));
}

export function getLayoutMetrics() {
  return {
    width,
    height,
    scaleFactor,
  };
}

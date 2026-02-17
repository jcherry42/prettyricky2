/**
 * Mercedes-Benz designo Interior Program Color Palette
 * Inspired by 1990s W140 S-Class luxury materials
 */

export const designoColors = {
  // Nappa Leather
  leather: {
    burgundy: '#4A1F2F',
    cream: '#E8DCC8',
    black: '#1A1714',
    contrast: '#D6B25E', // Contrast stitching
  },

  // Wood Bezels
  wood: {
    burrWalnut: '#3D2817',
    burrWalnutLight: '#5C3D28',
    birdsEyeMaple: '#C9A876',
    birdsEyeMapleLight: '#E0C49A',
  },

  // Metal Accents
  metal: {
    brushedAluminum: '#A8B2BC',
    chrome: '#C0C8D0',
    darkChrome: '#6B7480',
  },

  // Picasso Hand-Painted Patterns
  picasso: {
    dark: {
      burgundy: '#7D2E4A',
      teal: '#2E6B7D',
    },
    light: {
      dustyRose: '#C49B9B',
      sageGreen: '#8BB09B',
      ivory: '#F5F1E8',
    },
  },

  // Ambient Lighting - 64 color spectrum
  ambient: [
    '#FF0000', '#FF1A00', '#FF3300', '#FF4D00', // Reds
    '#FF6600', '#FF8000', '#FF9900', '#FFB300', // Oranges
    '#FFCC00', '#FFE600', '#FFFF00', '#E6FF00', // Yellows
    '#CCFF00', '#B3FF00', '#99FF00', '#80FF00', // Yellow-Greens
    '#66FF00', '#4DFF00', '#33FF00', '#1AFF00', // Greens
    '#00FF00', '#00FF1A', '#00FF33', '#00FF4D', // Pure Greens
    '#00FF66', '#00FF80', '#00FF99', '#00FFB3', // Cyan-Greens
    '#00FFCC', '#00FFE6', '#00FFFF', '#00E6FF', // Cyans
    '#00CCFF', '#00B3FF', '#0099FF', '#0080FF', // Light Blues
    '#0066FF', '#004DFF', '#0033FF', '#001AFF', // Blues
    '#0000FF', '#1A00FF', '#3300FF', '#4D00FF', // Deep Blues
    '#6600FF', '#8000FF', '#9900FF', '#B300FF', // Purples
    '#CC00FF', '#E600FF', '#FF00FF', '#FF00E6', // Magentas
    '#FF00CC', '#FF00B3', '#FF0099', '#FF0080', // Pinks
    '#FF0066', '#FF004D', '#FF0033', '#FF001A', // Pink-Reds
  ],
};

export const designoTexturePatterns = {
  // Diamond-quilted leather pattern (for backgrounds)
  quiltedLeather: {
    backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 20px, rgba(255,255,255,0.03) 20px, rgba(255,255,255,0.03) 40px)',
  },

  // Wood grain (horizontal lines for bezel effect)
  woodGrain: {
    backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 1px, rgba(0,0,0,0.15) 1px, rgba(0,0,0,0.15) 2px)',
  },

  // Brushed aluminum (fine horizontal brushing)
  brushedMetal: {
    backgroundImage: 'repeating-linear-gradient(90deg, transparent, transparent 1px, rgba(255,255,255,0.05) 1px, rgba(255,255,255,0.05) 2px)',
  },
};

// Ambient lighting intensity levels
export const ambientIntensity = {
  subtle: 0.04,
  medium: 0.08,
  vivid: 0.12,
};

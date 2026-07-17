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

/**
 * Picasso Hand-Painted Pattern Generators
 * Flowing artistic curves for backgrounds
 */

import { designoColors } from './designo';

/**
 * Generate Picasso swirl SVG for dark mode
 * Burgundy + Teal flowing curves
 */
export function generatePicassoDark(width = 400, height = 300) {
  const { burgundy, teal } = designoColors.picasso.dark;
  
  return `
    <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="swirl-dark" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style="stop-color:${burgundy};stop-opacity:0.3" />
          <stop offset="50%" style="stop-color:${teal};stop-opacity:0.2" />
          <stop offset="100%" style="stop-color:${burgundy};stop-opacity:0.3" />
        </linearGradient>
      </defs>
      <path d="M0,${height * 0.3} Q${width * 0.25},${height * 0.1} ${width * 0.5},${height * 0.25} T${width},${height * 0.4}" 
            stroke="url(#swirl-dark)" stroke-width="40" fill="none" opacity="0.6"/>
      <path d="M0,${height * 0.7} Q${width * 0.3},${height * 0.5} ${width * 0.6},${height * 0.7} T${width},${height * 0.6}" 
            stroke="url(#swirl-dark)" stroke-width="30" fill="none" opacity="0.4"/>
    </svg>
  `;
}

/**
 * Generate Picasso swirl SVG for light mode
 * Dusty Rose + Sage Green on Ivory
 */
export function generatePicassoLight(width = 400, height = 300) {
  const { dustyRose, sageGreen } = designoColors.picasso.light;
  
  return `
    <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="swirl-light" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style="stop-color:${dustyRose};stop-opacity:0.4" />
          <stop offset="50%" style="stop-color:${sageGreen};stop-opacity:0.3" />
          <stop offset="100%" style="stop-color:${dustyRose};stop-opacity:0.4" />
        </linearGradient>
      </defs>
      <path d="M0,${height * 0.35} Q${width * 0.3},${height * 0.15} ${width * 0.6},${height * 0.3} T${width},${height * 0.45}" 
            stroke="url(#swirl-light)" stroke-width="35" fill="none" opacity="0.5"/>
      <path d="M0,${height * 0.65} Q${width * 0.25},${height * 0.45} ${width * 0.55},${height * 0.65} T${width},${height * 0.55}" 
            stroke="url(#swirl-light)" stroke-width="25" fill="none" opacity="0.4"/>
    </svg>
  `;
}

/**
 * Get base64 encoded Picasso swirl for use as background image
 */
export function getPicassoBackground(isDark = true, width = 400, height = 300) {
  const svg = isDark ? generatePicassoDark(width, height) : generatePicassoLight(width, height);
  const encoded = btoa(svg);
  return `data:image/svg+xml;base64,${encoded}`;
}

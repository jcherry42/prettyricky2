/**
 * useAmbientLighting — reads from the shared AmbientLightingContext.
 * Each call no longer creates its own setInterval.
 */
import { useAmbientLightingContext } from '../context/AmbientLightingContext';

export function useAmbientLighting() {
  return useAmbientLightingContext();
}

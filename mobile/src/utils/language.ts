/**
 * Shared language utilities
 * Consolidated flag/label helpers used across multiple components.
 */

export function flagFor(lang: string): string {
  switch (lang) {
    case 'es': return '\uD83C\uDDF2\uD83C\uDDFD';
    case 'fr': return '\uD83C\uDDEB\uD83C\uDDF7';
    case 'ko': return '\uD83C\uDDF0\uD83C\uDDF7';
    case 'en': return '\uD83C\uDDFA\uD83C\uDDF8';
    default:   return '\uD83C\uDFF3\uFE0F';
  }
}

export function langName(lang: string): string {
  switch (lang) {
    case 'es': return 'Spanish';
    case 'fr': return 'French';
    case 'ko': return 'Korean';
    case 'en': return 'English';
    default:   return lang || 'Unknown';
  }
}

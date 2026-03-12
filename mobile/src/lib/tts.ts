import { apiFetch } from './api';

export async function ttsSpeak({ text, language, voice = 'auto' }: { text: string; language: string; voice?: string }) {
  if (!language) throw new Error('Language is required for TTS');
  // Backend: POST /api/tts {text, voice, language}
  // Returns: {audio_base64, format, voice_used}
  return apiFetch('/api/tts', {
    method: 'POST',
    body: JSON.stringify({ text, voice, language }),
  });
}

import { apiFetch } from './api';

export async function ttsSpeak({ text, language = 'es', voice = 'auto' }) {
  // Backend: POST /api/tts {text, voice, language}
  // Returns: {audio_data: base64, mime_type}
  return apiFetch('/api/tts', {
    method: 'POST',
    body: JSON.stringify({ text, voice, language }),
  });
}

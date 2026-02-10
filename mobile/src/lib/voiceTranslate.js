import { buildApiUrl } from '../config/backend';

export async function voiceTranslateUpload({ uri, targetLang = 'es', sourceLang = 'en', mimeType }) {
  const url = buildApiUrl('/api/voice-translate');
  if (!url) throw new Error('Backend URL not configured. Set EXPO_PUBLIC_BACKEND_URL');

  const form = new FormData();
  form.append('audio', {
    uri,
    name: 'ptt.m4a',
    type: mimeType || 'audio/m4a',
  });
  form.append('source_lang', sourceLang);
  form.append('target_lang', targetLang);

  const res = await fetch(url, {
    method: 'POST',
    body: form,
  });

  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(json?.detail || json?.error || `Voice translate failed: ${res.status}`);
  }

  if (json?.success === false) {
    throw new Error(json?.error || 'Voice translate failed');
  }

  return json;
}

import { buildApiUrlAsync } from '../config/backend';

/**
 * Upload recorded audio for voice translation.
 * @param {object} opts
 * @param {string} opts.uri       - Local file URI from Audio.Recording
 * @param {string} opts.targetLang - Target language code (en|es|fr|ko)
 * @param {string} [opts.sourceLang='en'] - Source language code
 * @param {string} [opts.mimeType='audio/mp4'] - MIME type (audio/mp4 for m4a, audio/webm for web)
 * @param {string} [opts.fileExtension='m4a'] - File extension
 */
export async function voiceTranslateUpload({ uri, targetLang, sourceLang = 'en', mimeType, fileExtension }) {
  if (!targetLang) throw new Error('Target language is required');
  const url = await buildApiUrlAsync('/api/voice-translate');
  if (!url) throw new Error('Backend URL not configured. Set EXPO_PUBLIC_BACKEND_URL');

  // Use provided values or derive sensible defaults
  const ext = fileExtension || 'm4a';
  const mime = mimeType || 'audio/mp4';
  const filename = `ptt_recording.${ext}`;

  const form = new FormData();
  form.append('audio', {
    uri,
    name: filename,
    type: mime,
  } as any);
  form.append('source_lang', sourceLang);
  form.append('target_lang', targetLang);

  // Use a generous timeout for voice translation (STT + translation can take 8-12s)
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 30000); // 30s timeout

  try {
    const res = await fetch(url, {
      method: 'POST',
      body: form,
      signal: controller.signal,
    });

    clearTimeout(timer);

    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(json?.detail || json?.error || `Voice translate failed: ${res.status}`);
    }

    if (json?.success === false) {
      throw new Error(json?.error || 'Voice translate failed — no speech detected');
    }

    return json;
  } catch (e) {
    clearTimeout(timer);
    if (e.name === 'AbortError') {
      throw new Error('Voice translation timed out. Try a shorter phrase.');
    }
    throw e;
  }
}

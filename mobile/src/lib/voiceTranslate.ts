import { errorMessage } from './errors';
import { apiFetch } from './api';
import { onDeviceTranscribe, isOnDeviceSttAvailable } from './onDeviceStt';

/**
 * Upload recorded audio for voice translation.
 * Falls back to on-device speech recognition if the server is unreachable.
 * @param {object} opts
 * @param {string} opts.uri       - Local file URI from Audio.Recording
 * @param {string} opts.targetLang - Target language code (en|es|fr|ko)
 * @param {string} [opts.sourceLang='en'] - Source language code
 * @param {string} [opts.mimeType='audio/mp4'] - MIME type (audio/mp4 for m4a, audio/webm for web)
 * @param {string} [opts.fileExtension='m4a'] - File extension
 * @param {boolean} [opts.preferOnDevice=false] - Force on-device STT (no translation)
 */
export async function voiceTranslateUpload({ uri, targetLang, sourceLang = 'en', mimeType, fileExtension, preferOnDevice = false }: {
  uri: string;
  targetLang: string;
  sourceLang?: string;
  mimeType?: string;
  fileExtension?: string;
  preferOnDevice?: boolean;
}) {
  if (!targetLang) throw new Error('Target language is required');

  // On-device STT mode (offline fallback)
  if (preferOnDevice) {
    const onDeviceAvailable = await isOnDeviceSttAvailable();
    if (onDeviceAvailable) {
      const result = await onDeviceTranscribe(sourceLang, 10000);
      if (result) {
        return {
          success: true,
          transcript: result.transcript,
          translated_text: result.transcript, // No translation in offline mode
          source_lang: sourceLang,
          target_lang: targetLang,
          on_device: true,
          confidence: result.confidence,
        };
      }
    }
  }

  const url = '/api/voice-translate';

  // Use provided values or derive sensible defaults
  const ext = fileExtension || 'm4a';
  const mime = mimeType || 'audio/mp4';
  const filename = `ptt_recording.${ext}`;

  const form = new FormData();
  form.append('audio', {
    uri,
    name: filename,
    type: mime,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any);
  form.append('source_lang', sourceLang);
  form.append('target_lang', targetLang);

  try {
    const json = await apiFetch(url, {
      method: 'POST',
      body: form,
      isFormData: true,
      timeout: 30000, // 30s — STT + translation can take 8-12s
      retries: 0,     // PTT should fail fast; on-device fallback below
    });

    if (json?.success === false) {
      throw new Error(json?.error || 'Voice translate failed — no speech detected');
    }

    return json;
  } catch (e: unknown) {
    if (e instanceof Error && e.name === 'AbortError') {
      // On timeout, attempt on-device STT as fallback
      try {
        const onDeviceAvailable = await isOnDeviceSttAvailable();
        if (onDeviceAvailable) {
          const fallback = await onDeviceTranscribe(sourceLang, 10000);
          if (fallback) {
            return {
              success: true,
              transcript: fallback.transcript,
              translated_text: fallback.transcript,
              source_lang: sourceLang,
              target_lang: targetLang,
              on_device: true,
              fallback_reason: 'server_timeout',
            };
          }
        }
      } catch (fallbackErr) {
        console.warn('[VoiceTranslate] On-device fallback failed:', fallbackErr);
      }
      throw new Error('Voice translation timed out. Try a shorter phrase.');
    }

    // On network errors, attempt on-device STT fallback
    const msg = errorMessage(e);
    if (msg.includes('Network request failed') || msg.includes('fetch')) {
      try {
        const onDeviceAvailable = await isOnDeviceSttAvailable();
        if (onDeviceAvailable) {
          const fallback = await onDeviceTranscribe(sourceLang, 10000);
          if (fallback) {
            return {
              success: true,
              transcript: fallback.transcript,
              translated_text: fallback.transcript,
              source_lang: sourceLang,
              target_lang: targetLang,
              on_device: true,
              fallback_reason: 'network_error',
            };
          }
        }
      } catch (fallbackErr) {
        console.warn('[VoiceTranslate] On-device fallback failed:', fallbackErr);
      }
    }

    throw e;
  }
}

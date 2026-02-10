import { buildApiUrl } from '../config/backend';

export async function uploadImageToLicenseScan({ uri, mimeType }) {
  const url = buildApiUrl('/api/license/scan');
  if (!url) throw new Error('Backend URL not configured. Set EXPO_PUBLIC_BACKEND_URL');

  const form = new FormData();
  form.append('image', {
    uri,
    name: 'license.jpg',
    type: mimeType || 'image/jpeg',
  });

  const res = await fetch(url, {
    method: 'POST',
    body: form,
  });

  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(json?.detail || json?.error || `Upload failed: ${res.status}`);
  }

  return json;
}

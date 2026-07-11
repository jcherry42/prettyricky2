import { apiFetch } from './api';

/**
 * Upload a license image for OCR.
 * Goes through `apiFetch` so the Bearer token is auto-attached
 * (the `/api/license/scan` endpoint enforces auth).
 */
export async function uploadImageToLicenseScan({ uri, mimeType }: { uri: string; mimeType?: string }) {
  const form = new FormData();
  form.append('image', {
    uri,
    name: 'license.jpg',
    type: mimeType || 'image/jpeg',
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any);

  return apiFetch('/api/license/scan', {
    method: 'POST',
    body: form,
    isFormData: true,
    timeout: 45000,
  });
}

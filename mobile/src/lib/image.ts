// Utilities for converting local image URIs to base64.
// Used for print flows that require base64 payload.

export async function uriToBase64(uri) {
  const res = await fetch(uri);
  const blob = await res.blob();

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.onloadend = () => {
      const dataUrl = reader.result;
      // data:<mime>;base64,<...>
      const parts = String(dataUrl).split('base64,');
      resolve(parts[1] || '');
    };
    reader.readAsDataURL(blob);
  });
}

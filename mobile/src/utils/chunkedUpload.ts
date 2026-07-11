/**
 * Chunked File Upload Utility
 * Handles large file uploads by splitting into chunks.
 *
 * Upload flow:
 *   Small files (<5 MB) → single POST /api/license/upload  (multipart, field name "image")
 *   Large files (≥5 MB) → chunked 3-step flow:
 *     1. POST /api/license/upload/init   (JSON)
 *     2. POST /api/license/upload/chunk  (multipart FormData per chunk)
 *     3. POST /api/license/upload/complete (multipart FormData)
 *
 * Backend contract (FastAPI):
 *   /upload       → image: UploadFile = File(...)
 *   /upload/chunk → upload_id: Form, chunk_index: Form, total_chunks: Form, chunk: File
 *   /upload/complete → upload_id: Form, customer_id: Form(None)
 */

import { apiFetch } from '../lib/api';
import { errorMessage } from '../lib/errors';

const DEFAULT_CHUNK_SIZE = 1024 * 1024; // 1 MB

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function base64ToBlob(base64: string, mimeType = 'image/jpeg'): Blob {
  const raw = base64.includes(',') ? base64.split(',')[1] : base64;
  const byteString = atob(raw);
  const ab = new ArrayBuffer(byteString.length);
  const ia = new Uint8Array(ab);
  for (let i = 0; i < byteString.length; i++) {
    ia[i] = byteString.charCodeAt(i);
  }
  return new Blob([ab], { type: mimeType });
}

// ---------------------------------------------------------------------------
// Chunked upload (files ≥ 5 MB)
// ---------------------------------------------------------------------------

interface ChunkedUploadOptions {
  uri: string;
  filename: string;
  contentType?: string;
  chunkSize?: number;
  onProgress?: (current: number, total: number) => void;
}

export async function uploadFileChunked(options: ChunkedUploadOptions): Promise<string> {
  const {
    uri,
    filename,
    contentType = 'image/jpeg',
    chunkSize = DEFAULT_CHUNK_SIZE,
    onProgress,
  } = options;

  try {
    // Read the whole file into an ArrayBuffer
    let fileData: ArrayBuffer;

    if (uri.startsWith('data:')) {
      const blob = base64ToBlob(uri, contentType);
      fileData = await blob.arrayBuffer();
    } else {
      const response = await fetch(uri);
      const blob = await response.blob();
      fileData = await blob.arrayBuffer();
    }

    const totalSize = fileData.byteLength;
    const totalChunks = Math.ceil(totalSize / chunkSize);

    // Step 1: Init (JSON)
    const initData = await apiFetch('/api/license/upload/init', {
      method: 'POST',
      body: JSON.stringify({
        filename,
        content_type: contentType,
        total_size: totalSize,
        total_chunks: totalChunks,
      }),
    });

    const uploadId: string = initData.upload_id;

    // Step 2: Upload each chunk as multipart FormData
    for (let i = 0; i < totalChunks; i++) {
      const start = i * chunkSize;
      const end = Math.min(start + chunkSize, totalSize);
      const chunkBuf = fileData.slice(start, end);
      const chunkBlob = new Blob([chunkBuf], { type: contentType });

      const form = new FormData();
      form.append('upload_id', uploadId);
      form.append('chunk_index', String(i));
      form.append('total_chunks', String(totalChunks));
      form.append('chunk', chunkBlob, `chunk_${i}.part`);

      await apiFetch('/api/license/upload/chunk', {
        method: 'POST',
        body: form,
        isFormData: true,
      });

      if (onProgress) {
        onProgress(i + 1, totalChunks);
      }
    }

    // Step 3: Complete upload (multipart FormData — backend uses Form(...))
    const completeForm = new FormData();
    completeForm.append('upload_id', uploadId);

    const completeData = await apiFetch('/api/license/upload/complete', {
      method: 'POST',
      body: completeForm,
      isFormData: true,
    });

    return completeData.image_url;
  } catch (error: unknown) {
    throw new Error(`Chunked upload failed: ${errorMessage(error)}`);
  }
}

// ---------------------------------------------------------------------------
// Auto upload (decides chunked vs single based on size)
// ---------------------------------------------------------------------------

interface AutoUploadOptions {
  uri: string;
  filename: string;
  contentType?: string;
  onProgress?: (current: number, total: number) => void;
}

export async function uploadFileAuto(options: AutoUploadOptions): Promise<string> {
  const { uri, filename, contentType = 'image/jpeg', onProgress } = options;

  // Determine file size
  let fileSize = 0;
  if (uri.startsWith('data:')) {
    const base64Data = uri.split(',')[1] || uri;
    fileSize = (base64Data.length * 3) / 4;
  } else {
    const response = await fetch(uri);
    const blob = await response.blob();
    fileSize = blob.size;
  }

  // Chunked upload for files > 5 MB
  if (fileSize > 5 * 1024 * 1024) {
    return uploadFileChunked({ uri, filename, contentType, onProgress });
  }

  // ── Single upload for small files ──
  // Backend expects: image: UploadFile = File(...)
  const formData = new FormData();

  if (uri.startsWith('data:')) {
    const blob = base64ToBlob(uri, contentType);
    formData.append('image', blob, filename);
  } else {
    // React Native: pass an object describing the file
    formData.append('image', {
      uri,
      type: contentType,
      name: filename,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);
  }

  // isFormData: true  →  apiFetch will NOT inject Content-Type: application/json
  // and the RN runtime will set the correct multipart boundary automatically.
  const data = await apiFetch('/api/license/upload', {
    method: 'POST',
    body: formData,
    isFormData: true,
  });

  if (onProgress) {
    onProgress(1, 1);
  }

  return data.image_url;
}

/**
 * Chunked File Upload Utility
 * Handles large file uploads by splitting into chunks
 */

import { apiFetch } from '../lib/api';

const DEFAULT_CHUNK_SIZE = 1024 * 1024; // 1MB chunks

/**
 * Convert base64 to blob
 */
function base64ToBlob(base64, mimeType = 'image/jpeg') {
  const byteString = atob(base64.split(',')[1] || base64);
  const ab = new ArrayBuffer(byteString.length);
  const ia = new Uint8Array(ab);
  
  for (let i = 0; i < byteString.length; i++) {
    ia[i] = byteString.charCodeAt(i);
  }
  
  return new Blob([ab], { type: mimeType });
}

/**
 * Upload file in chunks
 * @param {object} options
 * @param {string} options.uri - Local file URI or base64 data
 * @param {string} options.filename - Filename
 * @param {string} options.contentType - MIME type
 * @param {number} options.chunkSize - Chunk size in bytes
 * @param {function} options.onProgress - Progress callback (chunkIndex, totalChunks)
 * @returns {Promise<string>} - Image URL from server
 */
export async function uploadFileChunked(options) {
  const {
    uri,
    filename,
    contentType = 'image/jpeg',
    chunkSize = DEFAULT_CHUNK_SIZE,
    onProgress,
  } = options;

  try {
    // Read file data
    let fileData;
    let totalSize;

    if (uri.startsWith('data:')) {
      // Base64 data
      const blob = base64ToBlob(uri, contentType);
      fileData = await blob.arrayBuffer();
      totalSize = fileData.byteLength;
    } else {
      // File URI - use fetch to read
      const response = await fetch(uri);
      const blob = await response.blob();
      fileData = await blob.arrayBuffer();
      totalSize = fileData.byteLength;
    }

    const totalChunks = Math.ceil(totalSize / chunkSize);

    // Step 1: Initialize upload
    const initData = await apiFetch('/api/license/upload/init', {
      method: 'POST',
      body: JSON.stringify({
        filename,
        content_type: contentType,
        total_size: totalSize,
        total_chunks: totalChunks,
      }),
    });

    const uploadId = initData.upload_id;

    // Step 2: Upload chunks
    for (let i = 0; i < totalChunks; i++) {
      const start = i * chunkSize;
      const end = Math.min(start + chunkSize, totalSize);
      const chunk = fileData.slice(start, end);

      // Convert chunk to base64
      const chunkArray = new Uint8Array(chunk);
      const chunkBase64 = btoa(String.fromCharCode(...chunkArray));

      await apiFetch('/api/license/upload/chunk', {
        method: 'POST',
        body: JSON.stringify({
          upload_id: uploadId,
          chunk_index: i,
          chunk_data: chunkBase64,
          total_chunks: totalChunks,
        }),
      });

      if (onProgress) {
        onProgress(i + 1, totalChunks);
      }
    }

    // Step 3: Complete upload
    const completeData = await apiFetch('/api/license/upload/complete', {
      method: 'POST',
      body: JSON.stringify({
        upload_id: uploadId,
      }),
    });

    return completeData.image_url;
  } catch (error) {
    throw new Error(`Chunked upload failed: ${error.message}`);
  }
}

/**
 * Upload file with automatic chunking decision
 * Uses single upload for small files, chunked for large files
 * @param {object} options
 * @returns {Promise<string>} - Image URL from server
 */
export async function uploadFileAuto(options) {
  const { uri, filename, contentType = 'image/jpeg', onProgress } = options;

  // Determine file size
  let fileSize = 0;
  if (uri.startsWith('data:')) {
    const base64Data = uri.split(',')[1] || uri;
    fileSize = (base64Data.length * 3) / 4; // Approximate size
  } else {
    const response = await fetch(uri);
    const blob = await response.blob();
    fileSize = blob.size;
  }

  // Use chunked upload for files > 5MB
  if (fileSize > 5 * 1024 * 1024) {
    return uploadFileChunked({ uri, filename, contentType, onProgress });
  }

  // Single upload for small files
  const formData = new FormData();
  
  if (uri.startsWith('data:')) {
    const blob = base64ToBlob(uri, contentType);
    formData.append('file', blob, filename);
  } else {
    formData.append('file', {
      uri,
      type: contentType,
      name: filename,
    });
  }

  const data = await apiFetch('/api/license/upload', {
    method: 'POST',
    headers: {
      'Content-Type': 'multipart/form-data',
    },
    body: formData,
  });

  if (onProgress) {
    onProgress(1, 1);
  }

  return data.image_url;
}

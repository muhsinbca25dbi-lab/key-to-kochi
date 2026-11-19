/**
 * ImageKit Image Service — KEY TO KOCHI
 *
 * Implements:
 * - Direct browser-to-ImageKit binary file upload (uncompressed, exact original quality)
 * - 10MB per-image limit and image MIME-type validation
 * - Server-signed upload authentication (single-use token, expire, signature via Netlify Function)
 * - Real-time progress tracking (0-100%) via XMLHttpRequest
 * - Safe cleanup of unsaved uploads
 * - Verified property-owned image deletion
 */
import { authService } from './authService.js';

const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/avif'
];

export const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB per image
export const MAX_PHOTOS_PER_PROPERTY = 5;

/**
 * Validate a single image file before upload.
 * Enforces 10MB limit and image MIME formats without modifying the file.
 *
 * @param {File} file
 * @returns {{ valid: boolean, error?: string }}
 */
export function validateImageFile(file) {
  if (!file) {
    return { valid: false, error: 'No file provided.' };
  }

  const mime = (file.type || '').toLowerCase();
  if (!ALLOWED_MIME_TYPES.includes(mime) && !mime.startsWith('image/')) {
    return {
      valid: false,
      error: `"${file.name}" is not a supported format. Supported formats: JPG, PNG, WEBP, GIF, AVIF.`
    };
  }

  if (file.size > MAX_FILE_SIZE_BYTES) {
    const sizeMb = (file.size / (1024 * 1024)).toFixed(1);
    return {
      valid: false,
      error: `"${file.name}" is ${sizeMb} MB. Maximum allowed image size is 10 MB.`
    };
  }

  return { valid: true };
}

/**
 * Retrieve the current admin session token from authService or sessionStorage.
 * @returns {string}
 */
function getAdminToken() {
  if (typeof authService !== 'undefined' && authService) {
    if (typeof authService.getSessionToken === 'function') {
      const tok = authService.getSessionToken();
      if (tok) return tok;
    }
    if (typeof authService.getToken === 'function') {
      const tok = authService.getToken();
      if (tok) return tok;
    }
  }
  try {
    if (typeof sessionStorage !== 'undefined') {
      const raw = sessionStorage.getItem('ktk_admin_session');
      if (raw) {
        const s = JSON.parse(raw);
        if (s && s.token && s.expiresAt > Date.now()) return s.token;
      }
    }
  } catch (_) {}
  return '';
}

/**
 * Fetch server-signed ImageKit upload authentication credentials.
 * Authenticated via Admin Session Token (Bearer).
 *
 * @returns {Promise<{ token: string, expire: number, signature: string, publicKey: string, urlEndpoint: string }>}
 */
export async function getImageKitAuth() {
  const adminToken = getAdminToken();
  if (!adminToken) {
    throw new Error('Admin session is required to upload property images. Please log in.');
  }

  const resp = await fetch('/api/admin/images/auth', {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${adminToken}`
    }
  });

  const data = await resp.json().catch(() => ({}));
  if (!resp.ok || !data.ok) {
    throw new Error(data.error || 'Failed to authenticate image upload with server.');
  }

  return {
    token: data.token,
    expire: data.expire,
    signature: data.signature,
    publicKey: data.publicKey,
    urlEndpoint: data.urlEndpoint
  };
}

/**
 * Upload an exact original image file directly from the browser to ImageKit.
 * Does NOT compress, resize, or alter the original file bytes.
 *
 * @param {File} file - Original unmodified File object
 * @param {string} [propertyId='general'] - Associated property ID for folder organization
 * @param {Function} [onProgress] - Real-time progress callback: (percent: number)
 * @returns {Promise<{ url: string, fileId: string, name: string, size: number, thumbnailUrl: string }>}
 */
export function uploadPropertyImage(file, propertyId = 'general', onProgress = null) {
  return new Promise(async (resolve, reject) => {
    const val = validateImageFile(file);
    if (!val.valid) {
      reject(new Error(val.error));
      return;
    }

    let auth;
    try {
      auth = await getImageKitAuth();
    } catch (authErr) {
      reject(authErr);
      return;
    }

    const cleanPropId = String(propertyId || 'general').replace(/[^a-zA-Z0-9_-]/g, '_');
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');

    // Build standard multipart FormData containing the exact original binary file
    const formData = new FormData();
    formData.append('file', file, safeName);
    formData.append('fileName', safeName);
    formData.append('publicKey', auth.publicKey);
    formData.append('signature', auth.signature);
    formData.append('expire', String(auth.expire));
    formData.append('token', auth.token);
    formData.append('folder', `/properties/${cleanPropId}`);
    formData.append('useUniqueFileName', 'true');

    const xhr = new XMLHttpRequest();
    xhr.open('POST', 'https://upload.imagekit.io/api/v1/files/upload', true);

    if (typeof onProgress === 'function') {
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable && e.total > 0) {
          const percent = Math.min(99, Math.round((e.loaded / e.total) * 100));
          onProgress(percent);
        }
      };
    }

    xhr.onload = () => {
      let result;
      try {
        result = JSON.parse(xhr.responseText);
      } catch (_) {
        result = {};
      }

      if (xhr.status >= 200 && xhr.status < 300 && result.fileId) {
        if (typeof onProgress === 'function') onProgress(100);
        resolve({
          url: result.url,
          fileId: result.fileId,
          name: result.name || file.name,
          size: result.size || file.size,
          thumbnailUrl: result.thumbnailUrl || result.url,
          height: result.height,
          width: result.width
        });
      } else {
        const errMsg = result.message || `Upload failed with HTTP status ${xhr.status}`;
        console.error('[KTK ImageKit] Upload error response:', xhr.status, result);
        reject(new Error(errMsg));
      }
    };

    xhr.onerror = () => {
      console.error('[KTK ImageKit] Network error during upload');
      reject(new Error('Network error uploading image to ImageKit. Please check your connection and retry.'));
    };

    xhr.onabort = () => {
      reject(new Error('Upload was cancelled.'));
    };

    xhr.send(formData);
  });
}

/**
 * Upload multiple original images sequentially with accurate progress tracking.
 * Strictly enforces a total cap of 5 photos per property.
 *
 * @param {FileList|File[]} files
 * @param {string} propertyId
 * @param {number} [existingCount=0]
 * @param {Function} [onOverallProgress] - Callback: (percent, currentFileIndex, totalFiles)
 * @returns {Promise<{ successful: Array<{ url: string, fileId: string, name: string, size: number }>, failed: Array<{ name: string, error: string }> }>}
 */
export async function uploadMultiplePropertyImages(files, propertyId = 'general', existingCount = 0, onOverallProgress = null) {
  const fileArray = Array.from(files || []);
  if (fileArray.length === 0) {
    return { successful: [], failed: [] };
  }

  if (existingCount + fileArray.length > MAX_PHOTOS_PER_PROPERTY) {
    const allowed = Math.max(0, MAX_PHOTOS_PER_PROPERTY - existingCount);
    throw new Error(
      `Maximum ${MAX_PHOTOS_PER_PROPERTY} photos allowed per property. You currently have ${existingCount} photo(s) and can only add ${allowed} more.`
    );
  }

  const successful = [];
  const failed = [];

  for (let i = 0; i < fileArray.length; i++) {
    const file = fileArray[i];

    if (typeof onOverallProgress === 'function') {
      const baseProgress = Math.round((i / fileArray.length) * 100);
      onOverallProgress(baseProgress, i + 1, fileArray.length);
    }

    try {
      const item = await uploadPropertyImage(file, propertyId, (filePercent) => {
        if (typeof onOverallProgress === 'function') {
          const totalProgress = Math.round(((i + (filePercent / 100)) / fileArray.length) * 100);
          onOverallProgress(totalProgress, i + 1, fileArray.length);
        }
      });
      successful.push(item);
    } catch (err) {
      failed.push({ name: file.name, error: err.message });
    }
  }

  if (typeof onOverallProgress === 'function' && successful.length === fileArray.length && fileArray.length > 0) {
    onOverallProgress(100, fileArray.length, fileArray.length);
  }

  return { successful, failed };
}

/**
 * Delete an individual property image file from ImageKit.
 * Strictly verified by the server: requires propertyId and verifies that
 * propertyId owns that exact fileId in Firestore metadata.
 *
 * @param {string} propertyId
 * @param {string} fileId
 * @returns {Promise<boolean>}
 */
export async function deletePropertyImageFile(propertyId, fileId) {
  if (!propertyId || !fileId) return false;

  const adminToken = getAdminToken();
  if (!adminToken) return false;

  try {
    const resp = await fetch(`/api/admin/properties/${encodeURIComponent(propertyId)}/images/${encodeURIComponent(fileId)}`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${adminToken}`
      }
    });
    return resp.ok;
  } catch (err) {
    console.warn('[KTK ImageKit] deletePropertyImageFile failed:', err.message);
    return false;
  }
}

/**
 * Safely clean up uncommitted / abandoned uploads that were uploaded to ImageKit
 * during an Add/Edit session but never saved to Firestore (e.g. if admin cancels or closes modal).
 * The server verifies that none of these fileIds belong to any saved property.
 *
 * @param {string[]} fileIds
 * @returns {Promise<boolean>}
 */
export async function cleanupUnsavedImageFiles(fileIds) {
  const ids = Array.isArray(fileIds) ? fileIds.filter(Boolean) : [];
  if (ids.length === 0) return true;

  const adminToken = getAdminToken();
  if (!adminToken) return false;

  try {
    const resp = await fetch('/api/admin/images/cleanup-unsaved', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`
      },
      body: JSON.stringify({ fileIds: ids })
    });
    return resp.ok;
  } catch (err) {
    console.warn('[KTK ImageKit] cleanupUnsavedImageFiles failed:', err.message);
    return false;
  }
}


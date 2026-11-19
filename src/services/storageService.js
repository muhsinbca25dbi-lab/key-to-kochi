/**
 * Storage Service — KEY TO KOCHI
 *
 * Re-exports from imageService.js (ImageKit integration).
 * Completely replaces legacy Firebase Storage with secure ImageKit direct binary uploads.
 */
export {
  validateImageFile,
  uploadPropertyImage,
  uploadMultiplePropertyImages,
  deletePropertyImageFile,
  deletePropertyImageFile as deletePropertyImage,
  cleanupUnsavedImageFiles,
  MAX_FILE_SIZE_BYTES,
  MAX_PHOTOS_PER_PROPERTY
} from './imageService.js';

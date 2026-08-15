import { PUBLIC_VAULT_UPLOAD_MAX_BYTES, PUBLIC_VAULT_UPLOAD_MAX_MB } from 'constants/selfIntroVideoLimits';
import { ALBUM_PHOTO_EXTENSIONS, isAllowedAlbumPhotoFile } from 'constants/albumUploadFormats';

const VAULT_MEDIA_EXTENSIONS = new Set(['mp3', 'mp4', 'webm', 'mov', 'avi', 'wmv']);

const VAULT_MEDIA_MIME_TYPES = new Set([
  'video/mp4',
  'video/webm',
  'video/quicktime',
  'video/x-msvideo',
  'video/x-ms-wmv',
  'audio/mpeg',
  'audio/mp3'
]);

const PHOTO_ACCEPT_ATTR = [...ALBUM_PHOTO_EXTENSIONS].map((ext) => `.${ext}`).join(',');
const VAULT_ACCEPT_ATTR = [...VAULT_MEDIA_EXTENSIONS].map((ext) => `.${ext}`).join(',');

/** File picker / drop accept for Public Video Vault only. */
export const PUBLIC_VAULT_MEDIA_ACCEPT = [
  'video/mp4',
  'video/webm',
  'video/quicktime',
  'video/x-msvideo',
  'video/x-ms-wmv',
  'audio/mpeg',
  'audio/mp3',
  VAULT_ACCEPT_ATTR
].join(',');

/** Combined accept for MyStory drag-drop / file picker (photos + Public Video Vault media). */
export const MY_STORY_UPLOAD_ACCEPT = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/avif',
  'image/tiff',
  'image/bmp',
  'image/svg+xml',
  'image/eps',
  'image/x-eps',
  'application/postscript',
  'image/vnd.adobe.photoshop',
  'application/x-photoshop',
  'image/x-canon-cr2',
  'image/x-nikon-nef',
  'image/x-raw',
  'video/mp4',
  'video/webm',
  'video/quicktime',
  'video/x-msvideo',
  'video/x-ms-wmv',
  'audio/mpeg',
  'audio/mp3',
  PHOTO_ACCEPT_ATTR,
  VAULT_ACCEPT_ATTR
].join(',');

export function fileExtensionLower(file) {
  const name = String(file?.name ?? '').trim();
  const dot = name.lastIndexOf('.');
  if (dot < 1) return '';
  return name.slice(dot + 1).toLowerCase();
}

export function isAllowedPublicVaultMediaFile(file) {
  if (!file) return false;
  const ext = fileExtensionLower(file);
  if (ext && VAULT_MEDIA_EXTENSIONS.has(ext)) return true;
  const type = String(file.type || '').trim().toLowerCase();
  if (VAULT_MEDIA_MIME_TYPES.has(type)) return true;
  return false;
}

export function isAllowedMyStoryPhotoFile(file) {
  return isAllowedAlbumPhotoFile(file);
}

export function isAllowedMyStoryUploadFile(file) {
  return isAllowedMyStoryPhotoFile(file) || isAllowedPublicVaultMediaFile(file);
}

export function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ''));
    reader.onerror = () => reject(reader.error || new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
}

export { PUBLIC_VAULT_UPLOAD_MAX_BYTES, PUBLIC_VAULT_UPLOAD_MAX_MB };

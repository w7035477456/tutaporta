import useSWR from 'swr';
import api from './axios';
import { getApiBaseUrl } from 'config/apiBaseUrl';
import { bumpPhotosAlbumCacheBust, withPhotoApiCacheBust } from './photoCacheBust';
import { invalidateMyPicksFeedCache } from './myPicksFe';
import { downsizeImageFileToMaxMb } from 'utils/photoAlbumsDownsizeMedia';
import { isAllowedAlbumPhotoFile } from 'constants/albumUploadFormats';

const fetcher = ([url]) => api.get(url).then((res) => res.data);

/** Same target as phone QR upload — keeps base64 JSON small for WAF / HAProxy / cellular. */
export const MY_PHOTO_UPLOAD_PREP_MAX_MB = 2;

export const MY_PHOTO_UPLOAD_TIMEOUT_MS = 120000;

export const ALLOWED_UPLOAD_IMAGE_EXTENSIONS = new Set(['jpg', 'jpeg', 'png', 'gif', 'webp']);

export function getUploadImageExtension(fileName) {
  if (!fileName || typeof fileName !== 'string') return '';
  const i = fileName.lastIndexOf('.');
  if (i <= 0 || i === fileName.length - 1) return '';
  return fileName.slice(i + 1).toLowerCase();
}

/**
 * Safari often leaves file.type empty for valid JPEG/PNG picked in Finder — trust extension when type is missing.
 */
export function isAllowedUploadImageFile(file) {
  if (!file) return false;
  const ext = getUploadImageExtension(file.name);
  if (!ALLOWED_UPLOAD_IMAGE_EXTENSIONS.has(ext)) return false;
  const type = String(file.type || '').trim().toLowerCase();
  if (!type) return true;
  return type.startsWith('image/');
}

export function useMyPhotos(singlesId) {
  const ownerId = Number(singlesId);
  const key = Number.isFinite(ownerId) && ownerId > 0 ? ['/api/myPhotos', ownerId] : null;
  const { data, error, isLoading, mutate } = useSWR(key, fetcher, {
    revalidateOnFocus: false,
    keepPreviousData: false
  });
  return {
    photos: key && Array.isArray(data) ? data : [],
    myPhotosLoading: Boolean(key) && isLoading,
    myPhotosError: error,
    refetchMyPhotos: mutate
  };
}

export async function fetchUploadLimits() {
  const { data } = await api.get('/api/myPhotos/uploadLimits');
  const maxUploadMb = Number(data?.maxUploadMb);
  const videoMaxUploadMb = Number(data?.videoMaxUploadMb);
  const photoMb = Number.isFinite(maxUploadMb) && maxUploadMb > 0 ? maxUploadMb : 2;
  return {
    maxUploadMb: photoMb,
    videoMaxUploadMb:
      Number.isFinite(videoMaxUploadMb) && videoMaxUploadMb > 0 ? videoMaxUploadMb : photoMb,
    debugPhotoInfo: data?.debugPhotoInfo === true
  };
}

export function fileTooLargeMessage(fileSizeBytes, maxUploadMb) {
  const sizeMb = (fileSizeBytes / (1024 * 1024)).toFixed(2);
  return `File size is ${sizeMb} mb. Maximum we allow is ${maxUploadMb} mb`;
}

function uploadTimeoutMessage() {
  return 'Upload timed out. Try a smaller JPG/PNG or use Scan from your phone.';
}

function uploadHttpErrorMessage(status) {
  if (status === 403) {
    return 'Upload blocked (HTTP 403). Try a smaller photo or use Scan from your phone.';
  }
  if (status === 413) {
    return 'Photo is too large for the server. Try a smaller JPG or use Scan from your phone.';
  }
  if (status === 504 || status === 502) {
    return 'Upload timed out at the server (HTTP 504). Try a smaller photo or use Scan from your phone.';
  }
  return null;
}

/**
 * Shrink camera JPGs before base64 JSON upload (same idea as mobile QR upload page).
 */
export async function prepareMyPhotoFileForUpload(file, { maxUploadMb = MY_PHOTO_UPLOAD_PREP_MAX_MB } = {}) {
  if (!file || !isAllowedAlbumPhotoFile(file)) return file;

  const serverMaxMb = Number(maxUploadMb);
  const prepCapMb =
    Number.isFinite(serverMaxMb) && serverMaxMb > 0
      ? Math.min(serverMaxMb, MY_PHOTO_UPLOAD_PREP_MAX_MB)
      : MY_PHOTO_UPLOAD_PREP_MAX_MB;

  const smaller = await downsizeImageFileToMaxMb(file, prepCapMb);
  if (smaller) return smaller;

  const hardMaxBytes =
    (Number.isFinite(serverMaxMb) && serverMaxMb > 0 ? serverMaxMb : MY_PHOTO_UPLOAD_PREP_MAX_MB) *
    1024 *
    1024;
  if (file.size > hardMaxBytes) {
    throw new Error(fileTooLargeMessage(file.size, prepCapMb));
  }

  return file;
}

export async function uploadMyPhoto(file, { maxUploadMb, timeoutMs = MY_PHOTO_UPLOAD_TIMEOUT_MS } = {}) {
  const prepared = await prepareMyPhotoFileForUpload(file, { maxUploadMb });
  const fileSizeMb = (prepared.size / (1024 * 1024)).toFixed(2);
  console.log('[uploadMyPhoto] START', {
    name: prepared.name,
    type: prepared.type,
    sizeBytes: prepared.size,
    sizeMb: fileSizeMb,
    originalSizeBytes: file.size
  });

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result;
      const bodyChars = dataUrl.length;
      const bodyMb = (bodyChars / (1024 * 1024)).toFixed(2);
      console.log('[uploadMyPhoto] base64 ready', {
        dataUrlChars: bodyChars,
        approxJsonBodyMb: bodyMb,
        note: 'If nginx client_max_body_size < this, nginx returns 413 before Express sees it'
      });

      api
        .post(
          '/api/myPhotos',
          {
            image: dataUrl,
            file_extension: getUploadImageExtension(prepared.name) || undefined
          },
          { timeout: timeoutMs }
        )
        .then((res) => {
          console.log('[uploadMyPhoto] SUCCESS', res.data);
          resolve(res.data);
        })
        .catch((err) => {
          const status = err.response?.status;
          const data = err.response?.data;
          const headers = err.response?.headers;
          const isNginx413 = status === 413 && (!data?.code || typeof data === 'string');
          const isTimeout = err.code === 'ECONNABORTED' || /timeout/i.test(String(err.message || ''));
          console.error('[uploadMyPhoto] FAILED', {
            status,
            code: data?.code,
            error: data?.error || err.message,
            hasResponseData: !!data,
            responseDataType: typeof data,
            server: headers?.server,
            isNginx413,
            isTimeout,
            hint: isNginx413
              ? 'NGINX is blocking the request. Add "client_max_body_size 20M;" to your nginx server block and reload nginx.'
              : 'Error came from Express (check PM2 logs)'
          });
          if (isTimeout) {
            reject(new Error(uploadTimeoutMessage()));
            return;
          }
          const httpMsg = uploadHttpErrorMessage(status);
          if (httpMsg) {
            reject(new Error(httpMsg));
            return;
          }
          reject(err);
        });
    };
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsDataURL(prepared);
  });
}

export function myPhotoUrl(photosId, cacheBust) {
  const id = Number(photosId);
  if (!Number.isFinite(id) || id < 1) return '';
  const base = typeof window !== 'undefined' ? getApiBaseUrl() : '';
  const path = `/api/photo/${id}`;
  const url = base ? `${base}${path}` : path;
  if (cacheBust != null && cacheBust !== '') {
    return `${url}?v=${encodeURIComponent(String(cacheBust))}`;
  }
  return withPhotoApiCacheBust(url);
}

/** Stored JPEG thumbnail (256px); falls back to full image when photo_thumbnail is null. */
export function myPhotoThumbnailUrl(photosId, cacheBust) {
  const id = Number(photosId);
  if (!Number.isFinite(id) || id < 1) return '';
  const base = typeof window !== 'undefined' ? getApiBaseUrl() : '';
  const path = `/api/photo/${id}/thumbnail`;
  const url = base ? `${base}${path}` : path;
  if (cacheBust != null && cacheBust !== '') {
    return `${url}?v=${encodeURIComponent(String(cacheBust))}`;
  }
  return withPhotoApiCacheBust(url);
}

export async function deleteMyPhoto(photosId) {
  const { data } = await api.delete(`/api/myPhotos/${photosId}`);
  bumpPhotosAlbumCacheBust(data?.photos_cache_bust);
  await invalidateMyPicksFeedCache();
  return data;
}

export async function setProfilePhoto(photosId) {
  await api.post('/api/profilePhoto', { photos_id: photosId });
}

export async function updateMyPhotoType(photosId, type) {
  const { data } = await api.patch(`/api/myPhotos/${photosId}/type`, { type });
  return data;
}

/** Overwrite existing album photo with new image (full editor viewport as JPEG data URL). */
export async function saveMyPhoto(photosId, imageDataUrl) {
  const { data } = await api.put(`/api/myPhotos/${photosId}`, { image: imageDataUrl });
  return data;
}

/** Restore main photo from {id}orig.jpg if that backup exists. */
export async function resetMyPhotoFromOrig(photosId) {
  const { data } = await api.post(`/api/myPhotos/${photosId}/resetOriginal`);
  return data;
}

import api from './axios';
import { getApiBaseUrl } from 'config/apiBaseUrl';

export function adminPhotoStorageFileUrl(fileName) {
  const name = String(fileName ?? '').trim();
  if (!name) return '';
  return `${getApiBaseUrl()}/api/admin/photo-storage/file/${encodeURIComponent(name)}`;
}

export function adminVideoUrl(videoId) {
  const id = Number(videoId);
  if (!Number.isFinite(id) || id < 1) return '';
  return `${getApiBaseUrl()}/api/admin/video/${id}`;
}

export function adminPhotoUrl(photosId) {
  const id = Number(photosId);
  if (!Number.isFinite(id) || id < 1) return '';
  return `${getApiBaseUrl()}/api/admin/photo/${id}`;
}

export function adminPhotoThumbnailUrl(photosId) {
  const id = Number(photosId);
  if (!Number.isFinite(id) || id < 1) return '';
  return `${getApiBaseUrl()}/api/admin/photo/${id}/thumbnail`;
}

export function adminVideoThumbnailUrl(videoId) {
  const id = Number(videoId);
  if (!Number.isFinite(id) || id < 1) return '';
  return `${getApiBaseUrl()}/api/admin/video/${id}/thumbnail`;
}

/** Load admin photo with auth cookies; returns a blob URL for <img src>. Caller must revokeObjectURL. */
export async function fetchAdminPhotoObjectUrl(photosId) {
  const id = Number(photosId);
  if (!Number.isFinite(id) || id < 1) {
    throw new Error('Invalid photo id');
  }

  try {
    const { data } = await api.get(`/api/admin/photo/${id}`, { responseType: 'blob' });
    if (!(data instanceof Blob)) {
      throw new Error('Photo response was not a file');
    }

    if (data.type === 'application/json' || (data.size < 128 && !data.type.startsWith('image/'))) {
      const text = await data.text();
      try {
        const parsed = JSON.parse(text);
        throw new Error(parsed?.error || 'Failed to load photo');
      } catch (parseErr) {
        if (parseErr instanceof Error && parseErr.message !== 'Failed to load photo' && !parseErr.message.startsWith('Unexpected')) {
          throw parseErr;
        }
        throw new Error(text.trim() || 'Failed to load photo');
      }
    }

    return URL.createObjectURL(data);
  } catch (err) {
    const blob = err?.response?.data;
    if (blob instanceof Blob) {
      try {
        const text = await blob.text();
        const parsed = JSON.parse(text);
        throw new Error(parsed?.error || 'Failed to load photo');
      } catch {
        // fall through
      }
    }
    throw err;
  }
}

/** Load admin video with auth cookies; returns a blob URL for <video src>. Caller must revokeObjectURL. */
export async function fetchAdminVideoObjectUrl(videoId) {
  const id = Number(videoId);
  if (!Number.isFinite(id) || id < 1) {
    throw new Error('Invalid video id');
  }

  try {
    const { data } = await api.get(`/api/admin/video/${id}`, { responseType: 'blob' });
    if (!(data instanceof Blob)) {
      throw new Error('Video response was not a file');
    }

    if (data.type === 'application/json' || (data.size < 128 && !data.type.startsWith('video/') && !data.type.startsWith('audio/'))) {
      const text = await data.text();
      try {
        const parsed = JSON.parse(text);
        throw new Error(parsed?.error || 'Failed to load video');
      } catch (parseErr) {
        if (parseErr instanceof Error && parseErr.message !== 'Failed to load video' && !parseErr.message.startsWith('Unexpected')) {
          throw parseErr;
        }
        throw new Error(text.trim() || 'Failed to load video');
      }
    }

    return URL.createObjectURL(data);
  } catch (err) {
    const blob = err?.response?.data;
    if (blob instanceof Blob) {
      try {
        const text = await blob.text();
        const parsed = JSON.parse(text);
        throw new Error(parsed?.error || 'Failed to load video');
      } catch {
        // fall through
      }
    }
    throw err;
  }
}

export async function fetchAdminPhotoStorageFiles() {
  const { data } = await api.get('/api/admin/photo-storage/files');
  return data;
}

export async function fetchAdminPhotoStorageDuplicates() {
  const { data } = await api.get('/api/admin/photo-storage/duplicates');
  return data;
}

export async function removeAdminPhotoStorageDuplicates(checksum) {
  const { data } = await api.post('/api/admin/photo-storage/duplicates/remove', { checksum });
  return data;
}

/** Admin Tools → Password Check tab */
export async function fetchAdminPasswordHashPreview({ password }) {
  const { data } = await api.post('/api/admin/password-check/hash', { password });
  return data;
}

export async function fetchAdminPasswordCheckLookup({ singlesId, email, alias }) {
  const { data } = await api.post('/api/admin/password-check/lookup', { singlesId, email, alias });
  return data;
}

export async function fetchAdminPasswordCheck({ singlesId, email, alias, password }) {
  const { data } = await api.post('/api/admin/password-check', { singlesId, email, alias, password });
  return data;
}

export async function setAdminSinglesPasswordHash({ singlesId, email, alias, passwordHash }) {
  const { data } = await api.post('/api/admin/password-check/singles', {
    singlesId,
    email,
    alias,
    passwordHash
  });
  return data;
}

export async function setAdminGlobalPasswordHash({ passwordHash }) {
  const { data } = await api.post('/api/admin/password-check/global', { passwordHash });
  return data;
}

export async function setAdminMemberCategoryPasswordHash({ passwordHash }) {
  const { data } = await api.post('/api/admin/password-check/member-category', { passwordHash });
  return data;
}

/** Admin Tools → Lookup tab */
export async function fetchAdminSinglesLookupAll() {
  const { data } = await api.post('/api/admin/singles/lookup-all');
  return data;
}

export async function fetchAdminAuditRegistrationLookup({ singlesId, email, alias, memberId, phone }) {
  const { data } = await api.post('/api/admin/audit-registrations/lookup', {
    singlesId,
    email,
    alias,
    memberId,
    phone
  });
  return data;
}

/** Admin Tools → Login Log tab */
export async function fetchAdminLoginLogLookup({ type, singlesId, email, phone, ip }) {
  const { data } = await api.post('/api/admin/login-log/lookup', {
    type,
    singlesId,
    email,
    phone,
    ip
  });
  return data;
}

export async function fetchAdminLoginLogLookupAll() {
  const { data } = await api.post('/api/admin/login-log/lookup-all');
  return data;
}

export async function cycleAdminSinglesStatus({ singlesId }) {
  const { data } = await api.post('/api/admin/singles/cycle-status', { singlesId });
  return data;
}

export async function saveAdminSinglesStatus({ singlesId, status }) {
  const { data } = await api.post('/api/admin/singles/set-status', { singlesId, status });
  return data;
}

export async function saveAdminSinglesMemberCategory({ singlesId, memberCategory }) {
  const { data } = await api.post('/api/admin/singles/set-member-category', { singlesId, memberCategory });
  return data;
}

export async function saveAdminSinglesTokenBalance({ singlesId, accountBalanceToken }) {
  const { data } = await api.post('/api/admin/singles/set-token-balance', {
    singlesId,
    account_balance_token: accountBalanceToken
  });
  return data;
}

export async function resetAdminPasswordAttemptCount({ singlesId }) {
  const { data } = await api.post('/api/admin/singles/reset-password-attempt-count', { singlesId });
  return data;
}

/** Admin Tools → Tables tab */
export async function fetchAdminTables() {
  const { data } = await api.get('/api/admin/tables');
  return data;
}

export async function truncateAdminTable(tableKey) {
  const { data } = await api.post(`/api/admin/tables/${encodeURIComponent(tableKey)}/truncate`);
  return data;
}

export async function cascadeDeleteAdminTableRow(tableKey, id) {
  const { data } = await api.post(`/api/admin/tables/${encodeURIComponent(tableKey)}/cascade-delete`, { id });
  return data;
}

/** Admin Tools → Wipe by Id tab. Pass singlesId number or "ALL". */
export async function searchAdminWipeBySinglesId(singlesId) {
  const { data } = await api.post('/api/admin/wipe-by-singles-id/search', { singlesId });
  return data;
}

export async function deleteAdminWipeBySinglesIdTable({ singlesId, tableKey }) {
  const { data } = await api.post('/api/admin/wipe-by-singles-id/delete', { singlesId, tableKey });
  return data;
}

export async function cascadeDeleteAdminWipeBySinglesIdTable({ singlesId, tableKey }) {
  const { data } = await api.post('/api/admin/wipe-by-singles-id/cascade-delete', { singlesId, tableKey });
  return data;
}

export async function fetchAdminWipeBySinglesIdVideos(singlesId) {
  const { data } = await api.post('/api/admin/wipe-by-singles-id/videos/list', { singlesId });
  return data;
}

export async function deleteAdminWipeBySinglesIdVideo({ singlesId, videoId }) {
  const { data } = await api.post('/api/admin/wipe-by-singles-id/videos/delete', { singlesId, videoId });
  return data;
}

export async function fetchAdminWipeBySinglesIdPhotos(singlesId) {
  const { data } = await api.post('/api/admin/wipe-by-singles-id/photos/list', { singlesId });
  return data;
}

export async function deleteAdminWipeBySinglesIdPhoto({ singlesId, photosId }) {
  const { data } = await api.post('/api/admin/wipe-by-singles-id/photos/delete', { singlesId, photosId });
  return data;
}

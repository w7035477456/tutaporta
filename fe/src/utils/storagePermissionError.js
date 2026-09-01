/** Matches STORAGE_PERMISSION_CODE in be/utils/storagePermissionError.js */
export const STORAGE_PERMISSION_CODE = 'STORAGE_PERMISSION';

/** Shown in UI when server photo/video folder is not writable (run fixstorage on Ubuntu). */
export const STORAGE_PERMISSION_USER_MESSAGE = 'Folder permission fail, please contact admin.';

export function markStoragePermissionUploadError(message) {
  const err = new Error(String(message || '').trim() || STORAGE_PERMISSION_USER_MESSAGE);
  err.code = STORAGE_PERMISSION_CODE;
  return err;
}

export function isStoragePermissionUploadError(err) {
  if (!err) return false;
  if (err.code === STORAGE_PERMISSION_CODE) return true;
  if (err.response?.data?.code === STORAGE_PERMISSION_CODE) return true;
  const msg = String(err.message || err.response?.data?.error || '');
  return /folder permission/i.test(msg);
}

export function storagePermissionFailureMessage(err) {
  if (!isStoragePermissionUploadError(err)) return '';
  const msg = String(err?.response?.data?.error || err?.message || '').trim();
  return msg || STORAGE_PERMISSION_USER_MESSAGE;
}

import api from 'api/axios';

export const PROFILE_PHOTO_NOT_REAL_CODE = 'PROFILE_PHOTO_NOT_REAL';
export const PROFILE_PHOTO_NOT_REAL_EVENT = 'tutamall:profile-photo-not-real';
/** Fired when the member closes the notice, so My Story can reopen the photo upload. */
export const PROFILE_PHOTO_NOT_REAL_ACK_EVENT = 'tutamall:profile-photo-not-real-ack';
export const PROFILE_PHOTO_NOT_REAL_MESSAGE =
  'Please upload real photo, because momentarily, your profile must match your Driver License Photo and live facial scan to continue.';

const RECHECK_PASSED_KEY_PREFIX = 'profilePhotoRealRecheckPassed:';

export function isProfilePhotoNotRealError(err) {
  return err?.response?.data?.code === PROFILE_PHOTO_NOT_REAL_CODE;
}

export function requestProfilePhotoNotRealNotice(message) {
  window.dispatchEvent(
    new CustomEvent(PROFILE_PHOTO_NOT_REAL_EVENT, {
      detail: { message: String(message || '').trim() || PROFILE_PHOTO_NOT_REAL_MESSAGE }
    })
  );
}

function recheckPassedKey(singlesId, photosId) {
  return `${RECHECK_PASSED_KEY_PREFIX}${singlesId}:${photosId}`;
}

export function hasProfilePhotoRecheckPassed(singlesId, photosId) {
  try {
    return sessionStorage.getItem(recheckPassedKey(singlesId, photosId)) === '1';
  } catch {
    return false;
  }
}

export function markProfilePhotoRecheckPassed(singlesId, photosId) {
  try {
    sessionStorage.setItem(recheckPassedKey(singlesId, photosId), '1');
  } catch {
    /* ignore */
  }
}

/** @returns {Promise<{ ok: boolean, code?: string, error?: string }>} */
export async function recheckProfilePhoto() {
  const { data } = await api.post('/api/profilePhoto/recheck');
  return data || { ok: true };
}

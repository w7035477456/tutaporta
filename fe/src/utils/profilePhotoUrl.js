import { getApiBaseUrl } from 'config/apiBaseUrl';

/** Profile photo by singles id; `?v=` busts browser cache when profile_image_fk changes. */
export function buildProfilePhotoUrl(singlesId, profileImageFk) {
  const id = Number(singlesId);
  if (!Number.isFinite(id) || id < 1) return 'profile.jpeg';
  const fk = Number(profileImageFk);
  const versionQuery = Number.isFinite(fk) && fk > 0 ? `?v=${fk}` : '';
  return `${getApiBaseUrl()}/api/profile-photo/${id}${versionQuery}`;
}

/** Apps offered in Earn Tokens → Invite / Post FB flow. */
export const EARN_TOKENS_APP_DATING = 'dating';
export const EARN_TOKENS_APP_SECURE_PHOTO_ALBUM = 'securePhotoAlbum';
export const EARN_TOKENS_APP_SECURE_NOTES = 'secureNotes';

export const EARN_TOKENS_APPS = [
  { id: EARN_TOKENS_APP_DATING, label: 'Tuta - Dating' },
  { id: EARN_TOKENS_APP_SECURE_PHOTO_ALBUM, label: 'TutaPhotos' },
  { id: EARN_TOKENS_APP_SECURE_NOTES, label: 'TutaNotes' }
];

/**
 * Default app for the current route (vault pages pre-select the matching Tuta app).
 * @param {string} [pathname]
 */
export function defaultEarnTokensAppId(pathname = '') {
  const p = String(pathname || '');
  if (p.startsWith('/myPhotos') || p.startsWith('/myPhotoAlbums')) return EARN_TOKENS_APP_SECURE_PHOTO_ALBUM;
  if (p.startsWith('/myNote') || p.startsWith('/myRecordVault')) return EARN_TOKENS_APP_SECURE_NOTES;
  return EARN_TOKENS_APP_DATING;
}

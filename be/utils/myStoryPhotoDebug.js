/**
 * Verbose logging for My Story / posting photo pipeline (feed URLs + GET /api/photo/:id).
 * Enable: VSINGLES_DEBUG_MYSTORY_PHOTOS=1 in be env, then restart Node.
 */
export function myStoryPhotoDebugEnabled() {
  const v = String(process.env.VSINGLES_DEBUG_MYSTORY_PHOTOS ?? '').trim().toLowerCase();
  return v === '1' || v === 'true' || v === 'yes';
}

export function logMyStoryPhotos(...args) {
  if (myStoryPhotoDebugEnabled()) console.log('[MyStoryPhotos]', ...args);
}

/** Always logged — use for 401/403/404 and missing files so issues show up without enabling debug. */
export function logMyStoryPhotosAlways(...args) {
  console.log('[MyStoryPhotos]', ...args);
}

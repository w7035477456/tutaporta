/**
 * Older album HTML stored placed photos as `<div data-rv-attachment …></div>` atoms and the
 * thumbnail tray as a hidden `<div data-rv-album-staging data-staging-json=…>` marker.
 * Both are gone: photos live only as vault attachments (shown in the tray), so these
 * fragments are dropped on load and never written back.
 */

const LEGACY_PLACED_PHOTO_RE = /<div\b[^>]*\bdata-rv-attachment\b[^>]*>\s*<\/div>/gi;
const LEGACY_STAGING_MARKER_RE = /<div\b[^>]*\bdata-rv-album-staging\b[^>]*>\s*<\/div>/gi;

export function stripLegacyAlbumPhotoMarkup(html) {
  return String(html ?? '')
    .replace(LEGACY_PLACED_PHOTO_RE, '')
    .replace(LEGACY_STAGING_MARKER_RE, '');
}

export function hasLegacyAlbumPhotoMarkup(html) {
  const s = String(html ?? '');
  LEGACY_PLACED_PHOTO_RE.lastIndex = 0;
  LEGACY_STAGING_MARKER_RE.lastIndex = 0;
  const found = LEGACY_PLACED_PHOTO_RE.test(s) || LEGACY_STAGING_MARKER_RE.test(s);
  LEGACY_PLACED_PHOTO_RE.lastIndex = 0;
  LEGACY_STAGING_MARKER_RE.lastIndex = 0;
  return found;
}

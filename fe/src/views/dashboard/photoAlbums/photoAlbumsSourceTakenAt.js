/**
 * Source timestamp for album photo sequence (oldest = 1).
 * Priority: EXIF-like filename date → File.lastModified → now.
 */

/** @param {string} name */
function parseFilenameTimestampMs(name) {
  const base = String(name || '').trim();
  if (!base) return null;

  // 20220603_135447 or 20220603-135447
  const m1 = base.match(/(\d{4})(\d{2})(\d{2})[_-](\d{2})(\d{2})(\d{2})/);
  if (m1) {
    const ms = Date.UTC(
      Number(m1[1]),
      Number(m1[2]) - 1,
      Number(m1[3]),
      Number(m1[4]),
      Number(m1[5]),
      Number(m1[6])
    );
    if (Number.isFinite(ms)) return ms;
  }

  // IMG_20220603 or 2022-06-03
  const m2 = base.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (m2) {
    const ms = Date.UTC(Number(m2[1]), Number(m2[2]) - 1, Number(m2[3]));
    if (Number.isFinite(ms)) return ms;
  }

  const m3 = base.match(/(?:^|[^\d])(\d{4})(\d{2})(\d{2})(?:[^\d]|$)/);
  if (m3) {
    const ms = Date.UTC(Number(m3[1]), Number(m3[2]) - 1, Number(m3[3]));
    if (Number.isFinite(ms)) return ms;
  }

  return null;
}

/** @param {File | { name?: string, lastModified?: number }} file */
export function photoAlbumsSourceTakenAtMs(file) {
  const fromName = parseFilenameTimestampMs(file?.name);
  if (fromName != null) return fromName;
  const lm = Number(file?.lastModified);
  if (Number.isFinite(lm) && lm > 0) return Math.round(lm);
  return Date.now();
}

/** Oldest first — use before batch upload so seq 1..N matches timestamp order. */
export function sortPhotoAlbumsFilesBySourceTakenAt(files) {
  return [...(Array.isArray(files) ? files : [])].sort((a, b) => {
    const ta = photoAlbumsSourceTakenAtMs(a);
    const tb = photoAlbumsSourceTakenAtMs(b);
    if (ta !== tb) return ta - tb;
    return String(a?.name || '').localeCompare(String(b?.name || ''), undefined, {
      sensitivity: 'base'
    });
  });
}

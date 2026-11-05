/**
 * HTTP metadata for a downloaded backup zip.
 *
 * Why this exists: a browser download with no `Last-Modified` gets stamped with
 * "now", and macOS Finder then shows a blank / "…" Date Added for the file.
 * Sending the stored zip's real mtime makes the download keep its backup date,
 * and the ETag lets caches revalidate cheaply.
 */

/**
 * Build the date/cache headers for a stored backup.
 *
 * @param {object} file
 * @param {number} file.sizeBytes Total byte length (also used in the ETag).
 * @param {number} file.mtimeMs   Stored file mtime (ms since epoch). Non-finite →
 *                                no date headers, so the caller sends none.
 * @param {Date}   [now]          Injectable clock for tests.
 * @returns {{ 'Last-Modified'?: string, ETag?: string }}
 */
export function buildBackupDownloadHeaders({ sizeBytes = 0, mtimeMs = 0 } = {}, now = new Date()) {
  const ms = Number(mtimeMs);
  // A zero / missing mtime means "unknown". Falling back to now would quietly
  // re-introduce the bug, so skip the headers entirely instead.
  if (!Number.isFinite(ms) || ms <= 0) return {};

  // Never advertise a future time: some archives/proxies clamp the date and the
  // file ends up looking older than the backup that created it.
  const safeMs = Math.min(ms, now.getTime());
  const size = Math.max(0, Math.trunc(Number(sizeBytes) || 0));

  return {
    'Last-Modified': new Date(safeMs).toUTCString(),
    ETag: `"${size.toString(16)}-${Math.trunc(safeMs).toString(16)}"`
  };
}

export default buildBackupDownloadHeaders;

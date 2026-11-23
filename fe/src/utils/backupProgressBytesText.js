/**
 * Backup/Restore hourglass detail: two rows for the same byte progress —
 * row 1 always in gb, row 2 always in mb.
 *
 * Example:
 *   1.4gb of 1.9gb done
 *   1434mb of 1946mb done
 */
export function buildBackupProgressBytesText(progress) {
  if (!progress) return '';
  const reportedTotal = Number(progress.totalBytes) || Number(progress.estimatedBytes) || 0;
  const loaded = progress.stage === 'server' ? reportedTotal : Number(progress.loadedBytes);
  if (progress.loadedBytes == null && progress.stage !== 'server') return '';
  if (!Number.isFinite(loaded) || loaded < 0) return '';
  if (!loaded && !reportedTotal) return '';
  // Estimated totals can undershoot the real zip — grow them rather than stall at "Y of Y".
  const total = reportedTotal > 0 ? Math.max(reportedTotal, loaded) : 0;
  const MiB = 1024 * 1024;

  const fmtGb = (bytes) => `${(bytes / (1024 * MiB)).toFixed(1)}gb`;
  const fmtMb = (bytes) => {
    const mb = bytes / MiB;
    return `${mb.toFixed(mb >= 100 ? 0 : 1)}mb`;
  };

  const pair = (fmt) => (total > 0 ? `${fmt(loaded)} of ${fmt(total)} done` : `${fmt(loaded)} done`);
  return `${pair(fmtGb)}\n${pair(fmtMb)}`;
}

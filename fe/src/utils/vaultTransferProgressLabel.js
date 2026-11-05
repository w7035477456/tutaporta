/** Human-readable byte counts for vault busy overlays (note load, backup, etc.). */
export function formatVaultTransferBytes(bytes) {
  const n = Math.max(0, Math.floor(Number(bytes) || 0));
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(n < 10 * 1024 ? 1 : 0)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(n < 10 * 1024 * 1024 ? 2 : 1)} MB`;
  return `${(n / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

function formatSpeed(bytesPerSec) {
  const bps = Number(bytesPerSec) || 0;
  if (bps <= 0) return '';
  if (bps < 1024) return `${Math.round(bps)} B/s`;
  if (bps < 1024 * 1024) return `${(bps / 1024).toFixed(bps < 10 * 1024 ? 1 : 0)} KB/s`;
  return `${(bps / (1024 * 1024)).toFixed(1)} MB/s`;
}

/**
 * One-line transfer status for BusyHourglassOverlay progressLabel.
 * @param {{ phase?: string, loadedBytes?: number, totalBytes?: number, bytesPerSec?: number, label?: string }} p
 */
export function buildVaultTransferProgressLabel(p = {}) {
  const phase = String(p.phase || '').toLowerCase();
  const serverLabel = p.label ? String(p.label).trim() : '';
  const loaded = Math.max(0, Math.floor(Number(p.loadedBytes) || 0));
  const total = Math.max(0, Math.floor(Number(p.totalBytes) || 0));
  const speed = formatSpeed(p.bytesPerSec);

  if (phase === 'throttle') {
    if (serverLabel) return serverLabel;
    return 'Completing throttled transfer…';
  }

  const parts = [];
  if (total > 0) {
    parts.push(`Transfer: ${formatVaultTransferBytes(loaded)} / ${formatVaultTransferBytes(total)}`);
  } else if (loaded > 0) {
    parts.push(`Transfer: ${formatVaultTransferBytes(loaded)} received`);
  } else if (phase === 'download') {
    parts.push('Transfer: receiving note…');
  }
  if (speed) parts.push(speed);
  return parts.join(' · ') || serverLabel || '';
}

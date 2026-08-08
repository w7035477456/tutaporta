/** Drive label with vault-used and free-space stats, e.g. `MYVAULT1 (Used 1.3 MB / 70% free)`. */
function formatVaultUsedSize(location) {
  const bytes = Number(location?.vaultUsedBytes);
  if (Number.isFinite(bytes) && bytes >= 0) {
    const gb = bytes / (1024 * 1024 * 1024);
    if (gb >= 0.05) return `${Math.round(gb * 10) / 10} GB`;
    const mb = bytes / (1024 * 1024);
    if (mb >= 0.05) return `${Math.round(mb * 10) / 10} MB`;
    if (bytes > 0) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
    return '0 GB';
  }
  const gb = Number(location?.vaultUsedGb);
  if (Number.isFinite(gb) && gb >= 0) {
    if (gb >= 0.05) return `${Math.round(gb * 10) / 10} GB`;
    if (gb > 0) return `${Math.round(gb * 1024 * 10) / 10} MB`;
    return '0 GB';
  }
  return null;
}

export function formatPhotoAlbumsUsbAssignmentLabel(location) {
  const base = String(location?.label ?? location?.mountPath ?? '').trim();
  if (!base) return '';

  const parts = [];
  const usedLabel = formatVaultUsedSize(location);
  if (usedLabel) parts.push(`Used ${usedLabel}`);
  if (location?.freePercent != null && Number.isFinite(Number(location.freePercent))) {
    parts.push(`${location.freePercent}% free`);
  }
  if (!parts.length) return base;
  return `${base} (${parts.join(' / ')})`;
}

export function mergePhotoAlbumsUsbLocationStats(existing, fresh) {
  if (!existing?.mountPath || !fresh?.mountPath) return existing;
  if (existing.mountPath !== fresh.mountPath) return existing;
  return {
    ...existing,
    label: fresh.label || existing.label,
    hasVault: fresh.hasVault ?? existing.hasVault,
    partial: fresh.partial ?? existing.partial,
    legacyPinVault: fresh.legacyPinVault ?? existing.legacyPinVault,
    vaultId: fresh.vaultId ?? existing.vaultId,
    sizeGb: fresh.sizeGb ?? existing.sizeGb,
    availGb: fresh.availGb ?? existing.availGb,
    freePercent: fresh.freePercent ?? existing.freePercent,
    fileSystem: fresh.fileSystem ?? existing.fileSystem,
    vaultUsedBytes: fresh.vaultUsedBytes ?? existing.vaultUsedBytes,
    vaultUsedGb: fresh.vaultUsedGb ?? existing.vaultUsedGb
  };
}

function formatMyPhotoAlbumsBackupZipStamp(date = new Date()) {
  const y = date.getFullYear();
  const mo = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  let hours = date.getHours();
  const tt = hours >= 12 ? 'PM' : 'AM';
  hours %= 12;
  if (hours === 0) hours = 12;
  const hh = String(hours).padStart(2, '0');
  const mi = String(date.getMinutes()).padStart(2, '0');
  const ss = String(date.getSeconds()).padStart(2, '0');
  let tz = 'Local';
  try {
    const parts = new Intl.DateTimeFormat('en-US', { timeZoneName: 'short' }).formatToParts(date);
    const rawTz = parts.find((part) => part.type === 'timeZoneName')?.value || '';
    tz = String(rawTz).replace(/[^A-Za-z0-9_+-]/g, '') || 'Local';
  } catch {
    // keep Local
  }
  return `${y}-${mo}-${d}_${hh}-${mi}-${ss}_${tt}_${tz}`;
}

/** @param {'cloud' | 'onedrive' | 'usb'} kind — `onedrive` kept for legacy backup zips */
export function buildMyPhotoAlbumsBackupZipFileName(kind = 'cloud') {
  const prefix = kind === 'usb' ? 'MyPhotoAlbums_USB' : 'MyPhotoAlbums_TutaCloud';
  return `${prefix}_${formatMyPhotoAlbumsBackupZipStamp()}.zip`;
}

/** @param {'cloud' | 'onedrive' | 'usb'} kind */
export function buildPhotoAlbumsAlbumBackupZipFileName(albumLabel, kind = 'cloud') {
  const prefix = kind === 'usb' ? 'MyPhotoAlbums_USB' : 'MyPhotoAlbums_TutaCloud';
  const cleaned = String(albumLabel || 'Album')
    .trim()
    .replace(/[^\w\s-]+/g, '')
    .replace(/\s+/g, '_')
    .slice(0, 80);
  const safeLabel = cleaned || 'Album';
  return `${prefix}_${safeLabel}_${formatMyPhotoAlbumsBackupZipStamp()}.zip`;
}

export { formatMyPhotoAlbumsBackupZipStamp };

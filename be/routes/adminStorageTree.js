import {
  buildStorageTrees,
  listStorageFolderFiles,
  resolveStoragePath,
  storageFileContentType
} from '../utils/storageTree.js';

/**
 * GET /api/admin/storage-tree — Admin Tools → Tree tab (`storagetree` for both storage roots).
 */
export async function getAdminStorageTree(_req, res) {
  try {
    return res.json(await buildStorageTrees());
  } catch (err) {
    console.error('[getAdminStorageTree]', err?.message ?? err);
    return res.status(500).json({ error: err?.message || 'Failed to load storage tree' });
  }
}

/**
 * GET /api/admin/storage-tree/files?root=large|fast&path=rel — files directly inside one folder.
 */
export async function getAdminStorageTreeFiles(req, res) {
  try {
    return res.json(await listStorageFolderFiles(String(req.query.root || ''), String(req.query.path || '')));
  } catch (err) {
    if (!err?.statusCode) console.error('[getAdminStorageTreeFiles]', err?.message ?? err);
    return res.status(err?.statusCode || 500).json({ error: err?.message || 'Failed to list folder' });
  }
}

/**
 * GET /api/admin/storage-tree/file?root=large|fast&path=rel — stream one file (Range supported for video).
 */
export async function getAdminStorageTreeFile(req, res) {
  try {
    const { fullPath, stat } = await resolveStoragePath(String(req.query.root || ''), String(req.query.path || ''));
    if (!stat.isFile()) return res.status(400).json({ error: 'Not a file' });
    const contentType = storageFileContentType(fullPath);
    res.set('Content-Type', contentType);
    res.set('X-Content-Type-Options', 'nosniff');
    res.set('Cache-Control', 'private, max-age=60');
    if (contentType !== 'application/pdf') res.set('Content-Security-Policy', 'sandbox');
    return res.sendFile(fullPath, { dotfiles: 'allow' });
  } catch (err) {
    if (!err?.statusCode) console.error('[getAdminStorageTreeFile]', err?.message ?? err);
    return res.status(err?.statusCode || 500).json({ error: err?.message || 'Failed to load file' });
  }
}

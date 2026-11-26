import { removeUnusedStorageDuplicates, scanStorageDuplicates } from '../utils/adminStorageDuplicates.js';

/**
 * GET /api/admin/storage-duplicates — Admin Tools → Duplicate: duplicate files under
 * FAST_STORAGE_FOLDER/users and LARGE_CHEAP_STORAGE_FOLDER/users (demo content excluded).
 */
export async function getAdminStorageDuplicates(_req, res) {
  try {
    return res.json(await scanStorageDuplicates());
  } catch (err) {
    console.error('[getAdminStorageDuplicates]', err?.message ?? err);
    return res.status(500).json({ error: err?.message || 'Failed to scan for duplicates' });
  }
}

/**
 * POST /api/admin/storage-duplicates/remove
 * Body: { sha256: ["…"] } for chosen groups, or { all: true } for every group.
 * Deletes only copies a fresh scan marks unused; at least one copy of each file always stays.
 */
export async function postAdminStorageDuplicatesRemove(req, res) {
  try {
    const all = req.body?.all === true;
    const list = Array.isArray(req.body?.sha256) ? req.body.sha256 : req.body?.sha256 ? [req.body.sha256] : [];
    if (!all && !list.length) return res.status(400).json({ error: 'Pass sha256 (one or more groups) or all: true' });
    const result = await removeUnusedStorageDuplicates(all ? null : list);
    console.log(
      `[admin-duplicates] admin singles_id=${req.auth?.singles_id ?? '?'} removed ${result.removed.count} file(s), ${result.removed.label}`
    );
    return res.json(result);
  } catch (err) {
    console.error('[postAdminStorageDuplicatesRemove]', err?.message ?? err);
    return res.status(500).json({ error: err?.message || 'Failed to remove duplicates' });
  }
}

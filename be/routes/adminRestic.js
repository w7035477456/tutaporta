import { listResticSnapshots } from '../utils/resticSnapshots.js';

/**
 * GET /api/admin/restic/snapshots — Admin Tools → Restic tab (`showrestic` snapshot table).
 */
export async function getAdminResticSnapshots(_req, res) {
  try {
    const data = await listResticSnapshots();
    return res.json(data);
  } catch (err) {
    console.error('[getAdminResticSnapshots]', err?.message ?? err);
    return res
      .status(err?.statusCode || 500)
      .json({ error: err?.message || 'Failed to load restic snapshots', schedule: err?.schedule ?? null });
  }
}

import { getSystemStatisticsSnapshot } from '../utils/userActivityStats.js';

/**
 * GET /api/admin/statistics
 */
export async function getAdminStatistics(_req, res) {
  try {
    const data = await getSystemStatisticsSnapshot();
    return res.json(data);
  } catch (err) {
    console.error('[getAdminStatistics]', err?.message ?? err);
    return res.status(500).json({ error: 'Failed to load statistics' });
  }
}


import pool from '../../db/connection.js';
import { loadSelfIntroVideoSlots } from '../../utils/selfIntroVideoSlots.js';

/**
 * GET /api/self-intro-video/slots
 */
export async function getSelfIntroVideoSlotsRoute(req, res) {
  const singlesId = Number(req.auth?.singles_id);
  if (!Number.isFinite(singlesId) || singlesId < 1) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  let client;
  try {
    client = await pool.connect();
    const slots = await loadSelfIntroVideoSlots(client, singlesId);
    return res.json({ slots });
  } catch (error) {
    console.error('[getSelfIntroVideoSlotsRoute]', error?.message || error);
    return res.status(500).json({ error: error?.message || 'Failed to load self intro video slots' });
  } finally {
    client?.release();
  }
}

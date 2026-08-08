import { loadGlobalPromotionalArray } from '../../utils/globalPromotionalArray.js';

/** GET /api/promotionalMessages — referral Post FB / Refer Email templates from global.promotional_array */
export async function getPromotionalMessages(req, res) {
  try {
    const singlesId = Number(req.auth?.singles_id);
    if (!Number.isFinite(singlesId) || singlesId < 1) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const promotionalArray = await loadGlobalPromotionalArray();
    if (!promotionalArray.length) {
      return res.status(503).json({
        error: 'promotional_messages_unavailable',
        message:
          'No promotional message templates configured. Run be/db/addGlobalPromotionalArray.sql on Primary.'
      });
    }

    return res.json({ promotionalArray, count: promotionalArray.length });
  } catch (err) {
    console.error('[getPromotionalMessages]', err?.message ?? err);
    return res.status(500).json({ error: 'Failed to load promotional messages' });
  }
}

import pool from '../../db/connection.js';
import {
  hardDeleteMemberSelfIntroVideoInTx,
  unlinkDeletedSelfIntroVideoFiles
} from '../../utils/hardDeleteMemberSelfIntroVideo.js';
import { clearSelfIntroVideoSlot, loadSelfIntroVideoSlotRow, SELF_INTRO_VIDEO_SLOT_COLUMNS } from '../../utils/selfIntroVideoSlots.js';

/**
 * DELETE /api/self-intro-video/slot/:slot
 * slot = 1 | 2 | 3 — clears slot and hard-deletes the video file + DB row.
 */
export async function clearSelfIntroVideoSlotRoute(req, res) {
  const singlesId = Number(req.auth?.singles_id);
  if (!Number.isFinite(singlesId) || singlesId < 1) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const slot = Number(req.params.slot);
  if (!Number.isFinite(slot) || slot < 1 || slot > 3) {
    return res.status(400).json({ error: 'slot must be 1, 2, or 3' });
  }

  let client;
  try {
    client = await pool.connect();
    await client.query('BEGIN');
    const slotRow = await loadSelfIntroVideoSlotRow(client, singlesId);
    const column = SELF_INTRO_VIDEO_SLOT_COLUMNS[slot - 1];
    const videoId = Number(slotRow?.[column]);
    const cleared = await clearSelfIntroVideoSlot(client, singlesId, slot);
    let deleted = null;
    if (Number.isFinite(videoId) && videoId > 0) {
      deleted = await hardDeleteMemberSelfIntroVideoInTx(client, singlesId, videoId);
    }
    await client.query('COMMIT');
    if (deleted) unlinkDeletedSelfIntroVideoFiles([deleted]);
    return res.json({ success: true, slot: cleared.slot, video_id: deleted?.videoId ?? null });
  } catch (error) {
    try {
      await client?.query('ROLLBACK');
    } catch {
      // ignore
    }
    console.error('[clearSelfIntroVideoSlotRoute]', error?.message || error);
    return res.status(500).json({ error: error?.message || 'Failed to clear self intro video slot' });
  } finally {
    client?.release();
  }
}

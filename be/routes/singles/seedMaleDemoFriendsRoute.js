import { seedMaleDemoFriendsForSinglesId } from '../../utils/seedMaleDemoFriends.js';
import pool from '../../db/connection.js';

/**
 * POST /api/singles/seed-male-demo-friends
 * Seeds the authenticated member with Gary-style demo friends + welcome posting.
 * Idempotent. Male pack only for now (female pack TBD).
 */
export async function postSeedMaleDemoFriends(req, res) {
  const singlesId = Number(req.auth?.singles_id);
  if (!Number.isFinite(singlesId) || singlesId < 1) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  try {
    const result = await seedMaleDemoFriendsForSinglesId(pool, singlesId);
    return res.json({
      ok: true,
      singlesId: result.male?.singles_id,
      email: result.male?.email,
      friends: result.friends,
      posting: result.posting
        ? {
            postId: result.posting.postId,
            photoUrl: result.posting.photoUrl,
            inserted: result.posting.inserted,
            upgraded: result.posting.upgraded,
            skipped: result.posting.skipped
          }
        : null
    });
  } catch (err) {
    const message = String(err?.message ?? err);
    console.error('[postSeedMaleDemoFriends]', message);
    if (/Refusing to seed the template|Demo friend missing|no profile_image_fk|not owned/i.test(message)) {
      return res.status(400).json({ error: message });
    }
    return res.status(500).json({ error: 'Failed to seed demo friends.' });
  }
}

import pool from '../../db/connection.js';
import { sqlPhotoTypeParam } from '../../utils/pgEnumTypes.js';
import {
  ALBUM_MEDIA_MAX,
  VALID_ALBUM_TYPES,
  countAlbumPhotosInType,
  resolvePhotoAlbumTypeColumn
} from '../../utils/albumMediaCapacity.js';

const DEFAULT_FULL_ERROR = 'Full error message';

export async function updateMyPhotoType(req, res) {
  let client;
  try {
    const singlesId = req.auth?.singles_id;
    if (!singlesId) return res.status(401).json({ error: 'Authentication required' });

    const photosId = parseInt(req.params.id, 10);
    if (Number.isNaN(photosId) || photosId < 1) {
      return res.status(400).json({ error: 'Invalid photo id' });
    }

    const targetType = String(req.body?.type ?? '').trim().toLowerCase();
    if (!VALID_ALBUM_TYPES.has(targetType)) {
      return res.status(400).json({
        error:
          targetType === 'deleted'
            ? 'Photos cannot be soft-deleted. Use delete to remove the photo and its file permanently.'
            : 'Invalid photo type'
      });
    }

    client = await pool.connect();
    await client.query('BEGIN');
    const albumTypeColumn = await resolvePhotoAlbumTypeColumn(client);
    if (!albumTypeColumn) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Photo type storage is not available.' });
    }

    const ownerRow = await client.query(
      `SELECT photos_id
       FROM helloworldjunktest.photos
       WHERE photos_id = $1 AND singles_id = $2
       LIMIT 1`,
      [photosId, singlesId]
    );
    if (!ownerRow.rows.length) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Photo not found' });
    }

    const destinationCount = await countAlbumPhotosInType(client, singlesId, targetType, { excludePhotoId: photosId });
    if (destinationCount >= ALBUM_MEDIA_MAX) {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: DEFAULT_FULL_ERROR });
    }

    await client.query(
      `UPDATE helloworldjunktest.photos SET ${albumTypeColumn} = ${sqlPhotoTypeParam('$1')} WHERE photos_id = $2`,
      [targetType, photosId]
    );
    await client.query('COMMIT');
    return res.json({ ok: true, photos_id: photosId, type: targetType });
  } catch (err) {
    if (client) {
      try {
        await client.query('ROLLBACK');
      } catch (_) {
        // ignore rollback failure
      }
    }
    console.error('updateMyPhotoType error:', err);
    return res.status(500).json({ error: 'Failed to update photo type' });
  } finally {
    client?.release();
  }
}

import { receiveUploadChunk } from '../../utils/chunkedUploadStaging.js';
import { isStoragePermissionError } from '../../utils/storagePermissionError.js';

/**
 * PUT /api/tutadrive/upload-chunk?uploadId=…&index=N
 * Body: application/octet-stream — one piece of a backup zip too large for a single request.
 */
export async function putTutaDriveUploadChunk(req, res) {
  const singlesId = Number(req.auth?.singles_id);
  if (!Number.isFinite(singlesId) || singlesId < 1) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  try {
    const result = await receiveUploadChunk(req, singlesId, req.query?.uploadId, req.query?.index);
    return res.json({ success: true, ...result });
  } catch (err) {
    console.error('[putTutaDriveUploadChunk]', err?.message || err);
    return res
      .status(isStoragePermissionError(err) ? 500 : 400)
      .json({ error: err?.message || 'Unable to store upload chunk' });
  }
}

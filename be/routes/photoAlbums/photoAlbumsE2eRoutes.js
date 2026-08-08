/**
 * Yellow E2E key material API — salt + wrapped DEK only.
 * Password / KEK / DEK never submitted here.
 */
import {
  getAnyVaultKey,
  updateVaultKeys,
  upsertVaultKeys
} from '../../utils/photoAlbumsE2e/vaultE2eKeyStore.js';
import { isVaultE2eYellow } from '../../utils/photoAlbumsE2eYellowConfig.js';

function requireSinglesId(req, res) {
  const singlesId = Number(req.auth?.singles_id);
  if (!Number.isFinite(singlesId) || singlesId < 1) {
    res.status(401).json({ error: 'Authentication required' });
    return null;
  }
  return singlesId;
}

/** GET /api/photoAlbums/e2e/keys — KDF + wrapped DEK (or configured: false) */
export async function getPhotoAlbumsE2eKeys(req, res) {
  const singlesId = requireSinglesId(req, res);
  if (!singlesId) return;

  try {
    const vault = await getAnyVaultKey(singlesId);
    return res.json({
      e2eYellow: isVaultE2eYellow(),
      configured: Boolean(vault?.wrappedDekB64 && vault?.kdfSaltB64),
      vault: vault || null
    });
  } catch (err) {
    console.error('[getPhotoAlbumsE2eKeys]', err?.message || err);
    return res.status(500).json({ error: err?.message || 'Unable to load vault key material' });
  }
}

/** POST /api/photoAlbums/e2e/keys — first-time / upsert client-wrapped DEK */
export async function putPhotoAlbumsE2eKeys(req, res) {
  const singlesId = requireSinglesId(req, res);
  if (!singlesId) return;

  try {
    const result = await upsertVaultKeys(singlesId, req.body || {});
    return res.status(201).json({
      success: true,
      configured: true,
      ...result
    });
  } catch (err) {
    const status = Number(err?.status) || 500;
    if (status >= 500) console.error('[putPhotoAlbumsE2eKeys]', err?.message || err);
    return res.status(status).json({ error: err?.message || 'Unable to store vault key material' });
  }
}

/** PUT /api/photoAlbums/e2e/keys — password change: new salt + re-wrapped DEK only */
export async function updatePhotoAlbumsE2eKeys(req, res) {
  const singlesId = requireSinglesId(req, res);
  if (!singlesId) return;

  try {
    const existing = await getAnyVaultKey(singlesId);
    if (!existing) {
      return res.status(404).json({ error: 'Vault key material not found — set Encrypt Password first' });
    }
    const result = await updateVaultKeys(singlesId, {
      ...(req.body || {}),
      backends: req.body?.backends || ['usb', 'onedrive']
    });
    return res.json({
      success: true,
      configured: true,
      ...result
    });
  } catch (err) {
    const status = Number(err?.status) || 500;
    if (status >= 500) console.error('[updatePhotoAlbumsE2eKeys]', err?.message || err);
    return res.status(status).json({ error: err?.message || 'Unable to update vault key material' });
  }
}

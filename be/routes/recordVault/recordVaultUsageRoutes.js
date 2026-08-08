import { buildRecordVaultUsageStats } from '../../utils/vaultUsageStats.js';
import {
  addVaultSessionFileCounts,
  getVaultLastSessionFileCounts,
  getVaultSessionFileCounts,
  resetVaultSessionFileCounts,
  snapshotVaultSessionFileCountsToLast
} from '../../utils/vaultSessionFileCounts.js';
import { readRequestedVaultStorageType, vaultUsbStatus } from '../../utils/recordVaultUsb/vaultSession.js';

function requireSinglesId(req, res) {
  const singlesId = Number(req.auth?.singles_id);
  if (!Number.isFinite(singlesId) || singlesId < 1) {
    res.status(401).json({ error: 'Authentication required' });
    return null;
  }
  return singlesId;
}

/** Prefer last-session snapshot; fall back to live session if snapshot not written yet. */
async function resolveLoginGateFileCounts(singlesId) {
  const [last, live] = await Promise.all([
    getVaultLastSessionFileCounts(singlesId),
    getVaultSessionFileCounts(singlesId)
  ]);
  return {
    usbTxRx: Math.max(Number(last.usbTxRx) || 0, Number(live.usbTxRx) || 0),
    uiTxRx: Math.max(Number(last.uiTxRx) || 0, Number(live.uiTxRx) || 0)
  };
}

/** GET /api/recordVault/usage — transfer tally, vault folder size, OneDrive quota */
export async function getRecordVaultUsage(req, res) {
  const singlesId = requireSinglesId(req, res);
  if (!singlesId) return;

  try {
    const requestedType = readRequestedVaultStorageType(req);
    const session = requestedType
      ? await vaultUsbStatus(singlesId, requestedType)
      : await vaultUsbStatus(singlesId);
    // USB vault may live only on the local bridge — website node has no session.
    // Still return session file counts (Postgres) so the status bar can show Usb/ui tx/rx.
    if (!session?.unlocked) {
      const sessionFileCounts = await getVaultSessionFileCounts(singlesId);
      const lastSessionFileCounts = await resolveLoginGateFileCounts(singlesId);
      return res.json({
        storageType: requestedType || null,
        transfer: null,
        sessionFileCounts: {
          usbTxRx: Number(sessionFileCounts.usbTxRx) || 0,
          uiTxRx: Number(sessionFileCounts.uiTxRx) || 0
        },
        lastSessionFileCounts: {
          usbTxRx: Number(lastSessionFileCounts.usbTxRx) || 0,
          uiTxRx: Number(lastSessionFileCounts.uiTxRx) || 0
        },
        subscriptionTier: 'FREE',
        onedriveEmail: null,
        vaultFolderMb: 0,
        onedriveStorage: null
      });
    }
    const usage = await buildRecordVaultUsageStats(singlesId, session.storageType);
    return res.json(usage);
  } catch (err) {
    console.error('[getRecordVaultUsage]', err?.message || err);
    return res.status(500).json({ error: err?.message || 'Unable to load vault usage' });
  }
}

/**
 * POST /api/recordVault/session-file-counts
 * Body: { usbDelta?, uiDelta?, reset?, snapshot? }
 * Cluster-safe increments (FE reports USB-bridge activity; website owns Postgres).
 * snapshot:true copies running counts → last-session (USB bridge logoff).
 */
export async function postRecordVaultSessionFileCounts(req, res) {
  const singlesId = requireSinglesId(req, res);
  if (!singlesId) return;

  try {
    if (req.body?.reset === true) {
      await resetVaultSessionFileCounts(singlesId);
    }
    if (req.body?.snapshot === true) {
      const last = await snapshotVaultSessionFileCountsToLast(singlesId);
      return res.json({ success: true, ...last });
    }
    const counts = await addVaultSessionFileCounts(singlesId, {
      usbDelta: req.body?.usbDelta ?? req.body?.usb_delta,
      uiDelta: req.body?.uiDelta ?? req.body?.ui_delta
    });
    return res.json({ success: true, ...counts });
  } catch (err) {
    console.error('[postRecordVaultSessionFileCounts]', err?.message || err);
    return res.status(500).json({ error: err?.message || 'Unable to update session file counts' });
  }
}

/**
 * GET /api/recordVault/session-file-counts
 * Query: ?last=1 → frozen totals from last logoff (login gate).
 */
export async function getRecordVaultSessionFileCounts(req, res) {
  const singlesId = requireSinglesId(req, res);
  if (!singlesId) return;
  try {
    const wantLast =
      req.query?.last === '1' ||
      req.query?.last === 'true' ||
      String(req.query?.scope || '').toLowerCase() === 'last';
    const counts = wantLast
      ? await resolveLoginGateFileCounts(singlesId)
      : await getVaultSessionFileCounts(singlesId);
    return res.json(counts);
  } catch (err) {
    console.error('[getRecordVaultSessionFileCounts]', err?.message || err);
    return res.status(500).json({ error: err?.message || 'Unable to load session file counts' });
  }
}

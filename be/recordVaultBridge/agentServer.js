import express from 'express';
import os from 'os';
import { configureVaultAccessSessionResolver as configureNotesVaultAccessSessionResolver } from '../utils/recordVaultUsb/vaultSession.js';
import { configureVaultAccessSessionResolver as configurePhotoAlbumsVaultAccessSessionResolver } from '../utils/photoAlbumsUsb/vaultSession.js';
import {
  browseRecordVaultUsbPath,
  formatRecordVaultUsb,
  getRecordVaultUsbStatus,
  getRecordVaultUsbUnlockGuardLocal,
  getRecordVaultUsbVaultTree,
  initRecordVaultUsbBridge,
  listRecordVaultUsbLocationsLocal,
  logoffRecordVaultUsb,
  unlockRecordVaultUsbBridge,
  downloadRecordVaultUsbBackupZip,
  restoreRecordVaultUsbBackupZip
} from '../routes/recordVault/recordVaultUsbRoutes.js';
import {
  createRecordVaultNote,
  createRecordVaultNotebook,
  createRecordVaultShortcut,
  deleteRecordVaultNote,
  deleteRecordVaultNotebook,
  deleteRecordVaultShortcut,
  deleteRecordVaultNoteAttachment,
  getRecordVaultNoteAttachment,
  getRecordVaultNoteImage,
  getRecordVaultNoteExtraImage,
  uploadRecordVaultNoteExtraImage,
  deleteRecordVaultNoteExtraImage,
  getRecordVaultTree,
  getRecordVaultNote,
  moveRecordVaultNoteImage,
  reorderRecordVaultNotebooks,
  reorderRecordVaultNotes,
  reorderRecordVaultShortcuts,
  searchRecordVaultNotes,
  updateRecordVaultNotebook,
  updateRecordVaultNote,
  uploadRecordVaultNoteAttachment,
  openRecordVaultNoteAttachmentNative
} from '../routes/recordVault/recordVaultRoutes.js';
import {
  browsePhotoAlbumsUsbPath,
  formatPhotoAlbumsUsb,
  getPhotoAlbumsUsbStatus,
  getPhotoAlbumsUsbUnlockGuardLocal,
  getPhotoAlbumsUsbVaultTree,
  initPhotoAlbumsUsbBridge,
  listPhotoAlbumsUsbLocationsLocal,
  logoffPhotoAlbumsUsb,
  unlockPhotoAlbumsUsbBridge,
  downloadPhotoAlbumsUsbBackupZip,
  downloadPhotoAlbumsUsbAlbumBackupZip,
  getPhotoAlbumsUsbAlbumBackupProgress,
  restorePhotoAlbumsUsbBackupZip
} from '../routes/photoAlbums/photoAlbumsUsbRoutes.js';
import {
  createPhotoAlbumsNote,
  createPhotoAlbumsNotebook,
  createPhotoAlbumsShortcut,
  deletePhotoAlbumsNote,
  deletePhotoAlbumsNotebook,
  deletePhotoAlbumsShortcut,
  deletePhotoAlbumsNoteAttachment,
  getPhotoAlbumsNoteAttachment,
  getPhotoAlbumsNoteImage,
  getPhotoAlbumsNoteExtraImage,
  uploadPhotoAlbumsNoteExtraImage,
  deletePhotoAlbumsNoteExtraImage,
  getPhotoAlbumsTree,
  getPhotoAlbumsNote,
  movePhotoAlbumsNoteImage,
  reorderPhotoAlbumsNotebooks,
  reorderPhotoAlbumsNotes,
  reorderPhotoAlbumsShortcuts,
  searchPhotoAlbumsNotes,
  updatePhotoAlbumsNotebook,
  updatePhotoAlbumsNote,
  uploadPhotoAlbumsNoteAttachment,
  reconcilePhotoAlbumsAlbumPhotoSeq,
  openPhotoAlbumsNoteAttachmentNative
} from '../routes/photoAlbums/photoAlbumsRoutes.js';

const DEFAULT_PORT = Number(process.env.RECORD_VAULT_BRIDGE_PORT || 49201);
const DEFAULT_ORIGINS = [
  'https://onlinemall.website',
  'https://www.onlinemall.website',
  'http://localhost:3000',
  'http://127.0.0.1:3000'
];

function parseAllowedOrigins() {
  const raw = String(process.env.RECORD_VAULT_BRIDGE_ALLOWED_ORIGINS ?? '').trim();
  if (!raw) return DEFAULT_ORIGINS;
  return raw
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function isAllowedOrigin(origin, allowedOrigins) {
  if (!origin) return false;
  if (allowedOrigins.includes(origin)) return true;
  try {
    const host = new URL(origin).hostname.toLowerCase();
    return host === 'onlinemall.website' || host.endsWith('.onlinemall.website');
  } catch {
    return false;
  }
}

function bridgeSinglesId(req, res) {
  const singlesId = Number(req.headers['x-record-vault-singles-id']);
  if (!Number.isFinite(singlesId) || singlesId < 1) {
    res.status(401).json({ error: 'X-Record-Vault-Singles-Id header is required' });
    return null;
  }
  req.auth = { singles_id: singlesId };
  return singlesId;
}

function corsMiddleware(allowedOrigins) {
  return (req, res, next) => {
    const origin = String(req.headers.origin ?? '').trim();
    if (isAllowedOrigin(origin, allowedOrigins)) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Vary', 'Origin');
    }
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PATCH,PUT,DELETE,OPTIONS');
    res.setHeader(
      'Access-Control-Allow-Headers',
      'Content-Type, X-Record-Vault-Singles-Id, X-Record-Vault-Storage, Access-Control-Request-Private-Network'
    );
    res.setHeader('Access-Control-Expose-Headers', 'Content-Disposition');
    res.setHeader('Access-Control-Allow-Private-Network', 'true');
    if (req.method === 'OPTIONS') {
      return res.sendStatus(204);
    }
    return next();
  };
}

export function startBridgeServer({ port = DEFAULT_PORT } = {}) {
  configureNotesVaultAccessSessionResolver(async (req, res) => bridgeSinglesId(req, res));
  configurePhotoAlbumsVaultAccessSessionResolver(async (req, res) => bridgeSinglesId(req, res));

  const allowedOrigins = parseAllowedOrigins();
  const app = express();
  app.use(corsMiddleware(allowedOrigins));
  app.get('/health', (_req, res) => {
    res.json({
      ok: true,
      service: 'record-vault-bridge',
      platform: process.platform,
      hostname: os.hostname()
    });
  });

  app.use(express.json({ limit: '400mb' }));

  // No login header required — local drive list only (127.0.0.1).
  app.get('/api/recordVault/usb/locations', listRecordVaultUsbLocationsLocal);
  app.get('/api/recordVault/usb/unlock-guard', getRecordVaultUsbUnlockGuardLocal);
  app.get('/api/photoAlbums/usb/locations', listPhotoAlbumsUsbLocationsLocal);
  app.get('/api/photoAlbums/usb/unlock-guard', getPhotoAlbumsUsbUnlockGuardLocal);

  const withSinglesId = (req, res, next) => {
    const singlesId = bridgeSinglesId(req, res);
    if (!singlesId) return;
    next();
  };

  app.use('/api/recordVault', withSinglesId);
  app.use('/api/photoAlbums', withSinglesId);

  app.get('/api/recordVault/usb/status', getRecordVaultUsbStatus);
  app.post('/api/recordVault/usb/unlock', unlockRecordVaultUsbBridge);
  app.post('/api/recordVault/usb/init', initRecordVaultUsbBridge);
  app.post('/api/recordVault/usb/logoff', logoffRecordVaultUsb);
  app.post('/api/recordVault/usb/format', formatRecordVaultUsb);
  app.get('/api/recordVault/usb/browse', browseRecordVaultUsbPath);
  app.get('/api/recordVault/usb/vault-tree', getRecordVaultUsbVaultTree);
  app.get('/api/recordVault/usb/backup-zip', downloadRecordVaultUsbBackupZip);
  app.post('/api/recordVault/usb/restore-zip', restoreRecordVaultUsbBackupZip);

  app.get('/api/recordVault', getRecordVaultTree);
  app.get('/api/recordVault/search', searchRecordVaultNotes);
  app.post('/api/recordVault/notebooks', createRecordVaultNotebook);
  app.put('/api/recordVault/notebooks/reorder', reorderRecordVaultNotebooks);
  app.patch('/api/recordVault/notebooks/:notebookId', updateRecordVaultNotebook);
  app.delete('/api/recordVault/notebooks/:notebookId', deleteRecordVaultNotebook);
  app.post('/api/recordVault/notebooks/:notebookId/notes', createRecordVaultNote);
  app.put('/api/recordVault/notebooks/:notebookId/notes/reorder', reorderRecordVaultNotes);
  app.get('/api/recordVault/notes/:noteId', getRecordVaultNote);
  app.patch('/api/recordVault/notes/:noteId', updateRecordVaultNote);
  app.post('/api/recordVault/notes/move-image', moveRecordVaultNoteImage);
  app.delete('/api/recordVault/notes/:noteId', deleteRecordVaultNote);
  app.get('/api/recordVault/notes/:noteId/image/top', getRecordVaultNoteImage);
  app.get('/api/recordVault/notes/:noteId/image/bottom', getRecordVaultNoteImage);
  app.get('/api/recordVault/notes/:noteId/image', getRecordVaultNoteImage);
  app.get('/api/recordVault/notes/:noteId/extra-images/:imageId', getRecordVaultNoteExtraImage);
  app.post('/api/recordVault/notes/:noteId/extra-images', uploadRecordVaultNoteExtraImage);
  app.delete('/api/recordVault/notes/:noteId/extra-images/:imageId', deleteRecordVaultNoteExtraImage);
  app.post('/api/recordVault/notes/:noteId/attachments', uploadRecordVaultNoteAttachment);
  app.get('/api/recordVault/notes/:noteId/attachments/:attachmentId', getRecordVaultNoteAttachment);
  app.post('/api/recordVault/notes/:noteId/attachments/:attachmentId/open-native', openRecordVaultNoteAttachmentNative);
  app.delete('/api/recordVault/notes/:noteId/attachments/:attachmentId', deleteRecordVaultNoteAttachment);
  app.post('/api/recordVault/shortcuts', createRecordVaultShortcut);
  app.put('/api/recordVault/shortcuts/reorder', reorderRecordVaultShortcuts);
  app.delete('/api/recordVault/shortcuts/:shortcutId', deleteRecordVaultShortcut);

  app.get('/api/photoAlbums/usb/status', getPhotoAlbumsUsbStatus);
  app.post('/api/photoAlbums/usb/unlock', unlockPhotoAlbumsUsbBridge);
  app.post('/api/photoAlbums/usb/init', initPhotoAlbumsUsbBridge);
  app.post('/api/photoAlbums/usb/logoff', logoffPhotoAlbumsUsb);
  app.post('/api/photoAlbums/usb/format', formatPhotoAlbumsUsb);
  app.get('/api/photoAlbums/usb/browse', browsePhotoAlbumsUsbPath);
  app.get('/api/photoAlbums/usb/vault-tree', getPhotoAlbumsUsbVaultTree);
  app.get('/api/photoAlbums/usb/album-backup-progress', getPhotoAlbumsUsbAlbumBackupProgress);
  app.get('/api/photoAlbums/usb/album-backup-zip', downloadPhotoAlbumsUsbAlbumBackupZip);
  app.get('/api/photoAlbums/usb/backup-zip', downloadPhotoAlbumsUsbBackupZip);
  app.post('/api/photoAlbums/usb/restore-zip', restorePhotoAlbumsUsbBackupZip);

  app.get('/api/photoAlbums', getPhotoAlbumsTree);
  app.get('/api/photoAlbums/search', searchPhotoAlbumsNotes);
  app.post('/api/photoAlbums/notebooks', createPhotoAlbumsNotebook);
  app.put('/api/photoAlbums/notebooks/reorder', reorderPhotoAlbumsNotebooks);
  app.patch('/api/photoAlbums/notebooks/:notebookId', updatePhotoAlbumsNotebook);
  app.delete('/api/photoAlbums/notebooks/:notebookId', deletePhotoAlbumsNotebook);
  app.post('/api/photoAlbums/notebooks/:notebookId/notes', createPhotoAlbumsNote);
  app.put('/api/photoAlbums/notebooks/:notebookId/notes/reorder', reorderPhotoAlbumsNotes);
  app.get('/api/photoAlbums/notes/:noteId', getPhotoAlbumsNote);
  app.patch('/api/photoAlbums/notes/:noteId', updatePhotoAlbumsNote);
  app.post('/api/photoAlbums/notes/move-image', movePhotoAlbumsNoteImage);
  app.delete('/api/photoAlbums/notes/:noteId', deletePhotoAlbumsNote);
  app.get('/api/photoAlbums/notes/:noteId/image/top', getPhotoAlbumsNoteImage);
  app.get('/api/photoAlbums/notes/:noteId/image/bottom', getPhotoAlbumsNoteImage);
  app.get('/api/photoAlbums/notes/:noteId/image', getPhotoAlbumsNoteImage);
  app.get('/api/photoAlbums/notes/:noteId/extra-images/:imageId', getPhotoAlbumsNoteExtraImage);
  app.post('/api/photoAlbums/notes/:noteId/extra-images', uploadPhotoAlbumsNoteExtraImage);
  app.delete('/api/photoAlbums/notes/:noteId/extra-images/:imageId', deletePhotoAlbumsNoteExtraImage);
  app.post('/api/photoAlbums/notes/:noteId/attachments', uploadPhotoAlbumsNoteAttachment);
  app.post(
    '/api/photoAlbums/notes/:noteId/attachments/reconcile-album-seq',
    reconcilePhotoAlbumsAlbumPhotoSeq
  );
  app.get('/api/photoAlbums/notes/:noteId/attachments/:attachmentId', getPhotoAlbumsNoteAttachment);
  app.post('/api/photoAlbums/notes/:noteId/attachments/:attachmentId/open-native', openPhotoAlbumsNoteAttachmentNative);
  app.delete('/api/photoAlbums/notes/:noteId/attachments/:attachmentId', deletePhotoAlbumsNoteAttachment);
  app.post('/api/photoAlbums/shortcuts', createPhotoAlbumsShortcut);
  app.put('/api/photoAlbums/shortcuts/reorder', reorderPhotoAlbumsShortcuts);
  app.delete('/api/photoAlbums/shortcuts/:shortcutId', deletePhotoAlbumsShortcut);

  const host = '127.0.0.1';
  app.listen(port, host, () => {
    console.log(`[record-vault-bridge] listening on http://${host}:${port}`);
    console.log(`[record-vault-bridge] allowed origins: ${allowedOrigins.join(', ')}`);
  });

  return app;
}

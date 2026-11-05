import Busboy from 'busboy';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { assembleChunkedUpload, discardChunkedUpload } from './chunkedUploadStaging.js';

/** Max sealed/plain backup zip the parser accepts (1 GiB; BACKUP_ZIP_MAX_MB overrides). */
const BACKUP_ZIP_MAX_MB_DEFAULT = 1024;
/** Read per request so ~/.ssh/be/.env is loaded before the env var is consulted. */
function backupZipMaxBytes() {
  const mb = Number(process.env.BACKUP_ZIP_MAX_MB);
  const safeMb = Number.isFinite(mb) && mb > 0 ? mb : BACKUP_ZIP_MAX_MB_DEFAULT;
  return Math.trunc(safeMb) * 1024 * 1024;
}

function formatUploadHint(contentLength) {
  const n = contentLength ? parseInt(contentLength, 10) : NaN;
  const approxMiB = Number.isFinite(n) ? (n / (1024 * 1024)).toFixed(1) : null;
  const sizeHint = approxMiB ? ` (~${approxMiB} MiB request)` : '';
  return (
    `No backup zip file uploaded${sizeHint}. ` +
    'If the file is large, increase nginx/HAProxy client_max_body_size (e.g. client_max_body_size 200M;) ' +
    'and ensure the browser sends multipart/form-data with field name "backup".'
  );
}

/**
 * Parse multipart field `backup` into a temp zip file path. Zips over Cloudflare's 100 MB request
 * limit arrive instead as `chunkedUploadId` + `chunkCount` + `totalBytes` fields referencing parts
 * already sent to PUT /api/tutadrive/upload-chunk.
 */
export function parseVaultBackupZipUpload(req) {
  const maxZipBytes = backupZipMaxBytes();
  return new Promise((resolve, reject) => {
    const contentType = String(req.headers['content-type'] || '');
    const contentLength = req.get?.('content-length') || req.headers['content-length'] || '';
    if (!contentType.includes('multipart/form-data')) {
      reject(
        new Error(
          `Expected multipart/form-data upload (got ${contentType || 'no Content-Type'}). ` +
            'Large TutaDrive backups must use FormData field "backup".'
        )
      );
      return;
    }

    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rv-restore-upload-'));
    const zipPath = path.join(tmpDir, 'backup.zip');
    let fileReceived = false;
    let fileTruncated = false;
    let bytesWritten = 0;
    let note = '';
    let hint = '';
    let dateStamp = '';
    let originalFileName = '';
    let chunkedUploadId = '';
    let chunkCount = '';
    let chunkedTotalBytes = '';
    let settled = false;
    /** Resolves once the temp zip is fully flushed to disk (busboy `finish` can fire earlier). */
    let fileWritten = Promise.resolve();

    const fail = (err) => {
      if (settled) return;
      settled = true;
      req.unpipe(busboy);
      fs.rmSync(tmpDir, { recursive: true, force: true });
      reject(err);
    };

    const busboy = Busboy({
      headers: req.headers,
      limits: { files: 1, fileSize: maxZipBytes }
    });
    busboy.on('field', (fieldname, value) => {
      if (fieldname === 'note') {
        note = String(value || '');
      } else if (fieldname === 'hint') {
        hint = String(value || '');
      } else if (fieldname === 'dateStamp') {
        dateStamp = String(value || '');
      } else if (fieldname === 'chunkedUploadId') {
        chunkedUploadId = String(value || '').trim();
      } else if (fieldname === 'chunkCount') {
        chunkCount = String(value || '').trim();
      } else if (fieldname === 'totalBytes') {
        chunkedTotalBytes = String(value || '').trim();
      } else if (fieldname === 'preferredFileName') {
        originalFileName = String(value || '').trim();
      }
    });
    busboy.on('file', (fieldname, stream, info) => {
      if (fieldname !== 'backup') {
        stream.resume();
        return;
      }
      if (!originalFileName && info?.filename) {
        originalFileName = String(info.filename).trim();
      }
      fileReceived = true;
      const writeStream = fs.createWriteStream(zipPath);
      fileWritten = new Promise((resolveWrite, rejectWrite) => {
        writeStream.on('close', resolveWrite);
        writeStream.on('error', rejectWrite);
        stream.on('error', rejectWrite);
      });
      fileWritten.catch(() => {});
      stream.on('data', (chunk) => {
        bytesWritten += chunk?.length || 0;
      });
      stream.on('limit', () => {
        fileTruncated = true;
      });
      stream.pipe(writeStream);
    });
    busboy.on('error', fail);
    busboy.on('finish', async () => {
      try {
        await fileWritten;
      } catch (err) {
        fail(err);
        return;
      }
      if (settled) return;
      if (fileTruncated) {
        fail(new Error(`Backup zip exceeds ${maxZipBytes / (1024 * 1024)} MiB limit`));
        return;
      }
      if (!fileReceived && chunkedUploadId) {
        const singlesId = Number(req.auth?.singles_id);
        try {
          bytesWritten = await assembleChunkedUpload(singlesId, chunkedUploadId, {
            chunkCount,
            totalBytes: chunkedTotalBytes,
            maxBytes: maxZipBytes,
            destPath: zipPath
          });
          req.chunkedUploadBytes = bytesWritten;
        } catch (err) {
          discardChunkedUpload(singlesId, chunkedUploadId);
          fail(err);
          return;
        }
        if (settled) return;
      }
      if (!(fileReceived || chunkedUploadId) || !fs.existsSync(zipPath) || !fs.statSync(zipPath).size) {
        fail(new Error(formatUploadHint(contentLength)));
        return;
      }
      settled = true;
      resolve({
        tmpDir,
        zipPath,
        sizeBytes: fs.statSync(zipPath).size,
        bytesWritten,
        note: note.trim(),
        hint: hint.trim(),
        dateStamp: dateStamp.trim(),
        originalFileName: originalFileName.trim()
      });
    });
    req.on('error', fail);
    req.on('aborted', () => fail(new Error('Upload was interrupted before the backup zip finished arriving')));
    req.pipe(busboy);
  });
}

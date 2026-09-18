import Busboy from 'busboy';
import fs from 'fs';
import os from 'os';
import path from 'path';

/** Max backup zip the parser accepts (500 MiB). */
const MAX_BACKUP_ZIP_BYTES = 500 * 1024 * 1024;

function formatUploadHint(contentLength, detail = '') {
  const n = contentLength ? parseInt(contentLength, 10) : NaN;
  const approxMiB = Number.isFinite(n) ? (n / (1024 * 1024)).toFixed(1) : null;
  const sizeHint = approxMiB ? ` (~${approxMiB} MiB request)` : '';
  const extra = detail ? ` ${detail}` : '';
  return (
    `No backup zip file uploaded${sizeHint}.${extra} ` +
    'Use multipart/form-data with field name "backup". ' +
    'If the file is large, increase nginx/HAProxy client_max_body_size (e.g. client_max_body_size 200M;).'
  );
}

/** Parse multipart field `backup` into a temp zip file path. */
export function parseOneDriveBackupZipUpload(req) {
  return new Promise((resolve, reject) => {
    const contentType = String(req.headers['content-type'] || '');
    const contentLength = req.get?.('content-length') || req.headers['content-length'] || '';
    if (!contentType.includes('multipart/form-data')) {
      reject(
        new Error(
          `Expected multipart/form-data upload (got ${contentType || 'no Content-Type'}). ` +
            'Restore must send FormData field "backup".'
        )
      );
      return;
    }

    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pa-restore-upload-'));
    const zipPath = path.join(tmpDir, 'backup.zip');
    let fileReceived = false;
    let fileBuffer = null;
    let skippedFields = [];

    const busboy = Busboy({
      headers: req.headers,
      limits: { files: 1, fileSize: MAX_BACKUP_ZIP_BYTES }
    });

    busboy.on('file', (fieldname, stream) => {
      if (fieldname !== 'backup') {
        skippedFields.push(String(fieldname || ''));
        stream.resume();
        return;
      }
      fileReceived = true;
      const chunks = [];
      stream.on('data', (chunk) => chunks.push(chunk));
      stream.on('end', () => {
        fileBuffer = Buffer.concat(chunks);
      });
    });

    busboy.on('error', (err) => {
      if (err?.code === 'LIMIT_FILE_SIZE') {
        reject(new Error(`Backup zip exceeds ${MAX_BACKUP_ZIP_BYTES / (1024 * 1024)} MiB limit`));
        return;
      }
      reject(err);
    });

    busboy.on('finish', () => {
      try {
        if (!fileReceived || !fileBuffer?.length) {
          fs.rmSync(tmpDir, { recursive: true, force: true });
          const detail =
            skippedFields.length > 0
              ? `Found field(s) ${skippedFields.join(', ')} but not "backup".`
              : 'The upload body had no file part.';
          reject(new Error(formatUploadHint(contentLength, detail)));
          return;
        }
        fs.writeFileSync(zipPath, fileBuffer);
        resolve({ tmpDir, zipPath, sizeBytes: fileBuffer.length });
      } catch (err) {
        fs.rmSync(tmpDir, { recursive: true, force: true });
        reject(err);
      }
    });

    req.on('error', reject);
    req.pipe(busboy);
  });
}

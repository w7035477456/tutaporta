import Busboy from 'busboy';
import fs from 'fs';
import os from 'os';
import path from 'path';

/** Max sealed/plain backup zip the parser accepts (500 MiB). */
const MAX_BACKUP_ZIP_BYTES = 500 * 1024 * 1024;

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

/** Parse multipart field `backup` into a temp zip file path. */
export function parseOneDriveBackupZipUpload(req) {
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
    let writeError = null;
    let bytesWritten = 0;

    const busboy = Busboy({
      headers: req.headers,
      limits: { files: 1, fileSize: MAX_BACKUP_ZIP_BYTES }
    });
    busboy.on('file', (fieldname, stream) => {
      if (fieldname !== 'backup') {
        stream.resume();
        return;
      }
      fileReceived = true;
      const writeStream = fs.createWriteStream(zipPath);
      stream.on('data', (chunk) => {
        bytesWritten += chunk?.length || 0;
      });
      stream.pipe(writeStream);
      writeStream.on('error', (err) => {
        writeError = err;
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
      if (writeError) {
        fs.rmSync(tmpDir, { recursive: true, force: true });
        reject(writeError);
        return;
      }
      if (!fileReceived || !fs.existsSync(zipPath)) {
        fs.rmSync(tmpDir, { recursive: true, force: true });
        reject(new Error(formatUploadHint(contentLength)));
        return;
      }
      const st = fs.statSync(zipPath);
      if (!st.size) {
        fs.rmSync(tmpDir, { recursive: true, force: true });
        reject(new Error(formatUploadHint(contentLength)));
        return;
      }
      resolve({ tmpDir, zipPath, sizeBytes: st.size, bytesWritten });
    });
    req.pipe(busboy);
  });
}

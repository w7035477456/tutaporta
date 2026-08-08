import Busboy from 'busboy';
import fs from 'fs';
import os from 'os';
import path from 'path';

/** Parse multipart field `backup` into a temp zip file path. */
export function parseOneDriveBackupZipUpload(req) {
  return new Promise((resolve, reject) => {
    const contentType = String(req.headers['content-type'] || '');
    if (!contentType.includes('multipart/form-data')) {
      reject(new Error('Expected multipart/form-data upload'));
      return;
    }

    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rv-restore-upload-'));
    const zipPath = path.join(tmpDir, 'backup.zip');
    let fileReceived = false;
    let writeError = null;

    const busboy = Busboy({ headers: req.headers });
    busboy.on('file', (fieldname, stream) => {
      if (fieldname !== 'backup') {
        stream.resume();
        return;
      }
      fileReceived = true;
      const writeStream = fs.createWriteStream(zipPath);
      stream.pipe(writeStream);
      writeStream.on('error', (err) => {
        writeError = err;
      });
    });
    busboy.on('error', reject);
    busboy.on('finish', () => {
      if (writeError) {
        fs.rmSync(tmpDir, { recursive: true, force: true });
        reject(writeError);
        return;
      }
      if (!fileReceived || !fs.existsSync(zipPath)) {
        fs.rmSync(tmpDir, { recursive: true, force: true });
        reject(new Error('No backup zip file uploaded'));
        return;
      }
      resolve({ tmpDir, zipPath });
    });
    req.pipe(busboy);
  });
}

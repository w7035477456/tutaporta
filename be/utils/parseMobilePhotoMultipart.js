import Busboy from 'busboy';

/**
 * Parse multipart field "photo" into req.body.image (data URL) for uploadPhoto().
 * No-op when Content-Type is not multipart/form-data.
 */
export function parseMobilePhotoMultipart(req) {
  const ct = String(req.headers['content-type'] || '');
  if (!ct.includes('multipart/form-data')) {
    return Promise.resolve(false);
  }

  return new Promise((resolve, reject) => {
    const busboy = Busboy({ headers: req.headers });
    let fileBuffer = null;
    let mimeType = 'image/jpeg';
    let seenFile = false;

    let originalFileName = '';

    busboy.on('file', (fieldname, stream, info) => {
      if (fieldname !== 'photo') {
        stream.resume();
        return;
      }
      seenFile = true;
      mimeType = info.mimeType || mimeType;
      originalFileName = String(info.filename || '').trim();
      const chunks = [];
      stream.on('data', (chunk) => chunks.push(chunk));
      stream.on('end', () => {
        fileBuffer = Buffer.concat(chunks);
      });
    });

    busboy.on('error', reject);

    busboy.on('finish', () => {
      if (!seenFile || !fileBuffer?.length) {
        reject(new Error('Missing photo file'));
        return;
      }
      const base64 = fileBuffer.toString('base64');
      req.body = req.body || {};
      req.body.image = `data:${mimeType};base64,${base64}`;
      if (originalFileName) {
        req.body.originalFileName = originalFileName;
        const dot = originalFileName.lastIndexOf('.');
        if (dot > 0 && dot < originalFileName.length - 1) {
          req.body.file_extension = originalFileName.slice(dot + 1).toLowerCase();
        }
      }
      resolve(true);
    });

    req.pipe(busboy);
  });
}

/** fetch() with Accept: application/json expects a JSON body, not a 303 back to the upload page. */
export function wantsMobilePhotoUploadJsonResponse(req) {
  return String(req.headers?.accept || '')
    .toLowerCase()
    .includes('application/json');
}

/** Redirect back to phone upload page after native form POST (avoids JSON on screen). */
export function installMobilePhotoFormRedirect(req, res, token) {
  const ct = String(req.headers['content-type'] || '');
  if (!ct.includes('multipart/form-data')) return;
  if (wantsMobilePhotoUploadJsonResponse(req)) return;

  const tokenQ = encodeURIComponent(String(token ?? '').trim());
  const go = (suffix) => {
    res.redirect(303, `/mobilePhotoUpload?token=${tokenQ}${suffix}`);
  };

  const origStatus = res.status.bind(res);
  res.status = function status(code) {
    res.statusCode = code;
    return {
      json(body) {
        if (code >= 200 && code < 300) {
          go('&uploaded=1');
          return res;
        }
        const msg = encodeURIComponent(String(body?.error || body?.message || 'Upload failed').slice(0, 200));
        go(`&error=${msg}`);
        return res;
      }
    };
  };

  // uploadPhoto also calls res.status(500).json directly via orig - patched above
  res.json = function json(body) {
    const code = res.statusCode || 200;
    if (code >= 200 && code < 300) {
      go('&uploaded=1');
      return res;
    }
    const msg = encodeURIComponent(String(body?.error || 'Upload failed').slice(0, 200));
    go(`&error=${msg}`);
    return res;
  };
}

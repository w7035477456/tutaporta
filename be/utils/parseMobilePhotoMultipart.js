import Busboy from 'busboy';
import path from 'path';

import {
  extToContentType,
  normalizePhotoExtension
} from './albumUploadFormats.js';
import {
  debugMobilePhotoUpload,
  formatMobileUploadBytes,
  traceMobilePhotoUpload,
  warnMobilePhotoUpload
} from './mobilePhotoUploadLog.js';

function extensionOf(fileName) {
  const base = path.basename(String(fileName || ''));
  const dot = base.lastIndexOf('.');
  if (dot < 0) return '';
  return normalizePhotoExtension(base.slice(dot + 1));
}

/**
 * Parse multipart field "photo" into req._mobilePhotoBuffer for uploadPhoto().
 * No-op when Content-Type is not multipart/form-data.
 */
export function parseMobilePhotoMultipart(req) {
  const ct = String(req.headers['content-type'] || '');
  if (!ct.includes('multipart/form-data')) {
    debugMobilePhotoUpload('multipart parse SKIP (not multipart)', { contentType: ct || null });
    return Promise.resolve(false);
  }

  const cl = req.headers['content-length'];
  traceMobilePhotoUpload('multipart parse START', {
    contentType: ct.slice(0, 120),
    contentLength: cl || null,
    contentLengthLabel: cl ? formatMobileUploadBytes(Number(cl)) : null
  });

  return new Promise((resolve, reject) => {
    const busboy = Busboy({ headers: req.headers });
    let fileBuffer = null;
    let mimeType = 'image/jpeg';
    let seenFile = false;
    let skippedFields = [];

    let originalFileName = '';

    busboy.on('file', (fieldname, stream, info) => {
      if (fieldname !== 'photo') {
        skippedFields.push(fieldname);
        stream.resume();
        return;
      }
      seenFile = true;
      mimeType = info.mimeType || mimeType;
      originalFileName = String(info.filename || '').trim();
      traceMobilePhotoUpload('multipart file field', {
        fieldname,
        mimeType,
        originalFileName: originalFileName || '(none)',
        encoding: info.encoding
      });
      const chunks = [];
      stream.on('data', (chunk) => chunks.push(chunk));
      stream.on('end', () => {
        fileBuffer = Buffer.concat(chunks);
        traceMobilePhotoUpload('multipart file end', {
          bytes: fileBuffer.length,
          sizeLabel: formatMobileUploadBytes(fileBuffer.length)
        });
      });
    });

    busboy.on('error', (err) => {
      warnMobilePhotoUpload('multipart busboy error', {
        message: err?.message ?? err,
        seenFile,
        skippedFields
      });
      reject(err);
    });

    busboy.on('finish', () => {
      if (!seenFile || !fileBuffer?.length) {
        warnMobilePhotoUpload('multipart parse FAIL missing file', {
          seenFile,
          bufferBytes: fileBuffer?.length ?? 0,
          skippedFields
        });
        reject(new Error('Missing photo file'));
        return;
      }
      const ext = extensionOf(originalFileName);
      let resolvedMime = mimeType;
      if (ext) {
        const fromExt = extToContentType(ext);
        const genericMime = !resolvedMime || resolvedMime === 'application/octet-stream' || resolvedMime === 'image/jpeg';
        if (genericMime && fromExt && fromExt !== 'application/octet-stream') {
          resolvedMime = fromExt;
        }
      }
      req.body = req.body || {};
      req._mobilePhotoBuffer = fileBuffer;
      req._mobilePhotoContentType = resolvedMime;
      if (originalFileName) {
        req.body.originalFileName = originalFileName;
        if (ext) {
          req.body.file_extension = ext;
        }
      }
      traceMobilePhotoUpload('multipart parse OK', {
        bytes: fileBuffer.length,
        sizeLabel: formatMobileUploadBytes(fileBuffer.length),
        resolvedMime,
        ext: ext || null,
        originalFileName: originalFileName || null
      });
      resolve(true);
    });

    req.on('error', (err) => {
      warnMobilePhotoUpload('multipart req stream error', { message: err?.message ?? err });
    });
    req.pipe(busboy);
  });
}

/** fetch() with Accept: application/json — return JSON instead of redirecting to the SPA. */
export function wantsMobilePhotoJsonResponse(req) {
  return String(req.headers?.accept || '')
    .toLowerCase()
    .includes('application/json');
}

/** Redirect back to phone upload page after native HTML form POST (avoids JSON on screen). */
export function installMobilePhotoFormRedirect(req, res, token) {
  const ct = String(req.headers['content-type'] || '');
  if (!ct.includes('multipart/form-data')) return;
  if (wantsMobilePhotoJsonResponse(req)) {
    traceMobilePhotoUpload('form redirect SKIP (client wants JSON)', {
      accept: String(req.headers?.accept ?? '').slice(0, 80)
    });
    return;
  }
  traceMobilePhotoUpload('form redirect installed (HTML form POST)', {
    token: String(token ?? '').slice(0, 10)
  });

  const tokenQ = encodeURIComponent(String(token ?? '').trim());
  const go = (suffix) => {
    const target = `/mobilePhotoUpload?token=${tokenQ}${suffix}`;
    traceMobilePhotoUpload('form redirect GO', { target: target.slice(0, 120), suffix });
    res.redirect(303, target);
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

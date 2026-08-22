import {
  infoMobilePhotoUpload,
  mobileUploadRequestContext,
  traceMobilePhotoUpload,
  warnMobilePhotoUpload
} from '../utils/mobilePhotoUploadLog.js';

function isMobilePhotoUploadApiPath(path) {
  return String(path || '').startsWith('/api/mobilePhotoUpload');
}

/**
 * Always-on request/response tracing for phone QR upload API (not gated by PM2_LOG_LEVEL).
 * Logs at INFO via console.log so PM2 app-out shows the full pipeline.
 */
export function mobilePhotoUploadTraceMiddleware() {
  return function mobilePhotoUploadTrace(req, res, next) {
    if (!isMobilePhotoUploadApiPath(req.path)) return next();

    const startedAt = Date.now();
    const ctx = mobileUploadRequestContext(req);
    traceMobilePhotoUpload('REQUEST', ctx);

    const origJson = res.json.bind(res);
    const origStatus = res.status.bind(res);
    let statusCode = res.statusCode || 200;
    let loggedJson = false;

    res.status = function patchedStatus(code) {
      statusCode = code;
      return origStatus(code);
    };

    res.json = function patchedJson(body) {
      loggedJson = true;
      const elapsedMs = Date.now() - startedAt;
      const level = statusCode >= 500 ? 'error' : statusCode >= 400 ? 'warn' : 'ok';
      const payload = {
        ...ctx,
        statusCode,
        elapsedMs,
        responseError: body?.error || body?.message || null,
        responseCode: body?.code || null
      };
      if (level === 'error') {
        warnMobilePhotoUpload('RESPONSE FAIL', payload);
      } else if (level === 'warn') {
        warnMobilePhotoUpload('RESPONSE client error', payload);
      } else {
        infoMobilePhotoUpload('RESPONSE OK', payload);
      }
      return origJson(body);
    };

    res.on('finish', () => {
      const code = res.statusCode || statusCode;
      if (loggedJson) return;
      if (code === 200 && req.method === 'GET' && req.path === '/api/mobilePhotoUpload/ping') return;
      const elapsedMs = Date.now() - startedAt;
      const contentType = String(res.getHeader('content-type') || '');
      if (contentType.includes('text/html')) {
        warnMobilePhotoUpload('RESPONSE HTML (not JSON)', {
          ...ctx,
          statusCode: code,
          elapsedMs,
          contentType,
          hint: 'Phone upload API must return JSON — check HAProxy/nginx/Cloudflare or unmatched route'
        });
      } else if (code >= 300 && code < 400) {
        infoMobilePhotoUpload('RESPONSE redirect', {
          ...ctx,
          statusCode: code,
          elapsedMs,
          location: String(res.getHeader('location') || '').slice(0, 200)
        });
      }
    });

    next();
  };
}

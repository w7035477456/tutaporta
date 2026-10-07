/** Longest time to keep reading an unconsumed upload body before replying anyway. */
const DRAIN_MAX_MS = 120_000;

/**
 * Express middleware for large multipart upload routes.
 *
 * If a response (auth failure, vault lock, validation error, parser error) is sent while the
 * request body is still arriving, Node closes the socket mid-upload and nginx / HAProxy /
 * Cloudflare report a bare 502 instead of the real error. This defers `res.end` until the
 * remaining body has been read and discarded, so the client receives the actual status + JSON.
 */
export function drainUploadBodyBeforeResponse(req, res, next) {
  const originalEnd = res.end;
  let deferred = false;

  res.end = function endAfterRequestBodyDrained(...args) {
    if (deferred || req.complete || req.readableEnded || req.destroyed) {
      return originalEnd.apply(this, args);
    }
    deferred = true;
    console.error(
      `[upload-drain] ${req.method} ${req.path} responding ${res.statusCode} before upload body finished — ` +
        `draining rest of body (content-length ${req.get('content-length') || '?'}) so client sees the real error`
    );

    let finished = false;
    const finish = () => {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      req.off('end', finish);
      req.off('close', finish);
      req.off('error', finish);
      originalEnd.apply(res, args);
    };
    const timer = setTimeout(finish, DRAIN_MAX_MS);
    req.once('end', finish);
    req.once('close', finish);
    req.once('error', finish);
    req.unpipe();
    req.resume();
    return res;
  };

  next();
}

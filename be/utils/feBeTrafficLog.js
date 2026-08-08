/** Console logging for browser ↔ Node traffic when FE_BE_TRAFFIC_LOG=true in ~/.ssh/be/.env */

const PREFIX = '>>>>>';

export function isFeBeTrafficLogEnabled() {
  return String(process.env.FE_BE_TRAFFIC_LOG || '').trim().toLowerCase() === 'true';
}

function logLine(parts) {
  console.log(PREFIX, ...parts);
}

function summarizeBody(body) {
  if (body == null) return '';
  if (typeof body === 'string') {
    const t = body.trim();
    if (t.length > 120) return ` bodyChars=${t.length}`;
    return ` body=${JSON.stringify(t)}`;
  }
  if (Buffer.isBuffer(body)) return ` bodyBytes=${body.length}`;
  try {
    const s = JSON.stringify(body);
    if (s.length > 200) return ` bodyChars=${s.length}`;
    return ` body=${s}`;
  } catch {
    return ' body=[unserializable]';
  }
}

/** Express middleware: log each HTTP request/response when FE_BE_TRAFFIC_LOG=true (checked per request). */
export function feBeTrafficLogMiddleware() {
  return (req, res, next) => {
    if (!isFeBeTrafficLogEnabled()) return next();

    const started = Date.now();
    const method = req.method;
    const url = req.originalUrl || req.url || req.path;

    if (!String(url).startsWith('/api')) {
      return next();
    }

    logLine(['[BE HTTP in]', method, url]);

    res.on('finish', () => {
      const ms = Date.now() - started;
      logLine(['[BE HTTP out]', method, url, res.statusCode, `${ms}ms`]);
    });

    next();
  };
}

/** Call once at startup so PM2 logs show whether >>>>> traffic lines are expected. */
export function logFeBeTrafficLogStartupStatus() {
  if (isFeBeTrafficLogEnabled()) {
    logLine(['[BE startup] FE_BE_TRAFFIC_LOG=true — API HTTP traffic will log with >>>>> prefix']);
  } else {
    console.log('[startup] FE_BE_TRAFFIC_LOG=false (~/.ssh/be/.env) — no >>>>> traffic lines; set true and restart Node');
  }
}

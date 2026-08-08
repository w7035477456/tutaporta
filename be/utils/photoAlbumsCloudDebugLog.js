import appLog from '../logger.js';

function formatDetail(detail) {
  if (detail == null) return '';
  if (typeof detail === 'string') return detail;
  try {
    return JSON.stringify(detail);
  } catch {
    return String(detail);
  }
}

function formatErr(err) {
  if (!err) return { message: 'unknown error' };
  return {
    message: err?.message || String(err),
    stack: err?.stack || null,
    code: err?.code || null
  };
}

/** INFO — major Connect / Test Write steps (visible at PM2_LOG_LEVEL=INFO). */
export function rvCloudLog(provider, step, detail) {
  const suffix = formatDetail(detail);
  appLog.info(`[PhotoAlbumsCloud:${provider}] ${step}${suffix ? ` — ${suffix}` : ''}`);
}

/** DEBUG — granular sub-steps (visible at PM2_LOG_LEVEL=DEBUG or TRACE). */
export function rvCloudDebug(provider, step, detail) {
  const suffix = formatDetail(detail);
  appLog.debug(`[PhotoAlbumsCloud:${provider}] ${step}${suffix ? ` — ${suffix}` : ''}`);
}

export function rvCloudWarn(provider, step, detail) {
  const suffix = formatDetail(detail);
  appLog.warn(`[PhotoAlbumsCloud:${provider}] ${step}${suffix ? ` — ${suffix}` : ''}`);
}

export function rvCloudError(provider, step, err, extra) {
  appLog.error(`[PhotoAlbumsCloud:${provider}] ${step}`, {
    ...formatErr(err),
    extra: extra || null
  });
}

/** Safe cloud connection snapshot — never logs tokens. */
export function rvCloudConnSnapshot(provider, conn) {
  if (!conn) return { connected: false };
  return {
    connected: Boolean(conn.refreshToken),
    email: conn.email || null,
    folderId: conn.folderId || conn.folderPath || null,
    hasRefreshToken: Boolean(conn.refreshToken)
  };
}

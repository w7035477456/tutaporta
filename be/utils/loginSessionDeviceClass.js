/** Active login slots: one mobile + one desktop per account (same credentials). */

export const LOGIN_SESSION_DEVICE_MOBILE = 'mobile';
export const LOGIN_SESSION_DEVICE_DESKTOP = 'desktop';

const VALID = new Set([LOGIN_SESSION_DEVICE_MOBILE, LOGIN_SESSION_DEVICE_DESKTOP]);

export function normalizeLoginSessionDeviceClass(value) {
  const raw = String(value ?? '')
    .trim()
    .toLowerCase();
  if (raw === LOGIN_SESSION_DEVICE_MOBILE || raw === 'm') return LOGIN_SESSION_DEVICE_MOBILE;
  if (raw === LOGIN_SESSION_DEVICE_DESKTOP || raw === 'd') return LOGIN_SESSION_DEVICE_DESKTOP;
  return null;
}

/** Infer mobile vs desktop from User-Agent when the client does not send a class. */
export function inferLoginSessionDeviceClassFromUserAgent(userAgent) {
  const ua = String(userAgent ?? '');
  if (!ua.trim()) return LOGIN_SESSION_DEVICE_DESKTOP;
  if (/Mobile|Android|iPhone|iPod|IEMobile|Opera Mini|webOS|BlackBerry|Windows Phone/i.test(ua)) {
    return LOGIN_SESSION_DEVICE_MOBILE;
  }
  if (/iPad|Tablet|PlayBook|Silk/i.test(ua)) {
    return LOGIN_SESSION_DEVICE_MOBILE;
  }
  return LOGIN_SESSION_DEVICE_DESKTOP;
}

/**
 * Resolve device class for a new login or session refresh.
 * A phone / tablet User-Agent always owns the mobile slot — viewport width cannot be
 * trusted there (tablets and landscape phones are wider than the FE compact rule).
 * Otherwise the client hint wins, so a narrow desktop window or device emulation
 * without a UA override still takes the mobile slot.
 */
export function resolveLoginSessionDeviceClassFromReq(req) {
  if (inferLoginSessionDeviceClassFromUserAgent(req?.headers?.['user-agent']) === LOGIN_SESSION_DEVICE_MOBILE) {
    return LOGIN_SESSION_DEVICE_MOBILE;
  }

  const fromBody = normalizeLoginSessionDeviceClass(req?.body?.clientSessionDevice);
  if (fromBody) return fromBody;

  const fromHeader = normalizeLoginSessionDeviceClass(req?.headers?.['x-client-session-device']);
  if (fromHeader) return fromHeader;

  return LOGIN_SESSION_DEVICE_DESKTOP;
}

export function resolveLoginSessionDeviceClassFromJwt(decoded) {
  return normalizeLoginSessionDeviceClass(decoded?.session_device_class);
}

export function isValidLoginSessionDeviceClass(value) {
  return VALID.has(normalizeLoginSessionDeviceClass(value));
}

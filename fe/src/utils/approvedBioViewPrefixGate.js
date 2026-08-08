import api from 'api/axios';

/** Real members have prefix 1–99; prefix 0 is demo/testing (excluded from bio exchange). */
export function canBypassApprovedBioPrefixGate(viewerPrefix) {
  const prefix = Number(viewerPrefix);
  return Number.isFinite(prefix) && prefix !== 0;
}

export function approvedBioPrefixGateMessage() {
  return 'Error, user have not approved viewing bio.';
}

/**
 * Demo/testing sender (prefix 0) may only unlock approved bios for other prefix-0 accounts.
 * @returns {{ ok: true } | { ok: false, message: string }}
 */
export function checkApprovedBioPrefixGate(viewerPrefix, targetPrefix) {
  if (canBypassApprovedBioPrefixGate(viewerPrefix)) {
    return { ok: true };
  }
  const target = Number(targetPrefix);
  if (!Number.isFinite(target) || target !== 0) {
    return { ok: false, message: approvedBioPrefixGateMessage() };
  }
  return { ok: true };
}

/** Auth user may omit prefix; load from settings profile when missing. */
export async function resolveViewerPrefixForBioUnlock(user) {
  const fromUser = Number(user?.prefix);
  if (Number.isFinite(fromUser)) return fromUser;
  try {
    const { data } = await api.get('/api/settings/profile');
    const fromProfile = Number(data?.prefix);
    return Number.isFinite(fromProfile) ? fromProfile : null;
  } catch {
    return null;
  }
}

import { formatAliasWithMemberCode } from 'utils/memberLabel';

/** JWT role === 'Admin' (impersonation or elevated admin session). */
export function isAdminSession(user) {
  return String(user?.role ?? '').trim() === 'Admin';
}

/** Synced from AuthContext — browser API rate limit bypass for Admin sessions. */
let clientApiRateLimitBypassActive = false;

export function syncClientApiRateLimitBypass(user) {
  clientApiRateLimitBypassActive = isAdminSession(user);
  return clientApiRateLimitBypassActive;
}

export function isClientApiRateLimitBypassed() {
  return clientApiRateLimitBypassActive;
}

/** Global tools login (login id "admin"). */
export function isToolsOnlyAdminSession(user) {
  return Boolean(user?.tools_only) && isAdminSession(user);
}

export function getImpersonatedByAdminId(user) {
  const raw = user?.impersonated_by_admin_id;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? Math.trunc(n) : null;
}

/** Admin JWT impersonation (impersonated_by_admin_id is always set, including 0 for global gate). */
export function isImpersonationSession(user) {
  return isAdminSession(user) && !isToolsOnlyAdminSession(user);
}

/** Admin impersonating a member with singles_id — matches BE isAdminImpersonationSession (Rekognition bypass UI). */
export function isAdminImpersonationBypassSession(user) {
  if (!user || isToolsOnlyAdminSession(user) || !isAdminSession(user)) return false;
  const id = Number(user.singles_id);
  return Number.isFinite(id) && id >= 1;
}

export function formatAdminImpersonationBannerLabel(user) {
  return (
    formatAliasWithMemberCode({
      alias: user?.alias,
      prefix: user?.prefix,
      memberId: user?.member_id,
      singlesId: user?.singles_id
    }) || (user?.singles_id != null ? `User ${user.singles_id}` : 'this member')
  );
}

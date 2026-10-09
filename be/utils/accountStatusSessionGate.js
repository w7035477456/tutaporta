import { isSinglesStatusForceLogout, singlesStatusBlockedMessage } from './singlesStatus.js';

/**
 * Error text when an open member session must end because singles.status is a force-logout
 * status (suspend / inactive / abandon / blank / under18 / unknown / other); null otherwise.
 * Admin sessions (tools-only and impersonation) are never ended here.
 * @param {{ status?: unknown, role?: string, tools_only?: boolean } | null} authUser
 * @returns {string | null}
 */
export function accountStatusSessionBlockMessage(authUser) {
  if (!authUser || authUser.tools_only === true || authUser.role === 'Admin') return null;
  return isSinglesStatusForceLogout(authUser.status) ? singlesStatusBlockedMessage(authUser.status) : null;
}

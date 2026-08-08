/**
 * MeasureOne — mirrors node-quickstart-react env names where helpful.
 *
 * Backend (~/.ssh/be/.env):
 *   MEASUREONE_CLIENT_ID  (or M1_CLIENT_ID)
 *   MEASUREONE_CLIENT_SECRET  (or M1_CLIENT_SECRET)
 *   MEASUREONE_API_URL  (or M1_API_URL, default staging: https://api-stg.measureone.com)
 *   MEASUREONE_HOST_NAME  (optional; derived from MEASUREONE_API_URL if omitted)
 *   MEASUREONE_LINK_SCRIPT_URL
 *   MEASUREONE_MOCK=true  (force local demo; without credentials, mock auto-enables in non-production)
 *
 * Frontend (fe/.env):
 *   VITE_MEASUREONE_QUICKSTART_URL — optional external quickstart app URL
 *     (e.g. http://localhost:3001). When set, the MeasureOne link opens that app
 *     with access_key / host_name / datarequest_id query params.
 */

export function getMeasureOneQuickstartUrl() {
  const raw = String(import.meta.env.VITE_MEASUREONE_QUICKSTART_URL ?? '').trim();
  return raw ? raw.replace(/\/+$/, '') : '';
}

/** Public site origin for email links and OAuth postMessage (no trailing slash). */
function parseOriginList(raw) {
  return String(raw || '')
    .split(',')
    .map((item) => String(item || '').trim().replace(/\/$/, ''))
    .filter(Boolean);
}

/** Mac/local `npm run dev` — email links should open Vite, not production. */
function localDevFrontendOrigin() {
  if (String(process.env.RUN_LOCAL_API_DEV || '').trim() !== '1') return null;
  const origins = parseOriginList(process.env.DEV_ALLOWED_ORIGINS);
  const viteOrigin = origins.find((o) => /:3000$/i.test(o));
  return viteOrigin || origins[0] || 'http://localhost:3000';
}

export function getPublicAppUrl() {
  const emailOverride = process.env.REGISTRATION_EMAIL_BASE_URL || process.env.EMAIL_LINK_BASE_URL;
  if (emailOverride && String(emailOverride).trim()) {
    return String(emailOverride).trim().replace(/\/$/, '');
  }

  const localDev = localDevFrontendOrigin();
  if (localDev) return localDev;

  const override = process.env.PUBLIC_APP_URL || process.env.FRONTEND_PUBLIC_URL;
  if (override && String(override).trim()) {
    return String(override).trim().replace(/\/$/, '');
  }
  if (process.env.NODE_ENV === 'production') {
    return 'https://tutamall.com';
  }
  return 'http://localhost:3000';
}

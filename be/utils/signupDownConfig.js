/** When true, new-account sign up is paused (~/.ssh/be/.env SIGNUP_DOWN). Default: false. */

export const SIGNUP_DOWN_MESSAGE =
  'Our sign up service is being upgraded. Please check back in a few days. ' +
  'Meanwhile, log in as "demo" (no password) if you want to check it out in demo mode.';

export function isSignupDownEnabled() {
  const raw = String(process.env.SIGNUP_DOWN ?? '')
    .trim()
    .replace(/;+$/, '')
    .replace(/^["']|["']$/g, '')
    .trim()
    .toLowerCase();
  return ['true', '1', 'yes', 'on'].includes(raw);
}

export function rejectWhenSignupDown(_req, res, next) {
  if (isSignupDownEnabled()) {
    return res.status(503).json({ error: SIGNUP_DOWN_MESSAGE, signupDown: true });
  }
  return next();
}

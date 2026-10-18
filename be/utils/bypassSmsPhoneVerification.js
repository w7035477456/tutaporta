const TRUTHY = ['true', '1', 'yes', 'on'];

function envFlag(name) {
  return TRUTHY.includes(String(process.env[name] ?? '').trim().toLowerCase());
}

/**
 * ~/.ssh/be/.env BYPASS_TWILIO=true (or legacy BY_PASS_SMS_PHONE_VERIFICATION=true) — skip Twilio SMS
 * during signup and treat phone verification as succeeded (dev/staging).
 */
export function isBypassSmsPhoneVerificationEnabled() {
  return envFlag('BYPASS_TWILIO') || envFlag('BY_PASS_SMS_PHONE_VERIFICATION');
}

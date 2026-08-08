/** ~/.ssh/be/.env BY_PASS_SMS_PHONE_VERIFICATION=true — skip Twilio SMS during signup (dev/staging). */
export function isBypassSmsPhoneVerificationEnabled() {
  return ['true', '1', 'yes', 'on'].includes(
    String(process.env.BY_PASS_SMS_PHONE_VERIFICATION ?? '').trim().toLowerCase()
  );
}

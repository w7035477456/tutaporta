import twilio from 'twilio';

const accountSid = String(process.env.TWILIO_ACCOUNT_SID || '').trim();
const authToken = String(process.env.TWILIO_AUTH_TOKEN || '').trim();
const serviceSid = String(process.env.TWILIO_SERVICE_SID || process.env.TWILIO_ServiceSID || '').trim();

let twilioClient = null;

function getTwilioClient() {
  if (!twilioClient) {
    twilioClient = twilio(accountSid, authToken);
  }
  return twilioClient;
}

/** ~/.ssh/be/.env BYPASS_TWILIO=true — never call Twilio; every SMS send succeeds and every code is approved. */
export function isTwilioBypassed() {
  return ['true', '1', 'yes', 'on'].includes(String(process.env.BYPASS_TWILIO ?? '').trim().toLowerCase());
}

export function isTwilioVerifyConfigured() {
  return isTwilioBypassed() || Boolean(accountSid && authToken && serviceSid);
}

export async function sendTwilioVerificationSms(toPhoneE164) {
  if (isTwilioBypassed()) {
    console.log('[twilio] BYPASS_TWILIO: SMS not sent', { to: toPhoneE164 });
    return { status: 'pending', bypassed: true };
  }
  if (!isTwilioVerifyConfigured()) {
    throw new Error('Twilio Verify is not configured. Set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_SERVICE_SID (or TWILIO_ServiceSID).');
  }
  const client = getTwilioClient();
  return client.verify.v2.services(serviceSid).verifications.create({
    to: toPhoneE164,
    channel: 'sms'
  });
}

export async function checkTwilioVerificationCode(toPhoneE164, code) {
  if (isTwilioBypassed()) {
    console.log('[twilio] BYPASS_TWILIO: code assumed approved', { to: toPhoneE164 });
    return true;
  }
  if (!isTwilioVerifyConfigured()) {
    throw new Error('Twilio Verify is not configured. Set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_SERVICE_SID (or TWILIO_ServiceSID).');
  }
  const client = getTwilioClient();
  const result = await client.verify.v2.services(serviceSid).verificationChecks.create({
    to: toPhoneE164,
    code
  });
  return result?.status === 'approved' || result?.valid === true;
}

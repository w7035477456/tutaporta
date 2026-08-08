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

export function isTwilioVerifyConfigured() {
  return Boolean(accountSid && authToken && serviceSid);
}

export async function sendTwilioVerificationSms(toPhoneE164) {
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

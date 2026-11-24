/**
 * Plain outbound SMS through Twilio Programmable Messaging (custom text).
 * Signup codes use Twilio Verify instead (lib/twilioVerifySms.js), which cannot send custom text.
 *
 * Env (~/.ssh/be/.env):
 *   TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN  — same as Verify
 *   TWILIO_PHONE_NUMBER=+1XXXXXXXXXX       — sending number (toll-free must be Toll-Free Verified)
 *   TWILIO_MESSAGING_SERVICE_SID=MG...     — optional; used instead of TWILIO_PHONE_NUMBER when set
 *   BYPASS_TWILIO=true                     — log only, never call Twilio
 */
import twilio from 'twilio';
import { isTwilioBypassed } from './twilioVerifySms.js';

let client = null;

function env(name) {
  return String(process.env[name] ?? '').trim();
}

export function isTwilioSmsConfigured() {
  if (isTwilioBypassed()) return true;
  return Boolean(
    env('TWILIO_ACCOUNT_SID') &&
      env('TWILIO_AUTH_TOKEN') &&
      (env('TWILIO_MESSAGING_SERVICE_SID') || env('TWILIO_PHONE_NUMBER'))
  );
}

/** Twilio error 21610 = recipient replied STOP. */
export function isTwilioOptOutError(err) {
  return Number(err?.code) === 21610;
}

export async function sendTwilioSms(toE164, body) {
  if (isTwilioBypassed()) {
    console.log('[twilio-sms] BYPASS_TWILIO: SMS not sent', { to: toE164, body });
    return { sid: null, bypassed: true };
  }
  if (!isTwilioSmsConfigured()) {
    throw new Error(
      'Twilio SMS is not configured. Set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN and TWILIO_PHONE_NUMBER in ~/.ssh/be/.env.'
    );
  }
  if (!client) client = twilio(env('TWILIO_ACCOUNT_SID'), env('TWILIO_AUTH_TOKEN'));
  const msg = { to: toE164, body };
  if (env('TWILIO_MESSAGING_SERVICE_SID')) msg.messagingServiceSid = env('TWILIO_MESSAGING_SERVICE_SID');
  else msg.from = env('TWILIO_PHONE_NUMBER');
  const result = await client.messages.create(msg);
  return { sid: result?.sid ?? null, bypassed: false };
}

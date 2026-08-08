import { PinpointSMSVoiceV2Client, SendTextMessageCommand } from '@aws-sdk/client-pinpoint-sms-voice-v2';

let cachedClient;

function getClient() {
  if (cachedClient) return cachedClient;
  const region = process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || 'us-east-1';
  cachedClient = new PinpointSMSVoiceV2Client({ region });
  return cachedClient;
}

/**
 * True when AWS SMS can send: origination identity is set (pool id, phone, or ARN).
 * Uses the default credential provider chain (env keys, ~/.aws/credentials, IAM role, etc.).
 */
export function isAwsSmsConfigured() {
  return Boolean(process.env.AWS_SMS_ORIGINATION_IDENTITY?.trim());
}

/**
 * Send a transactional SMS via AWS End User Messaging (Pinpoint SMS Voice V2).
 * @param {string} destinationE164 - E.164 destination (e.g. +12065550100 or +1XXXXXXXXXX)
 * @param {string} messageBody - Full message text (include OTP in body)
 */
export async function sendTransactionalSms(destinationE164, messageBody) {
  if (!isAwsSmsConfigured()) {
    throw new Error('AWS SMS is not configured (missing AWS_SMS_ORIGINATION_IDENTITY)');
  }
  const client = getClient();
  const originationIdentity = process.env.AWS_SMS_ORIGINATION_IDENTITY.trim();
  const input = {
    DestinationPhoneNumber: destinationE164,
    OriginationIdentity: originationIdentity,
    MessageBody: messageBody,
    MessageType: 'TRANSACTIONAL'
  };
  const configSet = process.env.AWS_SMS_CONFIGURATION_SET_NAME?.trim();
  if (configSet) {
    input.ConfigurationSetName = configSet;
  }
  return client.send(new SendTextMessageCommand(input));
}

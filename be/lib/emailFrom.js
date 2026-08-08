/** Canonical From address for all outbound transactional email. */
export const OUTBOUND_EMAIL_FROM_ADDRESS = 'support@onlinemall.website';

/** Nodemailer From header — every sendMail should use this. */
export const OUTBOUND_EMAIL_FROM_HEADER = `"OnlineMall.Website Support" <${OUTBOUND_EMAIL_FROM_ADDRESS}>`;

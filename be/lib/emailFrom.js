/** Canonical From address for all outbound transactional email. */
export const OUTBOUND_EMAIL_FROM_ADDRESS = 'support@tutamall.com';

/** Nodemailer From header — every sendMail should use this. */
export const OUTBOUND_EMAIL_FROM_HEADER = `"TutaMall.com Support" <${OUTBOUND_EMAIL_FROM_ADDRESS}>`;

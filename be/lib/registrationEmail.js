import { wrapEmailHtml } from './emailHtml.js';

export { getEmailLogoAttachment, getRegistrationEmailLogoAttachment } from './emailHtml.js';

function escapeHtmlAttr(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

export function buildRegistrationEmailHtml({ code, createPasswordUrl, verifyEmailUrl }) {
  const href = escapeHtmlAttr(createPasswordUrl);
  const manualVerifyUrl = escapeHtmlAttr(verifyEmailUrl);
  return wrapEmailHtml(`
      <h2 style="color: #333;">Welcome to OnlineMall.Website and Vetted Singles!</h2>
      <p>Thank you for registering. Click the button below to verify your email and continue registration with your code already filled in.</p>
      <p style="margin: 20px 0; font-size: 24px; font-weight: bold; letter-spacing: 4px;">${code}</p>
      <p style="margin: 20px 0;">
        <a href="${href}" style="display: inline-block; padding: 12px 24px; background-color: #1976d2; color: white; text-decoration: none; border-radius: 4px;">Verify account</a>
      </p>
      <p>Or copy and paste this link into your browser:</p>
      <p style="color: #666; word-break: break-all;">${createPasswordUrl}</p>
      <p style="margin-top: 20px;">If you feel link is not safe, you can just enter URL ${manualVerifyUrl} and enter code ${code} on the page.</p>
      <p style="margin-top: 30px; color: #999; font-size: 12px;">If you did not register for this account, please ignore this email.</p>
  `);
}

import { wrapEmailHtml } from './emailHtml.js';

export function buildDomainVerificationEmailHtml({ code, companyEmail }) {
  const safeEmail = String(companyEmail ?? '').replace(/</g, '&lt;');
  return wrapEmailHtml(`
      <h2 style="color: #333;">Company domain verification</h2>
      <p>Enter this code on your Self-Report-Bio page to verify your company email <strong>${safeEmail}</strong>.</p>
      <p style="margin: 20px 0; font-size: 28px; font-weight: bold; letter-spacing: 6px;">${code}</p>
      <p style="margin-top: 30px; color: #999; font-size: 12px;">If you did not request this code, you can ignore this email.</p>
  `);
}

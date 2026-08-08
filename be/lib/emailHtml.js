import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

/** CID for inline logo in all transactional emails. */
export const EMAIL_LOGO_CID = 'onlineMallWebsiteLogo';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** Inline logo from fe/src/assets/images/onlineMallWebsiteLogo.png (or EMAIL_LOGO_PATH). */
export function getEmailLogoAttachment() {
  const envPath = (process.env.EMAIL_LOGO_PATH || process.env.REGISTRATION_EMAIL_LOGO_PATH)?.trim();
  const candidates = [
    envPath,
    path.join(__dirname, '../../fe/src/assets/images/onlineMallWebsiteLogo.png')
  ].filter(Boolean);

  for (const logoPath of candidates) {
    if (fs.existsSync(logoPath)) {
      return {
        filename: 'onlineMallWebsiteLogo.png',
        path: logoPath,
        cid: EMAIL_LOGO_CID
      };
    }
  }
  return null;
}

/** @deprecated Use getEmailLogoAttachment */
export const getRegistrationEmailLogoAttachment = getEmailLogoAttachment;

export function buildEmailLogoHeaderHtml() {
  if (!getEmailLogoAttachment()) return '';
  return `<p style="margin: 0 0 24px; text-align: center;">
    <img src="cid:${EMAIL_LOGO_CID}" alt="Welcome to our OnlineMall.website" style="width: 100%; max-width: 600px; height: auto; display: block; margin: 0 auto;" />
  </p>`;
}

/**
 * Wrap email body HTML with site logo header and standard container.
 * @param {string} bodyHtml - Inner content (headings, paragraphs, tables) without outer wrapper.
 * @param {{ maxWidth?: string }} [options]
 */
export function wrapEmailHtml(bodyHtml, { maxWidth = '600px' } = {}) {
  return `<div style="font-family: Arial, sans-serif; max-width: ${maxWidth}; margin: 0 auto;">
  ${buildEmailLogoHeaderHtml()}${bodyHtml}
</div>`;
}

export function getEmailLogoAttachments() {
  const logo = getEmailLogoAttachment();
  return logo ? [logo] : [];
}

/** Attach inline logo when available (merges with existing attachments). */
export function enrichMailOptions(mailOptions) {
  const logoAttachments = getEmailLogoAttachments();
  if (!logoAttachments.length) return mailOptions;
  const existing = Array.isArray(mailOptions.attachments) ? mailOptions.attachments : [];
  const hasLogo = existing.some((a) => a?.cid === EMAIL_LOGO_CID);
  if (hasLogo) return mailOptions;
  return { ...mailOptions, attachments: [...existing, ...logoAttachments] };
}

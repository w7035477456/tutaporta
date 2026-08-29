import pool from '../db/connection.js';
import { enrichMailOptions } from './emailHtml.js';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Flatten any nodemailer address field ("A <a@b>", ["a@b"], {address}) to lowercase addresses. */
function extractAddresses(field) {
  const found = [];
  const visit = (value) => {
    if (!value) return;
    if (Array.isArray(value)) {
      value.forEach(visit);
      return;
    }
    if (typeof value === 'object') {
      visit(value.address);
      return;
    }
    for (const part of String(value).split(',')) {
      const raw = part.trim();
      if (!raw) continue;
      const angled = raw.match(/<([^>]+)>/);
      const address = (angled ? angled[1] : raw).trim().toLowerCase();
      if (EMAIL_PATTERN.test(address)) found.push(address);
    }
  };
  visit(field);
  return found;
}

function toArrayField(value) {
  if (value == null) return [];
  return Array.isArray(value) ? [...value] : [value];
}

async function lookupAltEmails(mainEmails) {
  const { rows } = await pool.query(
    `SELECT DISTINCT LOWER(BTRIM(alt_email)) AS alt_email
       FROM helloworldjunktest.singles
      WHERE LOWER(email) = ANY($1::text[])
        AND alt_email IS NOT NULL
        AND BTRIM(alt_email) <> ''`,
    [mainEmails]
  );
  return rows.map((r) => String(r.alt_email || '').trim()).filter((a) => EMAIL_PATTERN.test(a));
}

/**
 * CC singles.alt_email for every recipient whose address matches singles.email.
 * Non-members and members without an alt address are left untouched.
 */
export async function addAltEmailCopies(mailOptions) {
  const recipients = extractAddresses(mailOptions?.to);
  if (!recipients.length) return mailOptions;

  let altEmails = [];
  try {
    altEmails = await lookupAltEmails(recipients);
  } catch (err) {
    console.error('[outboundMail] alt_email lookup failed:', err?.message ?? err);
    return mailOptions;
  }
  if (!altEmails.length) return mailOptions;

  const alreadyAddressed = new Set([
    ...recipients,
    ...extractAddresses(mailOptions.cc),
    ...extractAddresses(mailOptions.bcc)
  ]);
  const additions = [...new Set(altEmails)].filter((a) => !alreadyAddressed.has(a));
  if (!additions.length) return mailOptions;

  return { ...mailOptions, cc: [...toArrayField(mailOptions.cc), ...additions] };
}

/** Single send path for all transactional mail: inline logo + alt_email copies. */
export async function sendOutboundMail(transporter, mailOptions) {
  return transporter.sendMail(await addAltEmailCopies(enrichMailOptions(mailOptions)));
}

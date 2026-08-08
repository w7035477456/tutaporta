import { wrapEmailHtml } from './emailHtml.js';
import { formatMemberDisplayCode } from '../utils/memberDisplayCode.js';

/** Breaks Gmail duplicate-content clipping that shows a "..." trim control. */
const GMAIL_CLIP_BREAK = '\u200B';

function escapeHtml(text) {
  return String(text ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Greeting slot: alias (M######) per user spec [alias (M####)]. */
export function formatReferralInviteMemberGreeting({ alias, memberId }) {
  const aliasText = String(alias ?? '').trim();
  const memberCode = formatMemberDisplayCode(memberId);
  if (aliasText && memberCode) return `${aliasText} (${memberCode})`;
  if (aliasText) return aliasText;
  return memberCode || 'Member';
}

export function buildRegistrationReferralUrl(baseUrl, myReferCode) {
  const base = String(baseUrl ?? '').trim().replace(/\/$/, '');
  const digits = String(myReferCode ?? '').replace(/\D/g, '');
  if (!/^\d{6}$/.test(digits)) return `${base}/entertoken`;
  return `${base}/entertoken?token=${encodeURIComponent(digits)}`;
}

function defaultForwardedMessage({ referralUrl, referCode }) {
  return `Hey! I've been using this great dating website to meet real, verified people.
If you sign up using my personal link below, we both each get a token to spend.
${referralUrl}
(If you don't trust link then go to this website https://OnlineMall.Website/entertoken and enter this referee code ${referCode})`;
}

function resolveForwardedMessage({ forwardedMessage, referralUrl, referCode }) {
  const custom = String(forwardedMessage ?? '').trim();
  if (custom) return custom;
  return defaultForwardedMessage({ referralUrl, referCode });
}

function splitInviteParagraphs(forwarded) {
  return String(forwarded ?? '')
    .split(/\n{2,}/)
    .map((part) => part.trim())
    .filter(Boolean);
}

/** Separate paragraphs + clip-break chars so Gmail does not collapse the body with "...". */
function invitePlainParagraphs(forwarded) {
  return splitInviteParagraphs(forwarded)
    .map((part, index) => (index === 0 ? part : `${GMAIL_CLIP_BREAK}${part}`))
    .join('\n\n');
}

function inviteHtmlParagraphs(forwarded) {
  return splitInviteParagraphs(forwarded)
    .map((part, index) => {
      const html = escapeHtml(part).replace(/\n/g, '<br />');
      const clipBreak = index > 0 ? '&#8203;' : '';
      return `<p style="color:#333; line-height:1.55; margin:0 0 14px;">${clipBreak}${html}</p>`;
    })
    .join('\n');
}

/** Plain-text body — greeting + invite draft (no "Forwarded Message" line; that triggers Gmail trim). */
export function buildReferralInviteEmailPlain({ memberGreeting, referralUrl, referCode, forwardedMessage }) {
  const forwarded = resolveForwardedMessage({ forwardedMessage, referralUrl, referCode });
  const inviteBody = invitePlainParagraphs(forwarded);
  return `Hi ${memberGreeting}, here is the invitation link you requested for your friend!
Just forward this email to them so they can sign up and you can claim your free token.

Message to share with your friend:

${inviteBody}`;
}

/** HTML body — same wording; invite copy in a single box with separate paragraphs. */
export function buildReferralInviteEmailHtml({ memberGreeting, referralUrl, referCode, forwardedMessage }) {
  const greeting = escapeHtml(memberGreeting);
  const forwarded = resolveForwardedMessage({ forwardedMessage, referralUrl, referCode });
  const inviteBody = inviteHtmlParagraphs(forwarded);
  const uniqueRef = escapeHtml(`${referCode || 'invite'}-${Date.now()}`);

  return wrapEmailHtml(`
    <!-- invite-ref:${uniqueRef} -->
    <p style="color:#333; line-height:1.5; margin:0 0 12px;">
      Hi ${greeting}, here is the invitation link you requested for your friend!<br />
      Just forward this email to them so they can sign up and you can claim your free token.
    </p>
    <div style="border:1px solid #e0e0e0; border-radius:8px; padding:16px 18px; margin:16px 0 0; background:#fafafa;">
      <p style="color:#555; font-size:14px; line-height:1.4; margin:0 0 12px; font-weight:600;">
        Message to share with your friend:
      </p>
      ${inviteBody}
    </div>
  `);
}

import { wrapEmailHtml } from './emailHtml.js';

function escapeHtml(text) {
  return String(text ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function buildPhotoAlbumsInviteAcceptUrl(baseUrl, inviteToken) {
  const base = String(baseUrl ?? '').trim().replace(/\/$/, '');
  const token = String(inviteToken ?? '').trim();
  return `${base}/photoAlbums/accept-invite?token=${encodeURIComponent(token)}`;
}

export function buildPhotoAlbumsInviteEmailPlain({
  ownerDisplayName,
  albumSetName,
  albumName,
  acceptUrl
}) {
  const owner = String(ownerDisplayName || 'A member').trim();
  const setName = String(albumSetName || 'Album set').trim();
  const title = String(albumName || 'Album').trim();
  return `${owner} invited you to view a photo album on OnlineMall.Website.

Album: ${setName} / ${title}

Open this link to accept the invitation and add the album to your Shared Album list:

${acceptUrl}

If you do not have an account yet, sign up or log in with this email address first, then open the link again.`;
}

export function buildPhotoAlbumsInviteEmailHtml({
  ownerDisplayName,
  albumSetName,
  albumName,
  acceptUrl
}) {
  const owner = escapeHtml(String(ownerDisplayName || 'A member').trim());
  const setName = escapeHtml(String(albumSetName || 'Album set').trim());
  const title = escapeHtml(String(albumName || 'Album').trim());
  const url = escapeHtml(String(acceptUrl || '').trim());
  const body = `
<p style="color:#333; line-height:1.55; margin:0 0 14px;"><strong>${owner}</strong> invited you to view a photo album on OnlineMall.Website.</p>
<p style="color:#333; line-height:1.55; margin:0 0 14px;">Album: <strong>${setName} / ${title}</strong></p>
<p style="color:#333; line-height:1.55; margin:0 0 14px;">Click below to accept and add this album to your Shared Album list:</p>
<p style="margin:0 0 18px;"><a href="${url}" style="color:#1565c0; font-weight:700;">Accept album invitation</a></p>
<p style="color:#666; font-size:13px; line-height:1.45; margin:0;">If the button does not work, copy this URL into your browser:<br />${url}</p>`;
  return wrapEmailHtml(body, { maxWidth: '600px' });
}

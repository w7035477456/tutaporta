import crypto from 'crypto';
import nodemailer from 'nodemailer';
import pool from '../../db/connection.js';
import { getDBSchema } from '../../config/envConfig.js';
import { OUTBOUND_EMAIL_FROM_HEADER } from '../../lib/emailFrom.js';
import { enrichMailOptions } from '../../lib/emailHtml.js';
import {
  buildPhotoAlbumsInviteAcceptUrl,
  buildPhotoAlbumsInviteEmailHtml,
  buildPhotoAlbumsInviteEmailPlain
} from '../../lib/photoAlbumsInviteEmail.js';
import { getPublicAppUrl } from '../../utils/publicAppUrl.js';
import { requireVaultSession } from '../../utils/photoAlbumsUsb/vaultSession.js';
import { capturePhotoAlbumsInviteSnapshot, readSharedInviteAttachmentFile } from '../../utils/photoAlbumsSharedSnapshot.js';
import { photoAlbumsInlinePreviewPayload } from '../../utils/photoAlbumsInlinePreview.js';

const LOG_PREFIX = '[photoAlbumsInvites]';

function schemaTable(name) {
  const schema = String(getDBSchema() || 'helloworldjunktest').replace(/"/g, '');
  return `"${schema}"."${name}"`;
}

function normalizeEmail(value) {
  return String(value ?? '').trim().toLowerCase();
}

function isValidEmail(value) {
  const email = normalizeEmail(value);
  return Boolean(email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email));
}

function isSmtpConfigured() {
  const smtpUser = process.env.SMTP_USER;
  const smtpPass = (process.env.SMTP_PASS || '').replace(/\s+/g, '');
  return Boolean(
    smtpUser &&
      smtpPass &&
      smtpUser !== 'your-email@gmail.com' &&
      smtpPass !== 'your-app-password'
  );
}

function createTransporter() {
  const smtpUser = process.env.SMTP_USER;
  const smtpPass = (process.env.SMTP_PASS || '').replace(/\s+/g, '');
  const smtpHost = process.env.SMTP_HOST || 'smtp.gmail.com';
  const smtpPortNum = parseInt(process.env.SMTP_PORT, 10) || 587;
  return nodemailer.createTransport({
    host: smtpHost,
    port: smtpPortNum,
    secure: false,
    auth: { user: smtpUser, pass: smtpPass }
  });
}

function formatInviteRow(row) {
  if (!row) return null;
  return {
    inviteId: Number(row.invite_id),
    inviteeEmail: String(row.invitee_email || ''),
    invitedAt: row.invited_at,
    viewCount: Number(row.view_count) || 0,
    lastViewedAt: row.last_viewed_at,
    revokedAt: row.revoked_at,
    acceptedAt: row.accepted_at,
    acceptedBySinglesId: row.accepted_by_singles_id == null ? null : Number(row.accepted_by_singles_id)
  };
}

function formatSharedAlbumRow(row) {
  if (!row) return null;
  return {
    sharedAlbumId: Number(row.shared_album_id),
    inviteId: Number(row.invite_id),
    ownerSinglesId: Number(row.owner_singles_id),
    storageType: String(row.storage_type || ''),
    vaultNotebookId: Number(row.vault_notebook_id),
    vaultNoteId: Number(row.vault_note_id),
    albumSetName: String(row.album_set_name || ''),
    albumName: String(row.album_name || ''),
    displayLabel: String(row.display_label || ''),
    ownerEmail: String(row.owner_email || ''),
    ownerAlias: row.owner_alias == null ? null : String(row.owner_alias),
    createdAt: row.created_at
  };
}

async function loadOwnerProfile(singlesId) {
  const { rows } = await pool.query(
    `SELECT singles_id, email, alias, member_id FROM ${schemaTable('singles')} WHERE singles_id = $1 LIMIT 1`,
    [singlesId]
  );
  return rows[0] || null;
}

function ownerDisplayName(row) {
  const alias = String(row?.alias ?? '').trim();
  if (alias) return alias;
  const email = String(row?.email ?? '').trim();
  if (email) return email.split('@')[0];
  return 'Member';
}

/** GET /api/photoAlbums/invites?noteId=&storageType= */
export async function listPhotoAlbumsInvites(req, res) {
  try {
    const singlesId = Number(req.auth?.singles_id);
    if (!Number.isFinite(singlesId) || singlesId < 1) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    const noteId = Number(req.query?.noteId);
    const storageType = String(req.query?.storageType || '').trim().toLowerCase();
    if (!Number.isFinite(noteId) || noteId < 1) {
      return res.status(400).json({ error: 'noteId is required' });
    }
    if (storageType !== 'usb' && storageType !== 'onedrive') {
      return res.status(400).json({ error: 'storageType must be usb or onedrive' });
    }

    const { rows } = await pool.query(
      `SELECT invite_id, invitee_email, invited_at, view_count, last_viewed_at, revoked_at, accepted_at, accepted_by_singles_id
       FROM ${schemaTable('photo_albums_invites')}
       WHERE owner_singles_id = $1
         AND vault_note_id = $2
         AND storage_type = $3
         AND revoked_at IS NULL
       ORDER BY invited_at DESC, invite_id DESC`,
      [singlesId, noteId, storageType]
    );
    return res.json({ invites: rows.map(formatInviteRow) });
  } catch (err) {
    console.error(LOG_PREFIX, 'list', err?.message || err);
    return res.status(500).json({ error: 'Failed to load invites' });
  }
}

/** POST /api/photoAlbums/invites */
export async function createPhotoAlbumsInvite(req, res) {
  try {
    const singlesId = Number(req.auth?.singles_id);
    if (!Number.isFinite(singlesId) || singlesId < 1) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const inviteeEmail = normalizeEmail(req.body?.email);
    if (!isValidEmail(inviteeEmail)) {
      return res.status(400).json({ error: 'A valid invitee email is required.' });
    }

    const noteId = Number(req.body?.noteId);
    const notebookId = Number(req.body?.notebookId);
    const storageType = String(req.body?.storageType || '').trim().toLowerCase();
    const albumSetName = String(req.body?.albumSetName || '').trim();
    const albumName = String(req.body?.albumName || '').trim();

    if (!Number.isFinite(noteId) || noteId < 1 || !Number.isFinite(notebookId) || notebookId < 1) {
      return res.status(400).json({ error: 'notebookId and noteId are required' });
    }
    if (storageType !== 'usb' && storageType !== 'onedrive') {
      return res.status(400).json({ error: 'storageType must be usb or onedrive' });
    }

    const session = await requireVaultSession(
      { ...req, query: { ...req.query, storageType } },
      res
    );
    if (!session) return undefined;
    if (Number(session.singlesId) !== singlesId) {
      return res.status(403).json({ error: 'Vault session mismatch' });
    }

    const owner = await loadOwnerProfile(singlesId);
    if (!owner) return res.status(404).json({ error: 'User profile not found' });
    if (normalizeEmail(owner.email) === inviteeEmail) {
      return res.status(400).json({ error: 'You cannot invite yourself.' });
    }

    const existing = await pool.query(
      `SELECT invite_id, invitee_email, invited_at, view_count, last_viewed_at, revoked_at, accepted_at, accepted_by_singles_id, invite_token
       FROM ${schemaTable('photo_albums_invites')}
       WHERE owner_singles_id = $1
         AND vault_note_id = $2
         AND storage_type = $3
         AND invitee_email_normalized = $4
         AND revoked_at IS NULL
       LIMIT 1`,
      [singlesId, noteId, storageType, inviteeEmail]
    );
    if (existing.rows[0]) {
      let snapshotRefreshed = false;
      try {
        const snapshot = capturePhotoAlbumsInviteSnapshot(session, existing.rows[0].invite_id, noteId);
        await pool.query(
          `UPDATE ${schemaTable('photo_albums_invites')}
           SET snapshot_html = $2,
               snapshot_attachments = $3::jsonb,
               snapshot_at = NOW(),
               updated_at = NOW()
           WHERE invite_id = $1`,
          [existing.rows[0].invite_id, snapshot.html, JSON.stringify(snapshot.attachments || [])]
        );
        snapshotRefreshed = true;
      } catch (snapErr) {
        console.warn(LOG_PREFIX, 'snapshot-refresh', snapErr?.message || snapErr);
      }
      return res.status(409).json({
        error: 'An active invitation for this email already exists for this album.',
        invite: formatInviteRow(existing.rows[0]),
        snapshotRefreshed
      });
    }

    const inviteToken = crypto.randomBytes(24).toString('hex');

    const { rows } = await pool.query(
      `INSERT INTO ${schemaTable('photo_albums_invites')} (
         owner_singles_id, storage_type, vault_notebook_id, vault_note_id,
         album_set_name, album_name, invitee_email, invitee_email_normalized, invite_token
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING invite_id, invitee_email, invited_at, view_count, last_viewed_at, revoked_at, accepted_at, accepted_by_singles_id, invite_token`,
      [
        singlesId,
        storageType,
        notebookId,
        noteId,
        albumSetName,
        albumName,
        inviteeEmail,
        inviteeEmail,
        inviteToken
      ]
    );

    const inviteRow = rows[0];
    if (!inviteRow) {
      return res.status(500).json({ error: 'Failed to create invite' });
    }

    let snapshotWarning = '';
    try {
      const snapshot = capturePhotoAlbumsInviteSnapshot(session, inviteRow.invite_id, noteId);
      await pool.query(
        `UPDATE ${schemaTable('photo_albums_invites')}
         SET snapshot_html = $2,
             snapshot_attachments = $3::jsonb,
             snapshot_at = NOW(),
             updated_at = NOW()
         WHERE invite_id = $1`,
        [inviteRow.invite_id, snapshot.html, JSON.stringify(snapshot.attachments || [])]
      );
    } catch (snapErr) {
      snapshotWarning = snapErr?.message || 'Could not snapshot album for sharing';
      console.warn(LOG_PREFIX, 'snapshot', snapshotWarning);
    }

    if (!isSmtpConfigured()) {
      return res.status(500).json({
        error: 'Email service not configured',
        details: 'SMTP is not configured on the server.'
      });
    }

    const acceptUrl = buildPhotoAlbumsInviteAcceptUrl(getPublicAppUrl(), inviteRow.invite_token || inviteToken);
    const ownerName = ownerDisplayName(owner);
    const transporter = createTransporter();
    await transporter.sendMail(
      enrichMailOptions({
        from: OUTBOUND_EMAIL_FROM_HEADER,
        to: inviteeEmail,
        subject: `${ownerName} shared a photo album with you — OnlineMall.Website`,
        text: buildPhotoAlbumsInviteEmailPlain({
          ownerDisplayName: ownerName,
          albumSetName,
          albumName,
          acceptUrl
        }),
        html: buildPhotoAlbumsInviteEmailHtml({
          ownerDisplayName: ownerName,
          albumSetName,
          albumName,
          acceptUrl
        })
      })
    );

    console.log(LOG_PREFIX, 'sent', { singlesId, noteId, inviteePrefix: `${inviteeEmail.slice(0, 3)}***` });
    return res.json({
      success: true,
      invite: formatInviteRow(inviteRow),
      snapshotWarning: snapshotWarning || undefined
    });
  } catch (err) {
    console.error(LOG_PREFIX, 'create', err?.message || err);
    return res.status(500).json({ error: 'Failed to send album invitation email.' });
  }
}

/** POST /api/photoAlbums/invites/:inviteId/revoke */
export async function revokePhotoAlbumsInvite(req, res) {
  try {
    const singlesId = Number(req.auth?.singles_id);
    if (!Number.isFinite(singlesId) || singlesId < 1) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    const inviteId = Number(req.params?.inviteId);
    if (!Number.isFinite(inviteId) || inviteId < 1) {
      return res.status(400).json({ error: 'Invalid invite id' });
    }

    const { rowCount } = await pool.query(
      `UPDATE ${schemaTable('photo_albums_invites')}
       SET revoked_at = NOW(), updated_at = NOW()
       WHERE invite_id = $1 AND owner_singles_id = $2 AND revoked_at IS NULL`,
      [inviteId, singlesId]
    );
    if (!rowCount) {
      return res.status(404).json({ error: 'Invite not found or already revoked' });
    }
    return res.json({ success: true });
  } catch (err) {
    console.error(LOG_PREFIX, 'revoke', err?.message || err);
    return res.status(500).json({ error: 'Failed to revoke invite' });
  }
}

/** GET /api/photoAlbums/invites/preview?token= */
export async function previewPhotoAlbumsInvite(req, res) {
  try {
    const token = String(req.query?.token || '').trim();
    if (!token) return res.status(400).json({ error: 'token is required' });

    const { rows } = await pool.query(
      `SELECT i.invite_id, i.album_set_name, i.album_name, i.invitee_email, i.revoked_at, i.accepted_at,
              o.email AS owner_email, o.alias AS owner_alias
       FROM ${schemaTable('photo_albums_invites')} i
       JOIN ${schemaTable('singles')} o ON o.singles_id = i.owner_singles_id
       WHERE i.invite_token = $1
       LIMIT 1`,
      [token]
    );
    const row = rows[0];
    if (!row) return res.status(404).json({ error: 'Invitation not found' });
    if (row.revoked_at) return res.status(410).json({ error: 'This invitation was revoked.' });

    return res.json({
      albumSetName: String(row.album_set_name || ''),
      albumName: String(row.album_name || ''),
      inviteeEmail: String(row.invitee_email || ''),
      ownerDisplayName: ownerDisplayName({ alias: row.owner_alias, email: row.owner_email }),
      alreadyAccepted: Boolean(row.accepted_at)
    });
  } catch (err) {
    console.error(LOG_PREFIX, 'preview', err?.message || err);
    return res.status(500).json({ error: 'Failed to load invitation' });
  }
}

/** POST /api/photoAlbums/invites/accept */
export async function acceptPhotoAlbumsInvite(req, res) {
  try {
    const singlesId = Number(req.auth?.singles_id);
    if (!Number.isFinite(singlesId) || singlesId < 1) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const token = String(req.body?.token || '').trim();
    if (!token) return res.status(400).json({ error: 'token is required' });

    const recipient = await loadOwnerProfile(singlesId);
    if (!recipient) return res.status(404).json({ error: 'User profile not found' });

    const { rows } = await pool.query(
      `SELECT *
       FROM ${schemaTable('photo_albums_invites')}
       WHERE invite_token = $1
       LIMIT 1`,
      [token]
    );
    const invite = rows[0];
    if (!invite) return res.status(404).json({ error: 'Invitation not found' });
    if (invite.revoked_at) return res.status(410).json({ error: 'This invitation was revoked.' });

    const recipientEmail = normalizeEmail(recipient.email);
    const inviteeEmail = normalizeEmail(invite.invitee_email);
    if (recipientEmail !== inviteeEmail) {
      return res.status(403).json({
        error: `Log in as ${invite.invitee_email} to accept this invitation.`
      });
    }

    const displayLabel =
      [String(invite.album_set_name || '').trim(), String(invite.album_name || '').trim()]
        .filter(Boolean)
        .join(' / ') || 'Shared album';

    await pool.query('BEGIN');
    try {
      if (!invite.accepted_at) {
        await pool.query(
          `UPDATE ${schemaTable('photo_albums_invites')}
           SET accepted_at = NOW(), accepted_by_singles_id = $2, updated_at = NOW()
           WHERE invite_id = $1`,
          [invite.invite_id, singlesId]
        );
      }

      await pool.query(
        `INSERT INTO ${schemaTable('photo_albums_shared_albums')} (
           invite_id, recipient_singles_id, owner_singles_id, storage_type,
           vault_notebook_id, vault_note_id, album_set_name, album_name, display_label
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         ON CONFLICT (recipient_singles_id, invite_id) DO NOTHING`,
        [
          invite.invite_id,
          singlesId,
          invite.owner_singles_id,
          invite.storage_type,
          invite.vault_notebook_id,
          invite.vault_note_id,
          invite.album_set_name,
          invite.album_name,
          displayLabel
        ]
      );

      await pool.query('COMMIT');
    } catch (txErr) {
      await pool.query('ROLLBACK');
      throw txErr;
    }

    return res.json({
      success: true,
      displayLabel,
      redirectPath: '/myPhotoAlbums'
    });
  } catch (err) {
    console.error(LOG_PREFIX, 'accept', err?.message || err);
    return res.status(500).json({ error: 'Failed to accept invitation' });
  }
}

/** GET /api/photoAlbums/shared-albums */
export async function listPhotoAlbumsSharedAlbums(req, res) {
  try {
    const singlesId = Number(req.auth?.singles_id);
    if (!Number.isFinite(singlesId) || singlesId < 1) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const { rows } = await pool.query(
      `SELECT s.shared_album_id, s.invite_id, s.owner_singles_id, s.storage_type,
              s.vault_notebook_id, s.vault_note_id, s.album_set_name, s.album_name,
              s.display_label, s.created_at, o.email AS owner_email, o.alias AS owner_alias
       FROM ${schemaTable('photo_albums_shared_albums')} s
       JOIN ${schemaTable('singles')} o ON o.singles_id = s.owner_singles_id
       WHERE s.recipient_singles_id = $1
       ORDER BY s.created_at DESC, s.shared_album_id DESC`,
      [singlesId]
    );

    return res.json({ sharedAlbums: rows.map(formatSharedAlbumRow) });
  } catch (err) {
    console.error(LOG_PREFIX, 'shared-list', err?.message || err);
    return res.status(500).json({ error: 'Failed to load shared albums' });
  }
}

async function loadSharedAlbumForRecipient(sharedAlbumId, recipientSinglesId) {
  const id = Number(sharedAlbumId);
  const recipientId = Number(recipientSinglesId);
  if (!Number.isFinite(id) || id < 1 || !Number.isFinite(recipientId) || recipientId < 1) {
    return null;
  }
  const { rows } = await pool.query(
    `SELECT s.shared_album_id, s.invite_id, s.owner_singles_id, s.storage_type,
            s.vault_notebook_id, s.vault_note_id, s.album_set_name, s.album_name,
            s.display_label, s.created_at,
            i.snapshot_html, i.snapshot_attachments, i.snapshot_at, i.view_count,
            o.email AS owner_email, o.alias AS owner_alias
     FROM ${schemaTable('photo_albums_shared_albums')} s
     JOIN ${schemaTable('photo_albums_invites')} i ON i.invite_id = s.invite_id
     JOIN ${schemaTable('singles')} o ON o.singles_id = s.owner_singles_id
     WHERE s.shared_album_id = $1 AND s.recipient_singles_id = $2
       AND i.revoked_at IS NULL
     LIMIT 1`,
    [id, recipientId]
  );
  return rows[0] || null;
}

/** GET /api/photoAlbums/shared-albums/:sharedAlbumId/content */
export async function getPhotoAlbumsSharedAlbumContent(req, res) {
  try {
    const singlesId = Number(req.auth?.singles_id);
    if (!Number.isFinite(singlesId) || singlesId < 1) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    const sharedAlbumId = Number(req.params?.sharedAlbumId);
    if (!Number.isFinite(sharedAlbumId) || sharedAlbumId < 1) {
      return res.status(400).json({ error: 'Invalid shared album id' });
    }

    const row = await loadSharedAlbumForRecipient(sharedAlbumId, singlesId);
    if (!row) return res.status(404).json({ error: 'Shared album not found' });
    if (!row.snapshot_html) {
      return res.status(409).json({
        error: 'This shared album has no snapshot yet. Ask the owner to send the invite again.'
      });
    }

    await pool.query(
      `UPDATE ${schemaTable('photo_albums_invites')}
       SET view_count = COALESCE(view_count, 0) + 1,
           last_viewed_at = NOW(),
           updated_at = NOW()
       WHERE invite_id = $1`,
      [row.invite_id]
    );

    let attachments = [];
    try {
      attachments = Array.isArray(row.snapshot_attachments)
        ? row.snapshot_attachments
        : JSON.parse(String(row.snapshot_attachments || '[]'));
    } catch {
      attachments = [];
    }

    return res.json({
      sharedAlbum: {
        sharedAlbumId: Number(row.shared_album_id),
        inviteId: Number(row.invite_id),
        vaultNoteId: Number(row.vault_note_id),
        albumSetName: String(row.album_set_name || ''),
        albumName: String(row.album_name || ''),
        displayLabel: String(row.display_label || ''),
        ownerEmail: String(row.owner_email || ''),
        ownerDisplayName: ownerDisplayName({ alias: row.owner_alias, email: row.owner_email }),
        storageType: String(row.storage_type || ''),
        html: String(row.snapshot_html || ''),
        attachments,
        snapshotAt: row.snapshot_at
      }
    });
  } catch (err) {
    console.error(LOG_PREFIX, 'shared-content', err?.message || err);
    return res.status(500).json({ error: 'Failed to load shared album' });
  }
}

/** GET /api/photoAlbums/shared-albums/:sharedAlbumId/attachments/:attachmentId */
export async function getPhotoAlbumsSharedAlbumAttachment(req, res) {
  try {
    const singlesId = Number(req.auth?.singles_id);
    if (!Number.isFinite(singlesId) || singlesId < 1) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    const sharedAlbumId = Number(req.params?.sharedAlbumId);
    const attachmentId = Number(req.params?.attachmentId);
    if (!Number.isFinite(sharedAlbumId) || sharedAlbumId < 1) {
      return res.status(400).json({ error: 'Invalid shared album id' });
    }
    if (!Number.isFinite(attachmentId) || attachmentId < 1) {
      return res.status(400).json({ error: 'Invalid attachment id' });
    }

    const row = await loadSharedAlbumForRecipient(sharedAlbumId, singlesId);
    if (!row) return res.status(404).json({ error: 'Shared album not found' });

    let attachments = [];
    try {
      attachments = Array.isArray(row.snapshot_attachments)
        ? row.snapshot_attachments
        : JSON.parse(String(row.snapshot_attachments || '[]'));
    } catch {
      attachments = [];
    }
    const meta = attachments.find((item) => Number(item?.attachmentId) === attachmentId);
    if (!meta?.storageFileName) {
      return res.status(404).json({ error: 'Attachment not found in shared album' });
    }

    const buffer = readSharedInviteAttachmentFile(row.invite_id, meta.storageFileName);
    if (!buffer?.length) return res.status(404).json({ error: 'Attachment file missing' });

    const inline =
      req.query.inline === '1' || req.query.inline === 'true' || req.query.view === '1' || req.query.view === 'true';
    let payload = buffer;
    let contentType = meta.mimeType || 'application/octet-stream';
    if (inline) {
      const preview = await photoAlbumsInlinePreviewPayload(
        buffer,
        meta.fileExtension || String(meta.fileName || '').split('.').pop() || '',
        contentType
      );
      payload = preview.buffer;
      contentType = preview.contentType || contentType;
    }
    res.setHeader('Content-Type', contentType);
    res.setHeader(
      'Content-Disposition',
      `${inline ? 'inline' : 'attachment'}; filename="${encodeURIComponent(meta.fileName || 'file')}"`
    );
    res.setHeader('Cache-Control', 'private, max-age=3600');
    return res.send(payload);
  } catch (err) {
    console.error(LOG_PREFIX, 'shared-attachment', err?.message || err);
    return res.status(500).json({ error: 'Failed to load shared attachment' });
  }
}

/** DELETE /api/photoAlbums/shared-albums/:sharedAlbumId */
export async function removePhotoAlbumsSharedAlbum(req, res) {
  try {
    const singlesId = Number(req.auth?.singles_id);
    if (!Number.isFinite(singlesId) || singlesId < 1) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    const sharedAlbumId = Number(req.params?.sharedAlbumId);
    if (!Number.isFinite(sharedAlbumId) || sharedAlbumId < 1) {
      return res.status(400).json({ error: 'Invalid shared album id' });
    }

    const { rowCount } = await pool.query(
      `DELETE FROM ${schemaTable('photo_albums_shared_albums')}
       WHERE shared_album_id = $1 AND recipient_singles_id = $2`,
      [sharedAlbumId, singlesId]
    );
    if (!rowCount) {
      return res.status(404).json({ error: 'Shared album not found' });
    }
    return res.json({ success: true });
  } catch (err) {
    console.error(LOG_PREFIX, 'shared-remove', err?.message || err);
    return res.status(500).json({ error: 'Failed to remove shared album' });
  }
}

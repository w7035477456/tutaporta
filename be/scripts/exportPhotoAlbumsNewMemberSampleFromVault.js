#!/usr/bin/env node
/**
 * Make a member's current SAMPLE ALBUM the template for new members and "Restore Sample Album".
 * Copies the album layout (pages, photo pan/zoom/crop, emojis, blur, text labels, page colors)
 * into be/assets/photoAlbumsNewMemberSample/sampleAlbumBody.html and marks which bundled
 * photos are deleted in manifest.json. The album may only use the bundled sample photos.
 *
 * Usage (from repo root; reads the member's album index in Postgres):
 *   node be/scripts/exportPhotoAlbumsNewMemberSampleFromVault.js <singles_id | M{member_id}>
 */
import '../loadEnv.js';
import fs from 'fs';
import path from 'path';

import pool from '../db/connection.js';
import { DEFAULT_SAMPLE_ALBUM_NAME } from '../utils/photoAlbumsUsb/vaultSchema.js';
import { PHOTO_ALBUMS_VAULT_TABLES as T, VaultPgDb } from '../utils/photoAlbumsUsb/vaultPgStore.js';
import { remapSampleAlbumBodyAttachmentIds } from '../utils/photoAlbumsNewMemberSample/seedPhotoAlbumsNewMemberSample.js';
import {
  INITIALIZE_SAMPLE_ASSET_ROOT,
  loadInitializeSampleManifest
} from '../utils/photoAlbumsNewMemberSample/initializeSampleManifest.js';

async function resolveSinglesId(arg) {
  const raw = String(arg || '').trim();
  const member = /^M(\d+)$/i.exec(raw);
  if (member) {
    const { rows } = await pool.query(
      `SELECT singles_id FROM outdateddbsnapshotoct2024.singles WHERE member_id = $1 LIMIT 1`,
      [Number(member[1])]
    );
    return Number(rows[0]?.singles_id) || null;
  }
  const id = Number(raw);
  return Number.isFinite(id) && id >= 1 ? id : null;
}

async function main() {
  const singlesId = await resolveSinglesId(process.argv[2]);
  if (!singlesId) {
    console.error('Usage: node be/scripts/exportPhotoAlbumsNewMemberSampleFromVault.js <singles_id | M{member_id}>');
    process.exitCode = 1;
    return;
  }
  const db = new VaultPgDb(singlesId);

  const manifest = loadInitializeSampleManifest();
  const albumName = manifest.albumName || DEFAULT_SAMPLE_ALBUM_NAME;
  const note = await db.one(
    `SELECT note_id, body_text, inner_encrypt_enabled FROM ${T.notes}
      WHERE singles_id = $1 AND note_name = $2 AND deleted_at IS NULL ORDER BY note_id LIMIT 1`,
    [singlesId, albumName]
  );
  if (!note) throw new Error(`No live "${albumName}" for singles_id=${singlesId}`);
  if (Number(note.inner_encrypt_enabled) === 1) throw new Error(`"${albumName}" is inner-encrypted`);

  const live = await db.all(
    `SELECT attachment_id, file_name, checksum FROM ${T.attachments}
      WHERE singles_id = $1 AND note_id = $2 AND deleted_at IS NULL`,
    [singlesId, Number(note.note_id)]
  );
  // Restore Sample Album may have moved a template photo to a new id; map it back by checksum.
  const byId = new Map(manifest.attachments.map((a) => [Number(a.attachmentId), a]));
  const byChecksum = new Map(manifest.attachments.map((a) => [String(a.checksum || ''), a]));
  const vaultToManifest = new Map();
  const foreign = [];
  for (const row of live) {
    const vaultId = Number(row.attachment_id);
    const checksum = String(row.checksum || '');
    const entry =
      byId.get(vaultId)?.checksum === checksum ? byId.get(vaultId) : checksum ? byChecksum.get(checksum) : null;
    if (!entry) foreign.push(row);
    else vaultToManifest.set(vaultId, Number(entry.attachmentId));
  }
  if (foreign.length) {
    throw new Error(
      `"${albumName}" has photos that are not bundled samples: ${foreign
        .map((r) => `${r.attachment_id}:${r.file_name}`)
        .join(', ')}`
    );
  }

  const liveIds = new Set(vaultToManifest.values());
  const nextManifest = {
    ...manifest,
    attachments: manifest.attachments.map((entry) => {
      const { deleted: _deleted, ...rest } = entry;
      return liveIds.has(Number(entry.attachmentId)) ? rest : { ...rest, deleted: true };
    })
  };

  const remap = new Map([...vaultToManifest].filter(([vaultId, manifestId]) => vaultId !== manifestId));
  const bodyText = remap.size
    ? remapSampleAlbumBodyAttachmentIds(String(note.body_text || ''), remap)
    : String(note.body_text || '');

  const bodyFile = manifest.bodyHtmlFile || 'sampleAlbumBody.html';
  fs.writeFileSync(path.join(INITIALIZE_SAMPLE_ASSET_ROOT, bodyFile), bodyText, 'utf8');
  fs.writeFileSync(
    path.join(INITIALIZE_SAMPLE_ASSET_ROOT, 'manifest.json'),
    `${JSON.stringify(nextManifest, null, 2)}\n`,
    'utf8'
  );
  console.log(
    `[exportPhotoAlbumsNewMemberSampleFromVault] wrote ${bodyFile} (${bodyText.length} chars); ` +
      `live photos ${[...liveIds].sort((a, b) => a - b).join(',')}`
  );
}

main()
  .catch((err) => {
    console.error(err?.message || err);
    process.exitCode = 1;
  })
  .finally(() => pool.end());

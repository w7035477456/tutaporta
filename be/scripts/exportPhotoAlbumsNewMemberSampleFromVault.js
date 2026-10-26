#!/usr/bin/env node
/**
 * Make a member's current SAMPLE ALBUM the template for new members and "Restore Sample Album".
 * Copies the album layout (pages, photo pan/zoom/crop, emojis, blur, text labels, page colors)
 * into be/assets/photoAlbumsNewMemberSample/sampleAlbumBody.html and marks which bundled
 * photos are deleted in manifest.json. The album may only use the bundled sample photos.
 *
 * Usage (from repo root, plaintext TutaCloud vault):
 *   node be/scripts/exportPhotoAlbumsNewMemberSampleFromVault.js \
 *     /Users/a/mac_storage/tutamallStorageFolder_largecheapstorage_outdatedOct2021/users/M631955/photoalbums
 */
import fs from 'fs';
import path from 'path';

import { DEFAULT_SAMPLE_ALBUM_NAME } from '../utils/photoAlbumsUsb/vaultSchema.js';
import {
  closePhotoAlbumsVaultDb,
  openPhotoAlbumsVaultDbForMigration
} from '../utils/photoAlbumsNewMemberSample/migrateSampleAlbumTutorialLabels.js';
import {
  INITIALIZE_SAMPLE_ASSET_ROOT,
  loadInitializeSampleManifest
} from '../utils/photoAlbumsNewMemberSample/initializeSampleManifest.js';

function queryAll(db, sql, params = []) {
  const stmt = db.prepare(sql);
  stmt.bind(params);
  const rows = [];
  while (stmt.step()) rows.push(stmt.getAsObject());
  stmt.free();
  return rows;
}

async function main() {
  const mountPath = process.argv[2];
  if (!mountPath) {
    console.error('Usage: node be/scripts/exportPhotoAlbumsNewMemberSampleFromVault.js <photoalbums-mount-path>');
    process.exit(1);
  }
  const opened = await openPhotoAlbumsVaultDbForMigration(mountPath);
  if (opened.skipped) throw new Error(`Cannot open vault (${opened.reason}) under ${mountPath}`);
  const { db } = opened;

  try {
    const manifest = loadInitializeSampleManifest();
    const albumName = manifest.albumName || DEFAULT_SAMPLE_ALBUM_NAME;
    const note = queryAll(
      db,
      `SELECT note_id, body_text, inner_encrypt_enabled FROM notes
        WHERE note_name = ? AND deleted_at IS NULL ORDER BY note_id LIMIT 1`,
      [albumName]
    )[0];
    if (!note) throw new Error(`No live "${albumName}" in this vault`);
    if (Number(note.inner_encrypt_enabled) === 1) throw new Error(`"${albumName}" is inner-encrypted`);

    const live = queryAll(
      db,
      `SELECT attachment_id, file_name, checksum FROM note_attachments
        WHERE note_id = ? AND deleted_at IS NULL`,
      [Number(note.note_id)]
    );
    const byId = new Map(manifest.attachments.map((a) => [Number(a.attachmentId), a]));
    const foreign = live.filter((row) => {
      const entry = byId.get(Number(row.attachment_id));
      return !entry || String(entry.checksum || '') !== String(row.checksum || '');
    });
    if (foreign.length) {
      throw new Error(
        `"${albumName}" has photos that are not bundled samples: ${foreign
          .map((r) => `${r.attachment_id}:${r.file_name}`)
          .join(', ')}`
      );
    }

    const liveIds = new Set(live.map((row) => Number(row.attachment_id)));
    const nextManifest = {
      ...manifest,
      attachments: manifest.attachments.map((entry) => {
        const { deleted: _deleted, ...rest } = entry;
        return liveIds.has(Number(entry.attachmentId)) ? rest : { ...rest, deleted: true };
      })
    };

    const bodyFile = manifest.bodyHtmlFile || 'sampleAlbumBody.html';
    fs.writeFileSync(path.join(INITIALIZE_SAMPLE_ASSET_ROOT, bodyFile), String(note.body_text || ''), 'utf8');
    fs.writeFileSync(
      path.join(INITIALIZE_SAMPLE_ASSET_ROOT, 'manifest.json'),
      `${JSON.stringify(nextManifest, null, 2)}\n`,
      'utf8'
    );
    console.log(
      `[exportPhotoAlbumsNewMemberSampleFromVault] wrote ${bodyFile} (${String(note.body_text || '').length} chars); ` +
        `live photos ${[...liveIds].sort((a, b) => a - b).join(',')}`
    );
  } finally {
    closePhotoAlbumsVaultDb(db);
  }
}

main().catch((err) => {
  console.error(err?.message || err);
  process.exitCode = 1;
});

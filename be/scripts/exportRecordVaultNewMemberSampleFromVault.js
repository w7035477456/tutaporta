#!/usr/bin/env node
/**
 * Export dm1 (or any member) TutaNotes vault → be/assets/recordVaultNewMemberSample/.
 * Rewrites note body HTML with manifest attachment ids and seed marker comments.
 *
 * Usage (from repo root):
 *   node be/scripts/exportRecordVaultNewMemberSampleFromVault.js \
 *     /Users/a/mac_storage/onlinemallwebsite_largecheapstorage/users/M237112/notes
 *
 * After export: bump manifest.json version/seedMarker, then run:
 *   node be/scripts/migrateRecordVaultNewMemberSample.js
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import initSqlJs from 'sql.js';

import { openVaultBuffer } from '../utils/recordVaultUsb/vaultCrypto.js';
import { resolveVaultDbPath } from '../utils/recordVaultUsb/vaultPaths.js';
import { readVaultMeta } from '../utils/recordVaultUsb/usbScan.js';
import {
  loadRecordVaultNewMemberSampleManifest,
  RECORD_VAULT_NEW_MEMBER_SAMPLE_ASSET_ROOT
} from '../utils/recordVaultNewMemberSample/sampleManifest.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const NOTE_NAME_TO_BODY_FILE = {
  'SAMPLE RECEIPTS': 'sampleReceiptsBody.html',
  'SAMPLE VARIOUS FORMATS': 'sampleVariousFormatsBody.html',
  '2025 TAX': 'sampleTax2025Body.html',
  '2024 TAX': 'sampleTax2024Body.html'
};

function queryAll(db, sql, params = []) {
  const stmt = db.prepare(sql);
  stmt.bind(params);
  const rows = [];
  while (stmt.step()) rows.push(stmt.getAsObject());
  stmt.free();
  return rows;
}

function normalizeBodyHtml(rawBody, attachmentIdByChecksum, noteKey, seedMarker) {
  let html = String(rawBody || '');
  html = html.replace(/<!--\s*rv-new-member-sample-v\d+[^>]*-->\s*/gi, '');
  html = html.replace(
    /<div([^>]*data-rv-attachment=""[^>]*)><\/div>/gi,
    (match, attrs) => {
      const checksumMatch = attrs.match(/data-checksum="([^"]+)"/i);
      const idMatch = attrs.match(/data-attachment-id="(\d+)"/i);
      let attachmentId = idMatch ? Number(idMatch[1]) : null;
      const checksum = checksumMatch ? String(checksumMatch[1]).trim().toLowerCase() : '';
      if (checksum && attachmentIdByChecksum.has(checksum)) {
        attachmentId = attachmentIdByChecksum.get(checksum);
      }
      if (!Number.isFinite(attachmentId)) return match;
      const cleaned = attrs.replace(/\s*data-attachment-id="[^"]*"/i, '');
      return `<div data-attachment-id="${attachmentId}"${cleaned}></div>`;
    }
  );
  html = html.replace(
    /data-attachment-id="\d+"/gi,
    (token) => {
      const id = Number(token.match(/\d+/)?.[0]);
      if (!Number.isFinite(id)) return token;
      return `data-attachment-id="${id}"`;
    }
  );
  const header = `<!-- ${seedMarker} note=${noteKey} -->\n`;
  return `${header}${html.trim()}\n`;
}

async function main() {
  const mountPath = process.argv[2];
  if (!mountPath) {
    console.error('Usage: node be/scripts/exportRecordVaultNewMemberSampleFromVault.js <vault-mount-path>');
    process.exit(1);
  }
  const meta = readVaultMeta(mountPath);
  if (!meta) throw new Error(`No vault.meta.json under ${mountPath}`);
  const dbPath = resolveVaultDbPath(mountPath);
  const enc = fs.readFileSync(dbPath);
  const SQL = await initSqlJs();
  const db = new SQL.Database(openVaultBuffer(enc, null));

  const manifest = loadRecordVaultNewMemberSampleManifest();
  const seedMarker = String(manifest.seedMarker || 'rv-new-member-sample-v4');
  const attachmentIdByChecksum = new Map();
  for (const att of manifest.notebooks?.flatMap((nb) => nb.notes || []) || []) {
    for (const a of att.attachments || []) {
      const sum = String(a.checksum || '').trim().toLowerCase();
      if (sum) attachmentIdByChecksum.set(sum, Number(a.attachmentId));
    }
  }

  const noteKeyByName = new Map();
  for (const nb of manifest.notebooks || []) {
    for (const note of nb.notes || []) {
      noteKeyByName.set(String(note.noteName || '').trim().toUpperCase(), note.noteKey);
    }
  }

  const notes = queryAll(
    db,
    `SELECT n.note_id, n.note_name, n.body_text, nb.notebook_name
     FROM notes n
     JOIN notebooks nb ON nb.notebook_id = n.notebook_id
     WHERE n.deleted_at IS NULL AND nb.deleted_at IS NULL
     ORDER BY nb.display_order, n.display_order, n.note_id`
  );

  let written = 0;
  for (const row of notes) {
    const name = String(row.note_name || '').trim();
    const bodyFile = NOTE_NAME_TO_BODY_FILE[name.toUpperCase()];
    if (!bodyFile) continue;
    const noteKey = noteKeyByName.get(name.toUpperCase()) || name.toLowerCase().replace(/\s+/g, '-');
    const normalized = normalizeBodyHtml(row.body_text, attachmentIdByChecksum, noteKey, seedMarker);
    const outPath = path.join(RECORD_VAULT_NEW_MEMBER_SAMPLE_ASSET_ROOT, bodyFile);
    fs.writeFileSync(outPath, normalized, 'utf8');
    console.log(`wrote ${bodyFile} (${name}) len=${normalized.length}`);
    written += 1;
  }
  db.close();
  console.log(`[exportRecordVaultNewMemberSampleFromVault] done files=${written}`);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});

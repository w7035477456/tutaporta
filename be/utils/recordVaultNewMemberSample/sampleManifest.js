import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const RECORD_VAULT_NEW_MEMBER_SAMPLE_ASSET_ROOT = path.join(
  __dirname,
  '../../assets/recordVaultNewMemberSample'
);

let cachedManifest = null;

export function loadRecordVaultNewMemberSampleManifest() {
  if (cachedManifest) return cachedManifest;
  const raw = fs.readFileSync(
    path.join(RECORD_VAULT_NEW_MEMBER_SAMPLE_ASSET_ROOT, 'manifest.json'),
    'utf8'
  );
  cachedManifest = JSON.parse(raw);
  return cachedManifest;
}

export function loadRecordVaultSampleNoteBodyHtml(bodyHtmlFile) {
  const name = String(bodyHtmlFile || '').trim();
  if (!name) return '';
  return fs.readFileSync(path.join(RECORD_VAULT_NEW_MEMBER_SAMPLE_ASSET_ROOT, name), 'utf8');
}

export function recordVaultSampleMediaPath(sourceFile) {
  const name = String(sourceFile || '').trim();
  if (!name) return null;
  return path.join(RECORD_VAULT_NEW_MEMBER_SAMPLE_ASSET_ROOT, 'media', name);
}

export function listRecordVaultSampleAttachmentDefs() {
  const manifest = loadRecordVaultNewMemberSampleManifest();
  const out = [];
  for (const note of manifest.notes || []) {
    for (const att of note.attachments || []) {
      out.push({ ...att, noteKey: note.noteKey, noteName: note.noteName });
    }
  }
  return out;
}

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

/** Manifest notebooks (v3+) or legacy single-notebook shape. */
export function listRecordVaultSampleNotebooks(manifest = loadRecordVaultNewMemberSampleManifest()) {
  if (Array.isArray(manifest.notebooks) && manifest.notebooks.length) {
    return manifest.notebooks;
  }
  const notebookName = String(manifest.notebookName || 'SAMPLE NOTEBOOK 1').trim() || 'SAMPLE NOTEBOOK 1';
  return [
    {
      notebookKey: 'legacy-single',
      notebookName,
      displayOrder: 0,
      notes: manifest.notes || []
    }
  ];
}

/** Flat note defs with notebookName / notebookKey for seed + search. */
export function listRecordVaultSampleNoteDefs(manifest = loadRecordVaultNewMemberSampleManifest()) {
  const out = [];
  for (const nb of listRecordVaultSampleNotebooks(manifest)) {
    for (const note of nb.notes || []) {
      out.push({
        ...note,
        notebookKey: nb.notebookKey,
        notebookName: nb.notebookName,
        notebookDisplayOrder: nb.displayOrder
      });
    }
  }
  return out;
}

export function listRecordVaultSampleAttachmentDefs() {
  const out = [];
  for (const note of listRecordVaultSampleNoteDefs()) {
    for (const att of note.attachments || []) {
      out.push({
        ...att,
        noteKey: note.noteKey,
        noteName: note.noteName,
        notebookKey: note.notebookKey,
        notebookName: note.notebookName
      });
    }
  }
  return out;
}

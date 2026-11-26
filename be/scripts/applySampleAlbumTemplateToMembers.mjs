/**
 * One-time data script: give existing members the current demo SAMPLE ALBUM
 * (be/assets/photoAlbumsNewMemberSample/sampleAlbumBody.html + manifest.json), the same reset the
 * app's "Restore Sample Album" does. New members already get it at signup. No schema change.
 *
 * Every member with a live SAMPLE ALBUM is put in one group:
 *   current   already the current template — nothing to do
 *   untouched still an earlier template, no photos added (previousTemplateBodyHashes.json) — updated
 *   edited    member changed the layout or added photos — updated only with --include-edited
 *             (their SAMPLE ALBUM layout is replaced; photos they added to it are moved to trash)
 *   skipped   inner-encrypted album, or a demo photo id 1–7 is used by another album (Restore
 *             Sample Album in the app handles that case) — never updated here
 *
 * Usage (Mac or Ubuntu, from the repo root):
 *   node be/scripts/applySampleAlbumTemplateToMembers.mjs                      # dry run: list only
 *   node be/scripts/applySampleAlbumTemplateToMembers.mjs --apply              # untouched only
 *   node be/scripts/applySampleAlbumTemplateToMembers.mjs --apply --include-edited
 *   node be/scripts/applySampleAlbumTemplateToMembers.mjs --apply --member M4024129
 */
import '../loadEnv.js';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

import pool from '../db/connection.js';
import { PHOTO_ALBUMS_VAULT_TABLES as T, VaultPgDb } from '../utils/photoAlbumsUsb/vaultPgStore.js';
import {
  INITIALIZE_SAMPLE_ASSET_ROOT,
  loadInitializeSampleManifest
} from '../utils/photoAlbumsNewMemberSample/initializeSampleManifest.js';
import {
  loadSampleAlbumBodyHtml,
  restorePhotoAlbumsSampleAlbumDb
} from '../utils/photoAlbumsNewMemberSample/seedPhotoAlbumsNewMemberSample.js';
import { DEFAULT_SAMPLE_ALBUM_NAME } from '../utils/photoAlbumsUsb/vaultSchema.js';

const args = process.argv.slice(2);
const apply = args.includes('--apply');
const includeEdited = args.includes('--include-edited');
const memberArg = args.includes('--member') ? String(args[args.indexOf('--member') + 1] || '') : '';
const onlyMemberId = /^M?(\d+)$/i.exec(memberArg)?.[1] || null;

const sha = (s) =>
  crypto
    .createHash('sha256')
    .update(String(s ?? ''))
    .digest('hex');

async function main() {
  const manifest = loadInitializeSampleManifest();
  const albumName = manifest.albumName || DEFAULT_SAMPLE_ALBUM_NAME;
  const templateIds = (manifest.attachments || []).map((a, i) => Number(a.attachmentId) || i + 1);
  const currentHash = sha(loadSampleAlbumBodyHtml());
  const previous = new Set(
    JSON.parse(fs.readFileSync(path.join(INITIALIZE_SAMPLE_ASSET_ROOT, 'previousTemplateBodyHashes.json'), 'utf8')).sha256 || []
  );

  const { rows } = await pool.query(
    `SELECT n.singles_id, s.member_id, n.note_id, n.body_text, n.inner_encrypt_enabled
       FROM ${T.notes} n
       JOIN outdateddbsnapshotoct2024.singles s ON s.singles_id = n.singles_id
      WHERE n.note_name = $1 AND n.deleted_at IS NULL
        AND ($2::bigint IS NULL OR s.member_id = $2::bigint)
      ORDER BY n.singles_id, n.note_id`,
    [albumName, onlyMemberId]
  );

  const seen = new Set();
  const groups = { current: [], untouched: [], edited: [], skipped: [] };
  for (const r of rows) {
    const singlesId = Number(r.singles_id);
    if (seen.has(singlesId)) continue; // restore uses the member's first SAMPLE ALBUM
    seen.add(singlesId);
    const label = `M${r.member_id} (singles ${singlesId})`;
    const body = String(r.body_text || '');
    const { rows: live } = await pool.query(
      `SELECT attachment_id, note_id FROM ${T.attachments}
        WHERE singles_id = $1 AND deleted_at IS NULL AND (note_id = $2 OR attachment_id = ANY($3::int[]))`,
      [singlesId, r.note_id, templateIds]
    );
    const added = live.filter((a) => Number(a.note_id) === Number(r.note_id) && !templateIds.includes(Number(a.attachment_id)));
    const idsElsewhere = live.filter((a) => Number(a.note_id) !== Number(r.note_id));

    if (Number(r.inner_encrypt_enabled) === 1) groups.skipped.push({ singlesId, label, why: 'inner-encrypted album' });
    else if (idsElsewhere.length)
      groups.skipped.push({
        singlesId,
        label,
        why: `demo photo id(s) ${idsElsewhere.map((a) => a.attachment_id).join(',')} used by another album`
      });
    else if (sha(body) === currentHash && !added.length) groups.current.push({ singlesId, label });
    else if (previous.has(sha(body)) && !added.length) groups.untouched.push({ singlesId, label });
    else
      groups.edited.push({
        singlesId,
        label,
        why: added.length ? `layout changed or ${added.length} photo(s) added` : 'layout changed'
      });
  }

  for (const [name, list] of Object.entries(groups)) {
    console.log(`${name}: ${list.length}`);
    for (const m of list) console.log(`  ${m.label}${m.why ? ` — ${m.why}` : ''}`);
  }

  const targets = [...groups.untouched, ...(includeEdited ? groups.edited : [])];
  if (!apply) {
    console.log(
      `\nDry run: --apply would update ${targets.length} member(s)` +
        (includeEdited ? ' (untouched + edited).' : ' (untouched only; add --include-edited for edited).')
    );
    return 0;
  }
  let failed = 0;
  for (const m of targets) {
    try {
      const res = await restorePhotoAlbumsSampleAlbumDb(new VaultPgDb(m.singlesId));
      console.log(
        `updated ${m.label}: restored ids [${res.restoredAttachmentIds.join(',')}], trashed [${res.removedAttachmentIds.join(',')}]`
      );
    } catch (err) {
      failed += 1;
      console.error(`FAILED ${m.label}: ${err?.message || err}`);
    }
  }
  console.log(`\nDone: ${targets.length - failed} updated, ${failed} failed.`);
  return failed ? 1 : 0;
}

let code = 0;
main()
  .then((c) => {
    code = c;
  })
  .catch((err) => {
    console.error(err?.message || err);
    code = 1;
  })
  // loadEnv keeps a timer alive: exit explicitly once the pool is closed.
  .finally(() => pool.end().finally(() => process.exit(code)));

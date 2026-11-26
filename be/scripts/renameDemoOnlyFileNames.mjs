/**
 * One-time data script: rename every member's demo (sample) attachment rows to the demoOnly_ names
 * from the manifests, without waiting for each member to open their vault (vault open does the same
 * per member). No schema change. Safe to run more than once.
 *
 * Only untouched demo rows change:
 *   - TutaNotes: shared_content_key = manifest sharedKey AND file_name = legacyFileName
 *   - Photo Albums: checksum = manifest checksum AND file_name = legacyFileName
 * Also updates, for the affected notes, the note body chip (data-file-name="old" → new; skipped for
 * inner-encrypted bodies) and the search text.
 *
 * Usage (Mac or Ubuntu):
 *   node be/scripts/renameDemoOnlyFileNames.mjs            # dry run: counts only
 *   node be/scripts/renameDemoOnlyFileNames.mjs --apply    # write
 */
import "../loadEnv.js";
import pool from "../db/connection.js";
import { NOTES_VAULT_TABLES as NT } from "../utils/recordVaultUsb/vaultPgStore.js";
import { PHOTO_ALBUMS_VAULT_TABLES as PA } from "../utils/photoAlbumsUsb/vaultPgStore.js";
import { listRecordVaultSampleAttachmentDefs } from "../utils/recordVaultNewMemberSample/sampleManifest.js";
import { loadInitializeSampleManifest } from "../utils/photoAlbumsNewMemberSample/initializeSampleManifest.js";

const apply = process.argv.slice(2).includes("--apply");
const INNER_PREFIX = "⁣RVI";

function renames(defs, matchKey) {
  const out = [];
  for (const d of defs) {
    const legacy = String(d.legacyFileName || "").trim();
    const next = String(d.fileName || "").trim();
    const match = String(d[matchKey] || "").trim();
    if (legacy && next && legacy !== next && match)
      out.push({ legacy, next, match });
  }
  // Same key may appear twice (f1040.pdf for 2024 + 2025 TAX): keep one.
  return [...new Map(out.map((r) => [`${r.match}|${r.legacy}`, r])).values()];
}

async function renameTable(
  client,
  { label, attachments, notes, matchColumn, list, updateBodies },
) {
  let rows = 0;
  const touched = new Map(); // "singles|note" -> [{legacy,next}]
  for (const r of list) {
    const sql = apply
      ? `UPDATE ${attachments} SET file_name = $3 WHERE ${matchColumn} = $1 AND file_name = $2 RETURNING singles_id, note_id`
      : `SELECT singles_id, note_id FROM ${attachments} WHERE ${matchColumn} = $1 AND file_name = $2`;
    const res = await client.query(
      sql,
      apply ? [r.match, r.legacy, r.next] : [r.match, r.legacy],
    );
    rows += res.rowCount;
    for (const x of res.rows) {
      const k = `${x.singles_id}|${x.note_id}`;
      if (!touched.has(k)) touched.set(k, []);
      touched.get(k).push(r);
    }
  }
  const members = new Set([...touched.keys()].map((k) => k.split("|")[0]));
  console.log(
    `${label}: ${rows} row(s) ${apply ? "renamed" : "to rename"} in ${touched.size} note(s), ${members.size} member(s)`,
  );
  if (!apply) return;
  for (const [k, list2] of touched) {
    const [singlesId, noteId] = k.split("|").map(Number);
    const { rows: n } = await client.query(
      `SELECT body_text, search_text FROM ${notes} WHERE singles_id = $1 AND note_id = $2`,
      [singlesId, noteId],
    );
    if (!n.length) continue;
    let body = String(n[0].body_text || "");
    let search = String(n[0].search_text || "");
    for (const { legacy, next } of list2) {
      if (updateBodies && !body.startsWith(INNER_PREFIX)) {
        body = body
          .split(`data-file-name="${legacy}"`)
          .join(`data-file-name="${next}"`);
      }
      const lo = legacy.toLowerCase();
      const hi = next.toLowerCase();
      if (!search.includes(hi)) search = search.split(lo).join(hi);
    }
    await client.query(
      `UPDATE ${notes} SET body_text = $3, search_text = $4 WHERE singles_id = $1 AND note_id = $2`,
      [singlesId, noteId, body, search],
    );
  }
}

const client = await pool.connect();
let code = 0;
try {
  await client.query("BEGIN");
  await renameTable(client, {
    label: "TutaNotes demo attachments",
    attachments: NT.attachments,
    notes: NT.notes,
    matchColumn: "shared_content_key",
    list: renames(listRecordVaultSampleAttachmentDefs(), "sharedKey"),
    updateBodies: true,
  });
  await renameTable(client, {
    label: "Photo Albums demo photos",
    attachments: PA.attachments,
    notes: PA.notes,
    matchColumn: "checksum",
    list: renames(loadInitializeSampleManifest().attachments || [], "checksum"),
    updateBodies: false,
  });
  await client.query(apply ? "COMMIT" : "ROLLBACK");
  console.log(apply ? "Done." : "Dry run only — rerun with --apply to write.");
} catch (err) {
  await client.query("ROLLBACK").catch(() => {});
  console.error("FAILED, nothing changed:", err?.message || err);
  code = 1;
} finally {
  client.release();
  pool.end().finally(() => process.exit(code));
}

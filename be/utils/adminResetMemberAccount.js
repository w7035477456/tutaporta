/**
 * Admin Tools → LookupByID: soft Reset (keep user content) and Hard Reset (wipe then re-init).
 */
import pool from '../db/connection.js';
import { sqlBooleanEnumLiteral } from './booleanEnum.js';
import { seedDefaultBillScheduleForNewMember } from './defaultBillScheduleForNewMember.js';
import {
  deletePhotoFolderFilesForSinglesId,
  deletePhotosFromFolder,
  fetchPhotoRowsForSinglesId
} from './deletePhotoFromFolder.js';
import { deleteVideosFromFolder, fetchVideoRowsForSinglesId } from './deleteVideoFromFolder.js';
import { ensureSeededDemoBuddiesOnLogin } from './ensureSeededDemoBuddiesOnLogin.js';
import { isProtectedSystemToolsAdminSinglesId } from './systemToolsAdmin.js';

const SCHEMA = 'helloworldjunktest';
const Q = `"${SCHEMA}"`;

function toSinglesId(raw) {
  const id = Math.trunc(Number(raw));
  if (!Number.isFinite(id) || id < 1) {
    const err = new Error('Valid singles_id is required.');
    err.statusCode = 400;
    throw err;
  }
  return id;
}

async function loadSinglesRow(client, singlesId) {
  const { rows } = await client.query(
    `SELECT singles_id, email, alias, member_category, gender_self_report, seeded_demo_buddies_boolean
     FROM ${Q}.singles
     WHERE singles_id = $1
     LIMIT 1`,
    [singlesId]
  );
  return rows[0] || null;
}

/**
 * Soft Reset bill schedule: delete this member's Monthly/Yearly rows, then seed defaults.
 * Unique key is (singles_id, storage_backend, bill_year, bill_month, row_index) — merging
 * SAMPLE rows into an existing schedule collides when custom rows already use those indices.
 */
export async function resetDefaultBillScheduleForMember(client, singlesId, now = new Date()) {
  const id = toSinglesId(singlesId);

  const monthlyResult = await client.query(`DELETE FROM ${Q}.monthly_bill WHERE singles_id = $1`, [id]);
  const yearlyResult = await client.query(`DELETE FROM ${Q}.yearly_bill WHERE singles_id = $1`, [id]);

  const seeded = await seedDefaultBillScheduleForNewMember(client, id, now);

  return {
    ...seeded,
    monthlyBillsDeleted: Number(monthlyResult.rowCount) || 0,
    yearlyBillsDeleted: Number(yearlyResult.rowCount) || 0
  };
}

/**
 * Soft Reset (Task 1): re-apply new-member defaults without deleting dating content
 * (photos, postings, bios, custom vault albums/notes).
 * - Default Request/Approval + Buddies/Acquaintances (demo pack, force)
 * - Cascade-delete this member's Monthly/Yearly bill rows, then seed SAMPLE defaults
 * - Notes / Album Photo vault samples: created on next empty-vault open (cannot mutate encrypted vault here)
 */
export async function softResetMemberAccount(singlesId) {
  const id = toSinglesId(singlesId);
  if (await isProtectedSystemToolsAdminSinglesId(id)) {
    const err = new Error('System tools admin account cannot be reset.');
    err.statusCode = 403;
    throw err;
  }

  const client = await pool.connect();
  try {
    const row = await loadSinglesRow(client, id);
    if (!row) {
      const err = new Error('Singles row not found.');
      err.statusCode = 404;
      throw err;
    }

    await client.query('BEGIN');
    const bill = await resetDefaultBillScheduleForMember(client, id);
    await client.query('COMMIT');

    const demoBuddies = await ensureSeededDemoBuddiesOnLogin(pool, id, { force: true });

    return {
      ok: true,
      mode: 'soft',
      singlesId: id,
      email: row.email ?? null,
      alias: row.alias ?? null,
      steps: {
        demoBuddies,
        billSchedule: bill,
        vaultNotes:
          'Default SAMPLE MISC / SAMPLE TAX RECORDS (four sample notes) apply when the member next unlocks an empty or upgraded TutaNotes vault (custom notes are not removed).',
        vaultAlbums:
          'Default SAMPLE SET / SAMPLE ALBUM apply when the member next opens an empty TutaPhotoAlbums vault (custom albums are not removed).'
      }
    };
  } catch (err) {
    try {
      await client.query('ROLLBACK');
    } catch {
      // ignore
    }
    throw err;
  } finally {
    client.release();
  }
}

async function cascadeWipeUserContent(client, singlesId) {
  const id = toSinglesId(singlesId);
  const summary = {
    photosDeleted: 0,
    videosDeleted: 0,
    postingsDeleted: 0,
    vetBioDeleted: 0,
    miscBioDeleted: 0,
    requestsDeleted: 0,
    monthlyBillsDeleted: 0,
    yearlyBillsDeleted: 0,
    photoFolderFilesRemoved: 0
  };

  await client.query(
    `UPDATE ${Q}.singles
     SET profile_image_fk = NULL,
         seeded_demo_buddies_boolean = ${sqlBooleanEnumLiteral(false, SCHEMA)},
         updated_at = CURRENT_TIMESTAMP
     WHERE singles_id = $1`,
    [id]
  );

  const photoRows = await fetchPhotoRowsForSinglesId(client, id);
  const videoRows = await fetchVideoRowsForSinglesId(client, id);

  await client.query(
    `UPDATE ${Q}.consent_record
     SET consent_signature_image_fk = NULL
     WHERE consent_signature_image_fk IN (
       SELECT photos_id FROM ${Q}.photos WHERE singles_id = $1
     )`,
    [id]
  );

  const photosResult = await client.query(`DELETE FROM ${Q}.photos WHERE singles_id = $1`, [id]);
  summary.photosDeleted = Number(photosResult.rowCount) || 0;

  const videosResult = await client.query(`DELETE FROM ${Q}.videos WHERE singles_id = $1`, [id]);
  summary.videosDeleted = Number(videosResult.rowCount) || 0;

  const postingsResult = await client.query(`DELETE FROM ${Q}.postings WHERE singles_id = $1`, [id]);
  summary.postingsDeleted = Number(postingsResult.rowCount) || 0;

  const vetBioResult = await client.query(`DELETE FROM ${Q}.vet_bio WHERE singles_id = $1`, [id]);
  summary.vetBioDeleted = Number(vetBioResult.rowCount) || 0;

  const miscBioResult = await client.query(`DELETE FROM ${Q}.misc_bio WHERE singles_id = $1`, [id]);
  summary.miscBioDeleted = Number(miscBioResult.rowCount) || 0;

  const requestsResult = await client.query(
    `DELETE FROM ${Q}.requests
     WHERE singles_id_from = $1 OR singles_id_to = $1`,
    [id]
  );
  summary.requestsDeleted = Number(requestsResult.rowCount) || 0;

  const monthlyResult = await client.query(`DELETE FROM ${Q}.monthly_bill WHERE singles_id = $1`, [id]);
  summary.monthlyBillsDeleted = Number(monthlyResult.rowCount) || 0;

  const yearlyResult = await client.query(`DELETE FROM ${Q}.yearly_bill WHERE singles_id = $1`, [id]);
  summary.yearlyBillsDeleted = Number(yearlyResult.rowCount) || 0;

  // Disk cleanup after DB deletes succeed (caller commits first).
  summary._photoRows = photoRows;
  summary._videoRows = videoRows;

  return summary;
}

/**
 * Hard Reset (Task 2): cascade-delete user customizations, then soft-init defaults.
 */
export async function hardResetMemberAccount(singlesId) {
  const id = toSinglesId(singlesId);
  if (await isProtectedSystemToolsAdminSinglesId(id)) {
    const err = new Error('System tools admin account cannot be reset.');
    err.statusCode = 403;
    throw err;
  }

  const client = await pool.connect();
  let wipeSummary;
  try {
    const row = await loadSinglesRow(client, id);
    if (!row) {
      const err = new Error('Singles row not found.');
      err.statusCode = 404;
      throw err;
    }

    await client.query('BEGIN');
    wipeSummary = await cascadeWipeUserContent(client, id);
    const bill = await seedDefaultBillScheduleForNewMember(client, id);
    await client.query('COMMIT');

    deletePhotosFromFolder(wipeSummary._photoRows || []);
    deleteVideosFromFolder(wipeSummary._videoRows || []);
    const folderCleanup = await deletePhotoFolderFilesForSinglesId(pool, id);
    wipeSummary.photoFolderFilesRemoved = Array.isArray(folderCleanup?.removed)
      ? folderCleanup.removed.length
      : 0;
    delete wipeSummary._photoRows;
    delete wipeSummary._videoRows;

    const demoBuddies = await ensureSeededDemoBuddiesOnLogin(pool, id, { force: true });

    return {
      ok: true,
      mode: 'hard',
      singlesId: id,
      email: row.email ?? null,
      alias: row.alias ?? null,
      wiped: wipeSummary,
      steps: {
        demoBuddies,
        billSchedule: bill,
        vaultNotes:
          'Custom TutaNotes vault data is not auto-wiped while encrypted on disk/USB. Format/re-open vault or wipe USB from the vault UI if a clean SAMPLE NOTEBOOK is required.',
        vaultAlbums:
          'Custom TutaPhotoAlbums vault data is not auto-wiped while encrypted on disk/USB. Format/re-open vault or wipe USB from the vault UI if a clean SAMPLE SET is required.'
      }
    };
  } catch (err) {
    try {
      await client.query('ROLLBACK');
    } catch {
      // ignore
    }
    throw err;
  } finally {
    client.release();
  }
}

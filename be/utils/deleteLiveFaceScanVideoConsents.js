import { CONSENT_DESCRIPTION_LIVE_FACE_SCAN_VIDEO } from '../constants/consentRecordVariants.js';
import { unlinkMemberVideoFilesFromDisk } from './videoFilePath.js';

/**
 * Delete all live-face-scan consent rows (and videos) for one member.
 * @param {import('pg').PoolClient} client
 * @param {string} schemaSqlIdent - qualified schema identifier from sqlIdent()
 * @param {number} singlesId
 */
export async function deleteLiveFaceScanVideoConsentsForMember(client, schemaSqlIdent, singlesId) {
  const prior = await client.query(
    `SELECT cr.consent_record_id, cr.consent_signature_video_fk,
            v.video_file_name, v.file_extension
     FROM ${schemaSqlIdent}.consent_record cr
     LEFT JOIN helloworldjunktest.videos v ON v.video_id = cr.consent_signature_video_fk
     WHERE cr.member_id = $1
       AND cr.description = $2`,
    [singlesId, CONSENT_DESCRIPTION_LIVE_FACE_SCAN_VIDEO]
  );

  for (const row of prior.rows) {
    if (row.consent_signature_video_fk) {
      unlinkMemberVideoFilesFromDisk({
        videoFileName: row.video_file_name,
        fileExtension: row.file_extension,
        videoId: row.consent_signature_video_fk
      });
      await client.query('DELETE FROM helloworldjunktest.videos WHERE video_id = $1 AND singles_id = $2', [
        row.consent_signature_video_fk,
        singlesId
      ]);
    }
    await client.query(`DELETE FROM ${schemaSqlIdent}.consent_record WHERE consent_record_id = $1`, [
      row.consent_record_id
    ]);
  }
}

import pool from '../db/connection.js';

const GLOBAL_ROW_ID = 1;

/** Site-wide TutaPhotoAlbums tutorial URL from helloworldjunktest.global.video_tutorial_tutaphotoalbums. */
export async function loadGlobalVideoTutorialPhotoAlbums() {
  try {
    const { rows } = await pool.query(
      `SELECT video_tutorial_tutaphotoalbums
         FROM helloworldjunktest.global
        WHERE id = $1
        LIMIT 1`,
      [GLOBAL_ROW_ID]
    );
    return String(rows[0]?.video_tutorial_tutaphotoalbums || '').trim();
  } catch {
    return '';
  }
}

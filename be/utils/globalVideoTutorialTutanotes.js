import pool from '../db/connection.js';

const GLOBAL_ROW_ID = 1;

/** Site-wide TutaNotes tutorial URL from outdateddbsnapshotoct2024.global.video_tutorial_tutanotes. */
export async function loadGlobalVideoTutorialTutanotes() {
  try {
    const { rows } = await pool.query(
      `SELECT video_tutorial_tutanotes
         FROM outdateddbsnapshotoct2024.global
        WHERE id = $1
        LIMIT 1`,
      [GLOBAL_ROW_ID]
    );
    return String(rows[0]?.video_tutorial_tutanotes || '').trim();
  } catch {
    return '';
  }
}

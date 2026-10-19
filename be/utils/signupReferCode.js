/**
 * SQL expression → a random unused singles.my_refer_code 'A1000'–'A9999' (unique index
 * singles_my_refer_code_uniq). A0000 is reserved for DEFAULT_REFER_BY_CODE.
 */
export const SQL_NEW_MY_REFER_CODE = `(
  SELECT 'A' || n FROM generate_series(1000, 9999) AS n
   WHERE NOT EXISTS (SELECT 1 FROM outdateddbsnapshotoct2024.singles t WHERE t.my_refer_code = 'A' || n)
   ORDER BY random()
   LIMIT 1
)`;

/** Existing my_refer_code, or assign a new unique A#### once (concurrent picks retry on the unique index). */
export async function ensureMyReferCode(db, singlesId) {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      const { rows } = await db.query(
        `WITH assigned AS (
           UPDATE outdateddbsnapshotoct2024.singles
              SET my_refer_code = ${SQL_NEW_MY_REFER_CODE}
            WHERE singles_id = $1 AND my_refer_code IS NULL
            RETURNING my_refer_code
         )
         SELECT my_refer_code FROM assigned
         UNION ALL
         SELECT my_refer_code FROM outdateddbsnapshotoct2024.singles WHERE singles_id = $1 AND my_refer_code IS NOT NULL
         LIMIT 1`,
        [singlesId]
      );
      return String(rows[0]?.my_refer_code ?? '').trim();
    } catch (err) {
      if (err?.code !== '23505') throw err;
    }
  }
  return '';
}

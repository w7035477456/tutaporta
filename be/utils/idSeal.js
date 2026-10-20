/**
 * ID seal (idcertified.png on the header profile photo) and the only stored face-match scores:
 *   singles.profile_dl_match        profile photo ↔ driver license face
 *   singles.profile_livescan_match  live face scan ↔ profile photo AND driver license (lower of the two)
 * Both default to 0 (= not measured). The seal needs BOTH > ID_SEAL_MATCH_MUST_EXCEED_PERCENT.
 * Shortcuts (hidden Passport "O", pilot skip, admin impersonation) never write these columns.
 */

export const ID_SEAL_MATCH_MUST_EXCEED_PERCENT = 80;

function toPercent(value) {
  const n = Number(value);
  if (value == null || value === '' || !Number.isFinite(n)) return 0;
  return Math.round(Math.min(100, Math.max(0, n)) * 100) / 100;
}

export function isIdSealMatchPassing(value) {
  return toPercent(value) > ID_SEAL_MATCH_MUST_EXCEED_PERCENT;
}

export function computeIdSealEarned(row) {
  return isIdSealMatchPassing(row?.profile_dl_match) && isIdSealMatchPassing(row?.profile_livescan_match);
}

/** Lower of the two live-scan comparisons; 0 unless both were measured. */
export function combineLiveScanMatches(liveToProfile, liveToDl) {
  const a = toPercent(liveToProfile);
  const b = toPercent(liveToDl);
  return a > 0 && b > 0 ? Math.min(a, b) : 0;
}

/** Omit a key to leave that column unchanged. */
export async function updateSinglesIdSealMatch(db, singlesId, { profileLivescanMatch, profileDlMatch } = {}) {
  const sets = [];
  const values = [];
  if (profileLivescanMatch !== undefined) {
    values.push(toPercent(profileLivescanMatch));
    sets.push(`profile_livescan_match = $${values.length}`);
  }
  if (profileDlMatch !== undefined) {
    values.push(toPercent(profileDlMatch));
    sets.push(`profile_dl_match = $${values.length}`);
  }
  if (!sets.length) return;
  values.push(singlesId);
  await db.query(
    `UPDATE outdateddbsnapshotoct2024.singles
     SET ${sets.join(', ')}, updated_at = CURRENT_TIMESTAMP
     WHERE singles_id = $${values.length}`,
    values
  );
}

/** vet_bio.profilephoto_vetted mirrors the seal decision. */
export function profilePhotoVettedFromIdSealMatches({ profileDlMatch, profileLivescanMatch }) {
  const dl = toPercent(profileDlMatch);
  const live = toPercent(profileLivescanMatch);
  const passed = isIdSealMatchPassing(dl) && isIdSealMatchPassing(live);
  return {
    profilephoto_vetted: passed ? 'info_matches' : 'info_not_matches',
    profilephoto_vetted_note: `Profile&DL ${Math.round(dl)}%, Live scan ${Math.round(live)}%`
  };
}

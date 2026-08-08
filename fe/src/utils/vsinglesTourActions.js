import { getApiBaseUrl } from 'config/apiBaseUrl';
import { postMarkInterested } from 'api/allSinglesFe';
import { postInterestedRequestInfo } from 'api/interestedSinglesFe';
import { invalidateMyPicksListCache } from 'api/myPicksFe';
import { formatMemberNumber } from 'utils/memberLabel';

/** Demo members used during guided tour Step 1 → Step 2 transition (six-digit member_id). */
export const TOUR_DEMO_MEMBER_NUMBERS = ['100164', '100357', '100236'];

/** Lisa_2 — Full Bio Approved demo member for Step 4 SMS Chat. */
/** Tour Lisa (a2@b.com, DemoUser singles_id=2) — six-digit member_id for formatMemberNumber match. */
export const TOUR_LISA_MEMBER_NUMBER = '100236';

async function fetchAllSinglesRaw() {
  const res = await fetch(`${getApiBaseUrl()}/api/allSingles`, { credentials: 'include' });
  if (!res.ok) {
    throw new Error(`Failed to load singles (${res.status})`);
  }
  return res.json();
}

function memberNumberFor(person) {
  return formatMemberNumber(person?.prefix, person?.member_id);
}

/**
 * Marks the three tour demo members as My Picks (same as clicking each My Picks button).
 */
export async function markTourDemoMembersAsPicks() {
  const singles = await fetchAllSinglesRaw();
  if (!Array.isArray(singles)) return;

  for (const memberNumber of TOUR_DEMO_MEMBER_NUMBERS) {
    const person = singles.find((row) => memberNumberFor(row) === memberNumber);
    if (!person?.singles_id) continue;
    try {
      await postMarkInterested(person.singles_id);
    } catch {
      // Already picked or transient error — continue with remaining demo members.
    }
  }

  await invalidateMyPicksListCache();
}

async function fetchMyPicksListRaw() {
  const res = await fetch(`${getApiBaseUrl()}/api/myPicks/list`, { credentials: 'include' });
  if (!res.ok) {
    throw new Error(`Failed to load My Picks (${res.status})`);
  }
  return res.json();
}

/**
 * Clicks Brief Bio Avail for each tour demo pick (brief_bio_request → requested).
 */
export async function requestTourDemoBriefBios() {
  const list = await fetchMyPicksListRaw();
  if (!Array.isArray(list)) return;

  for (const memberNumber of TOUR_DEMO_MEMBER_NUMBERS) {
    const person = list.find((row) => memberNumberFor(row) === memberNumber);
    const singlesId = Number(person?.singles_id);
    if (!Number.isFinite(singlesId) || singlesId < 1) continue;

    const alreadyRequested = String(person?.brief_bio_request ?? '').trim().toLowerCase() === 'requested';
    if (alreadyRequested) continue;

    try {
      await postInterestedRequestInfo(singlesId, { brief_bio_request: 'requested' });
    } catch {
      // Continue with remaining demo members.
    }
  }

  await invalidateMyPicksListCache();
}

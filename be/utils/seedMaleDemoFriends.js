/**
 * Seed a male member with the same demo-social starter pack as Gary (JazzyJeff / dm4@gmail.com):
 *   - 3 My Picks: RapidRuth, GiddyGail, SillySue (interested)
 *   - RapidRuth: mutual approved Buddy (full bio) + full_paid (skip token debit popup)
 *   - GiddyGail: mutual approved Acquaint (brief bio) + brief_paid (skip token debit popup)
 *   - SillySue: outgoing Buddy request with noresponse (she never answers)
 *   - 1 public welcome posting with profile photo attached (`posting_photos.photo_url=/api/photo/{profile_image_fk}`)
 *     and created_at a few weeks after this member's previous post (first post: random in last 3 years)
 *
 * Idempotent upserts for requests; upgrades legacy hiking seed post / attaches missing photo.
 *
 * Library (called on login via ensureSeededDemoBuddiesOnLogin):
 *   import { seedMaleDemoFriendsForSinglesId } from '../utils/seedMaleDemoFriends.js';
 *
 * CLI:
 *   node be/scripts/seedMaleDemoFriends.js --email=regularmember2@gmail.com
 *   node be/scripts/seedMaleDemoFriends.js --singles-id=36
 *   node be/scripts/seedMaleDemoFriends.js --email=… --dry-run
 *
 * On success sets singles.seeded_demo_buddies_boolean = true.
 */
import { allocateRequestsId } from '../routes/singles/requestsUpsert.js';
import { booleanEnumCast, toBooleanEnumLabel } from './booleanEnum.js';
import { ensurePostingQuarterlyPartitionsBeforeWrite } from './ensureQuarterlyPartitions.js';
import {
  DEFAULT_LOOKBACK_YEARS,
  loadLatestPostingCreatedAt,
  randomTimestampAfterPrevious,
  randomTimestampWithinLastYears
} from './regularMemberActivityTimestamp.js';

export const SCHEMA = 'helloworldjunktest';

/** Template male (Gary / JazzyJeff). */
export const MALE_DEMO_TEMPLATE_EMAIL = 'dm4@gmail.com';

/** Fixed demo women (aliases must match helloworldjunktest.singles.alias). */
export const MALE_DEMO_FRIENDS = Object.freeze({
  buddy: { alias: 'RapidRuth', email: 'dm8@gmail.com', role: 'buddy' },
  acquaint: { alias: 'GiddyGail', email: 'dm9@gmail.com', role: 'acquaint' },
  pending: { alias: 'SillySue', email: 'dm10@gmail.com', role: 'pending_buddy_request' }
});

/** Public welcome posting (Review Postings) + profile photo attachment. */
export const MALE_DEMO_SAMPLE_POST_CONTENT =
  'Hi everyone! I am new to this site. Just wanted to drop in and say hello and attached my profile Photo! I\'m looking forward to getting to know you all and making new friends. I look forward to send out a few "Buddies Requests" soon, so please feel free to send one back as well. Ciao!';

/** Prior seed caption — upgraded in place to the welcome post + photo. */
const MALE_DEMO_LEGACY_POST_CONTENT = 'Hey we just went hiking, here are some photos:';

const TRUE = toBooleanEnumLabel(true);
const FALSE = toBooleanEnumLabel(false);
const CAST = booleanEnumCast(SCHEMA);
const Q = `"${SCHEMA}"`;
const PAID_ENTRY_SEED = 'seedMaleDemoFriends';

/**
 * @param {import('pg').Pool | import('pg').PoolClient} db
 * @param {string} email
 */
export async function findSinglesByEmail(db, email) {
  const normalized = String(email ?? '')
    .trim()
    .toLowerCase();
  if (!normalized) return null;
  const { rows } = await db.query(
    `SELECT singles_id, member_id, alias, email, member_category, status, profile_image_fk
     FROM ${Q}.singles
     WHERE LOWER(TRIM(email)) = $1
     ORDER BY singles_id
     LIMIT 1`,
    [normalized]
  );
  return rows[0] ?? null;
}

/**
 * @param {import('pg').Pool | import('pg').PoolClient} db
 * @param {number} singlesId
 */
export async function findSinglesById(db, singlesId) {
  const id = Math.trunc(Number(singlesId));
  if (!Number.isFinite(id) || id < 1) return null;
  const { rows } = await db.query(
    `SELECT singles_id, member_id, alias, email, member_category, status, profile_image_fk
     FROM ${Q}.singles
     WHERE singles_id = $1
     LIMIT 1`,
    [id]
  );
  return rows[0] ?? null;
}

/**
 * Resolve RapidRuth / GiddyGail / SillySue by email then alias.
 * @param {import('pg').Pool | import('pg').PoolClient} db
 */
export async function resolveMaleDemoFriendRows(db) {
  const out = {};
  for (const [key, def] of Object.entries(MALE_DEMO_FRIENDS)) {
    let row = await findSinglesByEmail(db, def.email);
    if (!row) {
      const { rows } = await db.query(
        `SELECT singles_id, member_id, alias, email, member_category, status
         FROM ${Q}.singles
         WHERE LOWER(TRIM(alias)) = LOWER(TRIM($1))
         ORDER BY singles_id
         LIMIT 1`,
        [def.alias]
      );
      row = rows[0] ?? null;
    }
    if (!row) {
      throw new Error(`Demo friend missing: ${def.alias} (${def.email}). Seed DemoUser rows first.`);
    }
    out[key] = { ...def, ...row, singles_id: Number(row.singles_id) };
  }
  return out;
}

/**
 * Upsert one requests row to exact starter-pack field values.
 * @param {import('pg').PoolClient} client
 */
async function upsertRequestRow(
  client,
  {
    fromId,
    toId,
    interested = true,
    briefRequest = 'notrequested',
    briefApproval = 'noresponse',
    fullRequest = 'notrequested',
    fullApproval = 'noresponse',
    briefPaid = false,
    fullPaid = false
  }
) {
  const interestedLabel = interested ? TRUE : FALSE;
  const briefPaidLabel = briefPaid ? TRUE : FALSE;
  const fullPaidLabel = fullPaid ? TRUE : FALSE;
  const briefPaidDate = briefPaid ? new Date() : null;
  const fullPaidDate = fullPaid ? new Date() : null;
  const briefPaidEntry = briefPaid ? PAID_ENTRY_SEED : null;
  const fullPaidEntry = fullPaid ? PAID_ENTRY_SEED : null;

  const params = [
    fromId,
    toId,
    interestedLabel,
    briefRequest,
    briefApproval,
    fullRequest,
    fullApproval,
    briefPaidLabel,
    fullPaidLabel,
    briefPaidDate,
    fullPaidDate,
    briefPaidEntry,
    fullPaidEntry
  ];

  const updated = await client.query(
    `UPDATE ${Q}.requests
     SET interested = $3::${CAST},
         brief_bio_request = $4::${Q}.request_status_enum,
         brief_bio_request_approval = $5::${Q}.approval_status_enum,
         full_bio_request = $6::${Q}.request_status_enum,
         full_bio_request_approval = $7::${Q}.approval_status_enum,
         brief_paid = $8::${CAST},
         full_paid = $9::${CAST},
         brief_paid_date = $10::date,
         full_paid_date = $11::date,
         brief_paid_entry = $12,
         full_paid_entry = $13,
         updated_at = CURRENT_TIMESTAMP
     WHERE singles_id_from = $1 AND singles_id_to = $2
     RETURNING requests_id`,
    params
  );
  if (updated.rowCount > 0) {
    return { requestsId: Number(updated.rows[0].requests_id), inserted: false };
  }

  const requestsId = await allocateRequestsId(SCHEMA, Q, client);
  await client.query(
    `INSERT INTO ${Q}.requests (
       requests_id, singles_id_from, singles_id_to,
       interested,
       brief_bio_request, brief_bio_request_approval,
       full_bio_request, full_bio_request_approval,
       brief_paid, full_paid,
       brief_paid_date, full_paid_date,
       brief_paid_entry, full_paid_entry
     ) VALUES (
       $1, $2, $3,
       $4::${CAST},
       $5::${Q}.request_status_enum,
       $6::${Q}.approval_status_enum,
       $7::${Q}.request_status_enum,
       $8::${Q}.approval_status_enum,
       $9::${CAST},
       $10::${CAST},
       $11::date,
       $12::date,
       $13,
       $14
     )`,
    [
      requestsId,
      fromId,
      toId,
      interestedLabel,
      briefRequest,
      briefApproval,
      fullRequest,
      fullApproval,
      briefPaidLabel,
      fullPaidLabel,
      briefPaidDate,
      fullPaidDate,
      briefPaidEntry,
      fullPaidEntry
    ]
  );
  return { requestsId, inserted: true };
}

async function resolveOwnedProfilePhotoId(client, maleId) {
  const { rows } = await client.query(
    `SELECT s.profile_image_fk, p.photos_id
     FROM ${Q}.singles s
     LEFT JOIN ${Q}.photos p
       ON p.photos_id = s.profile_image_fk
      AND p.singles_id = s.singles_id
     WHERE s.singles_id = $1
     LIMIT 1`,
    [maleId]
  );
  const fk = Number(rows[0]?.profile_image_fk);
  const owned = Number(rows[0]?.photos_id);
  if (!Number.isFinite(fk) || fk < 1) {
    throw new Error(
      `singles_id=${maleId} has no profile_image_fk — set a profile photo before seeding the welcome posting.`
    );
  }
  if (!Number.isFinite(owned) || owned < 1) {
    throw new Error(
      `singles_id=${maleId} profile_image_fk=${fk} is missing or not owned by this member in photos.`
    );
  }
  return fk;
}

async function ensurePostingHasProfilePhoto(client, postId, photoUrl) {
  const existing = await client.query(
    `SELECT photo_id
     FROM ${Q}.posting_photos
     WHERE post_id = $1
       AND split_part(photo_url, '?', 1) = $2
     LIMIT 1`,
    [postId, photoUrl]
  );
  if (existing.rows[0]) {
    return { photoId: Number(existing.rows[0].photo_id), inserted: false };
  }
  const { rows } = await client.query(
    `INSERT INTO ${Q}.posting_photos (post_id, post_created_at, photo_url, sort_order)
     SELECT $1, p.created_at, $2, 0
     FROM ${Q}.postings p
     WHERE p.post_id = $1
     RETURNING photo_id`,
    [postId, photoUrl]
  );
  if (!rows[0]) {
    throw new Error(`Failed to attach profile photo to post_id=${postId}`);
  }
  return { photoId: Number(rows[0].photo_id), inserted: true };
}

/**
 * Create/upgrade the public welcome posting with the member's profile photo attached
 * (same shape as createMyPosting: postings row + posting_photos.photo_url=/api/photo/:id).
 */
async function ensureSamplePosting(client, maleId, { dryRun = false, forcePost = false, createdAt = null } = {}) {
  const content = MALE_DEMO_SAMPLE_POST_CONTENT;
  const photoFk = await resolveOwnedProfilePhotoId(client, maleId);
  const photoUrl = `/api/photo/${photoFk}`;

  if (dryRun) {
    return {
      postId: null,
      photoUrl,
      profileImageFk: photoFk,
      inserted: true,
      skipped: false,
      dryRun: true
    };
  }

  const existing = await client.query(
    `SELECT post_id, created_at, BTRIM(COALESCE(content, '')) AS content
     FROM ${Q}.postings
     WHERE singles_id = $1
       AND parent_post_id IS NULL
       AND BTRIM(COALESCE(content, '')) IN ($2, $3)
     ORDER BY
       CASE WHEN BTRIM(COALESCE(content, '')) = $2 THEN 0 ELSE 1 END,
       created_at DESC
     LIMIT 1`,
    [maleId, content, MALE_DEMO_LEGACY_POST_CONTENT]
  );

  let postId = existing.rows[0] ? Number(existing.rows[0].post_id) : null;
  let inserted = false;
  let upgraded = false;
  let resolvedCreatedAt = existing.rows[0]?.created_at ?? null;

  if (postId && !forcePost) {
    const priorContent = String(existing.rows[0].content ?? '');
    if (priorContent !== content) {
      await client.query(
        `UPDATE ${Q}.postings
         SET content = $2,
             posting_visibility = 'public'
         WHERE post_id = $1`,
        [postId, content]
      );
      upgraded = true;
    }
  } else {
    const postCreatedAt =
      createdAt instanceof Date ? createdAt : randomTimestampWithinLastYears(DEFAULT_LOOKBACK_YEARS);
    const { rows } = await client.query(
      `INSERT INTO ${Q}.postings (singles_id, content, posting_visibility, created_at)
       VALUES ($1, $2, 'public', $3::timestamptz)
       RETURNING post_id, created_at`,
      [maleId, content, postCreatedAt.toISOString()]
    );
    postId = Number(rows[0].post_id);
    inserted = true;
    resolvedCreatedAt = rows[0].created_at ?? postCreatedAt;
  }

  if (!Number.isFinite(postId) || postId < 1) {
    throw new Error('Failed to create welcome posting');
  }

  const photo = await ensurePostingHasProfilePhoto(client, postId, photoUrl);

  return {
    postId,
    createdAt: resolvedCreatedAt,
    photoUrl,
    profileImageFk: photoFk,
    photoId: photo.photoId,
    photoInserted: photo.inserted,
    inserted,
    upgraded,
    skipped: !inserted && !upgraded && !photo.inserted
  };
}

/**
 * Apply Gary-style demo friends + one sample posting to an existing male singles row.
 *
 * @param {import('pg').Pool | import('pg').PoolClient} db
 * @param {number} maleSinglesId
 * @param {{ dryRun?: boolean, forcePost?: boolean }} [opts]
 */
export async function seedMaleDemoFriendsForSinglesId(db, maleSinglesId, opts = {}) {
  const dryRun = Boolean(opts.dryRun);
  const forcePost = Boolean(opts.forcePost);
  const male = await findSinglesById(db, maleSinglesId);
  if (!male) {
    throw new Error(`Male singles_id not found: ${maleSinglesId}`);
  }
  const maleId = Number(male.singles_id);
  if (maleId === (await findSinglesByEmail(db, MALE_DEMO_TEMPLATE_EMAIL))?.singles_id) {
    throw new Error('Refusing to seed the template account itself (dm4@gmail.com / JazzyJeff).');
  }

  const friends = await resolveMaleDemoFriendRows(db);
  const ruthId = friends.buddy.singles_id;
  const gailId = friends.acquaint.singles_id;
  const sueId = friends.pending.singles_id;

  if (maleId === ruthId || maleId === gailId || maleId === sueId) {
    throw new Error('Target cannot be one of the demo women (RapidRuth / GiddyGail / SillySue).');
  }

  const plan = {
    male: {
      singles_id: maleId,
      alias: male.alias,
      email: male.email,
      member_category: male.member_category
    },
    friends: {
      RapidRuth: { singles_id: ruthId, email: friends.buddy.email },
      GiddyGail: { singles_id: gailId, email: friends.acquaint.email },
      SillySue: { singles_id: sueId, email: friends.pending.email }
    },
    relationships: [
      'male → RapidRuth: My Pick + mutual Buddy (full approve) + full_paid',
      'RapidRuth → male: mutual Buddy (full approve)',
      'male → GiddyGail: My Pick + mutual Acquaint (brief approve) + brief_paid',
      'GiddyGail → male: mutual Acquaint (brief approve)',
      'male → SillySue: My Pick + Buddy request (noresponse)',
      'one public welcome posting + profile photo (/api/photo/{profile_image_fk})'
    ]
  };

  if (dryRun) {
    return { dryRun: true, ...plan, requests: [], posting: { dryRun: true } };
  }

  // Backdated created_at: a few weeks after this member's previous post (first post:
  // random in last 3 years). Ensure the target quarter exists BEFORE BEGIN.
  // DDL inside an open postings transaction deadlocks (ACCESS EXCLUSIVE vs RowShare).
  const previousAt = await loadLatestPostingCreatedAt(db, SCHEMA, maleId);
  const postCreatedAt = previousAt
    ? randomTimestampAfterPrevious(previousAt)
    : randomTimestampWithinLastYears(DEFAULT_LOOKBACK_YEARS);
  await ensurePostingQuarterlyPartitionsBeforeWrite(postCreatedAt);

  const ownsClient = typeof db.connect === 'function';
  const client = ownsClient ? await db.connect() : db;
  const requests = [];

  try {
    if (ownsClient) await client.query('BEGIN');

    // 1) RapidRuth — mutual buddy (viewer already paid for full bio = 2 tokens)
    requests.push({
      label: 'male→RapidRuth buddy',
      ...(await upsertRequestRow(client, {
        fromId: maleId,
        toId: ruthId,
        interested: true,
        briefRequest: 'notrequested',
        briefApproval: 'noresponse',
        fullRequest: 'requested',
        fullApproval: 'approve',
        fullPaid: true
      }))
    });
    requests.push({
      label: 'RapidRuth→male buddy',
      ...(await upsertRequestRow(client, {
        fromId: ruthId,
        toId: maleId,
        interested: true,
        briefRequest: 'notrequested',
        briefApproval: 'noresponse',
        fullRequest: 'requested',
        fullApproval: 'approve'
      }))
    });

    // 2) GiddyGail — mutual acquaint (viewer already paid for brief bio = 1 token)
    requests.push({
      label: 'male→GiddyGail acquaint',
      ...(await upsertRequestRow(client, {
        fromId: maleId,
        toId: gailId,
        interested: true,
        briefRequest: 'requested',
        briefApproval: 'approve',
        fullRequest: 'notrequested',
        fullApproval: 'noresponse',
        briefPaid: true
      }))
    });
    requests.push({
      label: 'GiddyGail→male acquaint',
      ...(await upsertRequestRow(client, {
        fromId: gailId,
        toId: maleId,
        interested: true,
        briefRequest: 'requested',
        briefApproval: 'approve',
        fullRequest: 'notrequested',
        fullApproval: 'noresponse'
      }))
    });

    // 3) SillySue — pick + unanswered full-bio request (no reverse row)
    requests.push({
      label: 'male→SillySue pending',
      ...(await upsertRequestRow(client, {
        fromId: maleId,
        toId: sueId,
        interested: true,
        briefRequest: 'notrequested',
        briefApproval: 'noresponse',
        fullRequest: 'requested',
        fullApproval: 'noresponse'
      }))
    });

    const posting = await ensureSamplePosting(client, maleId, { forcePost, createdAt: postCreatedAt });

    if (ownsClient) await client.query('COMMIT');

    // Outside the request/posting txn — flag means pack was applied.
    await db.query(
      `UPDATE ${Q}.singles
       SET seeded_demo_buddies_boolean = '${TRUE}'::${CAST},
           updated_at = CURRENT_TIMESTAMP
       WHERE singles_id = $1`,
      [maleId]
    );

    return { dryRun: false, ...plan, requests, posting };
  } catch (err) {
    if (ownsClient) {
      try {
        await client.query('ROLLBACK');
      } catch {
        // ignore
      }
    }
    throw err;
  } finally {
    if (ownsClient) client.release();
  }
}

/**
 * @param {import('pg').Pool | import('pg').PoolClient} db
 * @param {{ email?: string, singlesId?: number, dryRun?: boolean, forcePost?: boolean }} opts
 */
export async function seedMaleDemoFriends(db, opts = {}) {
  let male = null;
  if (opts.singlesId != null) {
    male = await findSinglesById(db, opts.singlesId);
  } else if (opts.email) {
    male = await findSinglesByEmail(db, opts.email);
  }
  if (!male) {
    throw new Error('Provide a valid --singles-id or --email for the male member to seed.');
  }
  return seedMaleDemoFriendsForSinglesId(db, Number(male.singles_id), {
    dryRun: opts.dryRun,
    forcePost: opts.forcePost
  });
}

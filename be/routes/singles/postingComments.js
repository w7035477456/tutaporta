import pool from '../../db/connection.js';
import { resolveRequestsAppSchema } from './resolveRequestsAppSchema.js';
import {
  canViewTargetFriendsPosts,
  canViewTargetFullBio,
  postingVisibilityExpr,
  relationExists,
  resolvePostingVisibilityColumn,
  resolvePostingsSchema
} from './getMyPicks.js';
import { sanitizePostingCommentText } from '../../utils/postingCommentContactSanitizer.js';
import { formatMemberDisplayCode } from '../../utils/memberDisplayCode.js';
import {
  sqlBooleanEnumColumnAsBool,
  sqlBooleanEnumIsTrue,
  sqlBooleanEnumParam,
  toBooleanEnumLabel
} from '../../utils/booleanEnum.js';
import { ensurePostingQuarterlyPartitionsBeforeWrite } from '../../utils/ensureQuarterlyPartitions.js';

const POSTING_COMMENT_BOOLEAN_ENUM_COLS = new Set(['is_liked', 'is_shared']);

function isPostingCommentBooleanEnumColumn(column, udtByColumn) {
  return POSTING_COMMENT_BOOLEAN_ENUM_COLS.has(column) && udtByColumn.get(column) === 'boolean_enum';
}

function postingCommentBoolIsTrue(alias, column, udtByColumn) {
  if (isPostingCommentBooleanEnumColumn(column, udtByColumn)) {
    return sqlBooleanEnumIsTrue(alias, column);
  }
  if (POSTING_COMMENT_BOOLEAN_ENUM_COLS.has(column)) {
    return `${alias}.${column} IS TRUE`;
  }
  return sqlBooleanEnumIsTrue(alias, column);
}

function postingCommentBoolParam(paramRef, column, udtByColumn, postingsSchema) {
  if (isPostingCommentBooleanEnumColumn(column, udtByColumn)) {
    return sqlBooleanEnumParam(paramRef, postingsSchema);
  }
  return paramRef;
}

function postingCommentBoolColumnAsBool(columnRef, asName, column, udtByColumn) {
  if (isPostingCommentBooleanEnumColumn(column, udtByColumn)) {
    return sqlBooleanEnumColumnAsBool(columnRef, asName);
  }
  return `(${columnRef}) AS ${asName}`;
}

function normalizePostingCommentBoolValue(column, value, udtByColumn) {
  if (isPostingCommentBooleanEnumColumn(column, udtByColumn)) {
    return toBooleanEnumLabel(value);
  }
  return Boolean(value);
}

function normalizePostingCommentInsertValues(insertColumns, insertValues, udtByColumn) {
  return insertColumns.map((column, index) => {
    if (POSTING_COMMENT_BOOLEAN_ENUM_COLS.has(column)) {
      return normalizePostingCommentBoolValue(column, insertValues[index], udtByColumn);
    }
    return insertValues[index];
  });
}

function postingCommentInsertPlaceholder(postingsSchema, column, paramRef, udtByColumn) {
  if (POSTING_COMMENT_BOOLEAN_ENUM_COLS.has(column)) {
    return postingCommentBoolParam(paramRef, column, udtByColumn, postingsSchema);
  }
  return paramRef;
}

async function tableColumnMeta(schemaName, tableName) {
  const result = await pool.query(
    `SELECT column_name, udt_name
     FROM information_schema.columns
     WHERE table_schema = $1
       AND table_name = $2`,
    [schemaName, tableName]
  );
  const columns = new Set();
  const udtByColumn = new Map();
  for (const row of result.rows) {
    columns.add(row.column_name);
    udtByColumn.set(row.column_name, String(row.udt_name || '').toLowerCase());
  }
  return { columns, udtByColumn };
}

async function tableColumns(schemaName, tableName) {
  const { columns } = await tableColumnMeta(schemaName, tableName);
  return columns;
}

/** Partitioned posting_comments require photo_post_created_at from posting_photos. */
function buildPostingCommentInsertQuery(postingsSchema, commentColumns, insertColumns, insertValues, udtByColumn) {
  const normalizedValues = normalizePostingCommentInsertValues(insertColumns, insertValues, udtByColumn);

  if (!commentColumns.has('photo_post_created_at')) {
    const placeholders = insertColumns.map((column, index) =>
      postingCommentInsertPlaceholder(postingsSchema, column, `$${index + 1}`, udtByColumn)
    );
    return {
      text: `INSERT INTO ${postingsSchema}.posting_comments (${insertColumns.join(', ')})
             VALUES (${placeholders.join(', ')})`,
      values: normalizedValues
    };
  }

  const photoId = normalizedValues[insertColumns.indexOf('photo_id')];
  const columns = insertColumns.includes('photo_post_created_at')
    ? insertColumns
    : [...insertColumns, 'photo_post_created_at'];
  const selectParts = [];
  const values = [];
  let paramIndex = 1;
  for (const column of columns) {
    if (column === 'photo_post_created_at') {
      selectParts.push('pp.post_created_at');
      continue;
    }
    selectParts.push(postingCommentInsertPlaceholder(postingsSchema, column, `$${paramIndex}`, udtByColumn));
    values.push(normalizedValues[insertColumns.indexOf(column)]);
    paramIndex += 1;
  }
  return {
    text: `INSERT INTO ${postingsSchema}.posting_comments (${columns.join(', ')})
           SELECT ${selectParts.join(', ')}
           FROM ${postingsSchema}.posting_photos pp
           WHERE pp.photo_id = $${paramIndex}`,
    values: [...values, photoId]
  };
}

async function resolvePostingsOwnerColumn(postingsSchema) {
  const columns = await tableColumns(postingsSchema, 'postings');
  if (columns.has('singles_id')) return 'singles_id';
  if (columns.has('user_id')) return 'user_id';
  return 'singles_id';
}

async function postingCommentsTableExists(postingsSchema) {
  return relationExists(postingsSchema, 'posting_comments');
}

async function canViewPosting(requestSchema, postingsSchema, me, postId) {
  const ownerColumn = await resolvePostingsOwnerColumn(postingsSchema);
  const postResult = await pool.query(
    `SELECT p.post_id, p.${ownerColumn} AS post_owner_id
     FROM ${postingsSchema}.postings p
     WHERE p.post_id = $1
     LIMIT 1`,
    [postId]
  );
  if (!postResult.rows.length) return null;

  const postOwnerId = Number(postResult.rows[0].post_owner_id);
  if (postOwnerId === me) {
    return { post_owner_id: postOwnerId };
  }

  const [canViewPrivatePosts, canViewFriendsPosts, postingVisibilityColumn] = await Promise.all([
    canViewTargetFullBio(requestSchema, me, postOwnerId),
    canViewTargetFriendsPosts(requestSchema, me, postOwnerId),
    resolvePostingVisibilityColumn(postingsSchema)
  ]);
  const visibilityExpr = postingVisibilityExpr(postingVisibilityColumn, 'p');
  const privateVisibilityFilter = canViewPrivatePosts
    ? `AND (${visibilityExpr}) <> 'mySelf'`
    : canViewFriendsPosts
      ? `AND (${visibilityExpr}) IN ('public','friends')`
      : `AND (${visibilityExpr}) = 'public'`;

  const visible = await pool.query(
    `SELECT p.post_id
     FROM ${postingsSchema}.postings p
     WHERE p.post_id = $1
       AND p.${ownerColumn} = $2
       ${privateVisibilityFilter}
     LIMIT 1`,
    [postId, postOwnerId]
  );
  if (!visible.rows.length) return null;
  return { post_owner_id: postOwnerId };
}

async function canViewPostingPhoto(requestSchema, postingsSchema, me, photoId) {
  const ownerColumn = await resolvePostingsOwnerColumn(postingsSchema);
  const photoResult = await pool.query(
    `SELECT pp.photo_id, pp.post_id, p.${ownerColumn} AS post_owner_id
     FROM ${postingsSchema}.posting_photos pp
     JOIN ${postingsSchema}.postings p ON p.post_id = pp.post_id
     WHERE pp.photo_id = $1
     LIMIT 1`,
    [photoId]
  );
  if (!photoResult.rows.length) return null;
  const postId = Number(photoResult.rows[0].post_id);
  const access = await canViewPosting(requestSchema, postingsSchema, me, postId);
  if (!access) return null;
  return {
    photo_id: Number(photoResult.rows[0].photo_id),
    post_id: postId,
    post_owner_id: Number(access.post_owner_id)
  };
}

function formatMemberId(_prefix, memberId) {
  return formatMemberDisplayCode(memberId);
}

function mapCommentRow(row, me, postOwnerId) {
  const alias = String(row.alias ?? '').trim();
  const originalText = row.posting_text ?? '';
  const cleanedStored = row.posting_text_clean ?? originalText;
  const isPostOwnerViewing = Number(postOwnerId) === Number(me);
  const isCommentAuthorViewing = Number(row.author_id) === Number(me);
  const canSeeOriginalText = isPostOwnerViewing || isCommentAuthorViewing;
  const visibleText = canSeeOriginalText ? originalText : sanitizePostingCommentText(cleanedStored);
  return {
    comment_id: Number(row.comment_id),
    photo_id: Number(row.photo_id),
    post_id: row.post_id == null ? null : Number(row.post_id),
    author_id: Number(row.author_id),
    created_at: row.created_at,
    posting_text: visibleText,
    alias,
    member_id: row.member_id ?? null,
    prefix: row.prefix ?? null,
    member_number: formatMemberId(row.prefix, row.member_id),
    can_delete: Number(row.author_id) === me || Number(postOwnerId) === me
  };
}

export async function getPostingComments(req, res) {
  const me = Number(req.auth?.singles_id);
  const postId = Number(req.params.postId);
  if (!Number.isFinite(me) || me < 1) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  if (!Number.isFinite(postId) || postId < 1) {
    return res.status(400).json({ error: 'Invalid post id' });
  }

  try {
    const postingsSchema = await resolvePostingsSchema();
    if (!(await postingCommentsTableExists(postingsSchema))) {
      return res.status(503).json({ error: 'Posting comments are not available on this server yet' });
    }
    const requestSchema = await resolveRequestsAppSchema();
    const access = await canViewPosting(requestSchema, postingsSchema, me, postId);
    if (!access) {
      return res.status(404).json({ error: 'Posting not found' });
    }

    const { columns: commentColumns, udtByColumn } = await tableColumnMeta(postingsSchema, 'posting_comments');
    const aliasSelect = commentColumns.has('alias') ? 'pc.alias' : 's.alias AS alias';
    const postingTextCleanSelect = commentColumns.has('posting_text_clean')
      ? 'pc.posting_text_clean'
      : 'NULL::text AS posting_text_clean';

    const rows = await pool.query(
      `SELECT
         pc.comment_id,
         pc.photo_id,
         pc.author_id,
         pc.created_at,
         pc.posting_text,
         ${postingTextCleanSelect},
         ${aliasSelect},
         s.prefix,
         s.member_id,
         s.alias,
         pp.post_id
       FROM ${postingsSchema}.posting_comments pc
       JOIN ${postingsSchema}.posting_photos pp ON pp.photo_id = pc.photo_id
       LEFT JOIN ${requestSchema}.singles s ON s.singles_id = pc.author_id
       WHERE pp.post_id = $1
         AND NOT ${postingCommentBoolIsTrue('pc', 'is_liked', udtByColumn)}
       ORDER BY pc.created_at ASC, pc.comment_id ASC`,
      [postId]
    );

    return res.json({
      post_id: postId,
      post_owner_id: Number(access.post_owner_id),
      comments: rows.rows.map((row) => mapCommentRow(row, me, access.post_owner_id))
    });
  } catch (error) {
    console.error('getPostingComments error:', error);
    return res.status(500).json({ error: 'Failed to load posting comments' });
  }
}

export async function createPostingComment(req, res) {
  const me = Number(req.auth?.singles_id);
  const photoId = Number(req.params.photoId);
  const postingText = String(req.body?.posting_text ?? req.body?.comment_text ?? '').trim();
  if (!Number.isFinite(me) || me < 1) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  if (!Number.isFinite(photoId) || photoId < 1) {
    return res.status(400).json({ error: 'Invalid photo id' });
  }
  if (!postingText) {
    return res.status(400).json({ error: 'Comment text is required' });
  }

  try {
    const postingsSchema = await resolvePostingsSchema();
    if (!(await postingCommentsTableExists(postingsSchema))) {
      return res.status(503).json({ error: 'Posting comments are not available on this server yet' });
    }
    const requestSchema = await resolveRequestsAppSchema();
    const access = await canViewPostingPhoto(requestSchema, postingsSchema, me, photoId);
    if (!access) {
      return res.status(404).json({ error: 'Posting photo not found' });
    }

    const { columns: commentColumns, udtByColumn } = await tableColumnMeta(postingsSchema, 'posting_comments');
    const aliasFromBody = String(req.body?.alias ?? '').trim();
    let alias = aliasFromBody;
    if (!alias) {
      const aliasRow = await pool.query(
        `SELECT alias
         FROM ${requestSchema}.singles
         WHERE singles_id = $1
         LIMIT 1`,
        [me]
      );
      alias = String(aliasRow.rows[0]?.alias ?? '').trim();
    }
    const postingTextClean = sanitizePostingCommentText(postingText);

    const insertColumns = ['photo_id', 'author_id', 'posting_text'];
    const insertValues = [photoId, me, postingText];
    if (commentColumns.has('posting_text_clean')) {
      insertColumns.push('posting_text_clean');
      insertValues.push(postingTextClean);
    }
    if (commentColumns.has('is_liked')) {
      insertColumns.push('is_liked');
      insertValues.push(false);
    }
    if (commentColumns.has('is_shared')) {
      insertColumns.push('is_shared');
      insertValues.push(false);
    }
    if (commentColumns.has('alias')) {
      insertColumns.push('alias');
      insertValues.push(alias || null);
    }
    await ensurePostingQuarterlyPartitionsBeforeWrite();
    const insertQuery = buildPostingCommentInsertQuery(
      postingsSchema,
      commentColumns,
      insertColumns,
      insertValues,
      udtByColumn
    );
    const insert = await pool.query(
      `${insertQuery.text}
       RETURNING comment_id, photo_id, author_id, created_at, posting_text${commentColumns.has('posting_text_clean') ? ', posting_text_clean' : ''}${commentColumns.has('alias') ? ', alias' : ''}`,
      insertQuery.values
    );
    const row = insert.rows[0];
    const memberRow = await pool.query(
      `SELECT prefix, member_id, alias
       FROM ${requestSchema}.singles
       WHERE singles_id = $1
       LIMIT 1`,
      [me]
    );
    const member = memberRow.rows[0] ?? {};

    return res.status(201).json({
      comment: mapCommentRow(
        {
          ...row,
          post_id: access.post_id,
          prefix: member.prefix,
          member_id: member.member_id,
          alias: commentColumns.has('alias') ? row.alias : member.alias
        },
        me,
        access.post_owner_id
      )
    });
  } catch (error) {
    console.error('createPostingComment error:', error);
    return res.status(500).json({ error: 'Failed to add comment' });
  }
}

export async function togglePostingLike(req, res) {
  const me = Number(req.auth?.singles_id);
  const postId = Number(req.params.postId);
  if (!Number.isFinite(me) || me < 1) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  if (!Number.isFinite(postId) || postId < 1) {
    return res.status(400).json({ error: 'Invalid post id' });
  }

  try {
    const postingsSchema = await resolvePostingsSchema();
    if (!(await postingCommentsTableExists(postingsSchema))) {
      return res.status(503).json({ error: 'Posting likes are not available on this server yet' });
    }
    const requestSchema = await resolveRequestsAppSchema();
    const access = await canViewPosting(requestSchema, postingsSchema, me, postId);
    if (!access) {
      return res.status(404).json({ error: 'Posting not found' });
    }

    const photos = await pool.query(
      `SELECT pp.photo_id
       FROM ${postingsSchema}.posting_photos pp
       WHERE pp.post_id = $1
       ORDER BY pp.sort_order ASC, pp.photo_id ASC`,
      [postId]
    );
    const photoIds = photos.rows.map((row) => Number(row.photo_id)).filter((id) => id >= 1);
    if (!photoIds.length) {
      return res.status(400).json({ error: 'This posting has no photos to like' });
    }

    const { columns: commentColumns, udtByColumn } = await tableColumnMeta(postingsSchema, 'posting_comments');
    if (!commentColumns.has('is_liked')) {
      return res.status(503).json({ error: 'Posting likes are not available on this server yet' });
    }

    const viewerLikedResult = await pool.query(
      `SELECT 1
       FROM ${postingsSchema}.posting_comments pc
       JOIN ${postingsSchema}.posting_photos pp ON pp.photo_id = pc.photo_id
       WHERE pp.post_id = $1
         AND pc.author_id = $2
         AND ${postingCommentBoolIsTrue('pc', 'is_liked', udtByColumn)}
       LIMIT 1`,
      [postId, me]
    );
    const nextLiked = viewerLikedResult.rows.length === 0;

    let alias = null;
    if (commentColumns.has('alias')) {
      const aliasRow = await pool.query(
        `SELECT alias
         FROM ${requestSchema}.singles
         WHERE singles_id = $1
         LIMIT 1`,
        [me]
      );
      alias = String(aliasRow.rows[0]?.alias ?? '').trim() || null;
    }

    for (const photoId of photoIds) {
      const existing = await pool.query(
        `SELECT pc.comment_id, ${postingCommentBoolColumnAsBool('pc.is_liked', 'is_liked', 'is_liked', udtByColumn)}
         FROM ${postingsSchema}.posting_comments pc
         WHERE pc.author_id = $1
           AND pc.photo_id = $2
           AND BTRIM(COALESCE(pc.posting_text, '')) = ''
         LIMIT 1`,
        [me, photoId]
      );

      if (existing.rows.length) {
        await pool.query(
          `UPDATE ${postingsSchema}.posting_comments
           SET is_liked = ${postingCommentBoolParam('$1', 'is_liked', udtByColumn, postingsSchema)}
           WHERE comment_id = $2`,
          [normalizePostingCommentBoolValue('is_liked', nextLiked, udtByColumn), existing.rows[0].comment_id]
        );
      } else if (nextLiked) {
        const insertColumns = ['photo_id', 'author_id', 'posting_text'];
        const insertValues = [photoId, me, ''];
        if (commentColumns.has('posting_text_clean')) {
          insertColumns.push('posting_text_clean');
          insertValues.push('');
        }
        insertColumns.push('is_liked');
        insertValues.push(true);
        if (commentColumns.has('is_shared')) {
          insertColumns.push('is_shared');
          insertValues.push(false);
        }
        if (commentColumns.has('alias')) {
          insertColumns.push('alias');
          insertValues.push(alias);
        }
        const insertQuery = buildPostingCommentInsertQuery(
          postingsSchema,
          commentColumns,
          insertColumns,
          insertValues,
          udtByColumn
        );
        await pool.query(insertQuery.text, insertQuery.values);
      }
    }

    const countResult = await pool.query(
      `SELECT COUNT(*)::int AS like_count
       FROM ${postingsSchema}.posting_comments pc
       JOIN ${postingsSchema}.posting_photos pp ON pp.photo_id = pc.photo_id
       WHERE pp.post_id = $1
         AND ${postingCommentBoolIsTrue('pc', 'is_liked', udtByColumn)}`,
      [postId]
    );
    const viewerResult = await pool.query(
      `SELECT 1
       FROM ${postingsSchema}.posting_comments pc
       JOIN ${postingsSchema}.posting_photos pp ON pp.photo_id = pc.photo_id
       WHERE pp.post_id = $1
         AND pc.author_id = $2
         AND ${postingCommentBoolIsTrue('pc', 'is_liked', udtByColumn)}
       LIMIT 1`,
      [postId, me]
    );

    return res.json({
      post_id: postId,
      posting_like_count: Number(countResult.rows[0]?.like_count ?? 0),
      viewer_has_liked: viewerResult.rows.length > 0
    });
  } catch (error) {
    console.error('togglePostingLike error:', error);
    return res.status(500).json({ error: 'Failed to update like' });
  }
}

export async function getPostingLikes(req, res) {
  const me = Number(req.auth?.singles_id);
  const postId = Number(req.params.postId);
  if (!Number.isFinite(me) || me < 1) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  if (!Number.isFinite(postId) || postId < 1) {
    return res.status(400).json({ error: 'Invalid post id' });
  }

  try {
    const postingsSchema = await resolvePostingsSchema();
    if (!(await postingCommentsTableExists(postingsSchema))) {
      return res.status(503).json({ error: 'Posting likes are not available on this server yet' });
    }
    const requestSchema = await resolveRequestsAppSchema();
    const access = await canViewPosting(requestSchema, postingsSchema, me, postId);
    if (!access) {
      return res.status(404).json({ error: 'Posting not found' });
    }

    const { columns: commentColumns, udtByColumn } = await tableColumnMeta(postingsSchema, 'posting_comments');
    const aliasExpr = commentColumns.has('alias')
      ? `COALESCE(NULLIF(BTRIM(pc.alias), ''), s.alias, '')`
      : `COALESCE(s.alias, '')`;

    const likesResult = await pool.query(
      `SELECT DISTINCT ON (pc.author_id)
         pc.author_id,
         ${aliasExpr} AS alias,
         s.prefix,
         s.member_id,
         pc.created_at
       FROM ${postingsSchema}.posting_comments pc
       JOIN ${postingsSchema}.posting_photos pp ON pp.photo_id = pc.photo_id
       LEFT JOIN ${requestSchema}.singles s ON s.singles_id = pc.author_id
       WHERE pp.post_id = $1
         AND ${postingCommentBoolIsTrue('pc', 'is_liked', udtByColumn)}
       ORDER BY pc.author_id, pc.created_at DESC, pc.comment_id DESC`,
      [postId]
    );

    const likes = likesResult.rows
      .map((row) => {
        const alias = String(row.alias ?? '').trim();
        const memberRaw = formatMemberId(row.prefix, row.member_id);
        return {
          author_id: Number(row.author_id),
          alias: alias || null,
          member_number: memberRaw ? `M${memberRaw}` : null,
          created_at: row.created_at
        };
      })
      .sort((a, b) => {
        const at = Date.parse(a.created_at ?? '');
        const bt = Date.parse(b.created_at ?? '');
        const an = Number.isFinite(at) ? at : 0;
        const bn = Number.isFinite(bt) ? bt : 0;
        return bn - an;
      });

    return res.json({
      post_id: postId,
      likes_count: likes.length,
      likes
    });
  } catch (error) {
    console.error('getPostingLikes error:', error);
    return res.status(500).json({ error: 'Failed to load posting likes' });
  }
}

export async function deletePostingComment(req, res) {
  const me = Number(req.auth?.singles_id);
  const commentId = Number(req.params.commentId);
  if (!Number.isFinite(me) || me < 1) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  if (!Number.isFinite(commentId) || commentId < 1) {
    return res.status(400).json({ error: 'Invalid comment id' });
  }

  try {
    const postingsSchema = await resolvePostingsSchema();
    if (!(await postingCommentsTableExists(postingsSchema))) {
      return res.status(503).json({ error: 'Posting comments are not available on this server yet' });
    }
    const ownerColumn = await resolvePostingsOwnerColumn(postingsSchema);
    const result = await pool.query(
      `DELETE FROM ${postingsSchema}.posting_comments pc
       USING ${postingsSchema}.posting_photos pp,
             ${postingsSchema}.postings p
       WHERE pc.comment_id = $1
         AND pc.photo_id = pp.photo_id
         AND pp.post_id = p.post_id
         AND (pc.author_id = $2 OR p.${ownerColumn} = $2)
       RETURNING pc.comment_id`,
      [commentId, me]
    );
    if (!result.rows.length) {
      return res.status(404).json({ error: 'Comment not found' });
    }
    return res.json({ ok: true });
  } catch (error) {
    console.error('deletePostingComment error:', error);
    return res.status(500).json({ error: 'Failed to delete comment' });
  }
}

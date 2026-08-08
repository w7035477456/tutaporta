import pool from '../../db/connection.js';
import { allowSinglesMutationForId } from '../../utils/systemToolsAdmin.js';
import {
  ADMIN_TOOLS_DB_SCHEMA,
  ADMIN_TOOLS_TABLES,
  normalizeAdminToolsTableId,
  qualifiedAdminTableSql,
  quoteSqlIdent,
  resolveAdminToolsTable
} from '../../utils/adminToolsTablesConfig.js';
import { deletePhotosFromFolder } from '../../utils/deletePhotoFromFolder.js';
import { countPhotoFolderFiles } from '../../utils/photoFilePath.js';

const PHOTOS_TABLE = `${quoteSqlIdent(ADMIN_TOOLS_DB_SCHEMA)}.${quoteSqlIdent('photos')}`;

/** Tables that must never be truncated from Admin Tools (singles holds reserved system admin). */
const ADMIN_TRUNCATE_BLOCKED_KEYS = new Set(['singles']);

function adminTruncateBlockedMessage(tableName) {
  return `Cannot truncate ${tableName}: another table references it (foreign key). Admin truncate never uses CASCADE — truncate or clear the referencing table first.`;
}

function mapAdminTruncateError(err, def) {
  const msg = String(err?.message ?? '');
  if (/cannot truncate a table referenced in a foreign key/i.test(msg)) {
    return adminTruncateBlockedMessage(def.table);
  }
  if (/violates foreign key constraint/i.test(msg)) {
    return adminTruncateBlockedMessage(def.table);
  }
  return msg || 'Failed to truncate table';
}

async function fetchPhotoRowsBySinglesId(singlesId) {
  const { rows } = await pool.query(
    `SELECT photos_id, photo_file_name, file_extension
     FROM ${PHOTOS_TABLE}
     WHERE singles_id = $1`,
    [singlesId]
  );
  return rows;
}

async function fetchPhotoRowById(photosId) {
  const { rows } = await pool.query(
    `SELECT photos_id, photo_file_name, file_extension
     FROM ${PHOTOS_TABLE}
     WHERE photos_id = $1`,
    [photosId]
  );
  return rows[0] ?? null;
}

async function removePhotoFilesBeforeCascadeDelete(def, idValue) {
  if (def.key === 'photos') {
    const row = await fetchPhotoRowById(idValue);
    if (!row) return { rowsProcessed: 0, removed: [] };
    return deletePhotosFromFolder([row]);
  }

  if (def.key === 'singles') {
    const rows = await fetchPhotoRowsBySinglesId(idValue);
    if (!rows.length) return { rowsProcessed: 0, removed: [] };
    return deletePhotosFromFolder(rows);
  }

  return { rowsProcessed: 0, removed: [] };
}

async function tableExists(def) {
  const { rows } = await pool.query(
    `
    SELECT EXISTS (
      SELECT 1
      FROM information_schema.tables
      WHERE table_schema = $1
        AND table_name = $2
    ) AS ok
    `,
    [ADMIN_TOOLS_DB_SCHEMA, def.table]
  );
  return rows[0]?.ok === true;
}

async function countTableRows(def) {
  const qualified = qualifiedAdminTableSql(def);
  const { rows } = await pool.query(`SELECT COUNT(*)::bigint AS n FROM ${qualified}`);
  const n = Number(rows[0]?.n);
  return Number.isFinite(n) && n >= 0 ? Math.trunc(n) : 0;
}

/**
 * Truncate exactly one table — never CASCADE, never UPDATE/DELETE on other tables.
 * If FK references block truncate (e.g. singles.profile_image_fk → photos), return a clear error.
 */
async function safeAdminTruncateTable(def) {
  if (ADMIN_TRUNCATE_BLOCKED_KEYS.has(def.key)) {
    const err = new Error('Truncating singles is not allowed.');
    err.statusCode = 403;
    throw err;
  }

  const qualified = qualifiedAdminTableSql(def);
  await pool.query(`TRUNCATE TABLE ${qualified} RESTART IDENTITY`);
}

/**
 * GET /api/admin/tables
 */
export async function getAdminTables(req, res) {
  try {
    const tables = [];
    for (const def of ADMIN_TOOLS_TABLES) {
      if (!(await tableExists(def))) {
        tables.push({
          key: def.key,
          label: def.label,
          table: def.table,
          schema: ADMIN_TOOLS_DB_SCHEMA,
          id_column: def.idColumn,
          id_type: def.idType ?? 'bigint',
          row_count: null,
          missing: true,
          truncate_allowed: !ADMIN_TRUNCATE_BLOCKED_KEYS.has(def.key)
        });
        continue;
      }
      const rowCount = await countTableRows(def);
      tables.push({
        key: def.key,
        label: def.label,
        table: def.table,
        schema: ADMIN_TOOLS_DB_SCHEMA,
        id_column: def.idColumn,
        id_type: def.idType ?? 'bigint',
        row_count: rowCount,
        missing: false,
        truncate_allowed: !ADMIN_TRUNCATE_BLOCKED_KEYS.has(def.key)
      });
    }

    const photosIndex = tables.findIndex((row) => row.key === 'photos');
    if (photosIndex >= 0) {
      const folderStats = countPhotoFolderFiles();
      const videosIndex = tables.findIndex((row) => row.key === 'videos');
      const folderInsertAt = videosIndex >= 0 ? videosIndex + 1 : photosIndex + 1;
      tables.splice(folderInsertAt, 0, {
        key: 'vsingles_photo_folder',
        label: folderStats.label,
        table: null,
        schema: null,
        id_column: null,
        id_type: null,
        row_count: folderStats.fileCount,
        missing: folderStats.missing,
        kind: 'photo_folder'
      });
    }

    return res.json({ schema: ADMIN_TOOLS_DB_SCHEMA, tables });
  } catch (err) {
    console.error('[adminTables:get]', err?.message ?? err);
    return res.status(500).json({ error: 'Failed to load admin tables' });
  }
}

/**
 * POST /api/admin/tables/:tableKey/truncate
 */
export async function postAdminTableTruncate(req, res) {
  const def = resolveAdminToolsTable(req.params?.tableKey);
  if (!def) {
    return res.status(404).json({ error: 'Unknown table' });
  }
  if (ADMIN_TRUNCATE_BLOCKED_KEYS.has(def.key)) {
    return res.status(403).json({ error: 'Truncating singles is not allowed.' });
  }
  if (!(await tableExists(def))) {
    return res.status(404).json({ error: `Table ${ADMIN_TOOLS_DB_SCHEMA}.${def.table} does not exist` });
  }

  try {
    await safeAdminTruncateTable(def);
    const rowCount = await countTableRows(def);
    return res.json({
      ok: true,
      key: def.key,
      label: def.label,
      row_count: rowCount
    });
  } catch (err) {
    console.error('[adminTables:truncate]', def.table, err?.message ?? err);
    const status = err?.statusCode === 403 ? 403 : 500;
    return res.status(status).json({ error: mapAdminTruncateError(err, def) });
  }
}

/**
 * POST /api/admin/tables/:tableKey/cascade-delete
 * Body: { id: string | number }
 */
export async function postAdminTableCascadeDelete(req, res) {
  const def = resolveAdminToolsTable(req.params?.tableKey);
  if (!def) {
    return res.status(404).json({ error: 'Unknown table' });
  }
  if (!(await tableExists(def))) {
    return res.status(404).json({ error: `Table ${ADMIN_TOOLS_DB_SCHEMA}.${def.table} does not exist` });
  }

  const idValue = normalizeAdminToolsTableId(req.body?.id ?? req.body?.[def.idColumn], def);
  if (idValue == null) {
    return res.status(400).json({ error: `Valid ${def.idColumn} is required` });
  }

  if (def.key === 'singles' && !(await allowSinglesMutationForId(res, Number(idValue)))) {
    return;
  }

  const qualified = qualifiedAdminTableSql(def);
  const idCol = quoteSqlIdent(def.idColumn);

  try {
    const exists = await pool.query(
      `SELECT 1 FROM ${qualified} WHERE ${idCol} = $1 LIMIT 1`,
      [idValue]
    );
    if (!exists.rowCount) {
      return res.status(404).json({ error: 'Row not found' });
    }

    const diskCleanup = await removePhotoFilesBeforeCascadeDelete(def, idValue);

    const result = await pool.query(
      `DELETE FROM ${qualified}
       WHERE ${idCol} = $1
       RETURNING ${idCol}`,
      [idValue]
    );
    if (!result.rowCount) {
      return res.status(404).json({ error: 'Row not found' });
    }
    const rowCount = await countTableRows(def);
    return res.json({
      ok: true,
      key: def.key,
      label: def.label,
      deleted_id: idValue,
      row_count: rowCount,
      photo_files_removed: diskCleanup.removed.length,
      photo_rows_cleaned: diskCleanup.rowsProcessed
    });
  } catch (err) {
    console.error('[adminTables:cascade-delete]', def.table, err?.message ?? err);
    return res.status(500).json({ error: err?.message || 'Failed to cascade delete row' });
  }
}

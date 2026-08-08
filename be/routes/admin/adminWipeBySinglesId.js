import pool from '../../db/connection.js';
import { allowSinglesMutationForId } from '../../utils/systemToolsAdmin.js';
import {
  ADMIN_WIPE_BY_SINGLES_ID_TABLES,
  parseAdminWipeSearchTarget,
  parseAdminWipeSinglesId,
  resolveAdminWipeBySinglesIdTable
} from '../../utils/adminWipeBySinglesIdConfig.js';
import {
  countPhotoFolderFilesForSinglesId,
  deletePhotoFolderFilesForSinglesId,
  deletePhotosFromFolder,
  fetchPhotoRowsForSinglesId
} from '../../utils/deletePhotoFromFolder.js';
import {
  deleteVideosFromFolder,
  fetchVideoRowsForSinglesId
} from '../../utils/deleteVideoFromFolder.js';
import { countPhotoFolderFiles } from '../../utils/photoFilePath.js';
import { invalidateAuthUserCache } from '../../utils/authUserLookupCache.js';

const WIPE_PHOTO_FOLDER_KEY = 'vsingles_photo_folder';

function insertPhotoFolderRow(tables, folderStats) {
  const anchorKey = tables.some((row) => row.key === 'videos') ? 'videos' : 'photos';
  const anchorIndex = tables.findIndex((row) => row.key === anchorKey);
  if (anchorIndex < 0) return tables;

  const next = [...tables];
  next.splice(anchorIndex + 1, 0, {
    key: WIPE_PHOTO_FOLDER_KEY,
    label: folderStats.label,
    table: null,
    match_count: folderStats.fileCount,
    missing: folderStats.missing,
    kind: 'photo_folder'
  });
  return next;
}

async function countForTable(def, singlesId) {
  const { rows } = await pool.query(def.countSql(singlesId), [singlesId]);
  const n = Number(rows[0]?.n);
  return Number.isFinite(n) && n >= 0 ? Math.trunc(n) : 0;
}

async function countAllForTable(def) {
  const { rows } = await pool.query(def.allCountSql());
  const n = Number(rows[0]?.n);
  return Number.isFinite(n) && n >= 0 ? Math.trunc(n) : 0;
}

async function tableExists(tableName) {
  const { rows } = await pool.query(
    `SELECT EXISTS (
       SELECT 1
       FROM information_schema.tables
       WHERE table_schema = 'helloworldjunktest'
         AND table_name = $1
     ) AS ok`,
    [tableName]
  );
  return rows[0]?.ok === true;
}

function mapTableResult(def, matchCount, missing = false) {
  return {
    key: def.key,
    label: def.label,
    table: def.table,
    match_count: matchCount,
    missing
  };
}

async function buildSinglesScopeTables(singlesId) {
  const tables = [];
  for (const def of ADMIN_WIPE_BY_SINGLES_ID_TABLES) {
    const bareTable = def.table.split('.').pop();
    if (!(await tableExists(bareTable))) {
      tables.push(mapTableResult(def, null, true));
      continue;
    }
    const matchCount = await countForTable(def, singlesId);
    tables.push(mapTableResult(def, matchCount, false));
  }

  const photosIndex = tables.findIndex((row) => row.key === 'photos');
  if (photosIndex >= 0) {
    const folderStats = await countPhotoFolderFilesForSinglesId(pool, singlesId);
    return insertPhotoFolderRow(tables, folderStats);
  }

  return tables;
}

/**
 * POST /api/admin/wipe-by-singles-id/search
 * Body: { singlesId }
 */
export async function postAdminWipeBySinglesIdSearch(req, res) {
  const target = parseAdminWipeSearchTarget(req.body?.singlesId ?? req.body?.singles_id);
  if (!target) {
    return res.status(400).json({ error: 'Enter ALL or a valid singles_id.' });
  }

  try {
    let tables = [];
    for (const def of ADMIN_WIPE_BY_SINGLES_ID_TABLES) {
      const bareTable = def.table.split('.').pop();
      if (!(await tableExists(bareTable))) {
        tables.push(mapTableResult(def, null, true));
        continue;
      }
      const matchCount =
        target.mode === 'all' ? await countAllForTable(def) : await countForTable(def, target.singlesId);
      tables.push(mapTableResult(def, matchCount, false));
    }

    const photosIndex = tables.findIndex((row) => row.key === 'photos');
    if (photosIndex >= 0) {
      const folderStats =
        target.mode === 'all'
          ? countPhotoFolderFiles()
          : await countPhotoFolderFilesForSinglesId(pool, target.singlesId);
      tables = insertPhotoFolderRow(tables, folderStats);
    }

    return res.json({
      scope: target.mode,
      singles_id: target.mode === 'all' ? 'ALL' : target.singlesId,
      tables
    });
  } catch (err) {
    console.error('[adminWipeBySinglesId:search]', err?.message ?? err);
    return res.status(500).json({ error: err?.message || 'Failed to search wipe-by-id counts.' });
  }
}

/**
 * POST /api/admin/wipe-by-singles-id/delete
 * Body: { singlesId, tableKey }
 */
export async function postAdminWipeBySinglesIdDelete(req, res) {
  const singlesId = parseAdminWipeSinglesId(req.body?.singlesId ?? req.body?.singles_id);
  const tableKey = String(req.body?.tableKey ?? req.body?.table_key ?? '').trim();
  if (!singlesId) {
    return res.status(400).json({ error: 'Valid singles_id is required.' });
  }

  if (!(await allowSinglesMutationForId(res, singlesId))) {
    return;
  }

  if (tableKey === WIPE_PHOTO_FOLDER_KEY) {
    try {
      const diskCleanup = await deletePhotoFolderFilesForSinglesId(pool, singlesId);
      const after = await countPhotoFolderFilesForSinglesId(pool, singlesId);
      return res.json({
        ok: true,
        singles_id: singlesId,
        key: WIPE_PHOTO_FOLDER_KEY,
        label: after.label,
        table: null,
        deleted_count: diskCleanup.removed.length,
        match_count: after.fileCount ?? 0
      });
    } catch (err) {
      console.error('[adminWipeBySinglesId:delete] photo folder', err?.message ?? err);
      return res.status(500).json({ error: err?.message || 'Failed to delete photo folder files.' });
    }
  }

  const def = resolveAdminWipeBySinglesIdTable(tableKey);
  if (!def) {
    return res.status(404).json({ error: 'Unknown table.' });
  }

  const bareTable = def.table.split('.').pop();
  if (!(await tableExists(bareTable))) {
    return res.status(404).json({ error: `Table ${def.table} does not exist.` });
  }

  try {
    const beforeCount = await countForTable(def, singlesId);
    const result = await pool.query(def.deleteSql(singlesId), [singlesId]);
    const deletedCount = Number.isFinite(result.rowCount) ? result.rowCount : beforeCount;
    const afterCount = await countForTable(def, singlesId);

    if (def.key === 'singles' && deletedCount > 0) {
      await invalidateAuthUserCache(singlesId);
    }

    return res.json({
      ok: true,
      singles_id: singlesId,
      key: def.key,
      label: def.label,
      table: def.table,
      deleted_count: deletedCount,
      match_count: afterCount
    });
  } catch (err) {
    console.error('[adminWipeBySinglesId:delete]', def.table, err?.message ?? err);
    return res.status(500).json({ error: err?.message || `Failed to delete from ${def.label}.` });
  }
}

/**
 * POST /api/admin/wipe-by-singles-id/cascade-delete
 * Body: { singlesId, tableKey }
 */
export async function postAdminWipeBySinglesIdCascadeDelete(req, res) {
  const singlesId = parseAdminWipeSinglesId(req.body?.singlesId ?? req.body?.singles_id);
  const tableKey = String(req.body?.tableKey ?? req.body?.table_key ?? '').trim();
  if (!singlesId) {
    return res.status(400).json({ error: 'Valid singles_id is required.' });
  }

  if (!(await allowSinglesMutationForId(res, singlesId))) {
    return;
  }

  try {
    let deletedCount = 0;

    if (tableKey === WIPE_PHOTO_FOLDER_KEY) {
      const beforeCount = (await countPhotoFolderFilesForSinglesId(pool, singlesId)).fileCount ?? 0;
      const diskCleanup = await deletePhotoFolderFilesForSinglesId(pool, singlesId);
      const photoResult = await pool.query(
        `DELETE FROM helloworldjunktest.photos WHERE singles_id = $1`,
        [singlesId]
      );
      deletedCount = Math.max(diskCleanup.removed.length, photoResult.rowCount ?? 0, beforeCount);
    } else {
      const def = resolveAdminWipeBySinglesIdTable(tableKey);
      if (!def) {
        return res.status(404).json({ error: 'Unknown table.' });
      }

      const bareTable = def.table.split('.').pop();
      if (!(await tableExists(bareTable))) {
        return res.status(404).json({ error: `Table ${def.table} does not exist.` });
      }

      const beforeCount = await countForTable(def, singlesId);

      if (def.key === 'singles' || def.key === 'photos' || def.key === 'videos') {
        if (def.key === 'singles' || def.key === 'photos') {
          const photoRows = await fetchPhotoRowsForSinglesId(pool, singlesId);
          deletePhotosFromFolder(photoRows);
        }
        if (def.key === 'singles' || def.key === 'videos') {
          const videoRows = await fetchVideoRowsForSinglesId(pool, singlesId);
          deleteVideosFromFolder(videoRows);
        }
      }

      const sql =
        def.key === 'photos'
          ? `DELETE FROM helloworldjunktest.photos WHERE singles_id = $1`
          : def.key === 'videos'
            ? `DELETE FROM helloworldjunktest.videos WHERE singles_id = $1`
            : (def.cascadeDeleteSql?.(singlesId) ?? def.deleteSql(singlesId));
      const result = await pool.query(sql, [singlesId]);
      deletedCount = Number.isFinite(result.rowCount) ? result.rowCount : beforeCount;

      if (def.key === 'singles' && deletedCount > 0) {
        await invalidateAuthUserCache(singlesId);
      }
    }

    const tables = await buildSinglesScopeTables(singlesId);
    const row = tables.find((item) => item.key === tableKey);

    return res.json({
      ok: true,
      singles_id: singlesId,
      key: tableKey,
      label: row?.label ?? tableKey,
      table: row?.table ?? null,
      deleted_count: deletedCount,
      match_count: row?.match_count ?? 0,
      tables
    });
  } catch (err) {
    console.error('[adminWipeBySinglesId:cascade-delete]', tableKey, err?.message ?? err);
    return res.status(500).json({ error: err?.message || 'Failed to cascade delete.' });
  }
}

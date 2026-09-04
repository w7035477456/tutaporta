#!/usr/bin/env node
/**
 * Move Tuta Dates media from LARGE_CHEAP_STORAGE/users/M{id}/tutadates
 * to STORAGE_FOLDER/users/M{id}/tutadates for every M###### folder found on disk.
 *
 * Also sweeps legacy flat STORAGE_FOLDER/photos and /videos for {memberId}_* files.
 * Updates helloworldjunktest.photos.file_path and videos.file_path to the new storage paths.
 *
 * Usage (from repo root, ~/.ssh/be/.env loaded via loadEnv.js):
 *   node be/scripts/migrateTutaDatesMediaToMemberFolders.js --dry-run
 *   node be/scripts/migrateTutaDatesMediaToMemberFolders.js
 */
import fs from 'fs';
import path from 'path';

import '../loadEnv.js';
import pool from '../db/connection.js';
import {
  getLegacyPhotoFolder,
  listMemberPhotoFilesOnDisk
} from '../utils/photoFilePath.js';
import {
  buildVideoSearchFolders,
  getLegacyVideoFolder
} from '../utils/videoFilePath.js';
import {
  ensureTutaDatesMemberLayout,
  getLegacyLargeCheapStorageRoot,
  getTutaDatesStorageRoot,
  listAllMemberFolderNamesOnDisk,
  memberFolderName,
  tutaDatesMemberRootLegacyLargeCheap,
  tutaDatesPhotosPathLegacyLargeCheap,
  tutaDatesVideosPathLegacyLargeCheap
} from '../utils/tutaDatesMemberPaths.js';

const dryRun = process.argv.includes('--dry-run');

function memberIdFromFolderName(folderName) {
  const raw = String(folderName || '').trim().replace(/^M/i, '');
  return raw || null;
}

function safeMoveFile(src, dest) {
  if (!src || !dest || src === dest) return false;
  if (!fs.existsSync(src)) return false;
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  if (fs.existsSync(dest)) {
    try {
      const srcStat = fs.statSync(src);
      const destStat = fs.statSync(dest);
      if (srcStat.ino === destStat.ino && srcStat.dev === destStat.dev) {
        return true;
      }
    } catch {
      // fall through
    }
    console.warn(`  skip (dest exists): ${dest}`);
    return false;
  }
  if (dryRun) {
    console.log(`  [dry-run] mv ${src} -> ${dest}`);
    return true;
  }
  fs.renameSync(src, dest);
  return true;
}

function moveAllFilesInDir(srcDir, destDir) {
  const src = String(srcDir || '').replace(/\/+$/, '');
  const dest = String(destDir || '').replace(/\/+$/, '');
  if (!src || !fs.existsSync(src)) return 0;
  fs.mkdirSync(dest, { recursive: true });
  let moved = 0;
  for (const name of fs.readdirSync(src)) {
    const srcPath = path.join(src, name);
    try {
      if (!fs.statSync(srcPath).isFile()) continue;
    } catch {
      continue;
    }
    if (safeMoveFile(srcPath, path.join(dest, name))) moved += 1;
  }
  return moved;
}

function collectLegacyPrefixFiles(legacyDir, memberId) {
  const dir = String(legacyDir || '').replace(/\/+$/, '');
  if (!dir || !fs.existsSync(dir)) return [];
  const prefix = `${memberId}_`;
  const out = [];
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    try {
      if (fs.statSync(full).isFile() && name.startsWith(prefix)) {
        out.push(full);
      }
    } catch {
      // ignore
    }
  }
  return out;
}

async function loadSinglesIdsForMemberId(memberId) {
  const { rows } = await pool.query(
    `SELECT singles_id
       FROM helloworldjunktest.singles
      WHERE trim(both from member_id::text) = $1
         OR trim(both from member_id::text) = $2`,
    [memberId, `M${memberId}`]
  );
  return rows.map((r) => Number(r.singles_id)).filter((id) => Number.isFinite(id) && id > 0);
}

async function updateDbPathsForSingles(singlesIds, photosFolder, videosFolder) {
  if (dryRun || !singlesIds.length) return;
  for (const singlesId of singlesIds) {
    await pool.query(
      `UPDATE helloworldjunktest.photos SET file_path = $2 WHERE singles_id = $1`,
      [singlesId, photosFolder]
    );
    await pool.query(
      `UPDATE helloworldjunktest.videos SET file_path = $2 WHERE singles_id = $1`,
      [singlesId, videosFolder]
    );
  }
}

async function migrateDbReferencedFiles({ singlesId, memberId, layout }) {
  let movedPhotos = 0;
  let movedVideos = 0;

  const photoRows = await pool.query(
    `SELECT photos_id, photo_file_name, file_extension, file_path
       FROM helloworldjunktest.photos
      WHERE singles_id = $1`,
    [singlesId]
  );
  for (const row of photoRows.rows) {
    for (const src of listMemberPhotoFilesOnDisk(row, { filePathFromDb: row.file_path, memberId })) {
      const dest = path.join(layout.photosPath, path.basename(src));
      if (dest.startsWith(layout.photosPath) && safeMoveFile(src, dest)) movedPhotos += 1;
    }
  }

  const videoRows = await pool.query(
    `SELECT video_id, video_file_name, file_extension, file_path
       FROM helloworldjunktest.videos
      WHERE singles_id = $1`,
    [singlesId]
  );
  for (const row of videoRows.rows) {
    const folders = buildVideoSearchFolders({ filePathFromDb: row.file_path, memberId });
    const ext = String(row.file_extension || 'webm').replace(/^\./, '');
    const raw = String(row.video_file_name || row.video_id || '').trim();
    for (const folder of folders) {
      for (const candidate of [
        raw ? path.join(folder.replace(/\/+$/, ''), raw) : null,
        raw ? path.join(folder.replace(/\/+$/, ''), `${raw}.${ext}`) : null
      ].filter(Boolean)) {
        if (!fs.existsSync(candidate)) continue;
        const dest = path.join(layout.videosPath, path.basename(candidate));
        if (dest.startsWith(layout.videosPath) && safeMoveFile(candidate, dest)) movedVideos += 1;
      }
    }
  }

  return { movedPhotos, movedVideos };
}

async function migrateMemberFolder(memberFolderNameOnDisk) {
  const memberId = memberIdFromFolderName(memberFolderNameOnDisk);
  if (!memberId) return null;

  // Avoid mkdir during dry-run; resolve target paths without creating.
  const layout = dryRun
    ? {
        photosPath: path.join(getTutaDatesStorageRoot(), 'users', memberFolderName(memberId), 'tutadates', 'photos'),
        videosPath: path.join(getTutaDatesStorageRoot(), 'users', memberFolderName(memberId), 'tutadates', 'videos'),
        photosFolder: `${path.join(getTutaDatesStorageRoot(), 'users', memberFolderName(memberId), 'tutadates', 'photos')}/`,
        videosFolder: `${path.join(getTutaDatesStorageRoot(), 'users', memberFolderName(memberId), 'tutadates', 'videos')}/`
      }
    : ensureTutaDatesMemberLayout(memberId);
  let movedPhotos = 0;
  let movedVideos = 0;

  const legacyPhotos = tutaDatesPhotosPathLegacyLargeCheap(memberId);
  const legacyVideos = tutaDatesVideosPathLegacyLargeCheap(memberId);
  movedPhotos += moveAllFilesInDir(legacyPhotos, layout.photosPath);
  movedVideos += moveAllFilesInDir(legacyVideos, layout.videosPath);

  const flatPhoto = getLegacyPhotoFolder().replace(/\/+$/, '');
  const flatVideo = getLegacyVideoFolder().replace(/\/+$/, '');
  for (const src of collectLegacyPrefixFiles(flatPhoto, memberId)) {
    if (safeMoveFile(src, path.join(layout.photosPath, path.basename(src)))) movedPhotos += 1;
  }
  for (const src of collectLegacyPrefixFiles(flatVideo, memberId)) {
    if (safeMoveFile(src, path.join(layout.videosPath, path.basename(src)))) movedVideos += 1;
  }

  const singlesIds = await loadSinglesIdsForMemberId(memberId);
  for (const singlesId of singlesIds) {
    const dbMoved = await migrateDbReferencedFiles({ singlesId, memberId, layout });
    movedPhotos += dbMoved.movedPhotos;
    movedVideos += dbMoved.movedVideos;
  }

  await updateDbPathsForSingles(singlesIds, layout.photosFolder, layout.videosFolder);

  if (movedPhotos || movedVideos) {
    console.log(
      `${memberFolderName(memberId)}: moved ${movedPhotos} photo file(s), ${movedVideos} video file(s) -> ${layout.photosPath}`
    );
  }

  return { memberId, movedPhotos, movedVideos };
}

async function main() {
  console.log('Source (old):', getLegacyLargeCheapStorageRoot() || '(LARGE_CHEAP_STORAGE_FOLDER unset)');
  console.log('Target (new):', getTutaDatesStorageRoot());
  console.log('Target layout: STORAGE_FOLDER/users/M{id}/tutadates/{photos,videos}');
  if (dryRun) console.log('DRY RUN — no files moved, no DB updates');

  const memberFolders = listAllMemberFolderNamesOnDisk();
  if (!memberFolders.length) {
    console.log('No M###### folders found under STORAGE_FOLDER/users or LARGE_CHEAP/users.');
  }

  let totalPhotos = 0;
  let totalVideos = 0;
  for (const folderName of memberFolders) {
    const result = await migrateMemberFolder(folderName);
    if (!result) continue;
    totalPhotos += result.movedPhotos;
    totalVideos += result.movedVideos;
  }

  // DB members without on-disk folders yet — still point file_path at storage layout.
  const { rows } = await pool.query(
    `SELECT singles_id, member_id
       FROM helloworldjunktest.singles
      WHERE member_id IS NOT NULL
      ORDER BY singles_id ASC`
  );
  for (const row of rows) {
    const memberId = memberIdFromFolderName(`M${String(row.member_id).replace(/^M/i, '')}`);
    if (!memberId) continue;
    if (dryRun) continue;
    const layout = ensureTutaDatesMemberLayout(memberId);
    await updateDbPathsForSingles([Number(row.singles_id)], layout.photosFolder, layout.videosFolder);
  }

  console.log(
    `Done. Moved ${totalPhotos} photo file(s) and ${totalVideos} video file(s) across ${memberFolders.length} on-disk member folder(s); updated DB paths for ${rows.length} member row(s).`
  );

  // Remove empty leftover tutadates trees under LARGE_CHEAP after a successful move.
  if (!dryRun) {
    let removedEmpty = 0;
    for (const folderName of memberFolders) {
      const memberId = memberIdFromFolderName(folderName);
      const legacyRoot = tutaDatesMemberRootLegacyLargeCheap(memberId);
      if (!legacyRoot || !fs.existsSync(legacyRoot)) continue;
      try {
        // Remove empty photos/videos first, then tutadates if empty.
        for (const sub of ['photos', 'videos']) {
          const subDir = path.join(legacyRoot, sub);
          if (fs.existsSync(subDir) && fs.readdirSync(subDir).length === 0) {
            fs.rmdirSync(subDir);
          }
        }
        if (fs.existsSync(legacyRoot) && fs.readdirSync(legacyRoot).length === 0) {
          fs.rmdirSync(legacyRoot);
          removedEmpty += 1;
        }
      } catch (err) {
        console.warn(`Could not remove empty legacy ${legacyRoot}:`, err?.message || err);
      }
    }
    if (removedEmpty) {
      console.log(`Removed ${removedEmpty} empty LARGE_CHEAP tutadates folder(s).`);
    } else {
      console.log('Legacy LARGE_CHEAP tutadates folders left in place if they still contain files.');
    }
  }

  await pool.end();
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

#!/usr/bin/env node
/**
 * Move Tuta Dates photos/videos from legacy flat STORAGE_FOLDER/{photos,videos}
 * into per-member LARGE_CHEAP_STORAGE/users/M{id}/tutadates/{photos,videos}.
 *
 * Usage (from repo root, ~/.ssh/be/.env loaded via loadEnv.js):
 *   node be/scripts/migrateTutaDatesMediaToMemberFolders.js
 *   node be/scripts/migrateTutaDatesMediaToMemberFolders.js --dry-run
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
  memberFolderName
} from '../utils/tutaDatesMemberPaths.js';
const dryRun = process.argv.includes('--dry-run');

function normalizeMemberId(value) {
  const raw = String(value ?? '').trim();
  if (!raw) return null;
  return raw.replace(/^M/i, '');
}

function safeMoveFile(src, dest) {
  if (src === dest || !src || !dest) return false;
  if (!fs.existsSync(src)) return false;
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  if (fs.existsSync(dest)) {
    const srcStat = fs.statSync(src);
    const destStat = fs.statSync(dest);
    if (srcStat.ino === destStat.ino && srcStat.dev === destStat.dev) {
      return true;
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

async function migrateMemberMedia({ singlesId, memberId }) {
  const layout = ensureTutaDatesMemberLayout(memberId);
  const legacyPhoto = getLegacyPhotoFolder().replace(/\/+$/, '');
  const legacyVideo = getLegacyVideoFolder().replace(/\/+$/, '');
  const movedPhotos = new Set();
  const movedVideos = new Set();

  const photoRows = await pool.query(
    `SELECT photos_id, photo_file_name, file_extension, file_path
       FROM helloworldjunktest.photos
      WHERE singles_id = $1`,
    [singlesId]
  );

  for (const row of photoRows.rows) {
    const files = listMemberPhotoFilesOnDisk(row, {
      filePathFromDb: row.file_path,
      memberId
    });
    for (const src of files) {
      const base = path.basename(src);
      const dest = path.join(layout.photosPath, base);
      if (safeMoveFile(src, dest)) movedPhotos.add(dest);
    }
  }

  for (const src of collectLegacyPrefixFiles(legacyPhoto, memberId)) {
    const dest = path.join(layout.photosPath, path.basename(src));
    if (safeMoveFile(src, dest)) movedPhotos.add(dest);
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
    const candidates = new Set();
    for (const folder of folders) {
      if (raw) {
        candidates.add(path.join(folder.replace(/\/+$/, ''), raw));
        candidates.add(path.join(folder.replace(/\/+$/, ''), `${raw}.${ext}`));
      }
    }
    for (const src of candidates) {
      if (!fs.existsSync(src)) continue;
      const dest = path.join(layout.videosPath, path.basename(src));
      if (safeMoveFile(src, dest)) movedVideos.add(dest);
    }
  }

  for (const src of collectLegacyPrefixFiles(legacyVideo, memberId)) {
    const dest = path.join(layout.videosPath, path.basename(src));
    if (safeMoveFile(src, dest)) movedVideos.add(dest);
  }

  // selfintro_ / video_ / consent files often use singles_id in name — move by DB rows above first;
  // also sweep singles-prefixed video names in legacy video dir.
  if (legacyVideo && fs.existsSync(legacyVideo)) {
    const singlesPrefix = `${singlesId}_`;
    for (const name of fs.readdirSync(legacyVideo)) {
      if (!name.includes(String(singlesId))) continue;
      const src = path.join(legacyVideo, name);
      try {
        if (!fs.statSync(src).isFile()) continue;
      } catch {
        continue;
      }
      const dest = path.join(layout.videosPath, name);
      if (safeMoveFile(src, dest)) movedVideos.add(dest);
    }
  }

  if (!dryRun) {
    await pool.query(
      `UPDATE helloworldjunktest.photos
          SET file_path = $2
        WHERE singles_id = $1`,
      [singlesId, layout.photosFolder]
    );
    await pool.query(
      `UPDATE helloworldjunktest.videos
          SET file_path = $2
        WHERE singles_id = $1`,
      [singlesId, layout.videosFolder]
    );
  }

  return {
    memberFolder: memberFolderName(memberId),
    photosPath: layout.photosPath,
    videosPath: layout.videosPath,
    movedPhotoCount: movedPhotos.size,
    movedVideoCount: movedVideos.size
  };
}

async function main() {
  const legacyPhoto = getLegacyPhotoFolder();
  const legacyVideo = getLegacyVideoFolder();
  console.log('Legacy photo root:', legacyPhoto || '(unset)');
  console.log('Legacy video root:', legacyVideo || '(unset)');
  console.log('Target layout: …/users/M{id}/tutadates/{photos,videos}');
  if (dryRun) console.log('DRY RUN — no files moved, no DB updates');

  const { rows } = await pool.query(
    `SELECT singles_id, member_id
       FROM helloworldjunktest.singles
      WHERE member_id IS NOT NULL
      ORDER BY singles_id ASC`
  );

  let totalPhotos = 0;
  let totalVideos = 0;
  for (const row of rows) {
    const memberId = normalizeMemberId(row.member_id);
    if (!memberId) continue;
    const singlesId = Number(row.singles_id);
    const result = await migrateMemberMedia({ singlesId, memberId });
    if (result.movedPhotoCount || result.movedVideoCount) {
      console.log(
        `M${memberId} (singles ${singlesId}): moved ${result.movedPhotoCount} photo file(s), ${result.movedVideoCount} video file(s)`
      );
    }
    totalPhotos += result.movedPhotoCount;
    totalVideos += result.movedVideoCount;
  }

  console.log(`Done. Moved ${totalPhotos} photo file(s) and ${totalVideos} video file(s) across ${rows.length} member(s).`);
  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

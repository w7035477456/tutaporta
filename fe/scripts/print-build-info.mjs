#!/usr/bin/env node
/**
 * Print the recorded FE build stamp (same as under Logout in the profile menu).
 * Reads fe/public/build-info.json written when Vite finished starting or building.
 *
 * Usage (from repo root):
 *   node fe/scripts/print-build-info.mjs
 *   showbuild   # if aliased
 */
import { BUILD_INFO_PATH, formatBuildLabel, readBuildInfo } from './buildInfo.mjs';

const info = readBuildInfo();
if (!info) {
  process.stderr.write(
    `No build stamp found at ${BUILD_INFO_PATH}\n` +
      'Start or rebuild the frontend (feall / vite build), then run again.\n'
  );
  process.exit(1);
}

const label = info.label || formatBuildLabel(info);
if (!label) {
  process.stderr.write(`Build stamp file exists but has no label: ${BUILD_INFO_PATH}\n`);
  process.exit(1);
}

process.stdout.write(`${label}\n`);
if (info.commit || info.sourceChecksum) {
  process.stdout.write('\n');
  if (info.commit) process.stdout.write(`  commit: ${info.commit}\n`);
  if (info.sourceChecksum) {
    process.stdout.write(`  src (fe+be): ${info.sourceChecksum}\n`);
  } else if (info.checksum) {
    process.stdout.write(`  src (fe+be): ${info.checksum}\n`);
  }
  if (info.feTree && info.beTree) {
    process.stdout.write(`  fe tree: ${info.feTree}  be tree: ${info.beTree}\n`);
  }
  if (info.dirty) process.stdout.write('  (uncommitted changes under fe/ or be/ at stamp time)\n');
  process.stdout.write('\n');
  process.stdout.write('  Mac and Ubuntu match when commit and src (fe+be) are identical.\n');
  process.stdout.write('  Datetime always differs per machine (local build time).\n');
}

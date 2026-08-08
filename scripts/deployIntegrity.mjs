#!/usr/bin/env node
/**
 * Deploy integrity — artifact hash of shipped FE+BE (steps 2–3 of minimal ladder).
 *
 *   node scripts/deployIntegrity.mjs write   # after fe build (creates ARTIFACT.* at repo root)
 *   node scripts/deployIntegrity.mjs verify  # before pm2 restart; exits 1 on mismatch
 *   node scripts/deployIntegrity.mjs show    # print manifest (same info as showbuild + artifact hash)
 *
 * Hashes on-disk deploy artifacts:
 *   fe/dist/**
 *   be/** excluding node_modules/ and logs/
 */
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';
import { readBuildInfo } from '../fe/scripts/buildInfo.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..');

const MANIFEST_JSON = path.join(REPO_ROOT, 'ARTIFACT.json');
const MANIFEST_SHA = path.join(REPO_ROOT, 'ARTIFACT.sha256');

const ARTIFACT_ROOTS = [
  path.join(REPO_ROOT, 'fe', 'dist'),
  path.join(REPO_ROOT, 'be')
];

const SKIP_DIR_NAMES = new Set(['node_modules', 'logs', '.git', '.pm2']);
const SKIP_FILE_NAMES = new Set(['ARTIFACT.json', 'ARTIFACT.sha256']);

function runGit(args) {
  try {
    return execSync(`git ${args}`, { cwd: REPO_ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch {
    return '';
  }
}

function shouldSkipDir(absPath) {
  const rel = path.relative(REPO_ROOT, absPath);
  if (!rel || rel.startsWith('..')) return true;
  const parts = rel.split(path.sep);
  return parts.some((p) => SKIP_DIR_NAMES.has(p));
}

function collectFiles(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  if (shouldSkipDir(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const abs = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!SKIP_DIR_NAMES.has(entry.name)) collectFiles(abs, out);
      continue;
    }
    if (entry.isFile() && !SKIP_FILE_NAMES.has(entry.name)) out.push(abs);
  }
  return out;
}

function hashFile(absPath) {
  const hash = crypto.createHash('sha256');
  hash.update(fs.readFileSync(absPath));
  return hash.digest('hex');
}

/** One aggregate SHA-256 over sorted file paths + per-file hashes. */
export function computeArtifactHash() {
  const files = [];
  for (const root of ARTIFACT_ROOTS) collectFiles(root, files);
  files.sort((a, b) => a.localeCompare(b));

  if (!files.length) {
    throw new Error('No deploy files found. Build FE first (fe/dist) and ensure be/ exists.');
  }

  const missingDist = !fs.existsSync(path.join(REPO_ROOT, 'fe', 'dist', 'index.html'));
  if (missingDist) {
    throw new Error('fe/dist/index.html missing — run buildprod / febeprod before writing artifact manifest.');
  }

  const aggregate = crypto.createHash('sha256');
  const fileEntries = [];
  for (const abs of files) {
    const rel = path.relative(REPO_ROOT, abs).split(path.sep).join('/');
    const fileHash = hashFile(abs);
    fileEntries.push({ path: rel, sha256: fileHash });
    aggregate.update(`${rel}\0${fileHash}\n`);
  }

  return {
    artifactSha256: aggregate.digest('hex'),
    fileCount: fileEntries.length,
    files: fileEntries
  };
}

function buildManifest() {
  const { artifactSha256, fileCount } = computeArtifactHash();
  const buildInfo = readBuildInfo();
  const gitCommit = runGit('rev-parse --short=12 HEAD') || null;
  const gitTree = runGit('rev-parse --short=12 HEAD^{tree}') || null;
  const dirty = Boolean(runGit('status --porcelain'));

  return {
    schema: 1,
    writtenAt: new Date().toISOString(),
    repoRoot: REPO_ROOT,
    artifactSha256,
    fileCount,
    gitCommit,
    gitTree,
    dirty,
    buildInfo: buildInfo
      ? {
          completedAt: buildInfo.completedAt,
          datetime: buildInfo.datetime,
          checksum: buildInfo.checksum,
          label: buildInfo.label
        }
      : null
  };
}

function writeManifest() {
  const manifest = buildManifest();
  const json = `${JSON.stringify(manifest, null, 2)}\n`;
  fs.writeFileSync(MANIFEST_JSON, json, 'utf8');
  fs.writeFileSync(MANIFEST_SHA, `${manifest.artifactSha256}\n`, 'utf8');
  return manifest;
}

function readExpectedHash() {
  if (!fs.existsSync(MANIFEST_SHA)) return null;
  return fs.readFileSync(MANIFEST_SHA, 'utf8').trim();
}

function verifyManifest() {
  const expected = readExpectedHash();
  if (!expected) {
    throw new Error(`Missing ${MANIFEST_SHA}. Run: node scripts/deployIntegrity.mjs write`);
  }
  const { artifactSha256, fileCount } = computeArtifactHash();
  if (artifactSha256 !== expected) {
    const err = new Error('Artifact hash mismatch — on-disk files differ from last deploy write.');
    err.expected = expected;
    err.actual = artifactSha256;
    err.fileCount = fileCount;
    throw err;
  }
  return { ok: true, artifactSha256, fileCount };
}

function showManifest() {
  if (fs.existsSync(MANIFEST_JSON)) {
    const manifest = JSON.parse(fs.readFileSync(MANIFEST_JSON, 'utf8'));
    process.stdout.write(`${JSON.stringify(manifest, null, 2)}\n`);
    return;
  }
  const buildInfo = readBuildInfo();
  if (buildInfo?.label) {
    process.stdout.write(`build-info only (no ARTIFACT yet): ${buildInfo.label}\n`);
    return;
  }
  process.stderr.write('No ARTIFACT.json or build-info.json found.\n');
  process.exit(1);
}

const cmd = (process.argv[2] || 'show').toLowerCase();

try {
  if (cmd === 'write') {
    const manifest = writeManifest();
    process.stdout.write(`ARTIFACT.sha256=${manifest.artifactSha256}\n`);
    if (manifest.buildInfo?.label) process.stdout.write(`build=${manifest.buildInfo.label}\n`);
    process.stdout.write(`files=${manifest.fileCount}\n`);
  } else if (cmd === 'verify') {
    const result = verifyManifest();
    process.stdout.write(`OK artifact ${result.artifactSha256} (${result.fileCount} files)\n`);
  } else if (cmd === 'show') {
    showManifest();
  } else {
    process.stderr.write('Usage: node scripts/deployIntegrity.mjs write|verify|show\n');
    process.exit(1);
  }
} catch (err) {
  process.stderr.write(`${err.message}\n`);
  if (err.expected && err.actual) {
    process.stderr.write(`expected: ${err.expected}\n`);
    process.stderr.write(`actual:   ${err.actual}\n`);
    process.stderr.write('Do not restart PM2 until you rebuild (febeprod) or restore files.\n');
  }
  process.exit(1);
}

/**
 * Build date/time (US Eastern) + checksum of the code tree at build completion.
 * Written by the Vite plugin into fe/public/build-info.json; UI and CLI both read it.
 */
import { execSync } from 'child_process';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FE_ROOT = path.resolve(__dirname, '..');
const REPO_ROOT = path.resolve(FE_ROOT, '..');

/** Canonical record written when Vite build/dev server completes. */
export const BUILD_INFO_PATH = path.join(FE_ROOT, 'public', 'build-info.json');

function runGit(args) {
  try {
    return execSync(`git ${args}`, {
      cwd: REPO_ROOT,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore']
    }).trim();
  } catch {
    return '';
  }
}

/** MM/DD/YYYY H:MMam/pm ET — matches profile-menu build stamp. */
export function formatBuildDateTimeEt(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    month: '2-digit',
    day: '2-digit',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  }).formatToParts(date);

  const get = (type) => parts.find((p) => p.type === type)?.value ?? '';
  const month = get('month');
  const day = get('day');
  const year = get('year');
  const hour = get('hour');
  const minute = get('minute');
  const dayPeriod = get('dayPeriod').toLowerCase().replace(/\./g, '');
  return `${month}/${day}/${year} ${hour}:${minute}${dayPeriod} ET`;
}

/**
 * Git commit at stamp time (12 chars). Same on Mac and Ubuntu when checkout matches.
 */
export function getGitCommitShort() {
  return runGit('rev-parse --short=12 HEAD');
}

/**
 * Combined FE+BE source checksum from git tree objects at HEAD (not build output).
 * Matches across machines when both are on the same commit with a clean fe/ and be/.
 * Appends `-dirty` when fe/ or be/ has uncommitted changes at stamp time.
 */
export function getFeBeSourceChecksum() {
  const feTree = runGit('rev-parse --short=12 HEAD^{tree}:fe');
  const beTree = runGit('rev-parse --short=12 HEAD^{tree}:be');
  if (!feTree || !beTree) {
    return getCodeChecksum();
  }
  const combined = crypto.createHash('sha256').update(`${feTree}:${beTree}`).digest('hex').slice(0, 12);
  const dirty = Boolean(runGit('status --porcelain -- fe be'));
  return dirty ? `${combined}-dirty` : combined;
}

/**
 * Full-repo git tree id (legacy). Prefer getFeBeSourceChecksum() for Mac vs Ubuntu compare.
 */
export function getCodeChecksum() {
  const tree = runGit('rev-parse --short=12 HEAD^{tree}');
  if (tree) {
    const dirty = Boolean(runGit('status --porcelain'));
    return dirty ? `${tree}-dirty` : tree;
  }
  const fallback = crypto.createHash('sha256').update(String(Date.now())).digest('hex').slice(0, 12);
  return fallback;
}

/** Profile menu + CLI one-liner. */
export function formatBuildLabel(info) {
  const datetime = info.datetime ?? '';
  const commit = info.commit ?? '';
  const src = info.sourceChecksum ?? info.checksum ?? '';
  if (datetime && commit && src) {
    return `${datetime} · commit ${commit} · src ${src}`;
  }
  if (datetime && src) return `${datetime} · src ${src}`;
  return [datetime, src].filter(Boolean).join(' ');
}

export function createBuildInfo(date = new Date()) {
  const completedAt = date.toISOString();
  const datetime = formatBuildDateTimeEt(date);
  const commit = getGitCommitShort() || null;
  const sourceChecksum = getFeBeSourceChecksum();
  const feTree = runGit('rev-parse --short=12 HEAD^{tree}:fe') || null;
  const beTree = runGit('rev-parse --short=12 HEAD^{tree}:be') || null;
  const dirty = Boolean(runGit('status --porcelain -- fe be'));
  const info = {
    completedAt,
    datetime,
    commit,
    sourceChecksum,
    feTree,
    beTree,
    dirty,
    /** @deprecated use sourceChecksum — kept for older build-info.json readers */
    checksum: sourceChecksum
  };
  info.label = formatBuildLabel(info);
  return info;
}

export function writeBuildInfo(info = createBuildInfo(), filePath = BUILD_INFO_PATH) {
  const dir = path.dirname(filePath);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(info, null, 2)}\n`, 'utf8');
  return info;
}

export function readBuildInfo() {
  try {
    if (!fs.existsSync(BUILD_INFO_PATH)) return null;
    const raw = fs.readFileSync(BUILD_INFO_PATH, 'utf8');
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    const label =
      typeof parsed.label === 'string' && parsed.label.trim()
        ? parsed.label.trim()
        : formatBuildLabel(parsed);
    if (!label) return null;
    return { ...parsed, label };
  } catch {
    return null;
  }
}

function stampJson(info) {
  return `${JSON.stringify(info, null, 2)}\n`;
}

/** Vite plugin: stamp at production build completion and when the dev server is ready. */
export function buildInfoVitePlugin() {
  let stampedForThisBuild = false;

  return {
    name: 'vsingles-build-info',
    configureServer(server) {
      const stamp = () => {
        writeBuildInfo(createBuildInfo());
      };
      server.httpServer?.once('listening', stamp);
      if (server.httpServer?.listening) stamp();
    },
    buildStart() {
      stampedForThisBuild = false;
    },
    generateBundle() {
      if (stampedForThisBuild) return;
      stampedForThisBuild = true;
      const info = createBuildInfo();
      // Keep public copy for `showbuild` / CLI after production builds.
      writeBuildInfo(info);
      // Emit into outDir so the deployed bundle serves the same stamp (public/ was copied earlier).
      this.emitFile({
        type: 'asset',
        fileName: 'build-info.json',
        source: stampJson(info)
      });
    }
  };
}

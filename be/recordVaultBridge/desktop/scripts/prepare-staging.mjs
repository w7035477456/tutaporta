/**
 * Stage a self-contained `be/` tree for electron-builder (no Andrew env, slim node_modules).
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawnSync } from 'child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const desktopDir = path.resolve(__dirname, '..');
const beRoot = path.resolve(desktopDir, '..', '..');
const stagingRoot = path.join(desktopDir, 'staging');
const stagingBe = path.join(stagingRoot, 'be');

function rmrf(target) {
  fs.rmSync(target, { recursive: true, force: true });
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function copyFile(src, dest) {
  ensureDir(path.dirname(dest));
  fs.copyFileSync(src, dest);
}

function copyDir(src, dest, { skipNames = [] } = {}) {
  ensureDir(dest);
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    if (skipNames.includes(entry.name)) continue;
    if (entry.name === 'node_modules' || entry.name === '.git') continue;
    const from = path.join(src, entry.name);
    const to = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDir(from, to, { skipNames });
    } else {
      copyFile(from, to);
    }
  }
}

rmrf(stagingRoot);
ensureDir(stagingBe);

copyDir(path.join(beRoot, 'recordVaultBridge'), path.join(stagingBe, 'recordVaultBridge'), {
  skipNames: ['desktop']
});
copyDir(path.join(beRoot, 'photoAlbumsBridge'), path.join(stagingBe, 'photoAlbumsBridge'));
copyDir(path.join(beRoot, 'routes', 'recordVault'), path.join(stagingBe, 'routes', 'recordVault'));
copyDir(path.join(beRoot, 'routes', 'photoAlbums'), path.join(stagingBe, 'routes', 'photoAlbums'));
copyDir(path.join(beRoot, 'utils'), path.join(stagingBe, 'utils'));
copyDir(path.join(beRoot, 'config'), path.join(stagingBe, 'config'));
copyDir(path.join(beRoot, 'db'), path.join(stagingBe, 'db'));

for (const file of ['jwtKeys.js', 'logger.js', 'mallDepartmentMode.js']) {
  copyFile(path.join(beRoot, file), path.join(stagingBe, file));
}

const iconCatalog = path.join(beRoot, '..', 'fe', 'src', 'constants', 'fontAwesome5ObjectsIcons.json');
if (fs.existsSync(iconCatalog)) {
  // From packaged be/utils → ../../fe/... resolves to resources/fe/...
  copyFile(iconCatalog, path.join(stagingRoot, 'fe', 'src', 'constants', 'fontAwesome5ObjectsIcons.json'));
}

const runtimePackage = {
  name: 'record-vault-bridge-runtime',
  private: true,
  type: 'module',
  dependencies: {
    express: '^4.18.2',
    'sql.js': '^1.14.1',
    archiver: '^8.0.0',
    unzipper: '^0.12.5',
    busboy: '^1.6.0',
    dotenv: '^16.3.1',
    jsonwebtoken: '^9.0.3',
    ioredis: '^5.9.3',
    // Vault icon KDF + password verify (static imports on bridge load path)
    argon2: '^0.44.0',
    bcrypt: '^6.0.0'
  }
};

fs.writeFileSync(path.join(stagingBe, 'package.json'), JSON.stringify(runtimePackage, null, 2));

console.log('[prepare-staging] npm install runtime deps…');
const npm = spawnSync('npm', ['install', '--omit=dev'], {
  cwd: stagingBe,
  stdio: 'inherit',
  shell: process.platform === 'win32'
});
if (npm.status !== 0) {
  process.exit(npm.status || 1);
}

// Belt-and-suspenders: keep node_modules out of git even if someone removes /staging/ from desktop .gitignore.
fs.writeFileSync(
  path.join(stagingRoot, '.gitignore'),
  '# Electron-builder staging tree — rebuild via npm run prepare-staging.\n*\n!.gitignore\n'
);
fs.writeFileSync(
  path.join(stagingBe, '.gitignore'),
  '# Runtime deps for packaged bridge — never commit.\nnode_modules/\n*.log\n.DS_Store\n'
);

console.log('[prepare-staging] ready:', stagingBe);

const fs = require('fs');
const path = require('path');

const expected = {
  'framer-motion': '12.41.0',
  'motion-dom': '12.41.0',
  'motion-utils': '12.39.0'
};

function readVersion(pkgName) {
  const pkgPath = path.join(__dirname, '..', 'node_modules', pkgName, 'package.json');
  return JSON.parse(fs.readFileSync(pkgPath, 'utf8')).version;
}

const mismatches = [];

for (const [pkgName, expectedVersion] of Object.entries(expected)) {
  try {
    const installedVersion = readVersion(pkgName);
    if (installedVersion !== expectedVersion) {
      mismatches.push(`${pkgName}@${installedVersion} (expected ${expectedVersion})`);
    }
  } catch {
    mismatches.push(`${pkgName} missing`);
  }
}

if (mismatches.length > 0) {
  console.error('\nMotion dependency mismatch detected:');
  mismatches.forEach((line) => console.error(`  - ${line}`));
  console.error('\nFix on Ubuntu:');
  console.error('  cd ~/code/main/fe');
  console.error('  sudo rm -rf node_modules');
  console.error('  npm install');
  console.error('  npm run buildprod\n');
  process.exit(1);
}

console.log('Motion deps OK:', Object.entries(expected).map(([name, version]) => `${name}@${version}`).join(', '));

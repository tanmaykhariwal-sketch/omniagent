const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const testDir = path.join(__dirname, '..', 'test');
const files = fs.readdirSync(testDir).filter((f) => f.endsWith('.test.js'));

let failed = false;
for (const file of files) {
  console.log(`\n--- ${file} ---`);
  const result = spawnSync(process.execPath, [path.join(testDir, file)], { stdio: 'inherit' });
  if (result.status !== 0) failed = true;
}

process.exit(failed ? 1 : 0);

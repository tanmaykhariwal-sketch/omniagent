const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const testDir = path.join(__dirname, '..', 'test');

// test/ is organized into subfolders (routes/, services/, core/, routing/,
// adapters/) mirroring server/'s structure -- walk recursively rather than
// only the top level, or every nested test file would silently never run.
function findTestFiles(dir) {
  const found = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      found.push(...findTestFiles(fullPath));
    } else if (entry.name.endsWith('.test.js')) {
      found.push(fullPath);
    }
  }
  return found;
}

const files = findTestFiles(testDir);

let failed = false;
for (const file of files) {
  console.log(`\n--- ${path.relative(testDir, file)} ---`);
  const result = spawnSync(process.execPath, [file], {
    stdio: 'inherit',
    // Signals test-only code (e.g. server/core/cache.js) to skip behavior
    // that's only safe outside a test process, such as caching responses
    // across the multiple test() blocks that share one process per file.
    env: { ...process.env, NODE_ENV: 'test' },
  });
  if (result.status !== 0) failed = true;
}

process.exit(failed ? 1 : 0);

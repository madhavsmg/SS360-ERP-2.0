import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const roots = process.argv.slice(2);
const extensions = new Set(['.js', '.mjs', '.cjs']);

if (!roots.length) {
  console.error('Usage: node scripts/check-js-syntax.js <path> [path...]');
  process.exit(1);
}

function collectFiles(targetPath) {
  if (!fs.existsSync(targetPath)) {
    return [];
  }

  const stat = fs.statSync(targetPath);
  if (stat.isFile()) {
    return extensions.has(path.extname(targetPath)) ? [targetPath] : [];
  }

  return fs.readdirSync(targetPath, { withFileTypes: true }).flatMap((entry) => {
    const childPath = path.join(targetPath, entry.name);

    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === 'dist' || entry.name === 'build') {
        return [];
      }

      return collectFiles(childPath);
    }

    return extensions.has(path.extname(entry.name)) ? [childPath] : [];
  });
}

const files = roots.flatMap((root) => collectFiles(path.resolve(root)));
let failed = false;

for (const file of files) {
  const result = spawnSync(process.execPath, ['--check', file], {
    encoding: 'utf8',
    stdio: 'pipe',
  });

  if (result.status !== 0) {
    failed = true;
    console.error(result.stderr || result.stdout || `Syntax check failed: ${file}`);
  }
}

if (failed) {
  process.exit(1);
}

console.log(`Checked JavaScript syntax for ${files.length} file(s).`);

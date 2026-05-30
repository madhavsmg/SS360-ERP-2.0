import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const repoRoot = process.cwd();
const ocrRoot = path.join(repoRoot, 'ocr-service');
const venvPython = path.join(ocrRoot, '.venv', 'Scripts', 'python.exe');
const python = fs.existsSync(venvPython) ? venvPython : 'python';

function run(label, args) {
  const result = spawnSync(python, args, {
    cwd: repoRoot,
    encoding: 'utf8',
    stdio: 'pipe',
  });

  if (result.status !== 0) {
    console.error(result.stdout);
    console.error(result.stderr);
    throw new Error(`${label} failed.`);
  }

  if (result.stdout.trim()) {
    console.log(result.stdout.trim());
  }
}

run('OCR Python compile', ['-m', 'compileall', '-q', path.join('ocr-service', 'app')]);
run('Python package check', ['-m', 'pip', 'check']);
console.log('OCR Python checks passed.');

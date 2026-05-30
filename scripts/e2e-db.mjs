import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const scriptsDir = path.dirname(fileURLToPath(import.meta.url));
export const repoRoot = path.resolve(scriptsDir, '..');

export function loadE2eEnv() {
  [
    '.env',
    '.env.e2e',
    '.env.e2e.local',
    path.join('backend', '.env'),
    path.join('backend', '.env.e2e'),
  ].forEach((relativePath) => {
    const filePath = path.join(repoRoot, relativePath);

    if (!fs.existsSync(filePath)) {
      return;
    }

    const lines = fs.readFileSync(filePath, 'utf8').split(/\r?\n/);

    lines.forEach((line) => {
      const trimmedLine = line.trim();

      if (!trimmedLine || trimmedLine.startsWith('#') || !trimmedLine.includes('=')) {
        return;
      }

      const [key, ...valueParts] = trimmedLine.split('=');

      if (!key || process.env[key]) {
        return;
      }

      process.env[key] = valueParts.join('=').replace(/^["']|["']$/g, '');
    });
  });
}

export function assertSafeDatabaseTarget() {
  const e2eEnv = process.env.E2E_ENV || 'qa';

  if (e2eEnv === 'production-real') {
    throw new Error('Refusing to reset or seed the real production tenant.');
  }

  if (e2eEnv === 'production-test' && !process.env.E2E_TEST_TENANT_ID) {
    throw new Error('E2E_TEST_TENANT_ID is required before mutating the production-test sandbox.');
  }
}

export async function createPrismaClient() {
  loadE2eEnv();
  assertSafeDatabaseTarget();

  if (!process.env.DATABASE_URL) {
    const message = 'DATABASE_URL is not set; backend PostgreSQL E2E seed/reset was skipped.';

    if (process.env.E2E_REQUIRE_DATABASE === '1') {
      throw new Error(message);
    }

    console.warn(message);
    return null;
  }

  const prismaClientPath = path.join(
    repoRoot,
    'backend',
    'node_modules',
    '@prisma',
    'client',
    'index.js'
  );

  if (!fs.existsSync(prismaClientPath)) {
    const message =
      'backend/node_modules/@prisma/client was not found; run npm --prefix backend install first.';

    if (process.env.E2E_REQUIRE_DATABASE === '1') {
      throw new Error(message);
    }

    console.warn(message);
    return null;
  }

  const { PrismaClient } = await import(pathToFileURL(prismaClientPath).href);
  return new PrismaClient();
}

export function isDirectRun(importMetaUrl) {
  return process.argv[1] && pathToFileURL(process.argv[1]).href === importMetaUrl;
}

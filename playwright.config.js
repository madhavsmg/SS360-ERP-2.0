import { defineConfig, devices } from '@playwright/test';

const localPort = Number(process.env.PLAYWRIGHT_PORT || 5174);
const localBaseURL = process.env.PLAYWRIGHT_BASE_URL || `http://127.0.0.1:${localPort}`;
const qaBaseURL = process.env.PLAYWRIGHT_QA_BASE_URL || localBaseURL;
const stagingBaseURL = process.env.PLAYWRIGHT_STAGE_BASE_URL || localBaseURL;
const productionTestBaseURL =
  process.env.PLAYWRIGHT_PROD_BASE_URL || process.env.PRODUCTION_TEST_BASE_URL || localBaseURL;
const productionReadonlyBaseURL =
  process.env.PLAYWRIGHT_REAL_PROD_BASE_URL || process.env.PRODUCTION_REAL_BASE_URL || localBaseURL;

function selectedProjectNames() {
  const names = [];

  process.argv.forEach((argument, index) => {
    if (argument.startsWith('--project=')) {
      names.push(argument.split('=')[1]);
    }

    if (argument === '--project' && process.argv[index + 1]) {
      names.push(process.argv[index + 1]);
    }
  });

  return names;
}

function projectIsSelected(projectName, selectedNames) {
  return (
    selectedNames.length === 0 ||
    selectedNames.some((selectedName) => projectName.includes(selectedName))
  );
}

function isLocalUrl(value) {
  try {
    const url = new URL(value);
    return ['127.0.0.1', 'localhost', '::1'].includes(url.hostname);
  } catch {
    return false;
  }
}

const selectedProjects = selectedProjectNames();
const activeBaseURLs = [
  ['qa-chromium', qaBaseURL],
  ['staging-chromium', stagingBaseURL],
  ['production-test-chromium', productionTestBaseURL],
  ['production-readonly-chromium', productionReadonlyBaseURL],
]
  .filter(([projectName]) => projectIsSelected(projectName, selectedProjects))
  .map(([, baseURL]) => baseURL);
const shouldStartLocalWebServer =
  process.env.PLAYWRIGHT_SKIP_WEBSERVER !== '1' && activeBaseURLs.some(isLocalUrl);

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 60_000,
  expect: {
    timeout: 10_000,
  },
  fullyParallel: Boolean(process.env.CI),
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 2 : 1,
  reporter: [
    ['list'],
    ['html', { outputFolder: 'playwright-report', open: 'never' }],
    ['json', { outputFile: 'test-results/e2e-results.json' }],
  ],
  outputDir: 'test-results/playwright-artifacts',
  use: {
    actionTimeout: 10_000,
    headless: Boolean(process.env.CI),
    launchOptions: {
      slowMo: process.env.CI ? 0 : Number(process.env.PLAYWRIGHT_SLOW_MO || 250),
    },
    navigationTimeout: 30_000,
    trace: process.env.CI ? 'retain-on-failure' : 'on-first-retry',
    screenshot: 'only-on-failure',
    video: process.env.CI ? 'retain-on-failure' : 'off',
  },
  webServer: shouldStartLocalWebServer
    ? {
        command: 'npm run dev:local',
        url: localBaseURL,
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
      }
    : undefined,
  projects: [
    {
      name: 'qa-chromium',
      metadata: { e2eEnvironment: 'qa', seededProfile: 'local-storage-and-backend-e2e' },
      use: { ...devices['Desktop Chrome'], baseURL: qaBaseURL },
    },
    {
      name: 'staging-chromium',
      metadata: { e2eEnvironment: 'staging', seededProfile: 'stage-test-data' },
      use: { ...devices['Desktop Chrome'], baseURL: stagingBaseURL },
    },
    {
      name: 'production-test-chromium',
      metadata: { e2eEnvironment: 'production-test', seededProfile: 'sandbox-test-tenant' },
      use: { ...devices['Desktop Chrome'], baseURL: productionTestBaseURL },
    },
    {
      name: 'production-readonly-chromium',
      grep: /@readonly/,
      metadata: { e2eEnvironment: 'production-real', seededProfile: 'readonly' },
      use: { ...devices['Desktop Chrome'], baseURL: productionReadonlyBaseURL },
    },
  ],
});

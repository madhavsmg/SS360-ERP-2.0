import { test as base, expect } from '@playwright/test';
import { seedEnterpriseState } from '../helpers/enterprise-state.js';

export const test = base.extend({
  page: async ({ page }, runFixture, testInfo) => {
    if (testInfo.project.metadata?.e2eEnvironment !== 'production-real') {
      await seedEnterpriseState(page);
    }

    await runFixture(page);
  },
});

export { expect };

export function needsProductionTestTenant(testInfo) {
  return (
    testInfo.project.metadata?.e2eEnvironment === 'production-test' &&
    !process.env.E2E_TEST_TENANT_ID
  );
}

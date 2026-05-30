import { expect } from '@playwright/test';
import { cloneE2eState, e2eState, STORAGE_KEY } from '../fixtures/erp-state.js';

export async function seedEnterpriseState(page, state = e2eState) {
  await page.addInitScript(
    ({ storageKey, enterpriseState }) => {
      if (globalThis.sessionStorage.getItem('__ss360E2eSeeded') === '1') {
        return;
      }

      globalThis.localStorage.setItem(storageKey, JSON.stringify(enterpriseState));
      globalThis.sessionStorage.setItem('__ss360E2eSeeded', '1');
    },
    {
      storageKey: STORAGE_KEY,
      enterpriseState: cloneE2eState(state),
    }
  );
}

export async function resetEnterpriseState(page, state = e2eState) {
  await page.evaluate(
    ({ storageKey, enterpriseState }) => {
      globalThis.localStorage.setItem(storageKey, JSON.stringify(enterpriseState));
      globalThis.sessionStorage.setItem('__ss360E2eSeeded', '1');
    },
    {
      storageKey: STORAGE_KEY,
      enterpriseState: cloneE2eState(state),
    }
  );
}

export async function readEnterpriseState(page) {
  return page.evaluate((storageKey) => {
    const storedValue = globalThis.localStorage.getItem(storageKey);
    return storedValue ? JSON.parse(storedValue) : null;
  }, STORAGE_KEY);
}

export async function expectStoredState(page, assertion) {
  const state = await readEnterpriseState(page);
  expect(state).toBeTruthy();
  await assertion(state);
}

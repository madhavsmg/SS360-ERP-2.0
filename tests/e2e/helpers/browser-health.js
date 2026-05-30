import { expect } from '@playwright/test';

const ignoredConsolePatterns = [/download the react devtools/i, /favicon/i, /ResizeObserver loop/i];

const criticalNetworkPatterns = [/\/api\//i, /\/src\//i, /\/assets\//i, /\/node_modules\//i];

export function trackBrowserHealth(page) {
  const consoleErrors = [];
  const failedRequests = [];

  page.on('console', (message) => {
    if (message.type() !== 'error') {
      return;
    }

    const text = message.text();
    if (!ignoredConsolePatterns.some((pattern) => pattern.test(text))) {
      consoleErrors.push(text);
    }
  });

  page.on('requestfailed', (request) => {
    const url = request.url();

    if (!criticalNetworkPatterns.some((pattern) => pattern.test(url))) {
      return;
    }

    failedRequests.push(`${request.method()} ${url}: ${request.failure()?.errorText || 'failed'}`);
  });

  page.on('response', (response) => {
    const url = response.url();

    if (response.status() >= 500 && criticalNetworkPatterns.some((pattern) => pattern.test(url))) {
      failedRequests.push(`${response.status()} ${url}`);
    }
  });

  return {
    consoleErrors,
    failedRequests,
  };
}

export function expectCleanBrowserHealth(health) {
  expect(health.consoleErrors, 'browser console errors').toEqual([]);
  expect(health.failedRequests, 'failed critical network calls').toEqual([]);
}

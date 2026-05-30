import { test, expect, needsProductionTestTenant } from './fixtures/test.js';

function apiBaseUrl() {
  return (
    process.env.PLAYWRIGHT_API_URL ||
    process.env.VITE_API_BASE_URL ||
    (process.env.CI ? '' : 'http://127.0.0.1:5000')
  );
}

test.describe('@regression backend invoice API guards', () => {
  test('@readonly reports backend liveness when an API URL is configured', async ({ request }) => {
    const baseURL = apiBaseUrl();
    test.skip(!baseURL, 'PLAYWRIGHT_API_URL or VITE_API_BASE_URL is not configured.');

    const response = await request.get(`${baseURL}/live`);
    const body = await response.json();

    expect(response.ok()).toBe(true);
    expect(body).toEqual(
      expect.objectContaining({
        status: 'ok',
        service: 'SS360 ERP Backend',
      })
    );
  });

  test('@workflow @destructive rejects unsupported invoice uploads before persistence', async ({
    request,
  }, testInfo) => {
    const baseURL = apiBaseUrl();
    test.skip(!baseURL, 'PLAYWRIGHT_API_URL or VITE_API_BASE_URL is not configured.');
    test.skip(
      needsProductionTestTenant(testInfo),
      'Production-test destructive runs require E2E_TEST_TENANT_ID.'
    );

    const response = await request.post(`${baseURL}/api/invoices`, {
      multipart: {
        file: {
          name: 'ss360-e2e-invalid.txt',
          mimeType: 'text/plain',
          buffer: Buffer.from('not an invoice'),
        },
      },
    });
    const body = await response.json();

    expect(response.status()).toBe(400);
    expect(body.success).toBe(false);
    expect(body.message).toMatch(/Supported files|uploaded file content/i);
    expect(JSON.stringify(body)).not.toMatch(/[A-Z]:\\|\/uploads\/invoices/i);
  });
});

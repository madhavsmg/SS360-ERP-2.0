import { test, expect } from './fixtures/test.js';
import { expectCleanBrowserHealth, trackBrowserHealth } from './helpers/browser-health.js';

const routes = [
  { path: '/', pageId: 'page-dashboard', heading: 'Siva Sai Tea ERP' },
  { path: '/suppliers', pageId: 'page-suppliers', heading: 'Supplier Ledger & Payments' },
  { path: '/customers', pageId: 'page-customers', heading: 'Customer Database & Order History' },
  { path: '/inventory', pageId: 'page-inventory', childId: 'inventory-stock-workspace' },
  { path: '/inventory/intake', pageId: 'page-inventory', childId: 'inventory-intake-workspace' },
  {
    path: '/inventory/invoices',
    pageId: 'page-inventory',
    childId: 'inventory-register-workspace',
  },
  { path: '/production', pageId: 'page-production', heading: 'QR Blending & Batch Costing' },
  { path: '/sales', pageId: 'page-sales', heading: 'Point of Sale & Sales Register' },
  { path: '/shipping', pageId: 'page-shipping', heading: 'Packaging & Shipping' },
];

test('@smoke @readonly shell navigation loads every current SS360 route', async ({ page }) => {
  const health = trackBrowserHealth(page);

  for (const route of routes) {
    await page.goto(route.path);
    await expect(page.getByTestId(route.pageId)).toBeVisible();

    if (route.childId) {
      await expect(page.getByTestId(route.childId)).toBeVisible();
    }

    if (route.heading) {
      await expect(page.getByRole('heading', { name: route.heading })).toBeVisible();
    }
  }

  await page.goto('/inventory/unknown-client-route');
  await expect(page.getByTestId('inventory-stock-workspace')).toBeVisible();
  await expectCleanBrowserHealth(health);
});

test('@smoke @readonly sidebar links activate the expected modules', async ({ page }) => {
  await page.goto('/');

  await page.getByTestId('nav-inventory').click();
  await expect(page.getByTestId('page-inventory')).toBeVisible();
  await expect(page.getByTestId('inventory-stock-workspace')).toBeVisible();

  await page.getByTestId('inventory-subnav-invoice-intake').click();
  await expect(page.getByTestId('inventory-intake-workspace')).toBeVisible();

  await page.getByTestId('inventory-subnav-invoice-register').click();
  await expect(page.getByTestId('inventory-register-workspace')).toBeVisible();

  await page.getByTestId('nav-dashboard').click();
  await expect(page.getByTestId('dashboard-kpi-raw-stock')).toBeVisible();
  await expect(page.getByTestId('dashboard-kpi-open-shipments')).toBeVisible();
});

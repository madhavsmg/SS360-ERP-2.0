import { test, expect, needsProductionTestTenant } from './fixtures/test.js';
import { expectStoredState } from './helpers/enterprise-state.js';

test.describe('@regression @workflow production, sales, and shipping', () => {
  test.beforeEach(({ page }, testInfo) => {
    void page;
    test.skip(
      needsProductionTestTenant(testInfo),
      'Production-test destructive runs require E2E_TEST_TENANT_ID.'
    );
  });

  test('@destructive creates a blend from existing inventory bags', async ({ page }) => {
    await page.goto('/production');

    await page.getByTestId('production-product-name-input').fill('E2E Morning Blend');
    await page.getByTestId('production-sku-input').fill('E2E-MORNING');
    await page.getByTestId('production-target-price-input').fill('260');
    await page.getByTestId('production-manual-lot-select').selectOption('RAW-E2E-ASSAM-001');
    await page.getByTestId('production-manual-bag-size-select').selectOption('25');
    await page.getByTestId('production-manual-bag-count-input').fill('1');
    await page.getByTestId('production-add-manual-button').click();

    await expect(page.getByTestId('production-message')).toContainText('added to the blend');
    await expect(page.getByTestId('production-price-preview')).toContainText('25');

    await page.getByTestId('production-create-blend-button').click();
    await page.getByTestId('confirmation-confirm').click();

    await expect(page.getByTestId('production-message')).toContainText('E2E Morning Blend created');
    await expect(page.getByTestId('production-batch-table')).toContainText('E2E Morning Blend');
    await expectStoredState(page, (state) => {
      const lot = state.rawLots.find((item) => item.id === 'RAW-E2E-ASSAM-001');
      expect(lot.remainingKg).toBe(125);
      expect(state.blendBatches[0].productName).toBe('E2E Morning Blend');
    });
  });

  test('@destructive prevents stock overdraw and completes a cash sale', async ({ page }) => {
    await page.goto('/sales');

    await page.getByTestId('sales-item-type-select').selectOption('blend');
    await page.getByTestId('sales-product-select').selectOption('BLD-E2E-CLASSIC-001');
    await page.getByTestId('sales-quantity-input').fill('9999');
    await page.getByTestId('sales-price-input').fill('240');
    await page.getByTestId('sales-add-to-cart-button').click();
    await expect(page.getByTestId('sales-message')).toContainText('Only');

    await page.getByTestId('sales-quantity-input').fill('5');
    await page.getByTestId('sales-add-to-cart-button').click();
    await expect(page.getByTestId('sales-cart-table')).toContainText('E2E Classic Blend');

    await page.getByTestId('sales-customer-select').selectOption('CUS-E2E-RETAIL');
    await page.getByTestId('sales-payment-mode-select').selectOption('Cash');
    await page.getByTestId('sales-complete-sale-button').click();
    await page.getByTestId('confirmation-confirm').click();

    await expect(page.getByTestId('sales-message')).toContainText('Sale completed');
    await expectStoredState(page, (state) => {
      const batch = state.blendBatches.find((item) => item.id === 'BLD-E2E-CLASSIC-001');
      expect(batch.remainingKg).toBe(85);
      expect(state.shipments[0].status).toBe('Packed');
    });
  });

  test('@destructive dispatches a packed shipment and syncs order status', async ({ page }) => {
    await page.goto('/shipping');

    await page.getByTestId('shipping-shipment-select').selectOption('SHIP-E2E-PACKED-001');
    await page.getByTestId('shipping-status-select').selectOption('Dispatched');
    await page.getByTestId('shipping-transport-input').fill('Navata Road Transport');
    await page.getByTestId('shipping-vehicle-input').fill('TS09E2E1234');
    await page.getByTestId('shipping-note-input').fill('E2E dispatched');
    await page.getByTestId('shipping-update-submit').click();
    await page.getByTestId('confirmation-confirm').click();

    await expect(page.getByTestId('shipping-message')).toContainText('Shipment status updated');
    await expect(page.getByTestId('shipping-row-SHIP-E2E-PACKED-001')).toContainText('Dispatched');
    await expectStoredState(page, (state) => {
      const shipment = state.shipments.find((item) => item.id === 'SHIP-E2E-PACKED-001');
      const order = state.salesOrders.find((item) => item.id === 'SO-E2E-PACKED-001');
      expect(shipment.status).toBe('Dispatched');
      expect(order.status).toBe('Dispatched');
    });
  });
});

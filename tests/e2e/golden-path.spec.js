import { test, expect, needsProductionTestTenant } from './fixtures/test.js';
import { readEnterpriseState } from './helpers/enterprise-state.js';

test.describe('@regression @workflow golden path', () => {
  test.beforeEach(({ page }, testInfo) => {
    void page;
    test.skip(
      needsProductionTestTenant(testInfo),
      'Production-test destructive runs require E2E_TEST_TENANT_ID.'
    );
  });

  test('@destructive moves seeded stock through blend, sale, shipment, and dashboard', async ({
    page,
  }) => {
    await page.goto('/production');
    await page.getByTestId('production-product-name-input').fill('E2E Golden Blend');
    await page.getByTestId('production-sku-input').fill('E2E-GOLDEN');
    await page.getByTestId('production-target-price-input').fill('275');
    await page.getByTestId('production-manual-lot-select').selectOption('RAW-E2E-ASSAM-001');
    await page.getByTestId('production-manual-bag-size-select').selectOption('25');
    await page.getByTestId('production-manual-bag-count-input').fill('1');
    await page.getByTestId('production-add-manual-button').click();
    await page.getByTestId('production-create-blend-button').click();
    await page.getByTestId('confirmation-confirm').click();

    const afterBlend = await readEnterpriseState(page);
    const blendId = afterBlend.blendBatches[0].id;

    await page.goto('/sales');
    await page.getByTestId('sales-item-type-select').selectOption('blend');
    await page.getByTestId('sales-product-select').selectOption(blendId);
    await page.getByTestId('sales-quantity-input').fill('10');
    await page.getByTestId('sales-price-input').fill('275');
    await page.getByTestId('sales-add-to-cart-button').click();
    await page.getByTestId('sales-customer-select').selectOption('CUS-E2E-CASH');
    await page.getByTestId('sales-payment-mode-select').selectOption('UPI');
    await page.getByTestId('sales-complete-sale-button').click();
    await page.getByTestId('confirmation-confirm').click();

    const afterSale = await readEnterpriseState(page);
    const shipmentId = afterSale.shipments[0].id;

    await page.goto('/shipping');
    await page.getByTestId('shipping-shipment-select').selectOption(shipmentId);
    await page.getByTestId('shipping-status-select').selectOption('Delivered');
    await page.getByTestId('shipping-transport-input').fill('Customer pickup');
    await page.getByTestId('shipping-vehicle-input').fill('E2E-PICKUP');
    await page.getByTestId('shipping-update-submit').click();
    await page.getByTestId('confirmation-confirm').click();

    await page.goto('/');
    await expect(page.getByTestId('dashboard-kpi-raw-stock')).toBeVisible();
    await expect(page.getByTestId('dashboard-kpi-sales-revenue')).toBeVisible();
    await expect(page.getByTestId('dashboard-kpi-open-shipments')).toBeVisible();

    const finalState = await readEnterpriseState(page);
    expect(finalState.blendBatches[0].productName).toBe('E2E Golden Blend');
    expect(finalState.blendBatches[0].remainingKg).toBe(15);
    expect(finalState.salesOrders[0].itemName).toBe('E2E Golden Blend');
    expect(finalState.shipments[0].status).toBe('Delivered');
  });
});

import { test, expect, needsProductionTestTenant } from './fixtures/test.js';
import { FIXED_E2E_DATE } from './fixtures/erp-state.js';
import { expectStoredState } from './helpers/enterprise-state.js';

test.describe('@regression @workflow @destructive supplier and customer ledgers', () => {
  test.beforeEach(({ page }, testInfo) => {
    void page;
    test.skip(
      needsProductionTestTenant(testInfo),
      'Production-test destructive runs require E2E_TEST_TENANT_ID.'
    );
  });

  test('adds a supplier and records a guarded supplier payment', async ({ page }) => {
    await page.goto('/suppliers');

    await page.getByTestId('supplier-name-input').fill('SS360 E2E New Supplier');
    await page.getByTestId('supplier-agent-input').fill('QA Broker');
    await page.getByTestId('supplier-phone-input').fill('9000011113');
    await page.getByTestId('supplier-region-input').fill('Dooars');
    await page.getByTestId('supplier-payment-terms-input').fill('9');
    await page.getByTestId('supplier-address-input').fill('Regression supplier address');
    await page.getByTestId('supplier-add-submit').click();
    await expect(page.getByTestId('confirmation-dialog')).toBeVisible();
    await page.getByTestId('confirmation-confirm').click();

    await expect(page.getByTestId('supplier-message')).toContainText(
      'SS360 E2E New Supplier added'
    );
    await expect(page.getByTestId('supplier-ledger')).toContainText('SS360 E2E New Supplier');

    await page.getByTestId('supplier-payment-supplier-select').selectOption('SUP-E2E-ASSAM');
    await page.getByTestId('supplier-payment-amount-input').fill('1001');
    await expect(page.getByText(/Payment cannot exceed the due amount/i)).toBeVisible();
    await expect(page.getByTestId('supplier-payment-submit')).toBeDisabled();

    await page.getByTestId('supplier-payment-amount-input').fill('125');
    await page.getByTestId('supplier-payment-date-input').fill(FIXED_E2E_DATE);
    await page.getByTestId('supplier-payment-mode-select').selectOption('UPI');
    await page.getByTestId('supplier-payment-reference-input').fill('E2E-UPI-001');
    await page.getByTestId('supplier-payment-submit').click();
    await page.getByTestId('confirmation-confirm').click();

    await expect(page.getByTestId('supplier-message')).toContainText('recorded for');
    await expectStoredState(page, (state) => {
      const supplier = state.suppliers.find((item) => item.id === 'SUP-E2E-ASSAM');
      expect(supplier.outstanding).toBe(875);
      expect(state.supplierPayments[0].reference).toBe('E2E-UPI-001');
    });
  });

  test('adds a customer and blocks payment above outstanding balance', async ({ page }) => {
    await page.goto('/customers');

    await page.getByTestId('customer-name-input').fill('SS360 E2E New Customer');
    await page.getByTestId('customer-type-select').selectOption('Retailer');
    await page.getByTestId('customer-phone-input').fill('9885500993');
    await page.getByTestId('customer-city-input').fill('Warangal');
    await page.getByTestId('customer-credit-limit-input').fill('30000');
    await page.getByTestId('customer-delivery-input').fill('SBT Transport');
    await page.getByTestId('customer-add-submit').click();
    await page.getByTestId('confirmation-confirm').click();

    await expect(page.getByTestId('customer-message')).toContainText(
      'SS360 E2E New Customer added'
    );
    await expect(page.getByTestId('customer-ledger')).toContainText('SS360 E2E New Customer');

    await page.getByTestId('customer-payment-customer-select').selectOption('CUS-E2E-RETAIL');
    await page.getByTestId('customer-payment-amount-input').fill('501');
    await expect(page.getByTestId('customer-payment-amount-input')).toHaveJSProperty(
      'validity.rangeOverflow',
      true
    );

    await page.getByTestId('customer-payment-amount-input').fill('100');
    await page.getByTestId('customer-payment-submit').click();
    await page.getByTestId('confirmation-confirm').click();

    await expect(page.getByTestId('customer-message')).toContainText('recorded for');
    await expectStoredState(page, (state) => {
      const customer = state.customers.find((item) => item.id === 'CUS-E2E-RETAIL');
      expect(customer.outstanding).toBe(400);
    });
  });
});

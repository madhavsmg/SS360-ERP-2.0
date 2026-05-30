import { test, expect, needsProductionTestTenant } from './fixtures/test.js';
import { e2eRawLotQrPayload, FIXED_E2E_DATE } from './fixtures/erp-state.js';
import { expectStoredState } from './helpers/enterprise-state.js';

test.describe('@regression @workflow inventory intake and register', () => {
  test.beforeEach(({ page }, testInfo) => {
    void page;
    test.skip(
      needsProductionTestTenant(testInfo),
      'Production-test destructive runs require E2E_TEST_TENANT_ID.'
    );
  });

  test('@readonly stock ledger resolves QR payloads and keeps page identity stable', async ({
    page,
  }) => {
    await page.goto('/inventory');

    await page.getByTestId('inventory-qr-lookup-input').fill(e2eRawLotQrPayload);
    await page.getByTestId('inventory-qr-match-button').click();

    await expect(page.getByTestId('inventory-stock-message')).toContainText(
      'E2E Assam CTC BOP selected'
    );
    await expect(page.getByTestId('inventory-selected-qr').getByRole('img')).toBeVisible();
    await expect(page.getByTestId('inventory-stock-workspace')).toContainText('E2E Assam CTC');
    await expect(page.getByTestId('inventory-raw-row-RAW-E2E-ASSAM-001')).toBeVisible();
  });

  test('@destructive saves a human-reviewed invoice draft and shows it in the drafts queue', async ({
    page,
  }) => {
    await page.goto('/inventory/intake');

    await page.getByTestId('invoice-vendor-name-input').fill('SS360 E2E Intake Supplier');
    await page.getByTestId('invoice-vendor-phone-input').fill('9000011198');
    await page.getByTestId('invoice-number-input').fill('E2E-MANUAL-001');
    await page.getByTestId('invoice-date-input').fill(FIXED_E2E_DATE);
    await page.getByTestId('invoice-vendor-address-input').fill('Manual intake regression address');
    await page.getByTestId('invoice-taxable-value-input').fill('2500');
    await page.getByTestId('invoice-net-total-input').fill('2500');
    await page.getByTestId('invoice-line-0-tea-name-input').fill('E2E Manual Tea');
    await page.getByTestId('invoice-line-0-grade-input').fill('BOP');
    await page.getByTestId('invoice-line-0-bag-breakdown-input').fill('2 x 10');
    await page.getByTestId('invoice-line-0-quantity-input').fill('2');
    await page.getByTestId('invoice-line-0-unit-weight-input').fill('10');
    await page.getByTestId('invoice-line-0-received-kg-input').fill('20');
    await page.getByTestId('invoice-line-0-rate-input').fill('125');
    await page.getByTestId('invoice-line-0-taxable-input').fill('2500');
    await page.getByTestId('invoice-line-0-line-total-input').fill('2500');
    await page.getByTestId('invoice-save-draft-button').click();

    await expect(page.getByTestId('invoice-intake-message')).toContainText(
      'saved for later review'
    );

    await page.goto('/inventory/invoices');
    await page.getByTestId('invoice-register-tab-drafts').click();
    await expect(page.getByTestId('inventory-register-workspace')).toContainText('E2E-MANUAL-001');
  });

  test('@destructive keeps approved invoices reversible through correction drafts', async ({
    page,
  }) => {
    await page.goto('/inventory/invoices');

    await page.getByTestId('invoice-register-tab-approved').click();
    await page.getByTestId('invoice-register-row-invoice:INV-E2E-REV-003').click();
    await expect(page.getByTestId('invoice-revert-button')).toBeEnabled();

    await page.getByTestId('invoice-revert-reason-input').fill('E2E correction rehearsal');
    await page.getByTestId('invoice-revert-button').click();
    await page.getByTestId('confirmation-confirm').click();

    await expect(page.getByTestId('invoice-register-message')).toContainText(
      'A correction draft is ready'
    );
    await page.getByTestId('invoice-register-tab-needsCorrection').click();
    await expect(page.getByTestId('inventory-register-workspace')).toContainText('Correction');
    await expectStoredState(page, (state) => {
      const invoice = state.invoiceReceipts.find((item) => item.id === 'INV-E2E-REV-003');
      expect(invoice.status).toBe('Reverted');
      expect(state.invoiceDrafts.some((draft) => draft.correctionOfInvoiceId === invoice.id)).toBe(
        true
      );
    });
  });
});

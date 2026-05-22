import { useMemo, useState } from 'react';
import { HandCoins } from 'lucide-react';
import { useConfirmationDialog } from '../../components/ConfirmationDialog';
import { useEnterprise } from '../../context/EnterpriseContext';
import {
  formatPaymentTerms,
  sanitizeGstinInput,
  sanitizeIndianMobileInput,
  sanitizePaymentTermDays,
  validateOptionalGstin,
  validateOptionalIndianMobile,
  validatePaymentTermDays,
} from '../../utils/businessValidation';
import { formatKg, formatMoney } from '../../utils/formatters';

const supplierFormDefaults = {
  name: '',
  agentName: '',
  phone: '',
  region: '',
  paymentTerms: '7',
  gstin: '',
  address: '',
};

const paymentDefaults = {
  supplierId: '',
  amount: '',
  paymentDate: '',
  mode: 'Bank transfer',
  reference: '',
};

export default function SuppliersPage() {
  const { data, addSupplier, recordSupplierPayment, today, numberValue } = useEnterprise();
  const [supplierForm, setSupplierForm] = useState(supplierFormDefaults);
  const [payment, setPayment] = useState(() => ({ ...paymentDefaults, paymentDate: today }));
  const [message, setMessage] = useState('');
  const { confirmationDialog, requestConfirmation } = useConfirmationDialog();

  const supplierLedger = useMemo(() => {
    return data.suppliers.map((supplier) => {
      const supplierLots = data.rawLots.filter((lot) => lot.supplierId === supplier.id);
      const supplierPayments = (data.supplierPayments || []).filter(
        (entry) => entry.supplierId === supplier.id
      );
      const suppliedKg = supplierLots.reduce(
        (total, lot) => total + numberValue(lot.receivedKg),
        0
      );
      const lastLot = supplierLots[0] || null;
      const lastPayment = supplierPayments[0] || null;

      return {
        supplier,
        suppliedKg,
        lastLot,
        lastPayment,
      };
    });
  }, [data.rawLots, data.supplierPayments, data.suppliers, numberValue]);

  const supplierStats = useMemo(() => {
    const totalOutstanding = data.suppliers.reduce(
      (total, supplier) => total + numberValue(supplier.outstanding),
      0
    );
    const totalPayments = (data.supplierPayments || []).reduce(
      (total, entry) => total + numberValue(entry.amount),
      0
    );
    const suppliersWithBalance = data.suppliers.filter(
      (supplier) => numberValue(supplier.outstanding) > 0
    ).length;

    return {
      supplierCount: data.suppliers.length,
      suppliersWithBalance,
      totalOutstanding,
      totalPayments,
    };
  }, [data.supplierPayments, data.suppliers, numberValue]);
  const selectedPaymentSupplier = data.suppliers.find(
    (supplier) => supplier.id === payment.supplierId
  );
  const selectedOutstanding = selectedPaymentSupplier
    ? numberValue(selectedPaymentSupplier.outstanding)
    : 0;
  const paymentAmount = numberValue(payment.amount);
  const selectedSupplierHasDue = Boolean(selectedPaymentSupplier) && selectedOutstanding > 0;
  const paymentExceedsOutstanding = selectedSupplierHasDue && paymentAmount > selectedOutstanding;
  const canSubmitPayment =
    selectedSupplierHasDue && paymentAmount > 0 && !paymentExceedsOutstanding;

  function updateSupplierForm(field, value) {
    let nextValue = value;

    if (field === 'phone') {
      nextValue = sanitizeIndianMobileInput(value);
    }

    if (field === 'paymentTerms') {
      nextValue = sanitizePaymentTermDays(value);
    }

    if (field === 'gstin') {
      nextValue = sanitizeGstinInput(value);
    }

    setSupplierForm((currentForm) => ({ ...currentForm, [field]: nextValue }));
  }

  function updatePayment(field, value) {
    setPayment((currentPayment) => ({ ...currentPayment, [field]: value }));
  }

  function selectPaymentSupplier(supplierId) {
    setPayment((currentPayment) => ({
      ...currentPayment,
      supplierId,
      amount: '',
      reference: '',
    }));
  }

  function useFullDueAmount() {
    if (!selectedSupplierHasDue) {
      return;
    }

    setPayment((currentPayment) => ({
      ...currentPayment,
      amount: String(Math.round(selectedOutstanding * 100) / 100),
    }));
    setMessage('');
  }

  function submitSupplier(event) {
    event.preventDefault();

    if (!supplierForm.name.trim()) {
      setMessage('Supplier name is required.');
      return;
    }

    const phoneError = validateOptionalIndianMobile(supplierForm.phone, 'Supplier phone');
    const termsError = validatePaymentTermDays(supplierForm.paymentTerms);
    const gstinError = validateOptionalGstin(supplierForm.gstin, 'Supplier GSTIN');

    if (phoneError || termsError || gstinError) {
      setMessage(phoneError || termsError || gstinError);
      return;
    }

    requestConfirmation(
      {
        title: 'Add supplier to ledger?',
        description:
          'This creates a supplier master record that can receive invoice payables and payments.',
        details: [
          { label: 'Supplier', value: supplierForm.name.trim() },
          { label: 'Region', value: supplierForm.region || 'Not set' },
          { label: 'Terms', value: formatPaymentTerms(supplierForm.paymentTerms) },
        ],
        confirmLabel: 'Add Supplier',
      },
      () => {
        try {
          const supplier = addSupplier(supplierForm);
          setSupplierForm(supplierFormDefaults);
          setPayment((currentPayment) => ({ ...currentPayment, supplierId: supplier.id }));
          setMessage(`${supplier.name} added to the supplier ledger.`);
        } catch (error) {
          setMessage(error.message);
        }
      }
    );
  }

  function submitPayment(event) {
    event.preventDefault();

    const supplier = data.suppliers.find((item) => item.id === payment.supplierId);
    const paymentAmount = numberValue(payment.amount);

    if (!supplier) {
      setMessage('Select a supplier before recording payment.');
      return;
    }

    if (paymentAmount <= 0) {
      setMessage('Payment amount must be greater than zero.');
      return;
    }

    const supplierOutstanding = numberValue(supplier.outstanding);

    if (supplierOutstanding <= 0) {
      setMessage(`${supplier.name} has no outstanding balance. Payment cannot be recorded.`);
      return;
    }

    if (paymentAmount > supplierOutstanding) {
      setMessage(
        `Payment cannot exceed ${supplier.name}'s outstanding balance of ${formatMoney(
          supplierOutstanding
        )}.`
      );
      return;
    }

    if (!payment.paymentDate || payment.paymentDate > today) {
      setMessage('Payment date is required and cannot be in the future.');
      return;
    }

    requestConfirmation(
      {
        title: 'Record supplier payment?',
        description: 'This will post a payment entry and reduce the supplier outstanding balance.',
        details: [
          { label: 'Supplier', value: supplier.name },
          { label: 'Outstanding', value: formatMoney(supplierOutstanding) },
          { label: 'Amount', value: formatMoney(paymentAmount) },
          { label: 'Balance After', value: formatMoney(supplierOutstanding - paymentAmount) },
          { label: 'Mode', value: payment.mode || 'Bank transfer' },
          { label: 'Reference', value: payment.reference || 'Not provided' },
        ],
        confirmLabel: 'Record Payment',
      },
      () => {
        try {
          const paymentRecord = recordSupplierPayment(payment);
          setPayment({
            ...paymentDefaults,
            supplierId: paymentRecord.supplierId,
            paymentDate: today,
            mode: payment.mode,
          });
          setMessage(
            `${formatMoney(paymentRecord.amount)} recorded for ${paymentRecord.supplierName}.`
          );
        } catch (error) {
          setMessage(error.message);
        }
      }
    );
  }

  return (
    <section className="erp-page supplier-module">
      <header className="erp-header">
        <div>
          <span className="erp-kicker">Suppliers</span>
          <h1>Supplier Ledger & Payments</h1>
          <p>
            Maintain supplier details, payable balances, and payment records while stock intake
            stays inside the Inventory invoice workflow.
          </p>
        </div>
      </header>

      <div className="erp-summary-grid">
        <div className="erp-stat erp-kpi-stat stat-master-records">
          <span>Total Suppliers</span>
          <strong>{supplierStats.supplierCount}</strong>
          <small>vendors in the ledger</small>
        </div>
        <div
          className={`erp-stat erp-kpi-stat ${
            supplierStats.totalOutstanding > 0 ? 'stat-payable-risk' : 'stat-approved'
          }`}
        >
          <span>Outstanding</span>
          <strong>{formatMoney(supplierStats.totalOutstanding)}</strong>
          <small>{supplierStats.suppliersWithBalance} suppliers with balance</small>
        </div>
        <div className="erp-stat erp-kpi-stat stat-cashflow">
          <span>Payments Posted</span>
          <strong>{formatMoney(supplierStats.totalPayments)}</strong>
          <small>{(data.supplierPayments || []).length} payment entries</small>
        </div>
        <div className="erp-stat erp-kpi-stat stat-stock-link">
          <span>Active Lots</span>
          <strong>{data.rawLots.length}</strong>
          <small>linked to supplier stock history</small>
        </div>
      </div>

      {message && <p className="erp-message">{message}</p>}

      <div className="erp-workspace supplier-workspace">
        <div className="supplier-main-column">
          <section className="erp-panel supplier-ledger-panel">
            <div className="erp-panel-title">
              <h2>Supplier Ledger</h2>
            </div>
            <div className="erp-table table-supplier-ledger">
              <div className="erp-row head">
                <span>Supplier</span>
                <span>Region</span>
                <span>Terms</span>
                <span>Supplied</span>
                <span>Outstanding</span>
                <span>Last Payment</span>
              </div>
              {supplierLedger.map(({ supplier, suppliedKg, lastLot, lastPayment }) => (
                <button
                  className="erp-row"
                  key={supplier.id}
                  type="button"
                  onClick={() => updatePayment('supplierId', supplier.id)}
                >
                  <span>
                    <strong>{supplier.name}</strong>
                    <small>
                      {supplier.agentName || 'Contact pending'} | {supplier.phone || 'No phone'}
                    </small>
                  </span>
                  <span>
                    <strong>{supplier.region || 'Not set'}</strong>
                    <small>{supplier.gstin || 'GSTIN pending'}</small>
                  </span>
                  <span>{supplier.paymentTerms || '7 days'}</span>
                  <span>
                    <strong>{formatKg(suppliedKg)}</strong>
                    <small>{lastLot ? lastLot.receivedDate : 'No stock lots'}</small>
                  </span>
                  <span
                    className={numberValue(supplier.outstanding) > 0 ? 'erp-loss' : 'erp-profit'}
                  >
                    {formatMoney(supplier.outstanding)}
                  </span>
                  <span>
                    {lastPayment ? (
                      <>
                        <strong>{formatMoney(lastPayment.amount)}</strong>
                        <small>{lastPayment.paymentDate}</small>
                      </>
                    ) : (
                      'No payments'
                    )}
                  </span>
                </button>
              ))}
              {!supplierLedger.length && (
                <div className="erp-empty-state">No suppliers have been added yet.</div>
              )}
            </div>
          </section>

          <section className="erp-panel supplier-payments-panel">
            <div className="erp-panel-title">
              <h2>Payment History</h2>
            </div>
            <div className="erp-table table-supplier-payments">
              <div className="erp-row head">
                <span>Supplier</span>
                <span>Date</span>
                <span>Mode</span>
                <span>Reference</span>
                <span>Amount</span>
              </div>
              {(data.supplierPayments || []).map((entry) => (
                <div className="erp-row" key={entry.id}>
                  <span>
                    <strong>{entry.supplierName}</strong>
                    <small>{entry.note || 'Supplier payment'}</small>
                  </span>
                  <span>{entry.paymentDate}</span>
                  <span>{entry.mode}</span>
                  <span>{entry.reference || 'Not provided'}</span>
                  <span className="erp-profit">{formatMoney(entry.amount)}</span>
                </div>
              ))}
              {!(data.supplierPayments || []).length && (
                <div className="erp-empty-state">No supplier payments have been posted yet.</div>
              )}
            </div>
          </section>
        </div>

        <aside className="supplier-action-stack">
          <form className="erp-panel" onSubmit={submitSupplier}>
            <div className="erp-panel-title">
              <h2>Add Supplier</h2>
            </div>
            <label>
              <span>Supplier name</span>
              <input
                autoComplete="organization"
                maxLength="80"
                required
                value={supplierForm.name}
                onChange={(event) => updateSupplierForm('name', event.target.value)}
              />
            </label>
            <div className="erp-form-grid supplier-form-grid">
              <label>
                <span>Contact person</span>
                <input
                  autoComplete="name"
                  maxLength="80"
                  value={supplierForm.agentName}
                  onChange={(event) => updateSupplierForm('agentName', event.target.value)}
                />
              </label>
              <label>
                <span>Phone</span>
                <input
                  autoComplete="tel"
                  inputMode="numeric"
                  maxLength="10"
                  pattern="[6-9][0-9]{9}"
                  placeholder="10-digit mobile"
                  type="tel"
                  value={supplierForm.phone}
                  onChange={(event) => updateSupplierForm('phone', event.target.value)}
                />
              </label>
              <label>
                <span>Region</span>
                <input
                  maxLength="40"
                  value={supplierForm.region}
                  onChange={(event) => updateSupplierForm('region', event.target.value)}
                />
              </label>
              <label>
                <span>Payment terms</span>
                <div className="erp-input-suffix-wrap">
                  <input
                    inputMode="numeric"
                    maxLength="2"
                    pattern="[0-9]{1,2}"
                    placeholder="7"
                    required
                    value={supplierForm.paymentTerms}
                    onChange={(event) => updateSupplierForm('paymentTerms', event.target.value)}
                  />
                  <span className="erp-input-suffix">days</span>
                </div>
              </label>
              <label>
                <span>GSTIN</span>
                <input
                  autoCapitalize="characters"
                  maxLength="15"
                  pattern="[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]"
                  placeholder="15-character GSTIN"
                  value={supplierForm.gstin}
                  onChange={(event) => updateSupplierForm('gstin', event.target.value)}
                />
              </label>
            </div>
            <label>
              <span>Address</span>
              <textarea
                maxLength="240"
                rows="3"
                value={supplierForm.address}
                onChange={(event) => updateSupplierForm('address', event.target.value)}
              />
            </label>
            <button className="erp-button" type="submit">
              Add Supplier
            </button>
          </form>

          <form className="erp-panel" onSubmit={submitPayment}>
            <div className="erp-panel-title">
              <h2>Supplier Payment</h2>
            </div>
            <label>
              <span>Supplier</span>
              <select
                required
                value={payment.supplierId}
                onChange={(event) => selectPaymentSupplier(event.target.value)}
              >
                <option value="">Select supplier</option>
                {data.suppliers.map((supplier) => (
                  <option key={supplier.id} value={supplier.id}>
                    {supplier.name} - {formatMoney(supplier.outstanding)}
                  </option>
                ))}
              </select>
            </label>
            {selectedPaymentSupplier && (
              <p
                className={paymentExceedsOutstanding ? 'erp-muted-note erp-loss' : 'erp-muted-note'}
              >
                {selectedSupplierHasDue
                  ? paymentExceedsOutstanding
                    ? `Payment cannot exceed the due amount of ${formatMoney(selectedOutstanding)}.`
                    : `Outstanding due: ${formatMoney(selectedOutstanding)}.`
                  : 'This supplier has no outstanding balance, so payment entry is disabled.'}
              </p>
            )}
            <div className="erp-form-grid supplier-payment-grid">
              <label>
                <span>Amount</span>
                <input
                  min="0"
                  max={selectedSupplierHasDue ? selectedOutstanding : undefined}
                  step="0.01"
                  type="number"
                  disabled={!selectedSupplierHasDue}
                  placeholder={selectedSupplierHasDue ? 'Enter amount due' : 'No due'}
                  required
                  value={payment.amount}
                  onChange={(event) => updatePayment('amount', event.target.value)}
                />
              </label>
              <button
                className="supplier-due-button"
                disabled={!selectedSupplierHasDue}
                title="Fill the full outstanding due amount"
                type="button"
                onClick={useFullDueAmount}
              >
                <HandCoins size={14} />
                Use Due
              </button>
              <label>
                <span>Date</span>
                <input
                  type="date"
                  disabled={!selectedSupplierHasDue}
                  max={today}
                  required
                  value={payment.paymentDate}
                  onChange={(event) => updatePayment('paymentDate', event.target.value)}
                />
              </label>
              <label>
                <span>Mode</span>
                <select
                  disabled={!selectedSupplierHasDue}
                  required
                  value={payment.mode}
                  onChange={(event) => updatePayment('mode', event.target.value)}
                >
                  <option>Bank transfer</option>
                  <option>UPI</option>
                  <option>Cash</option>
                  <option>Cheque</option>
                </select>
              </label>
              <label className="supplier-payment-reference">
                <span>Reference</span>
                <input
                  disabled={!selectedSupplierHasDue}
                  maxLength="40"
                  value={payment.reference}
                  onChange={(event) => updatePayment('reference', event.target.value)}
                />
              </label>
            </div>
            <button className="erp-button secondary" disabled={!canSubmitPayment} type="submit">
              Record Payment
            </button>
          </form>
        </aside>
      </div>
      {confirmationDialog}
    </section>
  );
}

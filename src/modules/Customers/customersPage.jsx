import { useMemo, useState } from 'react';
import { useConfirmationDialog } from '../../components/ConfirmationDialog';
import { useEnterprise } from '../../context/EnterpriseContext';
import {
  sanitizeIndianMobileInput,
  validateOptionalIndianMobile,
} from '../../utils/businessValidation';
import { formatKg, formatMoney } from '../../utils/formatters';
import { getMessageClassName } from '../../utils/messageTone';

const customerDefaults = {
  name: '',
  type: 'Wholesale',
  phone: '',
  city: '',
  state: '',
  deliveryPreference: 'Auto transport',
  creditLimit: '50000',
};

export default function CustomersPage() {
  const { data, addCustomer, recordCustomerPayment, numberValue } = useEnterprise();
  const [form, setForm] = useState(customerDefaults);
  const [payment, setPayment] = useState({ customerId: '', amount: '' });
  const [message, setMessage] = useState('');
  const { confirmationDialog, requestConfirmation } = useConfirmationDialog();
  const customerOrders = useMemo(() => {
    return data.customers.map((customer) => ({
      customer,
      orders: data.salesOrders.filter((order) => order.customerId === customer.id),
    }));
  }, [data.customers, data.salesOrders]);
  const selectedPaymentCustomer = data.customers.find(
    (customer) => customer.id === payment.customerId
  );

  function updateForm(field, value) {
    const nextValue = field === 'phone' ? sanitizeIndianMobileInput(value) : value;
    setForm((currentForm) => ({ ...currentForm, [field]: nextValue }));
  }

  function submitCustomer(event) {
    event.preventDefault();

    if (!form.name.trim()) {
      setMessage('Customer name is required.');
      return;
    }

    const phoneError = validateOptionalIndianMobile(form.phone, 'Customer phone');

    if (phoneError) {
      setMessage(phoneError);
      return;
    }

    if (numberValue(form.creditLimit) < 0) {
      setMessage('Credit limit cannot be negative.');
      return;
    }

    requestConfirmation(
      {
        title: 'Add customer to database?',
        description:
          'This creates a customer master record for sales, credit exposure, and payment tracking.',
        details: [
          { label: 'Customer', value: form.name.trim() },
          { label: 'Type', value: form.type },
          { label: 'State', value: form.state.trim() || 'Auto-filled from city' },
          { label: 'Credit Limit', value: formatMoney(form.creditLimit) },
        ],
        confirmLabel: 'Add Customer',
      },
      () => {
        try {
          const customer = addCustomer(form);
          setForm(customerDefaults);
          setMessage(`${customer.name} added to the customer database.`);
        } catch (error) {
          setMessage(error.message);
        }
      }
    );
  }

  function submitPayment(event) {
    event.preventDefault();

    const customer = selectedPaymentCustomer;
    const paymentAmount = numberValue(payment.amount);

    if (!customer) {
      setMessage('Select a customer before recording payment.');
      return;
    }

    if (paymentAmount <= 0) {
      setMessage('Payment amount must be greater than zero.');
      return;
    }

    if (paymentAmount > numberValue(customer.outstanding)) {
      setMessage(
        `Payment cannot exceed ${customer.name}'s outstanding balance of ${formatMoney(
          customer.outstanding
        )}.`
      );
      return;
    }

    requestConfirmation(
      {
        title: 'Record customer payment?',
        description:
          'This will reduce the customer outstanding balance and update the customer ledger.',
        details: [
          { label: 'Customer', value: customer.name },
          { label: 'Amount', value: formatMoney(paymentAmount) },
          { label: 'Current Due', value: formatMoney(customer.outstanding) },
        ],
        confirmLabel: 'Record Payment',
      },
      () => {
        try {
          recordCustomerPayment(payment.customerId, payment.amount);
          setPayment({ customerId: payment.customerId, amount: '' });
          setMessage(`${formatMoney(paymentAmount)} recorded for ${customer.name}.`);
        } catch (error) {
          setMessage(error.message);
        }
      }
    );
  }

  return (
    <section className="erp-page customer-module" data-testid="page-customers">
      <header className="erp-header">
        <div>
          <span className="erp-kicker">Customers</span>
          <h1>Customer Database & Order History</h1>
          <p>
            Maintain delivery preferences, credit exposure, and buying history for each customer.
          </p>
        </div>
      </header>

      {message && (
        <p className={getMessageClassName(message)} data-testid="customer-message">
          {message}
        </p>
      )}

      <div className="erp-workspace customer-workspace">
        <div className="erp-panel customer-ledger-panel">
          <div className="erp-panel-title">
            <h2>Customer Ledger</h2>
          </div>
          <div className="erp-table table-customer" data-testid="customer-ledger">
            <div className="erp-row head">
              <span>Customer</span>
              <span>Location</span>
              <span>Credit</span>
              <span>Outstanding</span>
              <span>Last Order</span>
            </div>
            {customerOrders.map(({ customer, orders }) => (
              <div
                className="erp-row"
                data-testid={`customer-ledger-row-${customer.id}`}
                key={customer.id}
              >
                <span>
                  <strong>{customer.name}</strong>
                  <small>
                    {customer.type} | {customer.phone}
                  </small>
                </span>
                <span>
                  <strong>{customer.city || 'Not set'}</strong>
                  <small>{customer.state || 'State not set'}</small>
                </span>
                <span>{formatMoney(customer.creditLimit)}</span>
                <span
                  className={
                    customer.outstanding > customer.creditLimit ? 'erp-loss' : 'erp-profit'
                  }
                >
                  {formatMoney(customer.outstanding)}
                </span>
                <span>
                  {orders[0] ? (
                    <>
                      <strong>{orders[0].itemName}</strong>
                      <small>{formatKg(orders[0].kg)}</small>
                    </>
                  ) : (
                    'No orders'
                  )}
                </span>
              </div>
            ))}
          </div>
        </div>

        <aside className="customer-action-stack">
          <form className="erp-panel" data-testid="customer-add-form" onSubmit={submitCustomer}>
            <div className="erp-panel-title">
              <h2>Add Customer</h2>
            </div>
            <label>
              <span>Name</span>
              <input
                autoComplete="organization"
                data-testid="customer-name-input"
                maxLength="80"
                required
                value={form.name}
                onChange={(event) => updateForm('name', event.target.value)}
              />
            </label>
            <div className="erp-form-grid">
              <label>
                <span>Type</span>
                <select
                  data-testid="customer-type-select"
                  required
                  value={form.type}
                  onChange={(event) => updateForm('type', event.target.value)}
                >
                  <option>Wholesale</option>
                  <option>Retailer</option>
                  <option>Hotel</option>
                  <option>Walk-in</option>
                </select>
              </label>
              <label>
                <span>Phone</span>
                <input
                  autoComplete="tel"
                  data-testid="customer-phone-input"
                  inputMode="numeric"
                  maxLength="10"
                  pattern="[6-9][0-9]{9}"
                  placeholder="10-digit mobile"
                  type="tel"
                  value={form.phone}
                  onChange={(event) => updateForm('phone', event.target.value)}
                />
              </label>
              <label>
                <span>City</span>
                <input
                  autoComplete="address-level2"
                  data-testid="customer-city-input"
                  maxLength="40"
                  value={form.city}
                  onChange={(event) => updateForm('city', event.target.value)}
                />
              </label>
              <label>
                <span>State</span>
                <input
                  autoComplete="address-level1"
                  data-testid="customer-state-input"
                  maxLength="60"
                  value={form.state}
                  onChange={(event) => updateForm('state', event.target.value)}
                />
              </label>
              <label>
                <span>Credit limit</span>
                <input
                  data-testid="customer-credit-limit-input"
                  min="0"
                  required
                  step="1"
                  type="number"
                  value={form.creditLimit}
                  onChange={(event) => updateForm('creditLimit', event.target.value)}
                />
              </label>
            </div>
            <label>
              <span>Delivery preference</span>
              <input
                data-testid="customer-delivery-input"
                maxLength="80"
                value={form.deliveryPreference}
                onChange={(event) => updateForm('deliveryPreference', event.target.value)}
              />
            </label>
            <button className="erp-button" data-testid="customer-add-submit" type="submit">
              Add Customer
            </button>
          </form>

          <form className="erp-panel" data-testid="customer-payment-form" onSubmit={submitPayment}>
            <div className="erp-panel-title">
              <h2>Customer Payment</h2>
            </div>
            <label>
              <span>Customer</span>
              <select
                data-testid="customer-payment-customer-select"
                required
                value={payment.customerId}
                onChange={(event) => setPayment({ ...payment, customerId: event.target.value })}
              >
                <option value="">Select customer</option>
                {data.customers.map((customer) => (
                  <option key={customer.id} value={customer.id}>
                    {customer.name} - {formatMoney(customer.outstanding)}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>Amount</span>
              <input
                data-testid="customer-payment-amount-input"
                min="0"
                max={selectedPaymentCustomer?.outstanding || undefined}
                step="0.01"
                type="number"
                required
                value={payment.amount}
                onChange={(event) => setPayment({ ...payment, amount: event.target.value })}
              />
            </label>
            <button
              className="erp-button secondary"
              data-testid="customer-payment-submit"
              type="submit"
            >
              Record Payment
            </button>
          </form>
        </aside>
      </div>
      {confirmationDialog}
    </section>
  );
}

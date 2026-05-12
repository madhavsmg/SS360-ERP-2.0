import { useMemo, useState } from 'react';
import { useConfirmationDialog } from '../../components/ConfirmationDialog';
import { useEnterprise } from '../../context/EnterpriseContext';
import { formatKg, formatMoney } from '../../utils/formatters';

const customerDefaults = {
  name: '',
  type: 'Wholesale',
  phone: '',
  city: '',
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

  function updateForm(field, value) {
    setForm((currentForm) => ({ ...currentForm, [field]: value }));
  }

  function submitCustomer(event) {
    event.preventDefault();

    if (!form.name.trim()) {
      setMessage('Customer name is required.');
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
          { label: 'Credit Limit', value: formatMoney(form.creditLimit) },
        ],
        confirmLabel: 'Add Customer',
      },
      () => {
        const customer = addCustomer(form);
        setForm(customerDefaults);
        setMessage(`${customer.name} added to the customer database.`);
      }
    );
  }

  function submitPayment(event) {
    event.preventDefault();

    const customer = data.customers.find((item) => item.id === payment.customerId);
    const paymentAmount = numberValue(payment.amount);

    if (!customer) {
      setMessage('Select a customer before recording payment.');
      return;
    }

    if (paymentAmount <= 0) {
      setMessage('Payment amount must be greater than zero.');
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
    <section className="erp-page customer-module">
      <header className="erp-header">
        <div>
          <span className="erp-kicker">Customers</span>
          <h1>Customer Database & Order History</h1>
          <p>
            Maintain delivery preferences, credit exposure, and buying history for each customer.
          </p>
        </div>
      </header>

      {message && <p className="erp-message">{message}</p>}

      <div className="erp-workspace customer-workspace">
        <div className="erp-panel customer-ledger-panel">
          <div className="erp-panel-title">
            <h2>Customer Ledger</h2>
          </div>
          <div className="erp-table table-customer">
            <div className="erp-row head">
              <span>Customer</span>
              <span>City</span>
              <span>Credit</span>
              <span>Outstanding</span>
              <span>Last Order</span>
            </div>
            {customerOrders.map(({ customer, orders }) => (
              <div className="erp-row" key={customer.id}>
                <span>
                  <strong>{customer.name}</strong>
                  <small>
                    {customer.type} | {customer.phone}
                  </small>
                </span>
                <span>{customer.city}</span>
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
          <form className="erp-panel" onSubmit={submitCustomer}>
            <div className="erp-panel-title">
              <h2>Add Customer</h2>
            </div>
            <label>
              <span>Name</span>
              <input
                value={form.name}
                onChange={(event) => updateForm('name', event.target.value)}
              />
            </label>
            <div className="erp-form-grid">
              <label>
                <span>Type</span>
                <select
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
                  value={form.phone}
                  onChange={(event) => updateForm('phone', event.target.value)}
                />
              </label>
              <label>
                <span>City</span>
                <input
                  value={form.city}
                  onChange={(event) => updateForm('city', event.target.value)}
                />
              </label>
              <label>
                <span>Credit limit</span>
                <input
                  min="0"
                  type="number"
                  value={form.creditLimit}
                  onChange={(event) => updateForm('creditLimit', event.target.value)}
                />
              </label>
            </div>
            <label>
              <span>Delivery preference</span>
              <input
                value={form.deliveryPreference}
                onChange={(event) => updateForm('deliveryPreference', event.target.value)}
              />
            </label>
            <button className="erp-button" type="submit">
              Add Customer
            </button>
          </form>

          <form className="erp-panel" onSubmit={submitPayment}>
            <div className="erp-panel-title">
              <h2>Customer Payment</h2>
            </div>
            <label>
              <span>Customer</span>
              <select
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
                min="0"
                type="number"
                value={payment.amount}
                onChange={(event) => setPayment({ ...payment, amount: event.target.value })}
              />
            </label>
            <button className="erp-button secondary" type="submit">
              Record Payment
            </button>
          </form>
        </aside>
      </div>
      {confirmationDialog}
    </section>
  );
}

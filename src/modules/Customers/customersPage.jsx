import { useMemo, useState } from 'react';
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
  const { data, addCustomer, recordCustomerPayment } = useEnterprise();
  const [form, setForm] = useState(customerDefaults);
  const [payment, setPayment] = useState({ customerId: '', amount: '' });
  const [message, setMessage] = useState('');
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

    const customer = addCustomer(form);
    setForm(customerDefaults);
    setMessage(`${customer.name} added to the customer database.`);
  }

  function submitPayment(event) {
    event.preventDefault();

    try {
      recordCustomerPayment(payment.customerId, payment.amount);
      setPayment({ customerId: payment.customerId, amount: '' });
      setMessage('Customer payment recorded.');
    } catch (error) {
      setMessage(error.message);
    }
  }

  return (
    <section className="erp-page">
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

      <div className="erp-workspace">
        <form className="erp-panel" onSubmit={submitCustomer}>
          <div className="erp-panel-title">
            <h2>Add Customer</h2>
          </div>
          <label>
            <span>Name</span>
            <input value={form.name} onChange={(event) => updateForm('name', event.target.value)} />
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

        <aside className="erp-panel">
          <div className="erp-panel-title">
            <h2>Customer Payment</h2>
          </div>
          <form onSubmit={submitPayment}>
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

      <div className="erp-panel">
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
                className={customer.outstanding > customer.creditLimit ? 'erp-loss' : 'erp-profit'}
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
    </section>
  );
}

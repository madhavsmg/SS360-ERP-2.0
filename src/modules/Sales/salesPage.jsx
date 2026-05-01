import { useMemo, useState } from 'react';
import { useEnterprise } from '../../context/EnterpriseContext';
import { formatKg, formatMoney } from '../../utils/formatters';

const saleDefaults = {
  customerId: '',
  itemType: 'blend',
  itemId: '',
  kg: '',
  pricePerKg: '',
  shippingCharge: '0',
  saleType: 'Wholesale',
  transportMode: '',
  note: '',
};

export default function SalesPage() {
  const { data, createSalesOrder } = useEnterprise();
  const [form, setForm] = useState(saleDefaults);
  const [message, setMessage] = useState('');
  const saleItems = useMemo(() => {
    if (form.itemType === 'raw') {
      return data.rawLots.map((lot) => ({
        id: lot.id,
        name: `${lot.variety} ${lot.grade}`,
        stockKg: lot.remainingKg,
        defaultPrice: lot.costPerKg,
      }));
    }

    return data.blendBatches.map((batch) => ({
      id: batch.id,
      name: batch.productName,
      stockKg: batch.remainingKg,
      defaultPrice: batch.sellingPricePerKg,
    }));
  }, [data.rawLots, data.blendBatches, form.itemType]);
  const selectedItem = saleItems.find((item) => item.id === form.itemId);
  const estimatedRevenue =
    Number(form.kg || 0) * Number(form.pricePerKg || 0) + Number(form.shippingCharge || 0);

  function updateForm(field, value) {
    setForm((currentForm) => ({ ...currentForm, [field]: value }));
  }

  function submitSale(event) {
    event.preventDefault();

    try {
      const order = createSalesOrder(form);
      setForm({
        ...saleDefaults,
        customerId: order.customerId,
        itemType: form.itemType,
      });
      setMessage(`${order.id} created, stock reduced, and shipment packed.`);
    } catch (error) {
      setMessage(error.message);
    }
  }

  return (
    <section className="erp-page">
      <header className="erp-header">
        <div>
          <span className="erp-kicker">Sales</span>
          <h1>Orders & POS</h1>
          <p>
            Sell finished blends or direct wholesale raw tea bags, then automatically update stock,
            customer balances, profit, and shipment queue.
          </p>
        </div>
      </header>

      {message && <p className="erp-message">{message}</p>}

      <div className="erp-workspace">
        <form className="erp-panel" onSubmit={submitSale}>
          <div className="erp-panel-title">
            <h2>Create Sale</h2>
          </div>
          <label>
            <span>Customer</span>
            <select
              value={form.customerId}
              onChange={(event) => updateForm('customerId', event.target.value)}
            >
              <option value="">Select customer</option>
              {data.customers.map((customer) => (
                <option key={customer.id} value={customer.id}>
                  {customer.name} - {customer.type}
                </option>
              ))}
            </select>
          </label>
          <div className="erp-form-grid">
            <label>
              <span>Item type</span>
              <select
                value={form.itemType}
                onChange={(event) => {
                  updateForm('itemType', event.target.value);
                  updateForm('itemId', '');
                  updateForm('pricePerKg', '');
                }}
              >
                <option value="blend">Finished blend</option>
                <option value="raw">Direct raw tea sale</option>
              </select>
            </label>
            <label>
              <span>Sale type</span>
              <select
                value={form.saleType}
                onChange={(event) => updateForm('saleType', event.target.value)}
              >
                <option>Wholesale</option>
                <option>Retail</option>
                <option>Distributor</option>
              </select>
            </label>
          </div>
          <label>
            <span>Item</span>
            <select
              value={form.itemId}
              onChange={(event) => {
                const item = saleItems.find((currentItem) => currentItem.id === event.target.value);
                updateForm('itemId', event.target.value);

                if (item) {
                  updateForm('pricePerKg', String(item.defaultPrice));
                }
              }}
            >
              <option value="">Select item</option>
              {saleItems.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name} - {formatKg(item.stockKg)}
                </option>
              ))}
            </select>
          </label>
          <div className="erp-form-grid">
            <label>
              <span>Kg</span>
              <input
                min="0"
                step="0.01"
                type="number"
                value={form.kg}
                onChange={(event) => updateForm('kg', event.target.value)}
              />
            </label>
            <label>
              <span>Price/kg</span>
              <input
                min="0"
                step="0.01"
                type="number"
                value={form.pricePerKg}
                onChange={(event) => updateForm('pricePerKg', event.target.value)}
              />
            </label>
            <label>
              <span>Shipping charge</span>
              <input
                min="0"
                step="0.01"
                type="number"
                value={form.shippingCharge}
                onChange={(event) => updateForm('shippingCharge', event.target.value)}
              />
            </label>
            <label>
              <span>Transport</span>
              <input
                value={form.transportMode}
                onChange={(event) => updateForm('transportMode', event.target.value)}
              />
            </label>
          </div>
          <label>
            <span>Shipping note</span>
            <input value={form.note} onChange={(event) => updateForm('note', event.target.value)} />
          </label>
          <button className="erp-button" type="submit">
            Create Sale & Pack
          </button>
        </form>

        <aside className="erp-panel">
          <div className="erp-panel-title">
            <h2>Sale Preview</h2>
          </div>
          <dl className="erp-cost-list">
            <div>
              <dt>Selected stock</dt>
              <dd>{selectedItem ? formatKg(selectedItem.stockKg) : 'Select item'}</dd>
            </div>
            <div>
              <dt>Revenue</dt>
              <dd>{formatMoney(estimatedRevenue)}</dd>
            </div>
            <div>
              <dt>Customer balance</dt>
              <dd>
                {formatMoney(
                  data.customers.find((customer) => customer.id === form.customerId)?.outstanding
                )}
              </dd>
            </div>
          </dl>
        </aside>
      </div>

      <div className="erp-panel">
        <div className="erp-panel-title">
          <h2>Sales Register</h2>
        </div>
        <div className="erp-table table-sales">
          <div className="erp-row head">
            <span>Order</span>
            <span>Kg</span>
            <span>Revenue</span>
            <span>Profit</span>
            <span>Status</span>
          </div>
          {data.salesOrders.map((order) => (
            <div className="erp-row" key={order.id}>
              <span>
                <strong>{order.itemName}</strong>
                <small>
                  {order.customerName} | {order.orderDate}
                </small>
              </span>
              <span>{formatKg(order.kg)}</span>
              <span>{formatMoney(order.revenue)}</span>
              <span className={order.profit >= 0 ? 'erp-profit' : 'erp-loss'}>
                {formatMoney(order.profit)}
              </span>
              <span className={order.status === 'Delivered' ? 'erp-pill' : 'erp-pill warning'}>
                {order.status}
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

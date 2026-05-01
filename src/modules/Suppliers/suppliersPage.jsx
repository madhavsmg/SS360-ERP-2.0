import { useMemo, useState } from 'react';
import { useEnterprise } from '../../context/EnterpriseContext';
import { formatKg, formatMoney } from '../../utils/formatters';

const supplierFormDefaults = {
  name: '',
  agentName: '',
  phone: '',
  region: '',
  paymentTerms: '15 days',
  reliabilityScore: '80',
  qualityScore: '80',
};

const purchaseFormDefaults = {
  supplierId: '',
  variety: '',
  grade: '',
  orderBags: '',
  bagWeightKg: '35',
  ratePerKg: '',
  expectedDate: '',
  taste: '8',
  color: '8',
  aroma: '8',
  sampleApproved: 'true',
};

const receiveFormDefaults = {
  purchaseOrderId: '',
  receivedBags: '',
  location: 'Rack A',
  reorderKg: '75',
  receivedDate: '',
};

export default function SuppliersPage() {
  const {
    data,
    addSupplier,
    createPurchaseOrder,
    receivePurchaseOrder,
    recordSupplierPayment,
    numberValue,
  } = useEnterprise();
  const [supplierForm, setSupplierForm] = useState(supplierFormDefaults);
  const [purchaseForm, setPurchaseForm] = useState(purchaseFormDefaults);
  const [receiveForm, setReceiveForm] = useState(receiveFormDefaults);
  const [payment, setPayment] = useState({ supplierId: '', amount: '' });
  const [message, setMessage] = useState('');
  const openPurchaseOrders = useMemo(
    () => data.purchaseOrders.filter((order) => order.status !== 'Received'),
    [data.purchaseOrders]
  );

  function updateForm(setter, field, value) {
    setter((currentForm) => ({ ...currentForm, [field]: value }));
  }

  function submitSupplier(event) {
    event.preventDefault();

    try {
      const supplier = addSupplier(supplierForm);
      setSupplierForm(supplierFormDefaults);
      setPurchaseForm((currentForm) => ({ ...currentForm, supplierId: supplier.id }));
      setMessage(`${supplier.name} added as a supplier.`);
    } catch (error) {
      setMessage(error.message);
    }
  }

  function submitPurchaseOrder(event) {
    event.preventDefault();

    try {
      const order = createPurchaseOrder(purchaseForm);
      setPurchaseForm({ ...purchaseFormDefaults, supplierId: order.supplierId });
      setReceiveForm((currentForm) => ({
        ...currentForm,
        purchaseOrderId: order.id,
        receivedBags: String(order.orderBags),
      }));
      setMessage(`${order.id} created after sample approval.`);
    } catch (error) {
      setMessage(error.message);
    }
  }

  function submitReceiving(event) {
    event.preventDefault();

    try {
      const lot = receivePurchaseOrder(receiveForm);
      setReceiveForm(receiveFormDefaults);
      setMessage(`${lot.id} received and added to Inventory with QR tracking.`);
    } catch (error) {
      setMessage(error.message);
    }
  }

  function submitPayment(event) {
    event.preventDefault();

    try {
      recordSupplierPayment(payment.supplierId, payment.amount);
      setPayment({ supplierId: payment.supplierId, amount: '' });
      setMessage('Supplier payment recorded.');
    } catch (error) {
      setMessage(error.message);
    }
  }

  return (
    <section className="erp-page">
      <header className="erp-header">
        <div>
          <span className="erp-kicker">Procurement</span>
          <h1>Suppliers & Purchase Orders</h1>
          <p>
            Approve tea samples, place purchase orders, receive bags, and track supplier balances.
          </p>
        </div>
      </header>

      {message && <p className="erp-message">{message}</p>}

      <div className="erp-workspace equal">
        <form className="erp-panel" onSubmit={submitSupplier}>
          <div className="erp-panel-title">
            <h2>Add Supplier</h2>
          </div>
          <div className="erp-form-grid">
            <label>
              <span>Name</span>
              <input
                value={supplierForm.name}
                onChange={(event) => updateForm(setSupplierForm, 'name', event.target.value)}
              />
            </label>
            <label>
              <span>Agent</span>
              <input
                value={supplierForm.agentName}
                onChange={(event) => updateForm(setSupplierForm, 'agentName', event.target.value)}
              />
            </label>
            <label>
              <span>Phone</span>
              <input
                value={supplierForm.phone}
                onChange={(event) => updateForm(setSupplierForm, 'phone', event.target.value)}
              />
            </label>
            <label>
              <span>Region</span>
              <input
                value={supplierForm.region}
                onChange={(event) => updateForm(setSupplierForm, 'region', event.target.value)}
              />
            </label>
            <label>
              <span>Terms</span>
              <input
                value={supplierForm.paymentTerms}
                onChange={(event) =>
                  updateForm(setSupplierForm, 'paymentTerms', event.target.value)
                }
              />
            </label>
            <label>
              <span>Reliability</span>
              <input
                min="0"
                max="100"
                type="number"
                value={supplierForm.reliabilityScore}
                onChange={(event) =>
                  updateForm(setSupplierForm, 'reliabilityScore', event.target.value)
                }
              />
            </label>
          </div>
          <button className="erp-button" type="submit">
            Add Supplier
          </button>
        </form>

        <form className="erp-panel" onSubmit={submitPurchaseOrder}>
          <div className="erp-panel-title">
            <h2>Create Purchase Order</h2>
          </div>
          <label>
            <span>Supplier</span>
            <select
              value={purchaseForm.supplierId}
              onChange={(event) => updateForm(setPurchaseForm, 'supplierId', event.target.value)}
            >
              <option value="">Select supplier</option>
              {data.suppliers.map((supplier) => (
                <option key={supplier.id} value={supplier.id}>
                  {supplier.name}
                </option>
              ))}
            </select>
          </label>
          <div className="erp-form-grid">
            <label>
              <span>Variety</span>
              <input
                value={purchaseForm.variety}
                onChange={(event) => updateForm(setPurchaseForm, 'variety', event.target.value)}
              />
            </label>
            <label>
              <span>Grade</span>
              <input
                value={purchaseForm.grade}
                onChange={(event) => updateForm(setPurchaseForm, 'grade', event.target.value)}
              />
            </label>
            <label>
              <span>Bags</span>
              <input
                min="0"
                type="number"
                value={purchaseForm.orderBags}
                onChange={(event) => updateForm(setPurchaseForm, 'orderBags', event.target.value)}
              />
            </label>
            <label>
              <span>Bag kg</span>
              <input
                min="0"
                step="0.01"
                type="number"
                value={purchaseForm.bagWeightKg}
                onChange={(event) => updateForm(setPurchaseForm, 'bagWeightKg', event.target.value)}
              />
            </label>
            <label>
              <span>Rate/kg</span>
              <input
                min="0"
                step="0.01"
                type="number"
                value={purchaseForm.ratePerKg}
                onChange={(event) => updateForm(setPurchaseForm, 'ratePerKg', event.target.value)}
              />
            </label>
            <label>
              <span>Expected</span>
              <input
                type="date"
                value={purchaseForm.expectedDate}
                onChange={(event) =>
                  updateForm(setPurchaseForm, 'expectedDate', event.target.value)
                }
              />
            </label>
          </div>
          <div className="erp-form-grid three">
            <label>
              <span>Taste</span>
              <input
                min="0"
                max="10"
                type="number"
                value={purchaseForm.taste}
                onChange={(event) => updateForm(setPurchaseForm, 'taste', event.target.value)}
              />
            </label>
            <label>
              <span>Color</span>
              <input
                min="0"
                max="10"
                type="number"
                value={purchaseForm.color}
                onChange={(event) => updateForm(setPurchaseForm, 'color', event.target.value)}
              />
            </label>
            <label>
              <span>Aroma</span>
              <input
                min="0"
                max="10"
                type="number"
                value={purchaseForm.aroma}
                onChange={(event) => updateForm(setPurchaseForm, 'aroma', event.target.value)}
              />
            </label>
          </div>
          <button className="erp-button" type="submit">
            Create PO
          </button>
        </form>
      </div>

      <div className="erp-workspace">
        <div className="erp-panel">
          <div className="erp-panel-title">
            <h2>Purchase Orders</h2>
          </div>
          <div className="erp-table table-purchase">
            <div className="erp-row head">
              <span>PO</span>
              <span>Qty</span>
              <span>Rate</span>
              <span>Total</span>
              <span>Status</span>
            </div>
            {data.purchaseOrders.map((order) => (
              <button
                className="erp-row"
                key={order.id}
                type="button"
                onClick={() =>
                  setReceiveForm((currentForm) => ({
                    ...currentForm,
                    purchaseOrderId: order.id,
                    receivedBags: String(order.orderBags),
                  }))
                }
              >
                <span>
                  <strong>{order.variety}</strong>
                  <small>
                    {order.grade} | {order.supplierName}
                  </small>
                </span>
                <span>{formatKg(order.orderedKg)}</span>
                <span>{formatMoney(order.ratePerKg)}</span>
                <span>{formatMoney(order.totalCost)}</span>
                <span className={order.status === 'Received' ? 'erp-pill' : 'erp-pill warning'}>
                  {order.status}
                </span>
              </button>
            ))}
          </div>
        </div>

        <aside className="erp-panel">
          <div className="erp-panel-title">
            <h2>Receive Goods</h2>
          </div>
          <form onSubmit={submitReceiving}>
            <label>
              <span>Open PO</span>
              <select
                value={receiveForm.purchaseOrderId}
                onChange={(event) =>
                  updateForm(setReceiveForm, 'purchaseOrderId', event.target.value)
                }
              >
                <option value="">Select PO</option>
                {openPurchaseOrders.map((order) => (
                  <option key={order.id} value={order.id}>
                    {order.variety} - {order.orderBags} bags
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>Received bags</span>
              <input
                min="0"
                type="number"
                value={receiveForm.receivedBags}
                onChange={(event) => updateForm(setReceiveForm, 'receivedBags', event.target.value)}
              />
            </label>
            <label>
              <span>Rack</span>
              <select
                value={receiveForm.location}
                onChange={(event) => updateForm(setReceiveForm, 'location', event.target.value)}
              >
                <option>Rack A</option>
                <option>Rack B</option>
                <option>Rack C</option>
                <option>Floor Stack</option>
              </select>
            </label>
            <label>
              <span>Reorder kg</span>
              <input
                min="0"
                type="number"
                value={receiveForm.reorderKg}
                onChange={(event) => updateForm(setReceiveForm, 'reorderKg', event.target.value)}
              />
            </label>
            <button className="erp-button" type="submit">
              Receive & Create Lot
            </button>
          </form>

          <form onSubmit={submitPayment}>
            <div className="erp-panel-title">
              <h2>Supplier Payment</h2>
            </div>
            <label>
              <span>Supplier</span>
              <select
                value={payment.supplierId}
                onChange={(event) => setPayment({ ...payment, supplierId: event.target.value })}
              >
                <option value="">Select supplier</option>
                {data.suppliers.map((supplier) => (
                  <option key={supplier.id} value={supplier.id}>
                    {supplier.name} - {formatMoney(supplier.outstanding)}
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
          <h2>Supplier Ledger</h2>
        </div>
        <div className="erp-table table-supplier">
          <div className="erp-row head">
            <span>Supplier</span>
            <span>Region</span>
            <span>Reliability</span>
            <span>Quality</span>
            <span>Outstanding</span>
          </div>
          {data.suppliers.map((supplier) => (
            <div className="erp-row" key={supplier.id}>
              <span>
                <strong>{supplier.name}</strong>
                <small>{supplier.agentName}</small>
              </span>
              <span>{supplier.region}</span>
              <span>{numberValue(supplier.reliabilityScore)}%</span>
              <span>{numberValue(supplier.qualityScore)}%</span>
              <span>{formatMoney(supplier.outstanding)}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

import { useState } from 'react';
import { useConfirmationDialog } from '../../components/ConfirmationDialog';
import { useEnterprise } from '../../context/EnterpriseContext';
import { getMessageClassName } from '../../utils/messageTone';

const updateDefaults = {
  shipmentId: '',
  status: 'Dispatched',
  transportMode: '',
  vehicleNo: '',
  note: '',
};

export default function ShippingPage() {
  const { data, updateShipment } = useEnterprise();
  const [form, setForm] = useState(updateDefaults);
  const [message, setMessage] = useState('');
  const { confirmationDialog, requestConfirmation } = useConfirmationDialog();

  function updateForm(field, value) {
    setForm((currentForm) => ({ ...currentForm, [field]: value }));
  }

  function submitShipment(event) {
    event.preventDefault();

    const shipment = data.shipments.find((item) => item.id === form.shipmentId);

    if (!shipment) {
      setMessage('Select a shipment to update.');
      return;
    }

    requestConfirmation(
      {
        title: 'Update shipment status?',
        description: 'This will update the fulfillment queue and the linked sales order status.',
        details: [
          { label: 'Customer', value: shipment.customerName },
          { label: 'Order', value: shipment.orderId },
          { label: 'Current', value: shipment.status },
          { label: 'Next', value: form.status || shipment.status },
        ],
        confirmLabel: 'Update Delivery',
      },
      () => {
        try {
          updateShipment(form);
          setForm(updateDefaults);
          setMessage('Shipment status updated.');
        } catch (error) {
          setMessage(error.message);
        }
      }
    );
  }

  return (
    <section className="erp-page shipping-module" data-testid="page-shipping">
      <header className="erp-header">
        <div>
          <span className="erp-kicker">Fulfillment</span>
          <h1>Packaging & Shipping</h1>
          <p>Track packed orders through dispatch and delivery with transport details.</p>
        </div>
      </header>

      {message && (
        <p className={getMessageClassName(message)} data-testid="shipping-message">
          {message}
        </p>
      )}

      <div className="erp-workspace shipping-workspace">
        <div className="erp-panel shipping-queue-panel">
          <div className="erp-panel-title">
            <h2>Shipment Queue</h2>
          </div>
          <div className="erp-table table-shipping" data-testid="shipping-queue-table">
            <div className="erp-row head">
              <span>Shipment</span>
              <span>Destination</span>
              <span>Mode</span>
              <span>Vehicle</span>
              <span>Status</span>
            </div>
            {data.shipments.map((shipment) => (
              <button
                className="erp-row"
                data-testid={`shipping-row-${shipment.id}`}
                key={shipment.id}
                type="button"
                onClick={() =>
                  setForm({
                    shipmentId: shipment.id,
                    status:
                      shipment.status === 'Packed'
                        ? 'Dispatched'
                        : shipment.status === 'Dispatched'
                          ? 'Delivered'
                          : shipment.status,
                    transportMode: shipment.transportMode,
                    vehicleNo: shipment.vehicleNo,
                    note: shipment.note,
                  })
                }
              >
                <span>
                  <strong>{shipment.customerName}</strong>
                  <small>{shipment.orderId}</small>
                </span>
                <span>{shipment.destination}</span>
                <span>{shipment.transportMode}</span>
                <span>{shipment.vehicleNo || 'Not set'}</span>
                <span className={shipment.status === 'Delivered' ? 'erp-pill' : 'erp-pill warning'}>
                  {shipment.status}
                </span>
              </button>
            ))}
          </div>
        </div>

        <form
          className="erp-panel shipping-update-panel"
          data-testid="shipping-update-form"
          onSubmit={submitShipment}
        >
          <div className="erp-panel-title">
            <h2>Update Shipment</h2>
          </div>
          <label>
            <span>Shipment</span>
            <select
              data-testid="shipping-shipment-select"
              required
              value={form.shipmentId}
              onChange={(event) => updateForm('shipmentId', event.target.value)}
            >
              <option value="">Select shipment</option>
              {data.shipments.map((shipment) => (
                <option key={shipment.id} value={shipment.id}>
                  {shipment.customerName} - {shipment.status}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>Status</span>
            <select
              data-testid="shipping-status-select"
              value={form.status}
              onChange={(event) => updateForm('status', event.target.value)}
            >
              <option>Packed</option>
              <option>Dispatched</option>
              <option>Delivered</option>
            </select>
          </label>
          <label>
            <span>Transport mode</span>
            <input
              data-testid="shipping-transport-input"
              maxLength="60"
              value={form.transportMode}
              onChange={(event) => updateForm('transportMode', event.target.value)}
            />
          </label>
          <label>
            <span>Vehicle / LR number</span>
            <input
              autoCapitalize="characters"
              data-testid="shipping-vehicle-input"
              maxLength="24"
              placeholder="Vehicle or LR number"
              value={form.vehicleNo}
              onChange={(event) => updateForm('vehicleNo', event.target.value)}
            />
          </label>
          <label>
            <span>Note</span>
            <input
              data-testid="shipping-note-input"
              maxLength="120"
              value={form.note}
              onChange={(event) => updateForm('note', event.target.value)}
            />
          </label>
          <button className="erp-button" data-testid="shipping-update-submit" type="submit">
            Update Delivery
          </button>
        </form>
      </div>
      {confirmationDialog}
    </section>
  );
}

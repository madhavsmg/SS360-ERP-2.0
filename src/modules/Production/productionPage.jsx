import { useMemo, useState } from 'react';
import { useEnterprise } from '../../context/EnterpriseContext';
import { formatKg, formatMoney, formatPercent } from '../../utils/formatters';

const blendDefaults = {
  productName: '',
  sku: '',
  sellingPricePerKg: '',
  packingCostPerKg: '12',
  laborCost: '',
  overheadCost: '',
  location: 'Finished Shelf',
  packagingStatus: 'Packed',
  components: [
    { lotId: '', kg: '' },
    { lotId: '', kg: '' },
    { lotId: '', kg: '' },
  ],
};

export default function ProductionPage() {
  const { data, createBlendBatch, createBlendPreview } = useEnterprise();
  const [form, setForm] = useState(blendDefaults);
  const [message, setMessage] = useState('');
  const preview = useMemo(
    () => createBlendPreview(form, data.rawLots),
    [createBlendPreview, form, data.rawLots]
  );

  function updateForm(field, value) {
    setForm((currentForm) => ({ ...currentForm, [field]: value }));
  }

  function updateComponent(index, field, value) {
    setForm((currentForm) => ({
      ...currentForm,
      components: currentForm.components.map((component, componentIndex) =>
        componentIndex === index ? { ...component, [field]: value } : component
      ),
    }));
  }

  function submitBlend(event) {
    event.preventDefault();

    try {
      const batch = createBlendBatch(form);
      setForm(blendDefaults);
      setMessage(
        `${batch.productName} created with ${formatMoney(batch.expectedProfit)} expected profit.`
      );
    } catch (error) {
      setMessage(error.message);
    }
  }

  return (
    <section className="erp-page">
      <header className="erp-header">
        <div>
          <span className="erp-kicker">Production</span>
          <h1>Blending & Batch Costing</h1>
          <p>
            Consume traceable raw tea lots, create finished products, and predict price/profit from
            true production cost.
          </p>
        </div>
      </header>

      {message && <p className="erp-message">{message}</p>}

      <div className="erp-workspace">
        <form className="erp-panel" onSubmit={submitBlend}>
          <div className="erp-panel-title">
            <h2>New Blend Batch</h2>
          </div>
          <div className="erp-form-grid four">
            <label>
              <span>Product</span>
              <input
                value={form.productName}
                onChange={(event) => updateForm('productName', event.target.value)}
              />
            </label>
            <label>
              <span>SKU</span>
              <input value={form.sku} onChange={(event) => updateForm('sku', event.target.value)} />
            </label>
            <label>
              <span>Selling/kg</span>
              <input
                min="0"
                step="0.01"
                type="number"
                value={form.sellingPricePerKg}
                onChange={(event) => updateForm('sellingPricePerKg', event.target.value)}
              />
            </label>
            <label>
              <span>Finished rack</span>
              <select
                value={form.location}
                onChange={(event) => updateForm('location', event.target.value)}
              >
                <option>Finished Shelf</option>
                <option>Rack A</option>
                <option>Rack B</option>
                <option>Rack C</option>
              </select>
            </label>
          </div>

          {form.components.map((component, index) => (
            <div className="erp-form-grid" key={`blend-component-${index}`}>
              <label>
                <span>Raw lot</span>
                <select
                  value={component.lotId}
                  onChange={(event) => updateComponent(index, 'lotId', event.target.value)}
                >
                  <option value="">Select lot</option>
                  {data.rawLots.map((lot) => (
                    <option key={lot.id} value={lot.id}>
                      {lot.variety} {lot.grade} - {formatKg(lot.remainingKg)}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span>Kg used</span>
                <input
                  min="0"
                  step="0.01"
                  type="number"
                  value={component.kg}
                  onChange={(event) => updateComponent(index, 'kg', event.target.value)}
                />
              </label>
            </div>
          ))}

          <div className="erp-form-grid three">
            <label>
              <span>Packing/kg</span>
              <input
                min="0"
                step="0.01"
                type="number"
                value={form.packingCostPerKg}
                onChange={(event) => updateForm('packingCostPerKg', event.target.value)}
              />
            </label>
            <label>
              <span>Labor</span>
              <input
                min="0"
                step="0.01"
                type="number"
                value={form.laborCost}
                onChange={(event) => updateForm('laborCost', event.target.value)}
              />
            </label>
            <label>
              <span>Overhead</span>
              <input
                min="0"
                step="0.01"
                type="number"
                value={form.overheadCost}
                onChange={(event) => updateForm('overheadCost', event.target.value)}
              />
            </label>
          </div>
          <button className="erp-button" type="submit">
            Create Finished Batch
          </button>
        </form>

        <aside className="erp-panel">
          <div className="erp-panel-title">
            <h2>Price Prediction</h2>
          </div>
          <dl className="erp-cost-list">
            <div>
              <dt>Batch kg</dt>
              <dd>{formatKg(preview.batchKg)}</dd>
            </div>
            <div>
              <dt>Raw material</dt>
              <dd>{formatMoney(preview.rawMaterialCost)}</dd>
            </div>
            <div>
              <dt>Packing</dt>
              <dd>{formatMoney(preview.packingCost)}</dd>
            </div>
            <div>
              <dt>Labor</dt>
              <dd>{formatMoney(preview.laborCost)}</dd>
            </div>
            <div>
              <dt>Overhead</dt>
              <dd>{formatMoney(preview.overheadCost)}</dd>
            </div>
            <div>
              <dt>Total cost</dt>
              <dd>{formatMoney(preview.totalCost)}</dd>
            </div>
            <div>
              <dt>Cost/kg</dt>
              <dd>{formatMoney(preview.costPerKg)}</dd>
            </div>
            <div>
              <dt>Expected revenue</dt>
              <dd>{formatMoney(preview.expectedRevenue)}</dd>
            </div>
            <div>
              <dt>Expected profit</dt>
              <dd className={preview.expectedProfit >= 0 ? 'erp-profit' : 'erp-loss'}>
                {formatMoney(preview.expectedProfit)}
              </dd>
            </div>
            <div>
              <dt>Margin</dt>
              <dd>{formatPercent(preview.marginPercent)}</dd>
            </div>
          </dl>
        </aside>
      </div>

      <div className="erp-panel">
        <div className="erp-panel-title">
          <h2>Finished Batch Traceability</h2>
        </div>
        <div className="erp-table table-production">
          <div className="erp-row head">
            <span>Batch</span>
            <span>Stock</span>
            <span>Cost/kg</span>
            <span>Sell/kg</span>
            <span>Profit</span>
          </div>
          {data.blendBatches.map((batch) => (
            <div className="erp-row" key={batch.id}>
              <span>
                <strong>{batch.productName}</strong>
                <small>
                  {batch.sku} | {batch.components.length} source lots
                </small>
              </span>
              <span>{formatKg(batch.remainingKg)}</span>
              <span>{formatMoney(batch.costPerKg)}</span>
              <span>{formatMoney(batch.sellingPricePerKg)}</span>
              <span className="erp-profit">{formatMoney(batch.expectedProfit)}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

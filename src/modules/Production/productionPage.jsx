import { useEffect, useMemo, useRef, useState } from 'react';
import { Camera, Plus, QrCode, Trash2, X } from 'lucide-react';
import { useConfirmationDialog } from '../../components/ConfirmationDialog';
import { useEnterprise } from '../../context/EnterpriseContext';
import { formatKg, formatMoney, formatPercent } from '../../utils/formatters';

const blendDefaults = {
  productName: '',
  sku: '',
  sellingPricePerKg: '',
  packingCostPerKg: '12',
  laborCost: '',
  overheadCost: '',
  packagingStatus: 'Packed',
  components: [],
};

const manualDefaults = {
  lotId: '',
  bagSizeKg: '',
  bagCount: '1',
};

function readQrValue(value) {
  const trimmedValue = value.trim();

  if (!trimmedValue) {
    return {};
  }

  try {
    return JSON.parse(trimmedValue);
  } catch {
    return { id: trimmedValue };
  }
}

function lineKey(lotId, bagSizeKg) {
  return `${lotId}:${bagSizeKg}`;
}

function getBagOptionLabel(option) {
  return `${option.remainingBagCount} bag(s) x ${option.bagSizeKg} kg`;
}

function mergeBlendLines(components, lot, bagSizeKg, bagCount, bagIds = []) {
  const normalizedBagSize = Number(bagSizeKg);
  const normalizedBagCount = Number(bagCount);
  const key = lineKey(lot.id, normalizedBagSize);
  const nextBagIds = [...new Set(bagIds.filter(Boolean))];
  const existingLine = components.find((component) => component.lineId === key);

  if (existingLine) {
    const mergedBagCount = existingLine.bagCount + normalizedBagCount;
    const mergedBagIds = [...new Set([...(existingLine.bagIds || []), ...nextBagIds])];

    return components.map((component) =>
      component.lineId === key
        ? {
            ...component,
            bagCount: mergedBagCount,
            bagIds: mergedBagIds,
            kgUsed: Number((mergedBagCount * normalizedBagSize).toFixed(2)),
          }
        : component
    );
  }

  return [
    ...components,
    {
      lineId: key,
      lotId: lot.id,
      bagSizeKg: normalizedBagSize,
      bagCount: normalizedBagCount,
      bagIds: nextBagIds,
      teaName: lot.variety,
      grade: lot.grade,
      supplierName: lot.supplierName,
      costPerKg: lot.costPerKg,
      kgUsed: Number((normalizedBagCount * normalizedBagSize).toFixed(2)),
    },
  ];
}

export default function ProductionPage() {
  const { data, createBlendBatch, createBlendPreview, getAvailableBagCount, getRawLotBagOptions } =
    useEnterprise();
  const [form, setForm] = useState(blendDefaults);
  const [manualForm, setManualForm] = useState(manualDefaults);
  const [qrText, setQrText] = useState('');
  const [message, setMessage] = useState('');
  const [scannerOpen, setScannerOpen] = useState(false);
  const [scannerStatus, setScannerStatus] = useState('');
  const scannerRef = useRef(null);
  const scanHandlerRef = useRef(null);
  const lastScanRef = useRef({ value: '', at: 0 });
  const { confirmationDialog, requestConfirmation } = useConfirmationDialog();
  const preview = useMemo(
    () => createBlendPreview(form, data.rawLots),
    [createBlendPreview, form, data.rawLots]
  );
  const activeRawLots = useMemo(
    () =>
      data.rawLots.filter(
        (lot) => lot.status !== 'Reversed' && getRawLotBagOptions(lot).length > 0
      ),
    [data.rawLots, getRawLotBagOptions]
  );
  const manualLot = activeRawLots.find((lot) => lot.id === manualForm.lotId);
  const manualBagOptions = manualLot ? getRawLotBagOptions(manualLot) : [];
  const manualAvailable =
    manualLot && manualForm.bagSizeKg ? getAvailableAfterDraft(manualLot, manualForm.bagSizeKg) : 0;
  const draftBagCount = form.components.reduce(
    (total, component) => total + Number(component.bagCount || 0),
    0
  );
  const hasBlendBags = preview.batchKg > 0;
  const targetPricePerKg = preview.sellingPricePerKg;
  const expectedRevenue = hasBlendBags ? preview.expectedRevenue : 0;
  const expectedProfit = hasBlendBags ? preview.expectedProfit : 0;
  const marginPercent = hasBlendBags ? preview.marginPercent : 0;
  const profitPerKg = hasBlendBags && targetPricePerKg > 0 ? targetPricePerKg - preview.costPerKg : 0;

  function updateForm(field, value) {
    setForm((currentForm) => ({ ...currentForm, [field]: value }));
  }

  function getDraftedBagCount(lotId, bagSizeKg) {
    return form.components
      .filter(
        (component) =>
          component.lotId === lotId && Number(component.bagSizeKg) === Number(bagSizeKg)
      )
      .reduce((total, component) => total + Number(component.bagCount || 0), 0);
  }

  function getAvailableAfterDraft(lot, bagSizeKg) {
    return Math.max(
      getAvailableBagCount(lot, bagSizeKg) - getDraftedBagCount(lot.id, bagSizeKg),
      0
    );
  }

  function addBagsToDraft(lot, bagSizeKg, bagCount = 1, bagIds = []) {
    const requestedCount = Math.max(Math.floor(Number(bagCount)), 0);
    const normalizedBagSize = Number(bagSizeKg);

    if (!lot || requestedCount <= 0 || !normalizedBagSize) {
      setMessage('Select an inventory lot, bag size, and bag count before adding.');
      return;
    }

    const existingBagIds = new Set(form.components.flatMap((component) => component.bagIds || []));
    const duplicateBagId = bagIds.find((bagId) => existingBagIds.has(bagId));

    if (duplicateBagId) {
      setMessage(`Bag ${duplicateBagId} is already in this blend draft.`);
      return;
    }

    const availableAfterDraft = getAvailableAfterDraft(lot, normalizedBagSize);

    if (requestedCount > availableAfterDraft) {
      setMessage(
        `${lot.variety} ${lot.grade} has only ${availableAfterDraft} bag(s) available at ${normalizedBagSize} kg.`
      );
      return;
    }

    setForm((currentForm) => ({
      ...currentForm,
      components: mergeBlendLines(
        currentForm.components,
        lot,
        normalizedBagSize,
        requestedCount,
        bagIds
      ),
    }));
    setMessage(
      `${requestedCount} bag(s) of ${lot.variety} ${lot.grade} added to the blend calculator.`
    );
  }

  function handleQrValue(value) {
    const qrValue = readQrValue(value);
    const bagId = qrValue.bagId || '';
    let lot = null;
    let bagSizeKg = Number(qrValue.bagSizeKg || 0);

    if (bagId) {
      lot = activeRawLots.find((rawLot) =>
        (rawLot.bagUnits || []).some((unit) => unit.id === bagId)
      );
      const unit = lot?.bagUnits.find((item) => item.id === bagId);

      if (!unit || unit.status !== 'available') {
        setMessage('That unique bag QR is not available in inventory.');
        return;
      }

      bagSizeKg = unit.bagSizeKg;
    } else {
      const lotId = qrValue.lotId || qrValue.id || '';
      lot = activeRawLots.find((rawLot) => rawLot.id === lotId);
    }

    if (!lot) {
      setMessage('No active inventory lot matched that QR code.');
      return;
    }

    const bagOptions = getRawLotBagOptions(lot);

    if (!bagSizeKg && bagOptions.length === 1) {
      bagSizeKg = bagOptions[0].bagSizeKg;
    }

    if (!bagSizeKg) {
      setMessage('This inventory lot has multiple bag sizes. Add it manually with the size.');
      return;
    }

    addBagsToDraft(lot, bagSizeKg, 1, bagId ? [bagId] : []);
  }

  scanHandlerRef.current = handleQrValue;

  useEffect(() => {
    if (!scannerOpen) {
      return undefined;
    }

    let cancelled = false;

    async function startScanner() {
      try {
        const { Html5Qrcode } = await import('html5-qrcode');

        if (cancelled) {
          return;
        }

        const scanner = new Html5Qrcode('production-qr-reader');
        scannerRef.current = scanner;
        await scanner.start(
          { facingMode: 'environment' },
          { fps: 8, qrbox: { width: 240, height: 240 } },
          (decodedText) => {
            const now = Date.now();

            if (lastScanRef.current.value === decodedText && now - lastScanRef.current.at < 1800) {
              return;
            }

            lastScanRef.current = { value: decodedText, at: now };
            scanHandlerRef.current?.(decodedText);
          }
        );
        setScannerStatus('Scanner active');
      } catch (error) {
        setScannerStatus(error.message || 'Camera scanner could not be opened.');
      }
    }

    startScanner();

    return () => {
      cancelled = true;

      if (scannerRef.current) {
        scannerRef.current
          .stop()
          .then(() => scannerRef.current?.clear())
          .catch(() => {});
        scannerRef.current = null;
      }
    };
  }, [scannerOpen]);

  function submitQr(event) {
    event.preventDefault();
    handleQrValue(qrText);
    setQrText('');
  }

  function selectManualLot(lotId) {
    const lot = activeRawLots.find((item) => item.id === lotId);
    const bagOptions = lot ? getRawLotBagOptions(lot) : [];

    setManualForm({
      lotId,
      bagSizeKg: bagOptions.length === 1 ? String(bagOptions[0].bagSizeKg) : '',
      bagCount: '1',
    });
  }

  function addManualBags(event) {
    event.preventDefault();
    addBagsToDraft(manualLot, manualForm.bagSizeKg, manualForm.bagCount);
  }

  function removeComponent(lineId) {
    setForm((currentForm) => ({
      ...currentForm,
      components: currentForm.components.filter((component) => component.lineId !== lineId),
    }));
    setMessage('');
  }

  function requestRemoveComponent(component) {
    requestConfirmation(
      {
        title: 'Remove bag line from blend?',
        description:
          'This only changes the current draft. The inventory stock will not change until you create the blend.',
        details: [
          { label: 'Raw Tea', value: `${component.teaName} ${component.grade}` },
          { label: 'Bags', value: `${component.bagCount} x ${formatKg(component.bagSizeKg)}` },
          { label: 'Draft Kg', value: formatKg(component.kgUsed) },
        ],
        confirmLabel: 'Remove Line',
        tone: 'danger',
      },
      () => removeComponent(component.lineId)
    );
  }

  function clearBlendDraft() {
    setForm((currentForm) => ({ ...currentForm, components: [] }));
    setMessage('Blend draft cleared.');
  }

  function requestClearBlendDraft() {
    requestConfirmation(
      {
        title: 'Clear blend draft?',
        description:
          'This removes all selected bags from the calculator. Posted inventory will not change.',
        details: [
          { label: 'Draft Bags', value: draftBagCount },
          { label: 'Batch Weight', value: formatKg(preview.batchKg) },
        ],
        confirmLabel: 'Clear Draft',
        tone: 'danger',
      },
      clearBlendDraft
    );
  }

  function submitBlend(event) {
    event.preventDefault();

    if (!form.productName.trim()) {
      setMessage('Enter a finished product name.');
      return;
    }

    if (preview.batchKg <= 0) {
      setMessage('Scan or add at least one inventory bag before creating a blend.');
      return;
    }

    if (preview.sellingPricePerKg <= 0) {
      setMessage('Target blend price is required for profit margin prediction.');
      return;
    }

    requestConfirmation(
      {
        title: 'Create blend batch?',
        description:
          'This will deduct the selected raw bags from inventory and add the finished blend stock.',
        details: [
          { label: 'Product', value: form.productName.trim() },
          { label: 'Draft Bags', value: draftBagCount },
          { label: 'Batch Weight', value: formatKg(preview.batchKg) },
          { label: 'Cost/Kg', value: formatMoney(preview.costPerKg) },
          { label: 'Target/Kg', value: formatMoney(preview.sellingPricePerKg) },
        ],
        confirmLabel: 'Create Blend',
      },
      () => {
        try {
          const batch = createBlendBatch(form);
          setForm(blendDefaults);
          setManualForm(manualDefaults);
          setMessage(
            `${batch.productName} created with ${formatKg(
              batch.batchKg
            )} finished stock and ${formatMoney(batch.costPerKg)}/kg cost.`
          );
        } catch (error) {
          setMessage(error.message);
        }
      }
    );
  }

  return (
    <section className="erp-page production-module">
      <header className="erp-header">
        <div>
          <span className="erp-kicker">Production</span>
          <h1>QR Blending & Batch Costing</h1>
          <p>
            Scan godown bags into a blend draft, estimate cost before approval, and post the
            finished blend into inventory only when the mix works.
          </p>
        </div>
      </header>

      <div className="erp-summary-grid">
        <div className="erp-stat">
          <span>Draft Bags</span>
          <strong>{draftBagCount}</strong>
          <small>selected for this blend</small>
        </div>
        <div className="erp-stat">
          <span>Batch Weight</span>
          <strong>{formatKg(preview.batchKg)}</strong>
          <small>raw tea in calculator</small>
        </div>
        <div className="erp-stat">
          <span>Cost/Kg</span>
          <strong>{formatMoney(preview.costPerKg)}</strong>
          <small>with overheads</small>
        </div>
        <div className="erp-stat">
          <span>Target Margin</span>
          <strong className={hasBlendBags && expectedProfit < 0 ? 'erp-loss' : 'erp-profit'}>
            {formatPercent(marginPercent)}
          </strong>
          <small>
            {hasBlendBags ? `${formatMoney(expectedProfit)} expected profit` : 'Add bags to calculate'}
          </small>
        </div>
      </div>

      {message && <p className="erp-message">{message}</p>}

      <form className="erp-workspace production-workspace" onSubmit={submitBlend}>
        <section className="erp-panel production-builder-panel">
          <div className="erp-panel-title">
            <h2>Blend Setup</h2>
            <button
              className="erp-button secondary"
              disabled={!form.components.length}
              type="button"
              onClick={requestClearBlendDraft}
            >
              <X size={17} />
              Clear Draft
            </button>
          </div>
          <div className="erp-form-grid three">
            <label>
              <span>Blend Product</span>
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
              <span>Target blend price/kg</span>
              <input
                min="0"
                step="0.01"
                type="number"
                value={form.sellingPricePerKg}
                onChange={(event) => updateForm('sellingPricePerKg', event.target.value)}
              />
            </label>
          </div>

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

          <div className="erp-inline-section">
            <div className="erp-panel-title compact">
              <h3>Scanned Bags</h3>
              <span className={form.components.length ? 'erp-pill' : 'erp-pill warning'}>
                {form.components.length ? 'Draft Ready' : 'Scan Bags'}
              </span>
            </div>
            <div className="erp-table table-production-bags">
              <div className="erp-row head">
                <span>Raw Tea</span>
                <span>Bags</span>
                <span>Bag Size</span>
                <span>Kg</span>
                <span>Cost</span>
                <span></span>
              </div>
              {form.components.map((component) => (
                <div className="erp-row" key={component.lineId}>
                  <span>
                    <strong>{component.teaName}</strong>
                    <small>
                      {component.grade} | {component.supplierName}
                    </small>
                  </span>
                  <span>{component.bagCount}</span>
                  <span>{formatKg(component.bagSizeKg)}</span>
                  <span>{formatKg(component.kgUsed)}</span>
                  <span>{formatMoney(component.kgUsed * component.costPerKg)}</span>
                  <span>
                    <button
                      className="erp-icon-button"
                      type="button"
                      onClick={() => requestRemoveComponent(component)}
                    >
                      <Trash2 size={16} />
                    </button>
                  </span>
                </div>
              ))}
              {form.components.length === 0 && (
                <p className="erp-empty-state">No inventory bags selected.</p>
              )}
            </div>
          </div>

          <button className="erp-button" type="submit">
            Create Blend
          </button>
        </section>

        <aside className="erp-panel production-cost-panel">
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
              <dt>Target price/kg</dt>
              <dd>{formatMoney(targetPricePerKg)}</dd>
            </div>
            <div>
              <dt>Profit/kg</dt>
              <dd className={profitPerKg >= 0 ? 'erp-profit' : 'erp-loss'}>
                {formatMoney(profitPerKg)}
              </dd>
            </div>
            <div>
              <dt>Expected revenue</dt>
              <dd>{formatMoney(expectedRevenue)}</dd>
            </div>
            <div>
              <dt>Expected profit</dt>
              <dd className={hasBlendBags && expectedProfit < 0 ? 'erp-loss' : 'erp-profit'}>
                {formatMoney(expectedProfit)}
              </dd>
            </div>
            <div>
              <dt>Margin</dt>
              <dd>{formatPercent(marginPercent)}</dd>
            </div>
          </dl>
        </aside>
      </form>

      <div className="erp-workspace production-workspace">
        <section className="erp-panel production-scanner-panel">
          <div className="erp-panel-title">
            <h2>Godown QR Scanner</h2>
            <button
              className="erp-button secondary"
              type="button"
              onClick={() => setScannerOpen((currentValue) => !currentValue)}
            >
              {scannerOpen ? <X size={17} /> : <Camera size={17} />}
              {scannerOpen ? 'Close Scanner' : 'Open Scanner'}
            </button>
          </div>
          {scannerOpen && (
            <div className="production-scanner">
              <div id="production-qr-reader" />
              <span>{scannerStatus || 'Starting scanner'}</span>
            </div>
          )}
          <form onSubmit={submitQr}>
            <label>
              <span>Paste QR payload or lot ID</span>
              <textarea
                rows="4"
                value={qrText}
                onChange={(event) => setQrText(event.target.value)}
              />
            </label>
            <button className="erp-button secondary" type="submit">
              <QrCode size={17} />
              Add QR Scan
            </button>
          </form>
        </section>

        <aside className="erp-panel production-manual-panel">
          <div className="erp-panel-title">
            <h2>Manual Inventory Add</h2>
          </div>
          <form onSubmit={addManualBags}>
            <label>
              <span>Raw inventory lot</span>
              <select
                value={manualForm.lotId}
                onChange={(event) => selectManualLot(event.target.value)}
              >
                <option value="">Select from inventory</option>
                {activeRawLots.map((lot) => (
                  <option key={lot.id} value={lot.id}>
                    {lot.variety} {lot.grade} - {formatKg(lot.remainingKg)}
                  </option>
                ))}
              </select>
            </label>
            <div className="erp-form-grid">
              <label>
                <span>Bag size</span>
                <select
                  value={manualForm.bagSizeKg}
                  onChange={(event) =>
                    setManualForm((currentForm) => ({
                      ...currentForm,
                      bagSizeKg: event.target.value,
                    }))
                  }
                  disabled={!manualLot}
                >
                  <option value="">Select size</option>
                  {manualBagOptions.map((option) => (
                    <option key={option.id} value={option.bagSizeKg}>
                      {getBagOptionLabel(option)}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span>Bag count</span>
                <input
                  min="1"
                  step="1"
                  type="number"
                  value={manualForm.bagCount}
                  onChange={(event) =>
                    setManualForm((currentForm) => ({
                      ...currentForm,
                      bagCount: event.target.value,
                    }))
                  }
                />
              </label>
            </div>
            <p className="erp-muted-note">
              Available after current draft: {manualAvailable} bag(s)
            </p>
            <button className="erp-button secondary" type="submit">
              <Plus size={17} />
              Add From Inventory
            </button>
          </form>
        </aside>
      </div>

      <div className="erp-panel production-trace-panel">
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
                  {batch.sku} | {(batch.components || []).length} source lots | QR ready
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
      {confirmationDialog}
    </section>
  );
}

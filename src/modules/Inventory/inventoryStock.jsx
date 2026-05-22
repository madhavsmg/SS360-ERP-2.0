import { useEffect, useMemo, useState } from 'react';
import { Printer, QrCode as QrCodeIcon, Search } from 'lucide-react';
import QRCode from 'qrcode';
import { useEnterprise } from '../../context/EnterpriseContext';
import { formatKg, formatMoney } from '../../utils/formatters';
import { buildStockQrPayload, getBagOptionLabel, readQrValue } from '../../utils/qrPayloads';

export default function InventoryStock() {
  const { data, metrics, getRawLotBagOptions } = useEnterprise();
  const [stockMode, setStockMode] = useState('raw');
  const [searchTerm, setSearchTerm] = useState('');
  const firstRawLot = data.rawLots.find((lot) => lot.status !== 'Reversed');
  const [selectedLabel, setSelectedLabel] = useState({
    type: 'raw',
    id: firstRawLot?.id || '',
    bagSizeKg: getRawLotBagOptions(firstRawLot)?.[0]?.bagSizeKg || '',
  });
  const [qrImages, setQrImages] = useState({});
  const [lookupText, setLookupText] = useState('');
  const [message, setMessage] = useState('');

  const selectedItem =
    selectedLabel.type === 'raw'
      ? data.rawLots.find((lot) => lot.id === selectedLabel.id)
      : data.blendBatches.find((batch) => batch.id === selectedLabel.id);
  const selectedBagOptions =
    selectedLabel.type === 'raw' && selectedItem ? getRawLotBagOptions(selectedItem) : [];
  const selectedBagSize =
    selectedLabel.type === 'raw'
      ? selectedLabel.bagSizeKg || selectedBagOptions[0]?.bagSizeKg || ''
      : '';
  const normalizedSearch = searchTerm.trim().toLowerCase();
  const activeRawLots = useMemo(() => {
    return data.rawLots.filter((lot) => lot.status !== 'Reversed');
  }, [data.rawLots]);
  const rawLots = useMemo(() => {
    return activeRawLots.filter((lot) =>
      [lot.id, lot.variety, lot.grade, lot.supplierName]
        .join(' ')
        .toLowerCase()
        .includes(normalizedSearch)
    );
  }, [activeRawLots, normalizedSearch]);
  const blendBatches = useMemo(() => {
    return data.blendBatches.filter((batch) =>
      [batch.id, batch.productName, batch.sku].join(' ').toLowerCase().includes(normalizedSearch)
    );
  }, [data.blendBatches, normalizedSearch]);
  const selectedQrKey =
    selectedLabel.type === 'raw'
      ? `raw:${selectedItem?.id}:${selectedBagSize}`
      : `blend:${selectedItem?.id}`;

  useEffect(() => {
    let mounted = true;

    async function buildSelectedQrCode() {
      if (!selectedItem || !selectedQrKey || qrImages[selectedQrKey]) {
        return;
      }

      const payload = buildStockQrPayload(selectedLabel.type, selectedItem, {
        bagSizeKg: selectedBagSize,
      });
      const image = await QRCode.toDataURL(payload, {
        errorCorrectionLevel: 'M',
        margin: 2,
        width: 220,
      });

      if (mounted) {
        setQrImages((currentImages) => ({ ...currentImages, [selectedQrKey]: image }));
      }
    }

    buildSelectedQrCode();

    return () => {
      mounted = false;
    };
  }, [qrImages, selectedBagSize, selectedItem, selectedLabel.type, selectedQrKey]);

  useEffect(() => {
    if (selectedItem) {
      return;
    }

    if (activeRawLots[0]) {
      setSelectedLabel({
        type: 'raw',
        id: activeRawLots[0].id,
        bagSizeKg: getRawLotBagOptions(activeRawLots[0])[0]?.bagSizeKg || '',
      });
      return;
    }

    if (data.blendBatches[0]) {
      setSelectedLabel({ type: 'blend', id: data.blendBatches[0].id, bagSizeKg: '' });
    }
  }, [selectedItem, activeRawLots, data.blendBatches, getRawLotBagOptions]);

  function selectLabel(type, id, bagSizeKg = '') {
    setStockMode(type);
    const rawLot = type === 'raw' ? activeRawLots.find((lot) => lot.id === id) : null;
    const nextBagSize = rawLot ? bagSizeKg || getRawLotBagOptions(rawLot)[0]?.bagSizeKg || '' : '';

    setSelectedLabel({ type, id, bagSizeKg: nextBagSize });
    setMessage('');
  }

  function matchQr(event) {
    event.preventDefault();

    const qrValue = readQrValue(lookupText);
    const id = qrValue.lotId || qrValue.id || qrValue.batchId || '';
    const rawLot = activeRawLots.find((lot) => lot.id === id);
    const blendBatch = data.blendBatches.find((batch) => batch.id === id);

    if (rawLot) {
      const bagOptions = getRawLotBagOptions(rawLot);
      const bagSizeKg =
        qrValue.bagSizeKg || (bagOptions.length === 1 ? bagOptions[0].bagSizeKg : '');

      if (!bagSizeKg) {
        setMessage('This lot has multiple active bag sizes. Select the size before printing.');
        return;
      }

      selectLabel('raw', rawLot.id, bagSizeKg);
      setMessage(
        `${rawLot.variety} ${rawLot.grade} selected from QR lot ${rawLot.id} at ${bagSizeKg} kg.`
      );
      return;
    }

    if (blendBatch) {
      selectLabel('blend', blendBatch.id);
      setMessage(`${blendBatch.productName} selected from QR batch ${blendBatch.id}.`);
      return;
    }

    setMessage('No active raw lot or blended batch matched that QR value.');
  }

  return (
    <>
      <div className="erp-summary-grid">
        <div className="erp-stat erp-kpi-stat stat-raw-stock">
          <span>Raw Stock</span>
          <strong>{formatKg(metrics.rawKg)}</strong>
          <small>{formatMoney(metrics.rawValue)} active value</small>
        </div>
        <div className="erp-stat erp-kpi-stat stat-blended-stock">
          <span>Blended Stock</span>
          <strong>{formatKg(metrics.finishedKg)}</strong>
          <small>{formatMoney(metrics.finishedValue)} batch value</small>
        </div>
        <div
          className={`erp-stat erp-kpi-stat ${
            metrics.lowRawLots > 0 ? 'stat-low-stock' : 'stat-approved'
          }`}
        >
          <span>Low Stock</span>
          <strong>{metrics.lowRawLots}</strong>
          <small>raw lots below reorder level</small>
        </div>
        <div className="erp-stat erp-kpi-stat stat-inventory-value">
          <span>Total Inventory</span>
          <strong>{formatMoney(metrics.rawValue + metrics.finishedValue)}</strong>
          <small>stock value on hand</small>
        </div>
      </div>

      {message && <p className="erp-message">{message}</p>}

      <div className="erp-workspace inventory-stock-workspace">
        <section className="erp-panel">
          <div className="erp-panel-title inventory-toolbar">
            <div>
              <h2>Stock Ledger</h2>
              <p className="erp-muted-note">Search, inspect, and print QR labels from one place.</p>
            </div>
            <label>
              <span>Search</span>
              <div className="erp-input-icon">
                <Search size={16} />
                <input
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  placeholder="Lot, product, supplier, QR ID"
                />
              </div>
            </label>
          </div>

          <div className="erp-tabs" role="tablist" aria-label="Stock type">
            <button
              className={stockMode === 'raw' ? 'erp-tab active' : 'erp-tab'}
              type="button"
              onClick={() => setStockMode('raw')}
            >
              Raw Lots
            </button>
            <button
              className={stockMode === 'blend' ? 'erp-tab active' : 'erp-tab'}
              type="button"
              onClick={() => setStockMode('blend')}
            >
              Blended Batches
            </button>
          </div>

          {stockMode === 'raw' ? (
            <div className="erp-table table-inventory">
              <div className="erp-row head">
                <span>Raw Lot</span>
                <span>Stock</span>
                <span>Landed/kg</span>
                <span>Reorder</span>
                <span>Status</span>
              </div>
              {rawLots.map((lot) => (
                <button
                  className="erp-row"
                  key={lot.id}
                  type="button"
                  onClick={() => selectLabel('raw', lot.id)}
                >
                  <span>
                    <strong>{lot.variety}</strong>
                    <small>
                      {lot.grade} | {lot.supplierName}
                    </small>
                    <small>
                      {getRawLotBagOptions(lot).map(getBagOptionLabel).join(' | ') ||
                        'No whole bags available'}
                    </small>
                  </span>
                  <span>{formatKg(lot.remainingKg)}</span>
                  <span>{formatMoney(lot.costPerKg)}</span>
                  <span>{formatKg(lot.reorderKg)}</span>
                  <span
                    className={lot.remainingKg <= lot.reorderKg ? 'erp-pill warning' : 'erp-pill'}
                  >
                    {lot.remainingKg <= lot.reorderKg ? 'Low' : 'In Stock'}
                  </span>
                </button>
              ))}
              {rawLots.length === 0 && <p className="erp-empty-state">No raw lots match.</p>}
            </div>
          ) : (
            <div className="erp-table table-inventory">
              <div className="erp-row head">
                <span>Blended Batch</span>
                <span>Stock</span>
                <span>Cost/kg</span>
                <span>Sell/kg</span>
                <span>Status</span>
              </div>
              {blendBatches.map((batch) => (
                <button
                  className="erp-row"
                  key={batch.id}
                  type="button"
                  onClick={() => selectLabel('blend', batch.id)}
                >
                  <span>
                    <strong>{batch.productName}</strong>
                    <small>
                      {batch.sku} | {(batch.components || []).length} raw lots
                    </small>
                  </span>
                  <span>{formatKg(batch.remainingKg)}</span>
                  <span>{formatMoney(batch.costPerKg)}</span>
                  <span>{formatMoney(batch.sellingPricePerKg)}</span>
                  <span className={batch.remainingKg > 0 ? 'erp-pill' : 'erp-pill danger'}>
                    {batch.remainingKg > 0 ? 'Ready' : 'Sold Out'}
                  </span>
                </button>
              ))}
              {blendBatches.length === 0 && (
                <p className="erp-empty-state">No blended batches match.</p>
              )}
            </div>
          )}
        </section>

        <aside className="erp-panel erp-print-label">
          <div className="erp-panel-title">
            <h2>Selected QR</h2>
            <button className="erp-button secondary" type="button" onClick={() => window.print()}>
              <Printer size={17} />
              Print
            </button>
          </div>
          {selectedItem ? (
            <>
              {selectedLabel.type === 'raw' && selectedBagOptions.length > 1 && (
                <label className="erp-no-print">
                  <span>QR bag size</span>
                  <select
                    value={selectedBagSize}
                    onChange={(event) =>
                      setSelectedLabel((currentLabel) => ({
                        ...currentLabel,
                        bagSizeKg: event.target.value,
                      }))
                    }
                  >
                    {selectedBagOptions.map((option) => (
                      <option key={option.id} value={option.bagSizeKg}>
                        {getBagOptionLabel(option)}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              <div className="erp-qr-box">
                {qrImages[selectedQrKey] ? (
                  <img src={qrImages[selectedQrKey]} alt={`QR for ${selectedItem.id}`} />
                ) : (
                  <span>Generating QR</span>
                )}
              </div>
              <dl className="erp-mini-list">
                <div>
                  <dt>Name</dt>
                  <dd>
                    {selectedLabel.type === 'raw'
                      ? `${selectedItem.variety} ${selectedItem.grade}`
                      : selectedItem.productName}
                  </dd>
                </div>
                <div>
                  <dt>ID</dt>
                  <dd>{selectedItem.id}</dd>
                </div>
                <div>
                  <dt>Stock</dt>
                  <dd>{formatKg(selectedItem.remainingKg)}</dd>
                </div>
                {selectedLabel.type === 'raw' && (
                  <div>
                    <dt>Bag QR</dt>
                    <dd>{selectedBagSize ? `${selectedBagSize} kg count label` : 'No bag size'}</dd>
                  </div>
                )}
                <div>
                  <dt>Trace</dt>
                  <dd>{selectedLabel.type === 'raw' ? 'Raw stock count QR' : 'Batch QR'}</dd>
                </div>
              </dl>
              <div className="erp-trace-list erp-no-print">
                {selectedLabel.type === 'raw'
                  ? (selectedItem.movements || []).map((movement) => (
                      <div key={movement.id}>
                        <strong>{movement.type}</strong>
                        <span>
                          {formatKg(movement.kg)} | {movement.date} | {movement.note}
                        </span>
                      </div>
                    ))
                  : (selectedItem.components || []).map((component) => (
                      <div key={component.lotId}>
                        <strong>
                          {component.variety} {component.grade}
                        </strong>
                        <span>
                          {formatKg(component.kgUsed)} | {formatMoney(component.cost)}
                        </span>
                      </div>
                    ))}
              </div>
            </>
          ) : (
            <p>No stock item selected.</p>
          )}

          <form className="erp-no-print" onSubmit={matchQr}>
            <div className="erp-panel-title compact">
              <h3>QR Lookup</h3>
              <QrCodeIcon size={18} />
            </div>
            <label>
              <span>Paste QR payload or item ID</span>
              <textarea
                rows="4"
                value={lookupText}
                onChange={(event) => setLookupText(event.target.value)}
              />
            </label>
            <button className="erp-button secondary" type="submit">
              Match QR
            </button>
          </form>
        </aside>
      </div>
    </>
  );
}

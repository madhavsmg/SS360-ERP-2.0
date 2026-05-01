import { useEffect, useMemo, useState } from 'react';
import QRCode from 'qrcode';
import { useEnterprise } from '../../context/EnterpriseContext';
import { formatKg, formatMoney } from '../../utils/formatters';

function getQrPayload(type, item) {
  if (type === 'raw') {
    return JSON.stringify({
      app: 'SS-360',
      module: 'inventory',
      type: 'raw-tea-lot',
      id: item.id,
      variety: item.variety,
      grade: item.grade,
      supplier: item.supplierName,
      remainingKg: item.remainingKg,
      costPerKg: item.costPerKg,
      location: item.location,
    });
  }

  return JSON.stringify({
    app: 'SS-360',
    module: 'inventory',
    type: 'finished-blend-batch',
    id: item.id,
    productName: item.productName,
    sku: item.sku,
    remainingKg: item.remainingKg,
    costPerKg: item.costPerKg,
    sellingPricePerKg: item.sellingPricePerKg,
    location: item.location,
  });
}

function readQrId(value) {
  const trimmedValue = value.trim();

  if (!trimmedValue) {
    return '';
  }

  try {
    const parsed = JSON.parse(trimmedValue);
    return parsed.id || parsed.batchId || parsed.lotId || '';
  } catch {
    return trimmedValue;
  }
}

export default function InventoryPage() {
  const { data } = useEnterprise();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedLabel, setSelectedLabel] = useState({
    type: 'raw',
    id: data.rawLots[0]?.id || '',
  });
  const [qrImages, setQrImages] = useState({});
  const [lookupText, setLookupText] = useState('');
  const [message, setMessage] = useState('');

  const selectedItem =
    selectedLabel.type === 'raw'
      ? data.rawLots.find((lot) => lot.id === selectedLabel.id)
      : data.blendBatches.find((batch) => batch.id === selectedLabel.id);
  const normalizedSearch = searchTerm.trim().toLowerCase();
  const rawLots = useMemo(() => {
    return data.rawLots.filter((lot) =>
      [lot.id, lot.variety, lot.grade, lot.supplierName, lot.location]
        .join(' ')
        .toLowerCase()
        .includes(normalizedSearch)
    );
  }, [data.rawLots, normalizedSearch]);
  const blendBatches = useMemo(() => {
    return data.blendBatches.filter((batch) =>
      [batch.id, batch.productName, batch.sku, batch.location]
        .join(' ')
        .toLowerCase()
        .includes(normalizedSearch)
    );
  }, [data.blendBatches, normalizedSearch]);

  useEffect(() => {
    let mounted = true;

    async function buildQrCodes() {
      const nextImages = {};
      const targets = [
        ...data.rawLots.map((lot) => ({
          key: `raw:${lot.id}`,
          payload: getQrPayload('raw', lot),
        })),
        ...data.blendBatches.map((batch) => ({
          key: `blend:${batch.id}`,
          payload: getQrPayload('blend', batch),
        })),
      ];

      await Promise.all(
        targets.map(async (target) => {
          nextImages[target.key] = await QRCode.toDataURL(target.payload, {
            errorCorrectionLevel: 'M',
            margin: 2,
            width: 220,
          });
        })
      );

      if (mounted) {
        setQrImages(nextImages);
      }
    }

    buildQrCodes();

    return () => {
      mounted = false;
    };
  }, [data.rawLots, data.blendBatches]);

  useEffect(() => {
    if (selectedItem) {
      return;
    }

    if (data.rawLots[0]) {
      setSelectedLabel({ type: 'raw', id: data.rawLots[0].id });
      return;
    }

    if (data.blendBatches[0]) {
      setSelectedLabel({ type: 'blend', id: data.blendBatches[0].id });
    }
  }, [selectedItem, data.rawLots, data.blendBatches]);

  function selectLabel(type, id) {
    setSelectedLabel({ type, id });
    setMessage('');
  }

  function matchQr(event) {
    event.preventDefault();

    const id = readQrId(lookupText);
    const rawLot = data.rawLots.find((lot) => lot.id === id);
    const blendBatch = data.blendBatches.find((batch) => batch.id === id);

    if (rawLot) {
      selectLabel('raw', rawLot.id);
      setMessage(`${rawLot.variety} selected from ${rawLot.location}.`);
      return;
    }

    if (blendBatch) {
      selectLabel('blend', blendBatch.id);
      setMessage(`${blendBatch.productName} selected from ${blendBatch.location}.`);
      return;
    }

    setMessage('No raw lot or finished batch matched that QR value.');
  }

  return (
    <section className="erp-page">
      <header className="erp-header">
        <div>
          <span className="erp-kicker">Inventory</span>
          <h1>QR Stock Ledger</h1>
          <p>
            Every received raw lot and finished blend batch has traceability from supplier to sale.
          </p>
        </div>
        <div className="erp-actions">
          <button className="erp-button" type="button" onClick={() => window.print()}>
            Print Selected QR
          </button>
        </div>
      </header>

      {message && <p className="erp-message">{message}</p>}

      <div className="erp-workspace">
        <div className="erp-panel">
          <div className="erp-panel-title">
            <h2>Stock</h2>
            <label>
              <span>Search</span>
              <input
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Lot, product, supplier, rack"
              />
            </label>
          </div>

          <div className="erp-table table-inventory">
            <div className="erp-row head">
              <span>Raw Lot</span>
              <span>Stock</span>
              <span>Cost/kg</span>
              <span>Location</span>
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
                </span>
                <span>{formatKg(lot.remainingKg)}</span>
                <span>{formatMoney(lot.costPerKg)}</span>
                <span>{lot.location}</span>
                <span
                  className={lot.remainingKg <= lot.reorderKg ? 'erp-pill warning' : 'erp-pill'}
                >
                  {lot.remainingKg <= lot.reorderKg ? 'Low' : 'In Stock'}
                </span>
              </button>
            ))}
          </div>

          <div className="erp-table table-inventory">
            <div className="erp-row head">
              <span>Finished Batch</span>
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
                    {batch.sku} | {batch.components.length} raw lots
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
          </div>
        </div>

        <aside className="erp-panel erp-print-label">
          <div className="erp-panel-title">
            <h2>Selected QR</h2>
          </div>
          {selectedItem ? (
            <>
              <div className="erp-qr-box">
                {qrImages[`${selectedLabel.type}:${selectedItem.id}`] ? (
                  <img
                    src={qrImages[`${selectedLabel.type}:${selectedItem.id}`]}
                    alt={`QR for ${selectedItem.id}`}
                  />
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
                <div>
                  <dt>Location</dt>
                  <dd>{selectedItem.location}</dd>
                </div>
              </dl>
              <div className="erp-trace-list erp-no-print">
                {selectedLabel.type === 'raw'
                  ? selectedItem.movements.map((movement) => (
                      <div key={movement.id}>
                        <strong>{movement.type}</strong>
                        <span>
                          {formatKg(movement.kg)} | {movement.date} | {movement.note}
                        </span>
                      </div>
                    ))
                  : selectedItem.components.map((component) => (
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
        </aside>
      </div>

      <form className="erp-panel erp-no-print" onSubmit={matchQr}>
        <div className="erp-panel-title">
          <h2>QR Lookup</h2>
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
    </section>
  );
}

import { useEffect, useMemo, useRef, useState } from 'react';
import { Camera, CheckCircle2, FileUp, Plus, ScanText, Trash2, X } from 'lucide-react';
import { useEnterprise } from '../../context/EnterpriseContext';
import { formatKg, formatMoney } from '../../utils/formatters';
import {
  createEmptyInvoiceDraft,
  createEmptyInvoiceCharge,
  createEmptyInvoiceLine,
  extractInvoiceFromFile,
  extractInvoiceFromImageDataUrl,
} from '../../utils/invoiceExtraction';
import {
  approveBackendInvoice,
  dataUrlToInvoiceFile,
  extractInvoiceWithBackend,
  LOCAL_OCR_SERVICE_MESSAGE,
} from '../../utils/invoiceBackendClient';

function progressLabel(progress) {
  if (!progress) {
    return '';
  }

  const percent = Math.round((progress.progress || 0) * 100);
  return `${progress.label} ${percent}%`;
}

export default function InvoiceIntake() {
  const { data, approveInvoiceReceipt, numberValue } = useEnterprise();
  const [draft, setDraft] = useState(createEmptyInvoiceDraft);
  const [message, setMessage] = useState('');
  const [progress, setProgress] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [cameraStream, setCameraStream] = useState(null);
  const videoRef = useRef(null);
  const fileInputRef = useRef(null);

  const approvedInvoices = data.invoiceReceipts || [];
  const reviewSummary = useMemo(() => {
    const stockLines = draft.items.filter((item) => item.teaName.trim());
    const receivedKg = stockLines.reduce((total, item) => {
      const quantity = numberValue(item.quantity);
      const unitWeightKg = numberValue(item.unitWeightKg || 1);
      return total + numberValue(item.receivedKg || quantity * unitWeightKg);
    }, 0);
    const miscChargesTotal =
      numberValue(draft.totals.miscChargesTotal) ||
      (draft.charges || []).reduce((total, charge) => total + numberValue(charge.amount), 0);
    const lineTotal = stockLines.reduce((total, item) => total + numberValue(item.lineTotal), 0);
    const netTotal = numberValue(draft.totals.netTotal) || lineTotal + miscChargesTotal;

    return {
      stockLines: stockLines.length,
      receivedKg,
      netTotal,
      miscChargesTotal,
    };
  }, [draft, numberValue]);

  const canApprove =
    draft.vendor.name.trim() &&
    draft.items.some((item) => {
      const quantity = numberValue(item.quantity);
      const receivedKg = numberValue(
        item.receivedKg || quantity * numberValue(item.unitWeightKg || 1)
      );
      const taxableValue = numberValue(item.taxableValue);
      const ratePerKg =
        numberValue(item.ratePerKg) || (receivedKg > 0 ? taxableValue / receivedKg : 0);

      return item.teaName.trim() && quantity > 0 && receivedKg > 0 && ratePerKg > 0;
    });

  useEffect(() => {
    if (videoRef.current && cameraStream) {
      videoRef.current.srcObject = cameraStream;
    }
  }, [cameraStream]);

  useEffect(() => {
    return () => {
      if (cameraStream) {
        cameraStream.getTracks().forEach((track) => track.stop());
      }
    };
  }, [cameraStream]);

  function updateDraft(section, field, value) {
    setDraft((currentDraft) => ({
      ...currentDraft,
      [section]: {
        ...currentDraft[section],
        [field]: value,
      },
    }));
  }

  function updateItem(index, field, value) {
    setDraft((currentDraft) => ({
      ...currentDraft,
      items: currentDraft.items.map((item, itemIndex) =>
        itemIndex === index ? { ...item, [field]: value } : item
      ),
    }));
  }

  function updateCharge(index, field, value) {
    setDraft((currentDraft) => ({
      ...currentDraft,
      charges: (currentDraft.charges || []).map((charge, chargeIndex) =>
        chargeIndex === index ? { ...charge, [field]: value } : charge
      ),
      totals: {
        ...currentDraft.totals,
        miscChargesTotal: (currentDraft.charges || [])
          .map((charge, chargeIndex) =>
            chargeIndex === index ? { ...charge, [field]: value } : charge
          )
          .reduce((total, charge) => total + numberValue(charge.amount), 0)
          .toString(),
      },
    }));
  }

  function addItem() {
    setDraft((currentDraft) => ({
      ...currentDraft,
      items: [...currentDraft.items, createEmptyInvoiceLine()],
    }));
  }

  function addCharge() {
    setDraft((currentDraft) => ({
      ...currentDraft,
      charges: [...(currentDraft.charges || []), createEmptyInvoiceCharge()],
    }));
  }

  function removeCharge(index) {
    setDraft((currentDraft) => ({
      ...currentDraft,
      charges: (currentDraft.charges || []).filter((charge, chargeIndex) => chargeIndex !== index),
      totals: {
        ...currentDraft.totals,
        miscChargesTotal: (currentDraft.charges || [])
          .filter((charge, chargeIndex) => chargeIndex !== index)
          .reduce((total, charge) => total + numberValue(charge.amount), 0)
          .toString(),
      },
    }));
  }

  function removeItem(index) {
    setDraft((currentDraft) => ({
      ...currentDraft,
      items:
        currentDraft.items.length === 1
          ? [createEmptyInvoiceLine()]
          : currentDraft.items.filter((item, itemIndex) => itemIndex !== index),
    }));
  }

  async function processFile(file) {
    if (!file) {
      return;
    }

    setIsProcessing(true);
    setMessage('');
    setProgress({ label: 'Starting extraction', progress: 0 });

    try {
      const result = await extractInvoiceWithBackend(file, setProgress);
      setDraft(result.draft);
      setMessage(`${file.name} extracted ${backendExtractionLabel(result.draft)}. Review all fields before approval.`);
    } catch (error) {
      try {
        setProgress({ label: 'Using browser OCR fallback', progress: 0.05 });
        const nextDraft = await extractInvoiceFromFile(file, setProgress);
        setDraft(nextDraft);
        setMessage(`${fallbackMessage(error)} Browser OCR fallback extracted ${file.name}.`);
      } catch (fallbackError) {
        setMessage(fallbackError.message);
      }
    } finally {
      setIsProcessing(false);
      setProgress(null);

      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  }

  async function openCamera() {
    if (!navigator.mediaDevices?.getUserMedia) {
      setMessage('Camera capture is not available in this browser.');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'environment',
        },
        audio: false,
      });
      setCameraStream(stream);
      setMessage('');
    } catch (error) {
      setMessage(error.message);
    }
  }

  function closeCamera() {
    if (cameraStream) {
      cameraStream.getTracks().forEach((track) => track.stop());
    }

    setCameraStream(null);
  }

  async function captureCameraFrame() {
    const video = videoRef.current;

    if (!video) {
      return;
    }

    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;
    canvas.getContext('2d').drawImage(video, 0, 0, canvas.width, canvas.height);
    setIsProcessing(true);
    setProgress({ label: 'Reading camera capture', progress: 0 });
    setMessage('');

    try {
      const dataUrl = canvas.toDataURL('image/png');
      const cameraFile = dataUrlToInvoiceFile(dataUrl, `camera-invoice-${Date.now()}.png`);
      const result = await extractInvoiceWithBackend(cameraFile, setProgress);
      setDraft(result.draft);
      setMessage(
        'Camera capture extracted with local PaddleOCR. Review all fields before approval.'
      );
    } catch (error) {
      try {
        const dataUrl = canvas.toDataURL('image/png');
        const nextDraft = await extractInvoiceFromImageDataUrl(dataUrl, setProgress);
        setDraft(nextDraft);
        setMessage(`${fallbackMessage(error)} Browser OCR fallback extracted the camera capture.`);
      } catch (fallbackError) {
        setMessage(fallbackError.message);
      }
    } finally {
      setIsProcessing(false);
      setProgress(null);
    }
  }

  async function approveDraft() {
    setIsProcessing(true);
    setMessage('');

    try {
      if (draft.backendInvoiceId) {
        setProgress({ label: 'Posting approved invoice to backend', progress: 0.65 });
        await approveBackendInvoice(draft.backendInvoiceId, draft);
      }

      approveInvoiceReceipt(draft);
      setMessage(
        `${draft.invoice.number || 'Invoice'} approved. ${reviewSummary.stockLines} raw stock lots posted.`
      );
      setDraft(createEmptyInvoiceDraft());
    } catch (error) {
      setMessage(error.message);
    } finally {
      setIsProcessing(false);
      setProgress(null);
    }
  }

  return (
    <div className="erp-invoice-flow erp-no-print">
      <div className="erp-workspace">
        <section className="erp-panel">
          <div className="erp-panel-title">
            <h2>Invoice Intake</h2>
            <span className="erp-pill neutral">{draft.extractionMode || 'Waiting'}</span>
          </div>

          <div className="erp-invoice-source">
            <label className="erp-upload-tile">
              <FileUp size={20} />
              <span>PDF or image</span>
              <input
                ref={fileInputRef}
                accept="application/pdf,image/*"
                className="erp-file-input"
                disabled={isProcessing}
                type="file"
                onChange={(event) => processFile(event.target.files?.[0])}
              />
            </label>
            <button
              className="erp-button secondary"
              disabled={isProcessing}
              type="button"
              onClick={cameraStream ? closeCamera : openCamera}
            >
              {cameraStream ? <X size={17} /> : <Camera size={17} />}
              {cameraStream ? 'Close Camera' : 'Open Camera'}
            </button>
            <button
              className="erp-button secondary"
              type="button"
              onClick={() => setDraft(createEmptyInvoiceDraft())}
            >
              <ScanText size={17} />
              Clear Draft
            </button>
          </div>

          {cameraStream && (
            <div className="erp-camera-box">
              <video ref={videoRef} autoPlay muted playsInline />
              <button
                className="erp-button"
                disabled={isProcessing}
                type="button"
                onClick={captureCameraFrame}
              >
                <Camera size={17} />
                Capture Invoice
              </button>
            </div>
          )}

          {progress && (
            <div className="erp-progress">
              <div style={{ width: `${Math.round((progress.progress || 0) * 100)}%` }} />
              <span>{progressLabel(progress)}</span>
            </div>
          )}

          <div className="erp-summary-grid invoice-summary">
            <div className="erp-stat">
              <span>Confidence</span>
              <strong>{draft.confidence}%</strong>
              <small>{draft.sourceName || 'No source selected'}</small>
            </div>
            <div className="erp-stat">
              <span>Stock Lines</span>
              <strong>{reviewSummary.stockLines}</strong>
              <small>{formatKg(reviewSummary.receivedKg)}</small>
            </div>
            <div className="erp-stat">
              <span>Payable Total</span>
              <strong>{formatMoney(reviewSummary.netTotal)}</strong>
              <small>
                {reviewSummary.miscChargesTotal
                  ? `${formatMoney(reviewSummary.miscChargesTotal)} charges`
                  : draft.invoice.number || 'Invoice pending'}
              </small>
            </div>
          </div>
        </section>

        <aside className="erp-panel">
          <div className="erp-panel-title">
            <h2>Approved Invoices</h2>
          </div>
          <div className="erp-trace-list">
            {approvedInvoices.slice(0, 4).map((invoice) => (
              <div key={invoice.id}>
                <strong>{invoice.invoiceNumber}</strong>
                <span>
                  {invoice.supplierName} | {formatMoney(invoice.netTotal)} |{' '}
                  {invoice.rawLotIds.length} lots
                  {invoice.miscChargesTotal
                    ? ` | ${formatMoney(invoice.miscChargesTotal)} charges`
                    : ''}
                </span>
              </div>
            ))}
            {approvedInvoices.length === 0 && (
              <div>
                <strong>No approved invoice receipts</strong>
                <span>Reviewed invoices will appear here after posting.</span>
              </div>
            )}
          </div>
        </aside>
      </div>

      {message && <p className="erp-message">{message}</p>}

      <section className="erp-panel">
        <div className="erp-panel-title">
          <h2>Human Review</h2>
          <button
            className="erp-button"
            disabled={!canApprove || isProcessing}
            type="button"
            onClick={approveDraft}
          >
            <CheckCircle2 size={17} />
            Approve to Inventory
          </button>
        </div>

        <div className="erp-form-grid four">
          <label>
            <span>Vendor</span>
            <input
              value={draft.vendor.name}
              onChange={(event) => updateDraft('vendor', 'name', event.target.value)}
            />
          </label>
          <label>
            <span>GSTIN</span>
            <input
              value={draft.vendor.gstin}
              onChange={(event) => updateDraft('vendor', 'gstin', event.target.value)}
            />
          </label>
          <label>
            <span>Phone</span>
            <input
              value={draft.vendor.phone}
              onChange={(event) => updateDraft('vendor', 'phone', event.target.value)}
            />
          </label>
          <label>
            <span>Invoice No</span>
            <input
              value={draft.invoice.number}
              onChange={(event) => updateDraft('invoice', 'number', event.target.value)}
            />
          </label>
          <label>
            <span>Invoice Date</span>
            <input
              type="date"
              value={draft.invoice.date}
              onChange={(event) => updateDraft('invoice', 'date', event.target.value)}
            />
          </label>
          <label className="erp-wide-field">
            <span>Vendor Address</span>
            <input
              value={draft.vendor.address}
              onChange={(event) => updateDraft('vendor', 'address', event.target.value)}
            />
          </label>
        </div>

        <div className="erp-form-grid four">
          <label>
            <span>Goods Amount</span>
            <input
              min="0"
              step="0.01"
              type="number"
              value={draft.totals.taxableValue}
              onChange={(event) => updateDraft('totals', 'taxableValue', event.target.value)}
            />
          </label>
          <label>
            <span>Cart/Coolie & Other Charges</span>
            <input
              min="0"
              step="0.01"
              type="number"
              value={draft.totals.miscChargesTotal}
              onChange={(event) => updateDraft('totals', 'miscChargesTotal', event.target.value)}
            />
          </label>
          <label>
            <span>CGST</span>
            <input
              min="0"
              step="0.01"
              type="number"
              value={draft.totals.cgstAmount}
              onChange={(event) => updateDraft('totals', 'cgstAmount', event.target.value)}
            />
          </label>
          <label>
            <span>SGST</span>
            <input
              min="0"
              step="0.01"
              type="number"
              value={draft.totals.sgstAmount}
              onChange={(event) => updateDraft('totals', 'sgstAmount', event.target.value)}
            />
          </label>
          <label>
            <span>IGST</span>
            <input
              min="0"
              step="0.01"
              type="number"
              value={draft.totals.igstAmount}
              onChange={(event) => updateDraft('totals', 'igstAmount', event.target.value)}
            />
          </label>
          <label>
            <span>Invoice Value Before GST</span>
            <input
              min="0"
              step="0.01"
              type="number"
              value={draft.totals.grossTotal}
              onChange={(event) => updateDraft('totals', 'grossTotal', event.target.value)}
            />
          </label>
          <label>
            <span>Payable Total</span>
            <input
              min="0"
              step="0.01"
              type="number"
              value={draft.totals.netTotal}
              onChange={(event) => updateDraft('totals', 'netTotal', event.target.value)}
            />
          </label>
        </div>

        <div className="erp-inline-section">
          <div className="erp-panel-title compact">
            <h3>Acquisition Charges</h3>
            <button className="erp-button secondary" type="button" onClick={addCharge}>
              <Plus size={17} />
              Add Charge
            </button>
          </div>
          {(draft.charges || []).length > 0 ? (
            <div className="erp-charge-grid">
              {(draft.charges || []).map((charge, index) => (
                <div className="erp-charge-row" key={charge.id}>
                  <label>
                    <span>Category</span>
                    <select
                      value={charge.category}
                      onChange={(event) => updateCharge(index, 'category', event.target.value)}
                    >
                      <option>Cart & Coolie</option>
                      <option>Transport</option>
                      <option>Labour & Handling</option>
                      <option>Miscellaneous</option>
                    </select>
                  </label>
                  <label>
                    <span>Description</span>
                    <input
                      value={charge.label}
                      onChange={(event) => updateCharge(index, 'label', event.target.value)}
                    />
                  </label>
                  <label>
                    <span>Amount</span>
                    <input
                      min="0"
                      step="0.01"
                      type="number"
                      value={charge.amount}
                      onChange={(event) => updateCharge(index, 'amount', event.target.value)}
                    />
                  </label>
                  <span>
                    <button
                      aria-label="Remove acquisition charge"
                      className="erp-icon-button"
                      type="button"
                      onClick={() => removeCharge(index)}
                    >
                      <Trash2 size={16} />
                    </button>
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="erp-muted-note">
              Cart, coolie, transport, and labour charges can be added here and allocated into
              landed stock cost by kg.
            </p>
          )}
        </div>
      </section>

      <section className="erp-panel">
        <div className="erp-panel-title">
          <h2>Stock Lines</h2>
          <button className="erp-button secondary" type="button" onClick={addItem}>
            <Plus size={17} />
            Add Line
          </button>
        </div>

        <div className="erp-table table-invoice">
          <div className="erp-row head">
            <span>Tea / Grade</span>
            <span>Bags</span>
            <span>Weight (kgs)</span>
            <span>Quantity (kgs)</span>
            <span>Rate/Kg</span>
            <span>Amount Before GST</span>
            <span>CGST</span>
            <span>SGST</span>
            <span>IGST</span>
            <span>Line Total</span>
            <span></span>
          </div>
          {draft.items.map((item, index) => (
            <div className="erp-row invoice-row" key={item.id}>
              <span>
                <input
                  placeholder="Tea name"
                  value={item.teaName}
                  onChange={(event) => updateItem(index, 'teaName', event.target.value)}
                />
                <input
                  placeholder="Grade"
                  value={item.grade}
                  onChange={(event) => updateItem(index, 'grade', event.target.value)}
                />
              </span>
              <span>
                <input
                  min="0"
                  step="0.01"
                  type="number"
                  value={item.quantity}
                  onChange={(event) => updateItem(index, 'quantity', event.target.value)}
                />
              </span>
              <span>
                <input
                  min="0"
                  step="0.01"
                  type="number"
                  value={item.unitWeightKg}
                  onChange={(event) => updateItem(index, 'unitWeightKg', event.target.value)}
                />
              </span>
              <span>
                <input
                  min="0"
                  step="0.01"
                  type="number"
                  value={item.receivedKg}
                  onChange={(event) => updateItem(index, 'receivedKg', event.target.value)}
                />
              </span>
              <span>
                <input
                  min="0"
                  step="0.01"
                  type="number"
                  value={item.ratePerKg}
                  onChange={(event) => updateItem(index, 'ratePerKg', event.target.value)}
                />
              </span>
              <span>
                <input
                  min="0"
                  step="0.01"
                  type="number"
                  value={item.taxableValue}
                  onChange={(event) => updateItem(index, 'taxableValue', event.target.value)}
                />
              </span>
              <span>
                <input
                  min="0"
                  step="0.01"
                  type="number"
                  value={item.cgstAmount}
                  onChange={(event) => updateItem(index, 'cgstAmount', event.target.value)}
                />
              </span>
              <span>
                <input
                  min="0"
                  step="0.01"
                  type="number"
                  value={item.sgstAmount}
                  onChange={(event) => updateItem(index, 'sgstAmount', event.target.value)}
                />
              </span>
              <span>
                <input
                  min="0"
                  step="0.01"
                  type="number"
                  value={item.igstAmount || ''}
                  onChange={(event) => updateItem(index, 'igstAmount', event.target.value)}
                />
              </span>
              <span>
                <input
                  min="0"
                  step="0.01"
                  type="number"
                  value={item.lineTotal}
                  onChange={(event) => updateItem(index, 'lineTotal', event.target.value)}
                />
              </span>
              <span>
                <button
                  aria-label="Remove stock line"
                  className="erp-icon-button"
                  type="button"
                  onClick={() => removeItem(index)}
                >
                  <Trash2 size={16} />
                </button>
              </span>
            </div>
          ))}
        </div>
      </section>

      <section className="erp-panel">
        <div className="erp-panel-title">
          <h2>Extracted Text</h2>
          <span className="erp-pill neutral">{draft.pageCount || 0} pages</span>
        </div>
        <textarea
          rows="7"
          value={draft.rawText}
          onChange={(event) =>
            setDraft((currentDraft) => ({ ...currentDraft, rawText: event.target.value }))
          }
        />
      </section>
    </div>
  );
}

function fallbackMessage(error) {
  const message = error?.message || '';
  return message.includes('Local OCR service is not running')
    ? LOCAL_OCR_SERVICE_MESSAGE
    : 'Backend OCR is unavailable.';
}

function backendExtractionLabel(draft) {
  return /embedded text/i.test(draft?.extractionMode || '')
    ? 'through the backend PDF text reader'
    : 'with local PaddleOCR';
}

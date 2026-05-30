import { useEffect, useMemo, useRef, useState } from 'react';
import { Camera, CheckCircle2, FileUp, Plus, Save, ScanText, Trash2, X } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useConfirmationDialog } from '../../components/ConfirmationDialog';
import { useEnterprise } from '../../context/EnterpriseContext';
import {
  sanitizeGstinInput,
  sanitizeIndianMobileInput,
  validateOptionalGstin,
  validateOptionalIndianMobile,
} from '../../utils/businessValidation';
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

function sanitizeInvoiceDraftForReview(draft) {
  return {
    ...draft,
    vendor: {
      ...(draft.vendor || {}),
      phone: sanitizeIndianMobileInput(draft.vendor?.phone || ''),
      gstin: sanitizeGstinInput(draft.vendor?.gstin || ''),
    },
  };
}

export default function InvoiceIntake() {
  const { data, approveInvoiceReceipt, numberValue, saveInvoiceDraft, today } = useEnterprise();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [draft, setDraft] = useState(() =>
    sanitizeInvoiceDraftForReview(createEmptyInvoiceDraft())
  );
  const [loadedDraftId, setLoadedDraftId] = useState('');
  const [message, setMessage] = useState('');
  const [progress, setProgress] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [cameraStream, setCameraStream] = useState(null);
  const videoRef = useRef(null);
  const fileInputRef = useRef(null);
  const { confirmationDialog, requestConfirmation } = useConfirmationDialog();

  const draftId = searchParams.get('draftId') || '';
  const storedDraft = useMemo(() => {
    return (data.invoiceDrafts || []).find((item) => item.id === draftId);
  }, [data.invoiceDrafts, draftId]);
  const correctionInvoice = draft.correctionOfInvoiceId
    ? (data.invoiceReceipts || []).find((invoice) => invoice.id === draft.correctionOfInvoiceId)
    : null;
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

  const vendorPhoneError = validateOptionalIndianMobile(draft.vendor.phone, 'Vendor phone');
  const vendorGstinError = validateOptionalGstin(draft.vendor.gstin, 'Vendor GSTIN');
  const invoiceDateError =
    draft.invoice.date && draft.invoice.date > today ? 'Invoice date cannot be in the future.' : '';
  const canApprove =
    draft.vendor.name.trim() &&
    !vendorPhoneError &&
    !vendorGstinError &&
    !invoiceDateError &&
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
  const hasDraftContent =
    draft.vendor.name.trim() ||
    draft.invoice.number.trim() ||
    draft.rawText.trim() ||
    draft.items.some((item) => item.teaName?.trim() || item.grade?.trim());
  const confidenceTone =
    draft.confidence >= 80
      ? 'stat-confidence-good'
      : draft.confidence >= 55
        ? 'stat-confidence-medium'
        : 'stat-confidence-low';

  useEffect(() => {
    if (videoRef.current && cameraStream) {
      videoRef.current.srcObject = cameraStream;
    }
  }, [cameraStream]);

  useEffect(() => {
    if (!draftId || loadedDraftId === draftId) {
      return;
    }

    if (storedDraft) {
      setDraft(sanitizeInvoiceDraftForReview(storedDraft));
      setLoadedDraftId(draftId);
      setMessage(`${storedDraft.invoice?.number || 'Draft'} opened for review.`);
    } else {
      setMessage('That invoice draft is no longer in the review queue.');
    }
  }, [draftId, loadedDraftId, storedDraft]);

  useEffect(() => {
    return () => {
      if (cameraStream) {
        cameraStream.getTracks().forEach((track) => track.stop());
      }
    };
  }, [cameraStream]);

  function updateDraft(section, field, value) {
    let nextValue = value;

    if (section === 'vendor' && field === 'phone') {
      nextValue = sanitizeIndianMobileInput(value);
    }

    if (section === 'vendor' && field === 'gstin') {
      nextValue = sanitizeGstinInput(value);
    }

    setDraft((currentDraft) => ({
      ...currentDraft,
      [section]: {
        ...currentDraft[section],
        [field]: nextValue,
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

  function clearDraft() {
    setDraft(sanitizeInvoiceDraftForReview(createEmptyInvoiceDraft()));
    setLoadedDraftId('');
    setMessage('');
    navigate('/inventory/intake', { replace: true });
  }

  function requestClearDraft() {
    if (!hasDraftContent) {
      clearDraft();
      return;
    }

    requestConfirmation(
      {
        title: 'Clear invoice draft?',
        description:
          'This removes the current review fields from the screen. Save it first if you need the draft later.',
        details: [
          { label: 'Vendor', value: draft.vendor.name || 'Missing' },
          { label: 'Invoice', value: draft.invoice.number || 'Pending' },
          { label: 'Stock Lines', value: reviewSummary.stockLines },
        ],
        confirmLabel: 'Clear Draft',
        tone: 'danger',
      },
      clearDraft
    );
  }

  function saveDraft() {
    const savedDraft = saveInvoiceDraft(draft);
    setDraft(sanitizeInvoiceDraftForReview(savedDraft));
    setLoadedDraftId(savedDraft.id);
    setMessage(`${savedDraft.invoice.number || 'Invoice draft'} saved for later review.`);
    navigate(`/inventory/intake?draftId=${savedDraft.id}`, { replace: true });
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
      setDraft(sanitizeInvoiceDraftForReview(result.draft));
      setLoadedDraftId('');
      navigate('/inventory/intake', { replace: true });
      setMessage(
        `${file.name} extracted ${backendExtractionLabel(result.draft)}. Review all fields before approval.`
      );
    } catch (error) {
      try {
        setProgress({ label: 'Using browser OCR fallback', progress: 0.05 });
        const nextDraft = await extractInvoiceFromFile(file, setProgress);
        setDraft(sanitizeInvoiceDraftForReview(nextDraft));
        setLoadedDraftId('');
        navigate('/inventory/intake', { replace: true });
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
      setDraft(sanitizeInvoiceDraftForReview(result.draft));
      setLoadedDraftId('');
      navigate('/inventory/intake', { replace: true });
      setMessage(
        'Camera capture extracted with local PaddleOCR. Review all fields before approval.'
      );
    } catch (error) {
      try {
        const dataUrl = canvas.toDataURL('image/png');
        const nextDraft = await extractInvoiceFromImageDataUrl(dataUrl, setProgress);
        setDraft(sanitizeInvoiceDraftForReview(nextDraft));
        setLoadedDraftId('');
        navigate('/inventory/intake', { replace: true });
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
    let backendApprovalCompleted = false;

    try {
      if (vendorPhoneError || vendorGstinError || invoiceDateError) {
        throw new Error(vendorPhoneError || vendorGstinError || invoiceDateError);
      }

      if (!canApprove) {
        throw new Error('Review vendor and stock line details before approval.');
      }

      if (draft.backendInvoiceId) {
        setProgress({ label: 'Posting approved invoice to backend', progress: 0.65 });
        await approveBackendInvoice(draft.backendInvoiceId, draft);
        backendApprovalCompleted = true;
      }

      const result = approveInvoiceReceipt(draft);
      setMessage(
        `${draft.invoice.number || 'Invoice'} approved. ${reviewSummary.stockLines} raw stock lots posted.`
      );
      setDraft(sanitizeInvoiceDraftForReview(createEmptyInvoiceDraft()));
      setLoadedDraftId('');
      navigate('/inventory/invoices', {
        state: {
          invoiceId: result?.invoice?.id,
        },
      });
    } catch (error) {
      setMessage(
        backendApprovalCompleted
          ? `${error.message} Backend approval already completed; keep this draft open and reconcile before approving again.`
          : error.message
      );
    } finally {
      setIsProcessing(false);
      setProgress(null);
    }
  }

  function requestApproveDraft() {
    if (vendorPhoneError || vendorGstinError || invoiceDateError) {
      setMessage(vendorPhoneError || vendorGstinError || invoiceDateError);
      return;
    }

    if (!canApprove) {
      setMessage('Review vendor and stock line details before approval.');
      return;
    }

    requestConfirmation(
      {
        title: 'Approve invoice to inventory?',
        description:
          'This will post the invoice, create raw stock lots, and increase the supplier payable balance.',
        details: [
          { label: 'Vendor', value: draft.vendor.name || 'Missing' },
          { label: 'Invoice', value: draft.invoice.number || 'Unnumbered' },
          { label: 'Received', value: formatKg(reviewSummary.receivedKg) },
          { label: 'Payable', value: formatMoney(reviewSummary.netTotal) },
        ],
        confirmLabel: 'Approve to Inventory',
      },
      approveDraft
    );
  }

  return (
    <div className="erp-invoice-flow erp-no-print" data-testid="inventory-intake-workspace">
      <div className="erp-workspace invoice-intake-workspace">
        <section className="erp-panel">
          <div className="erp-panel-title">
            <h2>Invoice Intake</h2>
            <span className="erp-pill neutral">
              {draft.correctionOfInvoiceId ? 'Correction Draft' : draft.extractionMode || 'Waiting'}
            </span>
          </div>

          <div className="erp-invoice-source">
            <label className="erp-upload-tile">
              <FileUp size={20} />
              <span>PDF or image</span>
              <input
                ref={fileInputRef}
                accept="application/pdf,image/*"
                className="erp-file-input"
                data-testid="invoice-file-input"
                disabled={isProcessing}
                type="file"
                onChange={(event) => processFile(event.target.files?.[0])}
              />
            </label>
            <button
              className="erp-button secondary"
              data-testid="invoice-camera-toggle"
              disabled={isProcessing}
              type="button"
              onClick={cameraStream ? closeCamera : openCamera}
            >
              {cameraStream ? <X size={17} /> : <Camera size={17} />}
              {cameraStream ? 'Close Camera' : 'Open Camera'}
            </button>
            <button
              className="erp-button secondary"
              data-testid="invoice-clear-draft-button"
              type="button"
              onClick={requestClearDraft}
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
            <div className={`erp-stat erp-kpi-stat ${confidenceTone}`}>
              <span>Confidence</span>
              <strong>{draft.confidence}%</strong>
              <small>{draft.sourceName || 'No source selected'}</small>
            </div>
            <div className="erp-stat erp-kpi-stat stat-stock-lines">
              <span>Stock Lines</span>
              <strong>{reviewSummary.stockLines}</strong>
              <small>{formatKg(reviewSummary.receivedKg)}</small>
            </div>
            <div className="erp-stat erp-kpi-stat stat-payable-total">
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

        <aside className="erp-panel invoice-approval-summary">
          <div className="erp-panel-title">
            <h2>Approval Summary</h2>
            <span className="erp-pill neutral">{loadedDraftId ? 'Stored' : 'Unsaved'}</span>
          </div>
          <dl className="erp-mini-list">
            <div>
              <dt>Vendor</dt>
              <dd>{draft.vendor.name || 'Missing'}</dd>
            </div>
            <div>
              <dt>Invoice</dt>
              <dd>{draft.invoice.number || 'Pending'}</dd>
            </div>
            <div>
              <dt>Received</dt>
              <dd>{formatKg(reviewSummary.receivedKg)}</dd>
            </div>
            <div>
              <dt>Payable</dt>
              <dd>{formatMoney(reviewSummary.netTotal)}</dd>
            </div>
          </dl>
          {correctionInvoice && (
            <div className="erp-trace-list">
              <div>
                <strong>Correcting {correctionInvoice.invoiceNumber}</strong>
                <span>
                  {correctionInvoice.revertReason || 'Correction draft from reverted approval.'}
                </span>
              </div>
            </div>
          )}
          <div className="inventory-action-stack">
            <button
              className="erp-button secondary"
              data-testid="invoice-save-draft-button"
              disabled={isProcessing}
              type="button"
              onClick={saveDraft}
            >
              <Save size={17} />
              Save Draft
            </button>
            <button
              className="erp-button"
              data-testid="invoice-approve-button"
              disabled={!canApprove || isProcessing}
              type="button"
              onClick={requestApproveDraft}
            >
              <CheckCircle2 size={17} />
              Approve to Inventory
            </button>
          </div>
        </aside>
      </div>

      {message && (
        <p className="erp-message" data-testid="invoice-intake-message">
          {message}
        </p>
      )}

      <section className="erp-panel">
        <div className="erp-panel-title">
          <h2>Human Review</h2>
          <span className={canApprove ? 'erp-pill' : 'erp-pill warning'}>
            {canApprove ? 'Ready' : 'Needs Review'}
          </span>
        </div>

        <div className="erp-form-grid four">
          <label>
            <span>Vendor</span>
            <input
              autoComplete="organization"
              data-testid="invoice-vendor-name-input"
              maxLength="100"
              required
              value={draft.vendor.name}
              onChange={(event) => updateDraft('vendor', 'name', event.target.value)}
            />
          </label>
          <label>
            <span>GSTIN</span>
            <input
              autoCapitalize="characters"
              data-testid="invoice-vendor-gstin-input"
              maxLength="15"
              pattern="[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]"
              placeholder="15-character GSTIN"
              value={draft.vendor.gstin}
              onChange={(event) => updateDraft('vendor', 'gstin', event.target.value)}
            />
          </label>
          <label>
            <span>Phone</span>
            <input
              autoComplete="tel"
              data-testid="invoice-vendor-phone-input"
              inputMode="numeric"
              maxLength="10"
              pattern="[6-9][0-9]{9}"
              placeholder="10-digit mobile"
              type="tel"
              value={draft.vendor.phone}
              onChange={(event) => updateDraft('vendor', 'phone', event.target.value)}
            />
          </label>
          <label>
            <span>Invoice No</span>
            <input
              data-testid="invoice-number-input"
              maxLength="40"
              value={draft.invoice.number}
              onChange={(event) => updateDraft('invoice', 'number', event.target.value)}
            />
          </label>
          <label>
            <span>Invoice Date</span>
            <input
              data-testid="invoice-date-input"
              type="date"
              max={today}
              value={draft.invoice.date}
              onChange={(event) => updateDraft('invoice', 'date', event.target.value)}
            />
          </label>
          <label className="erp-wide-field">
            <span>Vendor Address</span>
            <input
              data-testid="invoice-vendor-address-input"
              maxLength="240"
              value={draft.vendor.address}
              onChange={(event) => updateDraft('vendor', 'address', event.target.value)}
            />
          </label>
        </div>

        <div className="erp-form-grid four">
          <label>
            <span>Goods Amount</span>
            <input
              data-testid="invoice-taxable-value-input"
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
              data-testid="invoice-misc-charges-input"
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
              data-testid="invoice-cgst-input"
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
              data-testid="invoice-sgst-input"
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
              data-testid="invoice-igst-input"
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
              data-testid="invoice-gross-total-input"
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
              data-testid="invoice-net-total-input"
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
                      data-testid={`invoice-charge-${index}-label-input`}
                      maxLength="80"
                      value={charge.label}
                      onChange={(event) => updateCharge(index, 'label', event.target.value)}
                    />
                  </label>
                  <label>
                    <span>Amount</span>
                    <input
                      data-testid={`invoice-charge-${index}-amount-input`}
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
                  data-testid={`invoice-line-${index}-tea-name-input`}
                  maxLength="80"
                  placeholder="Tea name"
                  value={item.teaName}
                  onChange={(event) => updateItem(index, 'teaName', event.target.value)}
                />
                <input
                  data-testid={`invoice-line-${index}-grade-input`}
                  maxLength="24"
                  placeholder="Grade"
                  value={item.grade}
                  onChange={(event) => updateItem(index, 'grade', event.target.value)}
                />
                <input
                  data-testid={`invoice-line-${index}-bag-breakdown-input`}
                  maxLength="80"
                  placeholder="Bag breakup, e.g. 4 x 32, 3 x 21.5"
                  value={item.bagBreakdown || ''}
                  onChange={(event) => updateItem(index, 'bagBreakdown', event.target.value)}
                />
              </span>
              <span>
                <input
                  data-testid={`invoice-line-${index}-quantity-input`}
                  min="0"
                  step="0.01"
                  type="number"
                  value={item.quantity}
                  onChange={(event) => updateItem(index, 'quantity', event.target.value)}
                />
              </span>
              <span>
                <input
                  data-testid={`invoice-line-${index}-unit-weight-input`}
                  min="0"
                  step="0.01"
                  type="number"
                  value={item.unitWeightKg}
                  onChange={(event) => updateItem(index, 'unitWeightKg', event.target.value)}
                />
              </span>
              <span>
                <input
                  data-testid={`invoice-line-${index}-received-kg-input`}
                  min="0"
                  step="0.01"
                  type="number"
                  value={item.receivedKg}
                  onChange={(event) => updateItem(index, 'receivedKg', event.target.value)}
                />
              </span>
              <span>
                <input
                  data-testid={`invoice-line-${index}-rate-input`}
                  min="0"
                  step="0.01"
                  type="number"
                  value={item.ratePerKg}
                  onChange={(event) => updateItem(index, 'ratePerKg', event.target.value)}
                />
              </span>
              <span>
                <input
                  data-testid={`invoice-line-${index}-taxable-input`}
                  min="0"
                  step="0.01"
                  type="number"
                  value={item.taxableValue}
                  onChange={(event) => updateItem(index, 'taxableValue', event.target.value)}
                />
              </span>
              <span>
                <input
                  data-testid={`invoice-line-${index}-cgst-input`}
                  min="0"
                  step="0.01"
                  type="number"
                  value={item.cgstAmount}
                  onChange={(event) => updateItem(index, 'cgstAmount', event.target.value)}
                />
              </span>
              <span>
                <input
                  data-testid={`invoice-line-${index}-sgst-input`}
                  min="0"
                  step="0.01"
                  type="number"
                  value={item.sgstAmount}
                  onChange={(event) => updateItem(index, 'sgstAmount', event.target.value)}
                />
              </span>
              <span>
                <input
                  data-testid={`invoice-line-${index}-igst-input`}
                  min="0"
                  step="0.01"
                  type="number"
                  value={item.igstAmount || ''}
                  onChange={(event) => updateItem(index, 'igstAmount', event.target.value)}
                />
              </span>
              <span>
                <input
                  data-testid={`invoice-line-${index}-line-total-input`}
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
          data-testid="invoice-raw-text-input"
          rows="7"
          value={draft.rawText}
          onChange={(event) =>
            setDraft((currentDraft) => ({ ...currentDraft, rawText: event.target.value }))
          }
        />
      </section>
      {confirmationDialog}
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

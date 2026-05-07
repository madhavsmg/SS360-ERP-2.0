import {
  createEmptyInvoiceDraft,
  createEmptyInvoiceCharge,
  createEmptyInvoiceLine,
} from './invoiceExtraction';


export const LOCAL_OCR_SERVICE_MESSAGE =
  'Local OCR service is not running. Start it with: cd ocr-service && uvicorn main:app --reload --port 8001';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000';


export async function extractInvoiceWithBackend(file, onProgress = () => {}) {
  onProgress({ label: 'Uploading invoice to backend', progress: 0.08 });

  const uploadedInvoice = await uploadInvoice(file);

  onProgress({ label: 'Running local PaddleOCR service', progress: 0.28 });

  const extractionResponse = await requestJson(
    `${API_BASE_URL}/api/invoices/${uploadedInvoice.id}/extract`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ documentType: '' }),
    }
  );

  onProgress({ label: 'Preparing human review draft', progress: 0.9 });

  const draft = extractionResponse.extraction?.draft
    ? attachBackendInvoice(extractionResponse.extraction.draft, uploadedInvoice)
    : mapOcrExtractionToDraft(extractionResponse.extraction, uploadedInvoice);

  return {
    invoiceRecord: extractionResponse.invoice,
    extraction: extractionResponse.extraction,
    draft,
  };
}


export async function approveBackendInvoice(invoiceId, draft) {
  return requestJson(`${API_BASE_URL}/api/invoices/${invoiceId}/approve`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ draft }),
  });
}


export function dataUrlToInvoiceFile(dataUrl, fileName) {
  const [header, data] = dataUrl.split(',');
  const mimeType = header.match(/data:(.*?);base64/)?.[1] || 'image/png';
  const bytes = atob(data);
  const buffer = new Uint8Array(bytes.length);

  for (let index = 0; index < bytes.length; index += 1) {
    buffer[index] = bytes.charCodeAt(index);
  }

  return new File([buffer], fileName, { type: mimeType });
}


async function uploadInvoice(file) {
  const form = new FormData();
  form.append('file', file);

  const response = await requestJson(`${API_BASE_URL}/api/invoices`, {
    method: 'POST',
    body: form,
  });

  return response.invoice;
}


async function requestJson(url, options) {
  let response;

  try {
    response = await fetch(url, options);
  } catch {
    throw new Error('Backend OCR service is unavailable. Browser OCR fallback will be used.');
  }

  let payload = {};
  try {
    payload = await response.json();
  } catch {
    payload = {};
  }

  if (!response.ok || payload.success === false) {
    const message = payload.message || 'Backend invoice OCR request failed.';
    throw new Error(payload.code === 'OCR_UNAVAILABLE' ? LOCAL_OCR_SERVICE_MESSAGE : message);
  }

  return payload;
}


function mapOcrExtractionToDraft(extraction, uploadedInvoice) {
  const invoice = extraction?.invoice || {};
  const totals = invoice.totals || {};
  const supplier = invoice.supplier || {};
  const invoiceHeader = invoice.invoice || {};
  const draft = createEmptyInvoiceDraft({
    sourceName: extraction?.sourceFileName || uploadedInvoice?.originalFileName || '',
    sourceType: uploadedInvoice?.sourceType || inferSourceType(extraction?.sourceFileName),
    pageCount: extraction?.pageCount || 0,
    extractionMode: 'Backend + local PaddleOCR + tea invoice profile',
  });
  const taxAllocation = buildTaxAllocation(invoice.items || [], invoice.taxes || [], totals);

  draft.backendInvoiceId = uploadedInvoice?.id || '';
  draft.rawText = extraction?.rawText || '';
  draft.confidence = invoice.confidence?.overall || uploadedInvoice?.confidenceScore || 0;
  draft.extractionMetadata = {
    ...(draft.extractionMetadata || {}),
    backendInvoiceId: uploadedInvoice?.id || '',
    parserWarnings: invoice.confidence?.warnings || [],
    ocrEngine: 'PaddleOCR',
  };
  draft.vendor = {
    name: supplier.name || '',
    address: supplier.address || '',
    gstin: supplier.gstin || '',
    phone: supplier.phone || '',
    state: supplier.state || '',
  };
  draft.invoice = {
    number: invoiceHeader.invoiceNo || '',
    date: invoiceHeader.invoiceDate || draft.invoice.date,
    type: invoice.documentType === 'proforma_invoice' ? 'Proforma Invoice' : 'Tax Invoice',
  };
  draft.totals = {
    taxableValue: valueOrBlank(totals.taxableValue || totals.subTotal),
    cgstAmount: valueOrBlank(taxAllocation.cgstTotal),
    sgstAmount: valueOrBlank(taxAllocation.sgstTotal),
    igstAmount: valueOrBlank(totals.igstAmount || taxAllocation.igstTotal),
    totalTaxAmount: valueOrBlank(taxAllocation.totalTax),
    grossTotal: valueOrBlank(totals.taxableValue || totals.subTotal),
    netTotal: valueOrBlank(totals.grandTotal),
    miscChargesTotal: valueOrBlank(sumAmounts(invoice.charges || [])),
    roundOff: valueOrBlank(totals.roundOff),
  };
  draft.charges = (invoice.charges || []).map((charge) => ({
    ...createEmptyInvoiceCharge(),
    label: charge.label || 'Invoice charge',
    category: categorizeCharge(charge.label),
    amount: valueOrBlank(charge.amount),
  }));
  draft.items = (invoice.items || []).length
    ? invoice.items.map((item) => mapOcrItemToDraftLine(item, taxAllocation))
    : [createEmptyInvoiceLine()];

  return draft;
}


function attachBackendInvoice(draft, uploadedInvoice) {
  return {
    ...draft,
    backendInvoiceId: uploadedInvoice?.id || '',
    extractionMetadata: {
      ...(draft.extractionMetadata || {}),
      backendInvoiceId: uploadedInvoice?.id || '',
      ocrEngine: 'Backend PDF embedded text',
    },
  };
}


function mapOcrItemToDraftLine(item, taxAllocation) {
  const bagInfo = deriveBagInfo(item);
  const taxableValue = numberValue(item.amount);
  const receivedKg = numberValue(item.totalNett || item.quantity || bagInfo.receivedKg);
  const ratePerKg = numberValue(item.rate, receivedKg > 0 ? taxableValue / receivedKg : 0);
  const lineTaxes = taxAllocation.byLineNo[item.lineNo] || {};

  return {
    ...createEmptyInvoiceLine(),
    teaName: item.gardenName || cleanTeaName(item.description) || 'Tea',
    grade: item.grade || '',
    bagCount: valueOrBlank(bagInfo.bags),
    bagWeightKg: valueOrBlank(bagInfo.unitWeightKg),
    bagBreakdown: bagInfo.breakdown,
    hsn: item.hsnCode || '',
    quantity: valueOrBlank(bagInfo.bags || item.bags || item.quantity),
    unit: 'Bags',
    unitWeightKg: valueOrBlank(bagInfo.unitWeightKg),
    receivedKg: valueOrBlank(receivedKg),
    ratePerKg: valueOrBlank(ratePerKg),
    taxableValue: valueOrBlank(taxableValue),
    gstRate: lineTaxes.gstRate ? valueOrBlank(lineTaxes.gstRate) : '',
    cgstRate: lineTaxes.cgstRate ? valueOrBlank(lineTaxes.cgstRate) : '',
    cgstAmount: valueOrBlank(lineTaxes.cgstAmount),
    sgstRate: lineTaxes.sgstRate ? valueOrBlank(lineTaxes.sgstRate) : '',
    sgstAmount: valueOrBlank(lineTaxes.sgstAmount),
    igstRate: lineTaxes.igstRate ? valueOrBlank(lineTaxes.igstRate) : '',
    igstAmount: valueOrBlank(lineTaxes.igstAmount),
    lineTotal: valueOrBlank(taxableValue + numberValue(lineTaxes.totalTax)),
    confidence: 80,
  };
}


function deriveBagInfo(item) {
  const rawText = [...(item.rawLines || []), item.description || ''].join(' ');
  const bagMatch = rawText.match(/(\d+(?:\.\d+)?)\s*(?:x|\*|X)\s*(\d+(?:\.\d+)?)/);
  const bags = numberValue(item.bags || bagMatch?.[1]);
  const receivedKg = numberValue(item.totalNett || item.quantity);
  const unitWeightKg = numberValue(item.nett || bagMatch?.[2], bags > 0 ? receivedKg / bags : 1);

  return {
    bags,
    unitWeightKg,
    receivedKg: bags > 0 ? bags * unitWeightKg : receivedKg,
    breakdown: bags ? `${bags} x ${unitWeightKg}` : '',
  };
}


function buildTaxAllocation(items, taxes, totals) {
  const taxableTotal = sumAmounts(items.map((item) => ({ amount: item.amount })));
  const igstTotal = numberValue(totals?.igstAmount) || sumMatchingTaxes(taxes, /igst/i);
  const cgstTotal = sumMatchingTaxes(taxes, /cgst/i);
  const sgstTotal = sumMatchingTaxes(taxes, /sgst/i);
  const totalTax = igstTotal + cgstTotal + sgstTotal;
  const byLineNo = {};

  for (const item of items) {
    const amount = numberValue(item.amount);
    const ratio = taxableTotal > 0 ? amount / taxableTotal : 0;
    const igstAmount = roundMoney(igstTotal * ratio);
    const cgstAmount = roundMoney(cgstTotal * ratio);
    const sgstAmount = roundMoney(sgstTotal * ratio);

    byLineNo[item.lineNo] = {
      igstAmount,
      cgstAmount,
      sgstAmount,
      totalTax: igstAmount + cgstAmount + sgstAmount,
      igstRate: igstTotal && amount ? roundMoney((igstAmount / amount) * 100) : 0,
      cgstRate: cgstTotal && amount ? roundMoney((cgstAmount / amount) * 100) : 0,
      sgstRate: sgstTotal && amount ? roundMoney((sgstAmount / amount) * 100) : 0,
      gstRate: totalTax && amount ? roundMoney(((igstAmount + cgstAmount + sgstAmount) / amount) * 100) : 0,
    };
  }

  return { byLineNo, igstTotal, cgstTotal, sgstTotal, totalTax };
}


function sumMatchingTaxes(taxes, pattern) {
  return roundMoney(
    (taxes || [])
      .filter((tax) => pattern.test(tax.label || tax.rawLine || ''))
      .reduce((total, tax) => total + numberValue(tax.amount), 0)
  );
}


function sumAmounts(values) {
  return roundMoney((values || []).reduce((total, item) => total + numberValue(item.amount), 0));
}


function inferSourceType(sourceName = '') {
  return sourceName.toLowerCase().endsWith('.pdf') ? 'PDF' : 'Image';
}


function cleanTeaName(value) {
  return String(value || '')
    .replace(/\b0902\d+\b/g, '')
    .replace(/\b(BOPL|BOPF|BOP|BPS|BP|PF1|PF|PD1|PD|OF|DUST|CTC)\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
}


function categorizeCharge(label = '') {
  if (/cart|coolie/i.test(label)) return 'Cart & Coolie';
  if (/transport|freight/i.test(label)) return 'Transport';
  if (/labou?r|handling/i.test(label)) return 'Labour & Handling';
  return 'Miscellaneous';
}


function valueOrBlank(value) {
  const parsedValue = numberValue(value, null);
  return parsedValue === null || parsedValue === 0 ? '' : String(roundMoney(parsedValue));
}


function numberValue(value, fallback = 0) {
  if (value === null || value === undefined || String(value).trim() === '') {
    return fallback;
  }

  const parsedValue = Number(value);
  return Number.isFinite(parsedValue) ? parsedValue : fallback;
}


function roundMoney(value) {
  return Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;
}

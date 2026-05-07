import fs from 'fs';

import { PDFParse } from 'pdf-parse';

import { parseTeaInvoiceText } from '../../../src/utils/teaInvoiceParser.js';


export async function extractEmbeddedPdfDraft(invoiceRecord) {
  if (!isPdf(invoiceRecord)) {
    return null;
  }

  const parser = new PDFParse({ data: fs.readFileSync(invoiceRecord.filePath) });

  try {
    const result = await parser.getText();
    const rawText = result.text || '';

    if (!hasUsableInvoiceText(rawText)) {
      return null;
    }

    const pageCount = result.total || result.pages?.length || 1;
    const draft = parseTeaInvoiceText(rawText, {
      sourceName: invoiceRecord.originalFileName,
      sourceType: 'PDF',
      pageCount,
      extractionMode: 'Backend PDF embedded text + tea invoice profile',
    });

    return {
      success: true,
      sourceFileName: invoiceRecord.originalFileName,
      pageCount,
      rawText,
      pages: buildTextPages(result, rawText),
      engine: 'Backend PDF embedded text',
      draft,
      invoice: draftToInvoiceSummary(draft),
    };
  } finally {
    await parser.destroy();
  }
}


function isPdf(invoiceRecord) {
  return (
    invoiceRecord.mimeType === 'application/pdf' ||
    invoiceRecord.originalFileName.toLowerCase().endsWith('.pdf')
  );
}


function hasUsableInvoiceText(rawText) {
  const text = String(rawText || '').trim();
  const upperText = text.toUpperCase();

  return (
    text.length >= 120 &&
    ['TAX INVOICE', 'PROFORMA INVOICE', 'GSTIN', 'HSN/SAC', 'INVOICE NO'].some((keyword) =>
      upperText.includes(keyword)
    )
  );
}


function buildTextPages(result, rawText) {
  const pages = Array.isArray(result.pages) && result.pages.length ? result.pages : [rawText];

  return pages.map((page, index) => {
    const text = typeof page === 'string' ? page : page.text || '';
    return {
      pageNumber: index + 1,
      text,
      lines: String(text)
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean)
        .map((line) => ({
          text: line,
          confidence: 1,
          bbox: [],
        })),
      engine: 'Backend PDF embedded text',
    };
  });
}


function draftToInvoiceSummary(draft) {
  return {
    documentType: draft.invoice?.type === 'Proforma Invoice' ? 'proforma_invoice' : 'tax_invoice',
    supplier: {
      name: draft.vendor?.name || '',
      gstin: draft.vendor?.gstin || '',
      address: draft.vendor?.address || '',
      state: draft.vendor?.state || '',
      email: '',
      phone: draft.vendor?.phone || '',
    },
    invoice: {
      invoiceNo: draft.invoice?.number || '',
      invoiceDate: draft.invoice?.date || '',
    },
    items: draft.items || [],
    charges: draft.charges || [],
    taxes: [],
    totals: draft.totals || {},
    confidence: {
      overall: draft.confidence || 0,
      header: draft.vendor?.name && draft.invoice?.number ? 90 : 50,
      items: draft.items?.length ? 90 : 0,
      totals: draft.totals?.netTotal ? 90 : 0,
      warnings: [],
    },
  };
}

/* eslint-env node */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { PDFParse } from 'pdf-parse';
import { createWorker } from 'tesseract.js';
import { parseTeaInvoiceText } from '../src/utils/teaInvoiceParser.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const sampleDir = path.join(__dirname, '..', 'sample-data', 'invoices');
const supportedExtensions = new Set(['.pdf', '.jpg', '.jpeg', '.png']);

async function extractPdfText(filePath) {
  const parser = new PDFParse({ data: fs.readFileSync(filePath) });

  try {
    const result = await parser.getText();
    return {
      text: result.text,
      pageCount: result.total || result.pages?.length || 1,
      extractionMode: 'Node PDF embedded text + tea invoice profile',
    };
  } finally {
    await parser.destroy();
  }
}

async function recognizeImage(filePath) {
  const worker = await createWorker('eng');

  try {
    await worker.setParameters({
      ['preserve_interword_spaces']: '1',
    });

    const result = await worker.recognize(filePath);
    return {
      text: result.data.text || '',
      pageCount: 1,
      extractionMode: 'Node image OCR + tea invoice profile',
    };
  } finally {
    await worker.terminate();
  }
}

async function processFile(fileName) {
  const filePath = path.join(sampleDir, fileName);
  const extension = path.extname(fileName).toLowerCase();
  const extracted =
    extension === '.pdf' ? await extractPdfText(filePath) : await recognizeImage(filePath);

  return parseTeaInvoiceText(extracted.text, {
    sourceName: fileName,
    sourceType: extension === '.pdf' ? 'PDF' : 'Image',
    pageCount: extracted.pageCount,
    extractionMode: extracted.extractionMode,
  });
}

function money(value) {
  const number = Number(value || 0);
  return Number.isFinite(number)
    ? number.toLocaleString('en-IN', { maximumFractionDigits: 2 })
    : '';
}

function printDraftSummary(draft) {
  console.log(`\n${draft.sourceName}`);
  console.log(
    `  supplier=${draft.vendor.name || 'missing'} | invoice=${draft.invoice.number || 'missing'} | date=${draft.invoice.date}`
  );
  console.log(
    `  lines=${draft.items.length} | confidence=${draft.confidence}% | gst=${draft.extractionMetadata.gstType} | duplicatesSkipped=${draft.extractionMetadata.duplicateRowsSkipped}`
  );
  console.log(
    `  goods=${money(draft.totals.taxableValue)} | charges=${money(draft.totals.miscChargesTotal)} | igst=${money(draft.totals.igstAmount)} | cgst=${money(draft.totals.cgstAmount)} | sgst=${money(draft.totals.sgstAmount)} | payable=${money(draft.totals.netTotal)}`
  );

  draft.items.forEach((item, index) => {
    console.log(
      `  ${String(index + 1).padStart(2, '0')}. ${item.teaName} | grade=${item.grade || '-'} | bags=${item.quantity || '-'} | kgPerBag=${item.unitWeightKg || '-'} | kg=${item.receivedKg || '-'} | rate=${item.ratePerKg || '-'} | amount=${item.taxableValue || '-'}`
    );
  });
}

async function main() {
  const printJson = process.argv.includes('--json');
  const files = fs
    .readdirSync(sampleDir)
    .filter((file) => supportedExtensions.has(path.extname(file).toLowerCase()))
    .sort((left, right) => left.localeCompare(right));
  const results = [];

  for (const fileName of files) {
    process.stderr.write(`Processing ${fileName}...\n`);
    results.push(await processFile(fileName));
  }

  if (printJson) {
    console.log(JSON.stringify(results, null, 2));
    return;
  }

  results.forEach(printDraftSummary);

  const totalLines = results.reduce((total, draft) => total + draft.items.length, 0);
  const averageConfidence = Math.round(
    results.reduce((total, draft) => total + draft.confidence, 0) / Math.max(results.length, 1)
  );

  console.log('\nTraining sample scan complete');
  console.log(
    `  invoices=${results.length} | extractedLines=${totalLines} | averageConfidence=${averageConfidence}%`
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

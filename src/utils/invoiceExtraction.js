import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.mjs?url';
import tesseractWorkerUrl from 'tesseract.js/dist/worker.min.js?url';
import {
  TeaInvoiceExtractor,
  createEmptyInvoiceDraft,
  createEmptyInvoiceCharge,
  createEmptyInvoiceLine,
  parseTeaInvoiceText,
} from './teaInvoiceParser';

let pdfjsPromise = null;

async function loadPdfJs() {
  if (!pdfjsPromise) {
    pdfjsPromise = import('pdfjs-dist').then((module) => {
      module.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;
      return module;
    });
  }

  return pdfjsPromise;
}

export async function extractInvoiceFromFile(file, onProgress = () => {}) {
  const lowerName = file.name.toLowerCase();
  const isPdf = file.type === 'application/pdf' || lowerName.endsWith('.pdf');
  const isImage = file.type.startsWith('image/');

  onProgress({ label: 'Reading source file', progress: 0.02 });

  if (isPdf) {
    const result = await extractPdfText(file, onProgress);
    return parseTeaInvoiceText(result.text, {
      sourceName: file.name,
      sourceType: 'PDF',
      pageCount: result.pageCount,
      extractionMode: result.usedOcr
        ? 'PDF text + OCR fallback + tea invoice profile'
        : 'PDF embedded text + tea invoice profile',
    });
  }

  if (isImage) {
    const text = await recognizeImage(file, onProgress, file.name || 'Image');
    return parseTeaInvoiceText(text, {
      sourceName: file.name,
      sourceType: 'Image',
      pageCount: 1,
      extractionMode: 'Image OCR + tea invoice profile',
    });
  }

  throw new Error('Upload a PDF or image invoice file.');
}

export async function extractInvoiceFromImageDataUrl(dataUrl, onProgress = () => {}) {
  const text = await recognizeImage(dataUrl, onProgress, 'Camera capture');

  return parseTeaInvoiceText(text, {
    sourceName: 'Camera capture',
    sourceType: 'Camera',
    pageCount: 1,
    extractionMode: 'Camera OCR + tea invoice profile',
  });
}

async function extractPdfText(file, onProgress) {
  const pdfjsLib = await loadPdfJs();
  const data = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(data) }).promise;
  const pageTexts = [];
  let usedOcr = false;

  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    onProgress({
      label: `Extracting PDF page ${pageNumber} of ${pdf.numPages}`,
      progress: pageNumber / Math.max(pdf.numPages, 1) / 2,
    });

    const page = await pdf.getPage(pageNumber);
    const textContent = await page.getTextContent();
    let pageText = textContentToLines(textContent);

    if (pageText.trim().length < 40) {
      usedOcr = true;
      const canvas = await renderPdfPage(page);
      pageText = await recognizeImage(canvas, onProgress, `PDF page ${pageNumber}`);
    }

    pageTexts.push(pageText);
    page.cleanup();
  }

  return {
    text: pageTexts.join('\n'),
    pageCount: pdf.numPages,
    usedOcr,
  };
}

function textContentToLines(textContent) {
  const rows = [];

  for (const item of textContent.items || []) {
    const text = item.str?.trim();

    if (!text) {
      continue;
    }

    const [, , , , x = 0, y = 0] = item.transform || [];
    const row = rows.find((candidate) => Math.abs(candidate.y - y) <= 2);

    if (row) {
      row.items.push({ x, text });
    } else {
      rows.push({ y, items: [{ x, text }] });
    }
  }

  return rows
    .sort((left, right) => right.y - left.y)
    .map((row) =>
      row.items
        .sort((left, right) => left.x - right.x)
        .map((item) => item.text)
        .join(' ')
    )
    .join('\n');
}

async function renderPdfPage(page) {
  const viewport = page.getViewport({ scale: 2 });
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d', { alpha: false });

  canvas.width = Math.floor(viewport.width);
  canvas.height = Math.floor(viewport.height);

  await page.render({
    canvasContext: context,
    viewport,
  }).promise;

  return canvas;
}

async function recognizeImage(imageSource, onProgress, label) {
  onProgress({ label: `Preparing OCR for ${label}`, progress: 0.1 });

  const { createWorker } = await import('tesseract.js');
  const worker = await createWorker('eng', 1, {
    workerPath: tesseractWorkerUrl,
    logger: (message) => {
      if (message.status) {
        onProgress({
          label: `${message.status} ${label}`,
          progress: Math.min(Number(message.progress || 0), 1),
        });
      }
    },
  });

  try {
    await worker.setParameters({
      ['preserve_interword_spaces']: '1',
    });

    const result = await worker.recognize(imageSource);
    return result.data.text || '';
  } finally {
    await worker.terminate();
  }
}

export {
  TeaInvoiceExtractor,
  createEmptyInvoiceDraft,
  createEmptyInvoiceCharge,
  createEmptyInvoiceLine,
  parseTeaInvoiceText,
};

export default {
  TeaInvoiceExtractor,
  createEmptyInvoiceDraft,
  createEmptyInvoiceCharge,
  createEmptyInvoiceLine,
  extractInvoiceFromFile,
  extractInvoiceFromImageDataUrl,
  parseTeaInvoiceText,
};

import fs from 'fs';

import axios from 'axios';
import FormData from 'form-data';

import { env } from '../config/env.js';


export async function extractInvoiceFile({ filePath, fileName, mimeType, documentType }) {
  const form = new FormData();
  form.append('file', fs.createReadStream(filePath), {
    filename: fileName,
    contentType: mimeType,
  });

  if (documentType) {
    form.append('document_type', documentType);
  }

  try {
    const response = await axios.post(`${env.ocrServiceUrl}/ocr/extract`, form, {
      headers: form.getHeaders(),
      maxBodyLength: Infinity,
      timeout: 180000,
    });

    return response.data;
  } catch (error) {
    if (
      error.code === 'ECONNREFUSED' ||
      error.code === 'ENOTFOUND' ||
      error.code === 'ETIMEDOUT' ||
      error.response?.status === 503
    ) {
      const unavailable = new Error(
        'Local OCR service is not running. Start it with: cd ocr-service && uvicorn main:app --reload --port 8001'
      );
      unavailable.code = 'OCR_UNAVAILABLE';
      throw unavailable;
    }

    throw error;
  }
}

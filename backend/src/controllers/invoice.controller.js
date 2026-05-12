import fs from 'fs';
import path from 'path';

import { prisma } from '../config/prisma.js';
import { extractInvoiceFile } from '../services/ocrClient.service.js';
import { extractEmbeddedPdfDraft } from '../services/embeddedPdf.service.js';
import { approveInvoiceDraft } from '../services/invoiceApproval.service.js';


export async function uploadInvoice(request, response, next) {
  try {
    if (!request.file) {
      response.status(400).json({ success: false, message: 'Upload an invoice file named file.' });
      return;
    }

    const invoice = await prisma.invoice.create({
      data: {
        originalFileName: request.file.originalname,
        storedFileName: request.file.filename,
        filePath: path.resolve(request.file.path),
        mimeType: request.file.mimetype,
        size: request.file.size,
        sourceType: request.file.mimetype === 'application/pdf' ? 'PDF' : 'Image',
      },
    });

    response.status(201).json({ success: true, invoice });
  } catch (error) {
    next(error);
  }
}


export async function extractInvoice(request, response, next) {
  try {
    const invoice = await prisma.invoice.findUnique({ where: { id: request.params.id } });
    if (!invoice) {
      response.status(404).json({ success: false, message: 'Invoice not found.' });
      return;
    }

    if (!fs.existsSync(invoice.filePath)) {
      response.status(404).json({ success: false, message: 'Uploaded invoice file is missing.' });
      return;
    }

    try {
      const extraction =
        (await extractEmbeddedPdfDraft(invoice)) ||
        (await extractInvoiceFile({
          filePath: invoice.filePath,
          fileName: invoice.originalFileName,
          mimeType: invoice.mimeType,
          documentType: request.body?.documentType,
        }));
      const confidenceScore =
        extraction?.invoice?.confidence?.overall || extraction?.draft?.confidence || 0;

      const updatedInvoice = await prisma.invoice.update({
        where: { id: invoice.id },
        data: {
          rawText: extraction.rawText || '',
          extractionJson: extraction,
          confidenceScore,
          status: 'NEEDS_REVIEW',
        },
      });

      response.json({
        success: true,
        invoice: updatedInvoice,
        extraction,
      });
    } catch (error) {
      await prisma.invoice.update({
        where: { id: invoice.id },
        data: { status: 'OCR_FAILED' },
      });

      if (error.code === 'OCR_UNAVAILABLE') {
        response.status(503).json({
          success: false,
          code: 'OCR_UNAVAILABLE',
          message:
            'Local OCR service is not running. Start it with: cd ocr-service && uvicorn main:app --reload --port 8001',
        });
        return;
      }

      throw error;
    }
  } catch (error) {
    next(error);
  }
}


export async function approveInvoice(request, response, next) {
  try {
    const invoice = await prisma.invoice.findUnique({ where: { id: request.params.id } });
    if (!invoice) {
      response.status(404).json({ success: false, message: 'Invoice not found.' });
      return;
    }

    if (invoice.status === 'APPROVED') {
      response.status(409).json({ success: false, message: 'This invoice is already approved.' });
      return;
    }

    const draft = request.body?.draft || request.body;
    const approval = await approveInvoiceDraft(invoice, draft);

    response.json({
      success: true,
      invoice: approval.invoice,
      rawLots: approval.rawLots,
      supplier: approval.supplier,
    });
  } catch (error) {
    next(error);
  }
}

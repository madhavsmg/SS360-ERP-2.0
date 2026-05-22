import { Router } from 'express';

import {
  approveInvoice,
  extractInvoice,
  uploadInvoice,
} from '../controllers/invoice.controller.js';
import { upload } from '../middleware/upload.middleware.js';

export const invoiceRouter = Router();

invoiceRouter.post('/', upload.single('file'), uploadInvoice);
invoiceRouter.post('/:id/extract', extractInvoice);
invoiceRouter.post('/:id/approve', approveInvoice);

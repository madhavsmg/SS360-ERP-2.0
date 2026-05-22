import fs from 'fs';
import path from 'path';

import multer from 'multer';

import { env } from '../config/env.js';
import { isAllowedUploadMetadata } from '../utils/fileSignature.utils.js';

const uploadRoot = path.resolve(env.uploadDir);
fs.mkdirSync(uploadRoot, { recursive: true });

const storage = multer.diskStorage({
  destination: (request, file, callback) => {
    callback(null, uploadRoot);
  },
  filename: (request, file, callback) => {
    const extension = path.extname(file.originalname).toLowerCase();
    const safeName = path
      .basename(file.originalname, extension)
      .replace(/[^a-z0-9]+/gi, '-')
      .replace(/(^-|-$)/g, '')
      .slice(0, 50);
    callback(null, `${Date.now()}-${safeName || 'invoice'}${extension}`);
  },
});

function fileFilter(request, file, callback) {
  if (!isAllowedUploadMetadata(file)) {
    const error = new Error('Supported files are PDF, PNG, JPG, and JPEG invoices.');
    error.statusCode = 400;
    callback(error);
    return;
  }

  callback(null, true);
}

export const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 25 * 1024 * 1024,
  },
});

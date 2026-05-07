import dotenv from 'dotenv';


dotenv.config();

export const env = {
  port: Number(process.env.PORT || 5000),
  databaseUrl: process.env.DATABASE_URL || '',
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:5173',
  ocrServiceUrl: process.env.OCR_SERVICE_URL || 'http://localhost:8001',
  uploadDir: process.env.UPLOAD_DIR || './uploads/invoices',
};

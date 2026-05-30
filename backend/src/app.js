import cors from 'cors';
import express from 'express';

import { env } from './config/env.js';
import { prisma } from './config/prisma.js';
import { invoiceRouter } from './routes/invoice.routes.js';

export const app = express();

app.use(
  cors({
    origin: [
      env.frontendUrl,
      'http://localhost:5173',
      'http://127.0.0.1:5173',
      'http://localhost:5174',
      'http://127.0.0.1:5174',
    ],
    credentials: true,
  })
);
app.use(express.json({ limit: '10mb' }));

app.get('/live', (request, response) => {
  response.json({
    status: 'ok',
    service: 'SS360 ERP Backend',
  });
});

app.get('/health', async (request, response, next) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    response.json({
      status: 'ok',
      service: 'SS360 ERP Backend',
      database: 'ready',
    });
  } catch (error) {
    error.statusCode = 503;
    error.publicMessage = 'Backend is running, but PostgreSQL is not ready.';
    next(error);
  }
});

app.use('/api/invoices', invoiceRouter);

app.use((error, request, response, next) => {
  if (response.headersSent) {
    next(error);
    return;
  }

  if (error.code === 'LIMIT_FILE_SIZE') {
    error.statusCode = 413;
    error.publicMessage = 'Invoice upload exceeds the 25 MB limit.';
  }

  const status = error.statusCode || error.status || 500;
  response.status(status).json({
    success: false,
    message: error.publicMessage || error.message || 'Unexpected backend error.',
    code: error.code || 'SERVER_ERROR',
  });
});

import cors from 'cors';
import express from 'express';

import { env } from './config/env.js';
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

app.get('/health', (request, response) => {
  response.json({
    status: 'ok',
    service: 'SS360 ERP Backend',
    database: 'PostgreSQL/Prisma',
  });
});

app.use('/api/invoices', invoiceRouter);

app.use((error, request, response, next) => {
  if (response.headersSent) {
    next(error);
    return;
  }

  const status = error.statusCode || error.status || 500;
  response.status(status).json({
    success: false,
    message: error.publicMessage || error.message || 'Unexpected backend error.',
    code: error.code || 'SERVER_ERROR',
  });
});

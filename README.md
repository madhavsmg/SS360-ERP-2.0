# SS360 ERP 2.0

<p align="center">
  <img src="public/circle%20logo%20ss%20tea.png" alt="SS360 Tea Enterprise logo" width="112" />
</p>

<h3 align="center">Full-stack tea enterprise ERP with local OCR, PostgreSQL persistence, QR inventory, production costing, sales, POS, and shipping.</h3>

<p align="center">
  <img alt="React" src="https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=111827" />
  <img alt="Vite" src="https://img.shields.io/badge/Vite-6-646CFF?logo=vite&logoColor=white" />
  <img alt="Node.js" src="https://img.shields.io/badge/Node.js-Express-339933?logo=nodedotjs&logoColor=white" />
  <img alt="Prisma" src="https://img.shields.io/badge/Prisma-PostgreSQL-2D3748?logo=prisma&logoColor=white" />
  <img alt="FastAPI" src="https://img.shields.io/badge/FastAPI-PaddleOCR-009688?logo=fastapi&logoColor=white" />
  <img alt="Python" src="https://img.shields.io/badge/Python-OpenCV-3776AB?logo=python&logoColor=white" />
  <img alt="Tesseract" src="https://img.shields.io/badge/Tesseract.js-Browser%20fallback-5A67D8" />
  <img alt="QR" src="https://img.shields.io/badge/QR%20Labels-qrcode-111827" />
  <img alt="ESLint" src="https://img.shields.io/badge/ESLint-Prettier-4B32C3?logo=eslint&logoColor=white" />
</p>

SS360 ERP 2.0 is a local-first, full-stack ERP workspace built for Siva Sai Tea Enterprises. It connects the supplier ledger, invoice OCR, raw lot inventory, QR labels, blend production, sales/POS, customer balances, and shipping into one workflow.

The goal is simple: stop retyping tea invoices, stock ledgers, bag counts, GST numbers, and shipping updates by hand. The app reads invoices, turns reviewed data into inventory lots, calculates landed cost, prints QR labels, decrements stock through production and sales, and keeps operational dashboards current.

## What It Does

### Invoice OCR to Inventory

- Upload PDF invoices, image invoices, or capture an invoice from the camera.
- Send the file to the local Express backend, where it is stored with `multer` and tracked in PostgreSQL.
- Read embedded PDF text first for fast extraction.
- Fall back to the local FastAPI OCR service powered by PaddleOCR, OpenCV, Pillow, NumPy, and PyMuPDF.
- Fall back again in the browser with `tesseract.js` when the backend or OCR service is unavailable.
- Parse supplier name, GSTIN, phone, address, invoice number, invoice date, tea names, grades, HSN, bags, kg per bag, received kg, rate/kg, taxable value, GST, charges, and payable totals.
- Show a human review screen before anything is posted.
- Approve reviewed invoices into PostgreSQL and mirror them into the frontend ERP state.
- Automatically create supplier ledger entries, raw inventory lots, landed-cost values, and stock movement history.

### QR Stock Ledger

- Generate QR codes for raw tea lots and finished blend batches using `qrcode`.
- Print the selected QR label directly from the Inventory screen.
- Lookup stock by pasting a QR payload or stock ID.
- Track lot IDs, supplier, grade, remaining kg, landed cost/kg, and movement history.
- Highlight low-stock raw lots based on reorder thresholds.

### Suppliers

- Add suppliers with contact details, region, payment terms, GSTIN, address, and outstanding balance.
- Keep the supplier ledger focused on vendor details, payable balances, and stock history.
- Record supplier payments and reduce outstanding balances.

### Production

- Blend multiple raw tea lots into finished products.
- Decrement raw lot stock automatically.
- Calculate raw material cost, packing cost, labor, overhead, total cost, cost/kg, revenue, expected profit, and margin.
- Preserve traceability from finished batch back to source raw lots.

### Sales, POS, Customers, and Shipping

- Sell finished blends or direct raw tea stock.
- Automatically reduce stock when a sale is created.
- Calculate revenue, COGS, profit, customer outstanding, and shipment records.
- Maintain customer profiles, credit limits, delivery preferences, payments, and order history.
- Move shipments through Packed, Dispatched, and Delivered states with transport and vehicle/LR details.
- POS reuses the Sales workflow so counter sales and order entry stay consistent.

### Dashboard

- Show raw stock, finished stock, inventory value, sales revenue, profit, open shipments, and low-stock alerts.
- Surface pending shipments and recent order profitability.
- Keep operational visibility tied to the same ERP data model used by the modules.

## Architecture

```mermaid
flowchart LR
  Browser["React 19 + Vite frontend"] -->|Upload invoice / approve draft| Backend["Express backend"]
  Backend -->|Prisma ORM| Postgres["PostgreSQL"]
  Backend -->|OCR request when needed| OCR["FastAPI OCR service"]
  OCR --> Paddle["PaddleOCR + OpenCV + PyMuPDF"]
  Browser -->|Offline fallback| Tesseract["Tesseract.js in browser"]
  Browser -->|Local operational mirror| LocalStorage["localStorage ss360.enterpriseData.v1"]
```

The frontend is still resilient in offline/demo mode with React Context and `localStorage`. The backend currently persists the invoice intake workflow: uploaded files, OCR JSON, reviewed approval JSON, suppliers, and raw inventory lots.

## Tech Stack

| Layer | Technology | Why it is used |
| --- | --- | --- |
| Frontend | React 19, Vite, React Router | Fast module UI, dashboard routing, and modern development workflow |
| UI | CSS, lucide-react | Enterprise-style screens, icons, forms, tables, alerts, and QR label surfaces |
| Client state | React Context, localStorage | Local-first ERP state and browser fallback continuity |
| Invoice parsing | pdfjs-dist, pdf-parse, tesseract.js | Browser and Node PDF text extraction plus OCR fallback |
| QR labels | qrcode | Printable QR labels for raw lots and finished batches |
| Backend | Node.js, Express, CORS, dotenv | Local API layer for upload, extraction, approval, and service coordination |
| Database | PostgreSQL, Prisma | Persistent invoice, supplier, and raw lot records |
| Uploads | multer | Local invoice file storage under `backend/uploads/invoices` |
| OCR service | Python, FastAPI, Uvicorn | Free local OCR API without paid cloud OCR calls |
| OCR engine | PaddleOCR, OpenCV, Pillow, NumPy, PyMuPDF | Image preprocessing, PDF page conversion, OCR, text layout, and parsing |
| Tooling | ESLint, Prettier, nodemon | Code quality, formatting, and development reloads |

## How The Automation Saves Time

| Manual work before | SS360 automated flow |
| --- | --- |
| Read every invoice line by hand | OCR extracts PDF/image/camera text locally |
| Re-enter supplier and GST details | Parser fills vendor, GSTIN, phone, address, invoice number, and date |
| Calculate bags and kg manually | Bag specs like `17 x 40` become bags, kg per bag, and received kg |
| Split GST and charges by spreadsheet | Parser captures GST, cart/coolie, transport, labour, and misc charges |
| Calculate landed stock cost manually | Approval allocates acquisition charges into landed cost/kg |
| Create stock lots manually | Approval creates raw inventory lots automatically |
| Print labels from another tool | Inventory generates printable QR labels in the app |
| Update stock after blending and sales | Production and Sales decrement stock automatically |
| Track delivery separately | Sales creates shipments and Shipping updates order state |

## Project Structure

```text
.
├── backend/                 Express API, Prisma schema, migrations, uploads
├── docs/                    Implementation notes and invoice extraction reference
├── ocr-service/             FastAPI OCR service with PaddleOCR and OpenCV
├── public/                  Logos and static Vite assets
├── sample-data/invoices/    Real invoice samples for parser testing
├── scripts/                 Local extraction and validation scripts
├── src/
│   ├── components/          App shell and sidebar navigation
│   ├── context/             ERP state, metrics, localStorage, business rules
│   ├── modules/             Dashboard, Suppliers, Inventory, Production, Sales, Shipping, POS
│   └── utils/               Formatters, invoice extraction, parser, backend client
├── package.json             Frontend scripts and dependencies
└── vite.config.js
```

## Service Responsibilities

### Frontend

- Routes: `/`, `/suppliers`, `/customers`, `/inventory`, `/production`, `/sales`, `/shipping`, `/pos`.
- Uses `EnterpriseProvider` to hold the local ERP state and calculate dashboard metrics.
- Uses `src/utils/invoiceBackendClient.js` for backend invoice upload, extraction, and approval.
- Uses `src/utils/invoiceExtraction.js` and `src/utils/teaInvoiceParser.js` for browser fallback extraction.
- Uses `src/modules/Inventory/invoiceIntake.jsx` as the human review and approval surface.

### Backend

- `GET /health` verifies the Express service.
- `POST /api/invoices` uploads PDF/image files and creates an `Invoice` row.
- `POST /api/invoices/:id/extract` extracts embedded PDF text or calls the OCR service.
- `POST /api/invoices/:id/approve` validates the reviewed draft and persists approval results.
- Prisma models: `Invoice`, `Supplier`, and `RawInventoryLot`.
- Upload limit: 25 MB.
- Supported upload types: PDF, PNG, JPG, JPEG.

### OCR Service

- `GET /health` verifies the FastAPI service.
- `POST /ocr/extract` extracts and parses invoice data from PDF/image uploads.
- `POST /ocr/raw` returns OCR pages and lines without full invoice parsing.
- `POST /ocr/parse-text` parses supplied raw text.
- Uses PyMuPDF to read embedded PDF text and convert scanned PDFs to page images.
- Uses OpenCV to resize, denoise, deskew, and threshold images before OCR.
- Uses PaddleOCR for local text recognition.
- Validates totals, item math, GST consistency, and confidence warnings.

## Invoice Pipeline

1. User uploads a PDF/image or captures a camera frame in Inventory.
2. Frontend uploads it to `POST /api/invoices`.
3. Backend creates an invoice record and stores the local file.
4. Frontend requests `POST /api/invoices/:id/extract`.
5. Backend first attempts embedded PDF text extraction with `pdf-parse`.
6. If embedded text is not useful, backend calls the OCR service.
7. OCR service uses PyMuPDF, OpenCV, and PaddleOCR to return structured invoice data.
8. Frontend maps the extraction into an editable human review draft.
9. User fixes missing or incorrect values.
10. User clicks `Approve to Inventory`.
11. Backend persists reviewed approval data in a Prisma transaction.
12. Frontend mirrors the approval into local ERP state so QR inventory updates immediately.

## Database Model

| Model | Purpose |
| --- | --- |
| `Invoice` | Upload metadata, raw text, extraction JSON, review JSON, approval JSON, OCR status, confidence, approval timestamp |
| `Supplier` | Vendor profile, GSTIN, address, phone, outstanding balance |
| `RawInventoryLot` | Received tea lot with bags, kg, remaining kg, landed cost, quality JSON, and movement JSON |

## Local Setup

### Prerequisites

- Node.js 20 LTS recommended
- Python 3.10 or 3.11 recommended for PaddleOCR
- Local PostgreSQL
- Git Bash, PowerShell, or another terminal

### 1. Frontend Environment

```bash
cp .env.example .env
npm install
```

`.env`:

```env
VITE_API_BASE_URL=http://localhost:5000
```

### 2. Backend Environment

```bash
cd backend
cp .env.example .env
npm install
```

`backend/.env`:

```env
PORT=5000
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/ss360_erp?schema=public
FRONTEND_URL=http://localhost:5173
OCR_SERVICE_URL=http://localhost:8001
UPLOAD_DIR=./uploads/invoices
```

Create the local database, then generate and migrate Prisma:

```bash
createdb ss360_erp
npm run prisma:generate
npm run prisma:migrate
```

If `createdb` is not available, create `ss360_erp` from pgAdmin or psql and then run the Prisma commands.

### 3. OCR Service Environment

```bash
cd ocr-service
python -m venv .venv
```

Windows:

```bash
.venv\Scripts\activate
```

macOS/Linux:

```bash
source .venv/bin/activate
```

Install dependencies:

```bash
pip install -r requirements.txt
```

Optional OCR settings can be placed in `ocr-service/.env`:

```env
OCR_HOST=127.0.0.1
OCR_PORT=8001
OCR_TEMP_DIR=./temp
OCR_OUTPUT_DIR=./output
OCR_LANG=en
OCR_USE_GPU=false
```

## Run The Full Stack

### One-Click Windows Launcher

Double-click this file from the repo root:

```text
Start-SS360.cmd
```

The launcher starts the whole local system from one point:

- Docker PostgreSQL container `ss360-postgres` on `localhost:5432`
- Prisma migrations for the backend database
- Express backend on `http://127.0.0.1:5000`
- FastAPI OCR service on `http://127.0.0.1:8001`
- Vite frontend on `http://127.0.0.1:5174`
- Route smoke checks for the main ERP pages
- Browser open to `http://127.0.0.1:5174/inventory`

To stop the app services, double-click:

```text
Stop-SS360.cmd
```

The stop script leaves PostgreSQL running so the next launch is faster. To stop PostgreSQL too:

```bash
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/stop-ss360.ps1 -StopDatabase
```

Terminal equivalents:

```bash
npm run system:start
npm run system:stop
```

Logs are written under `logs/`.

### Manual Service Startup

If you want to run services by hand, start each service in its own terminal.

### Terminal 1: OCR Service

```bash
cd ocr-service
uvicorn main:app --reload --host 127.0.0.1 --port 8001
```

Health check:

```bash
curl http://localhost:8001/health
```

### Terminal 2: Backend

```bash
cd backend
npm run dev
```

Health check:

```bash
curl http://localhost:5000/health
```

### Terminal 3: Frontend

```bash
npm run dev
```

Known local workspace fallback port:

```bash
npm run dev:local
```

Open:

- Frontend: `http://localhost:5173`
- Frontend fallback: `http://127.0.0.1:5174`
- Backend: `http://localhost:5000`
- OCR service: `http://localhost:8001`

## Useful Commands

Root frontend:

```bash
npm run lint
npm run build
npm run format
npm run scan:invoices
```

Backend:

```bash
cd backend
npm run prisma:generate
npm run prisma:migrate
npm run prisma:studio
npm run dev
```

OCR service:

```bash
cd ocr-service
uvicorn main:app --reload --host 127.0.0.1 --port 8001
```

## Sample Invoice Extraction

The repo includes sample invoices under `sample-data/invoices/`.

Run:

```bash
npm run scan:invoices
```

This scans every supported PDF/image and prints supplier, invoice number, date, GST type, confidence, charges, line items, bags, kg per bag, received kg, rate/kg, amount, and payable totals.

## Supported Invoice Patterns

The parser includes tea-specific logic for:

- Sanjay Tea, Surya Tea, Vaishali Tea, Tea Triangle, and Sharon Tea Agency style invoices.
- Tax Invoice and Proforma Invoice layouts.
- Grades such as `BOP`, `BOP1`, `BOPL`, `BOPF`, `BPS`, `BP`, `OF`, `PD`, `PD1`, `PF`, `PF1`, `DUST`, `CTC`, `LEAF`, and `STANDARD`.
- Bag specifications such as `17 x 40`, `(12 x 35)`, and mixed bag groups.
- 5 percent tea GST with IGST or CGST/SGST split.
- Cart, coolie, freight, transport, labour, loading, unloading, handling, and miscellaneous charges.
- Duplicate transporter/copy pages in scanned PDFs.

## Fallback Behavior

The app is designed to keep working even when a local service is missing:

- Backend available and OCR service available: full upload, OCR, review, approval, PostgreSQL persistence.
- Backend available and PDF has embedded text: fast backend extraction without PaddleOCR.
- Backend unavailable or OCR unavailable: browser fallback uses `pdfjs-dist` and `tesseract.js`.
- Frontend local mode: React Context persists operational ERP state in `localStorage`.

## Generated And Ignored Runtime Files

- `dist/`
- `node_modules/`
- `backend/node_modules/`
- `backend/uploads/invoices/*`
- `ocr-service/.venv/`
- `ocr-service/temp/*`
- `ocr-service/output/*`
- OCR trained data and local logs

These are intentionally ignored so the repo stays focused on source code, schema, scripts, and sample invoices.

## Why This Project Is Powerful

SS360 is not just a form app. It is a workflow engine for a tea business:

- Documents become structured inventory.
- Human review prevents blind OCR mistakes.
- Approved stock becomes traceable lots.
- QR labels make physical bags searchable.
- Production consumes real raw lots and predicts profit before selling.
- Sales reduce stock and create shipments automatically.
- Dashboards surface the next operational problem before it becomes manual cleanup.

That is the big win: less retyping, fewer spreadsheet calculations, cleaner traceability, and faster daily decisions.

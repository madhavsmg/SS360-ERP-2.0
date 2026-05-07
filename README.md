# SS360 ERP 2.0

SS360 ERP 2.0 is a React/Vite ERP workspace for Siva Sai Tea Enterprises. It covers supplier purchasing, invoice intake, raw tea inventory, QR labels, production blending, sales/POS, customers, and shipping.

## Project Structure

```text
.
├── docs/                    Project notes and implementation references
├── public/                  Static images served by Vite
├── sample-data/invoices/    Purchase invoice samples for extraction testing
├── scripts/                 Local development and validation scripts
├── src/
│   ├── components/          Shared app shell components
│   ├── context/             ERP state, persistence, and business rules
│   ├── modules/             Dashboard, supplier, inventory, production, sales, shipping pages
│   └── utils/               Formatters and invoice extraction utilities
├── index.html
├── package.json
├── package-lock.json
└── vite.config.js
```

## Run Locally

```bash
npm install
npm run dev
```

For the known local workspace port:

```bash
npm run dev:local
```

Open the Vite URL in the browser. In this workspace, the app is commonly run at `http://127.0.0.1:5174/`.

## Useful Commands

```bash
npm run lint
npm run build
npm run scan:invoices
```

`npm run scan:invoices` reads every PDF/image under `sample-data/invoices/` and prints the extracted supplier, invoice, GST, stock lines, grades, bag counts, weights, rates, and totals.

## Main Features

- Supplier and purchase order workflows
- OCR/PDF invoice intake for Indian tea purchase invoices
- Tea grade extraction such as `BOP`, `BPS`, `BOPL`, `OF`, `PD1`, and `PF1`
- Bag parsing such as `17X40` into bag count, kg per bag, and quantity in kg
- GST handling for 5% tea tax using IGST or CGST/SGST split
- Cart, coolie, labour, and transport charges captured for landed-cost allocation
- Raw lot inventory, reorder thresholds, and QR label printing
- Production blending with stock decrement and costing
- Sales/POS, customer ledger, and shipping status flows

## Data Model

The app currently stores ERP state in browser `localStorage`. Approving an invoice posts reviewed stock lines into purchase orders, raw lots, supplier outstanding, and invoice receipt history. The committed sample invoices are only for parser testing; approving drafts in the browser does not alter files in the repo.

## Notes

- `dist/`, logs, caches, and local OCR artifacts are generated and ignored.
- The legacy `Sample Invoices/` folder is ignored; the organized sample location is `sample-data/invoices/`.
- The app is frontend-only for now. Backend/database integration can be added later without changing the UI module structure.

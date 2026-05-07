# Invoice Extraction Reference

The invoice intake flow is built around real tea purchase invoices in `sample-data/invoices/`.

## Files

- `src/utils/invoiceExtraction.js` handles browser PDF text extraction, PDF OCR fallback, image OCR, and camera OCR.
- `src/utils/invoiceBackendClient.js` uploads invoices to the local Node backend and maps PaddleOCR output back into the same human-review draft shape.
- `ocr-service/` contains the local FastAPI/PaddleOCR extraction service used before the browser fallback.
- `backend/` stores uploaded invoice files and persists reviewed approvals through Prisma/PostgreSQL.
- `src/utils/teaInvoiceParser.js` contains the tea invoice profile and converts extracted text into review-ready invoice drafts.
- `src/utils/teaInvoiceExtraction.js` keeps the older import path working by re-exporting the current extractor.
- `scripts/extract-samples.js` runs the same parser against local sample invoices from Node.

## Supported Patterns

- Supplier formats from Sanjay Tea, Surya Tea, Tea Triangle, Vaishali Tea, and Sharon Tea Agency.
- Tea grades including `BOP`, `BOP1`, `BOPL`, `BOPF`, `BPS`, `BP`, `OF`, `PD`, `PD1`, `PF`, and `PF1`.
- Bag specifications such as `17X40`, `( 12 x 35 )`, and mixed specs such as `19X33, 1X26.4`.
- Indian GST for tea at 5%, using IGST for interstate purchases or CGST/SGST split for intrastate invoices.
- Cart, coolie, labour, transport, freight, and handling charges are captured as acquisition charges and can be allocated into landed stock cost by kg.
- HSN values are detected only to avoid confusing table columns; they are not used as product grade.

## Validation

Run:

```bash
npm run scan:invoices
```

For the full backend-driven OCR path, run the OCR service, backend, and frontend together:

```bash
cd ocr-service
uvicorn main:app --reload --host 127.0.0.1 --port 8001
```

```bash
cd backend
npm run dev
```

```bash
npm run dev
```

Expected behavior:

- Every supported sample invoice is scanned.
- Duplicate transporter copies are skipped.
- Legitimate repeated item rows remain separate.
- Stock lines include tea name, grade, bag count, kg per bag, quantity in kg, rate per kg, amount before GST, tax, and line total.

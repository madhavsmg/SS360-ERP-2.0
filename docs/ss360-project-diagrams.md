# SS360 ERP 2.0 Project Diagrams

This document captures the high-level SS360 ERP architecture, runtime services, feature map, invoice-to-inventory workflow, and core persisted data model.

## Service Architecture

```mermaid
flowchart LR
  User["User / Staff"] --> Browser["React 19 + Vite Frontend<br/>Port 5174"]

  Browser --> Routes["ERP Routes<br/>Dashboard, Suppliers, Customers,<br/>Inventory, Production, Sales, Shipping"]
  Browser --> LocalState["React Context + localStorage<br/>ss360.enterpriseData.v1"]

  Browser -->|Invoice upload / extract / approve| Backend["Node + Express Backend<br/>Port 5000"]
  Backend -->|Prisma ORM| DB["PostgreSQL<br/>Docker container: ss360-postgres<br/>Port 5432<br/>DB: ss360_erp"]

  Backend -->|OCR fallback request| OCR["FastAPI OCR Service<br/>Port 8001"]
  OCR --> Engine["PaddleOCR + OpenCV + PyMuPDF<br/>PDF/image OCR + preprocessing"]

  Browser -->|If backend/OCR unavailable| BrowserOCR["Browser fallback<br/>pdfjs-dist + tesseract.js"]

  Backend --> Uploads["Local invoice file storage<br/>backend/uploads/invoices"]
```

## Invoice To Inventory Workflow

```mermaid
flowchart TD
  A["Supplier invoice<br/>PDF / image / camera"] --> B["Inventory: Invoice Intake"]
  B --> C["Backend upload<br/>POST /api/invoices"]
  C --> D["Invoice row + stored file"]
  D --> E["Extract invoice<br/>POST /api/invoices/:id/extract"]

  E --> F{"Embedded PDF text usable?"}
  F -->|Yes| G["Backend embedded PDF parser"]
  F -->|No| H["FastAPI OCR service<br/>PaddleOCR"]

  G --> I["Human review draft"]
  H --> I
  I --> J["User corrects missing/wrong fields"]
  J --> K["Approve to Inventory"]
  K --> L["PostgreSQL approval transaction"]
  L --> M["Supplier payable updated"]
  L --> N["Raw inventory lots created"]
  N --> O["QR labels / stock ledger"]
  O --> P["Production blending"]
  O --> Q["Sales"]
  P --> R["Finished blend batch + QR"]
  Q --> S["Stock reduced + customer balance + shipment"]
  S --> T["Shipping workflow"]
  M --> U["Dashboard KPIs"]
  N --> U
  R --> U
  S --> U
  T --> U
```

## High-Level Feature Map

```mermaid
mindmap
  root((SS360 ERP 2.0))
    Dashboard
      Stock value
      Sales revenue
      Profit
      Low-stock alerts
      Open shipments
    Suppliers
      Add supplier
      Supplier ledger
      Supplier payments
      Outstanding balance
      GSTIN and Indian phone validation
    Inventory
      Stock Ledger
        Raw lots
        Blended batches
        QR generation
        QR print labels
        QR lookup
      Invoice Intake
        PDF upload
        Image upload
        Camera capture
        OCR extraction
        Human review
        Approve to inventory
      Invoice Register
        Drafts
        Approved invoices
        Reverted invoices
        Correction drafts
    Production
      Select existing raw inventory
      QR/bag-driven raw usage
      Blend costing
      Target blend price
      Profit per kg
      Finished batch creation
      Raw stock deduction
    Customers
      Customer master
      Credit limits
      Outstanding balance
      Customer payments
    Sales
      Cart/order workflow
      Sell raw or blended stock
      Payment mode
      Revenue and profit
      Stock deduction
      Shipment creation
    Shipping
      Packaging status
      Dispatch status
      Delivery tracking
      Order status sync
    Services
      Frontend Vite 5174
      Backend Express 5000
      OCR FastAPI 8001
      PostgreSQL Docker 5432
```

## Core Data Model

```mermaid
erDiagram
  Invoice ||--o{ RawInventoryLot : creates
  Supplier ||--o{ RawInventoryLot : supplies

  Invoice {
    string id
    string originalFileName
    string status
    string rawText
    json extractionJson
    json reviewJson
    json approvedJson
    int confidenceScore
    datetime approvedAt
  }

  Supplier {
    string id
    string name
    string gstin
    string phone
    string address
    float outstanding
  }

  RawInventoryLot {
    string id
    string invoiceId
    string supplierId
    string supplierName
    string variety
    string grade
    float bags
    float bagWeightKg
    float receivedKg
    float remainingKg
    float costPerKg
    float landedCost
    json qualityJson
    json movementsJson
  }
```

## Runtime Services

| Service     |   Port | Purpose                                    | Start Path                                  |
| ----------- | -----: | ------------------------------------------ | ------------------------------------------- |
| Frontend    | `5174` | React ERP UI and routes                    | `npm run dev:local` or `Start-SS360.cmd`    |
| Backend API | `5000` | Invoice upload, extraction, approval API   | `backend/npm run start` via launcher        |
| OCR service | `8001` | Local PDF/image OCR using PaddleOCR        | `uvicorn main:app --port 8001` via launcher |
| PostgreSQL  | `5432` | Persistent invoice, supplier, raw lot data | Docker container `ss360-postgres`           |

## Summary

SS360 ERP is a local-first tea enterprise system where invoice OCR creates reviewed raw inventory, QR-labeled stock feeds production and sales, and sales, shipping, customer, and supplier balances roll back into the dashboard.

# Codebase Navigation

This repo keeps the project shape intentionally simple: one frontend, one backend API, one OCR service, and a small set of docs, scripts, and sample data.

## Root Folders

- `src/` is the React/Vite ERP app. Start with `src/App.jsx` for routes, `src/modules/` for business screens, `src/context/EnterpriseContext.jsx` for shared ERP state, `src/utils/` for reusable business helpers, and `src/styles/erp.css` for shared ERP styling.
- `backend/` is the Express API. Invoice upload, extraction, and approval routes flow through `backend/src/routes/`, `backend/src/controllers/`, and `backend/src/services/`. Prisma schema and migrations stay under `backend/prisma/`.
- `ocr-service/` is the FastAPI OCR service. Routes live in `ocr-service/app/routes/`, parsing and OCR logic lives in `ocr-service/app/services/`, and file/date/number helpers live in `ocr-service/app/utils/`.
- `scripts/` contains local validation and workflow helpers used by the root `package.json` release checks.
- `sample-data/invoices/` contains real invoice fixtures used by `npm run scan:invoices`.
- `docs/` contains architecture notes, invoice extraction notes, and this navigation guide.
- `public/` contains static Vite assets such as logos and images.

## Stable Release Boundaries

- Keep module pages inside `src/modules/<Module>/` so future workers can find screens by business area.
- Keep shared UI components in `src/components/` and shared CSS in `src/styles/`.
- Keep runtime output out of Git: `node_modules/`, `dist/`, logs, backend uploads, OCR temp/output files, Python virtual environments, and trained OCR data.
- Preserve `Start-SS360.cmd` and `Stop-SS360.cmd` at the repo root because they are the one-click Windows launcher entrypoints.

## Release Checks

Run these before publishing a stable branch:

```bash
npm run lint:strict
npm run verify:sales
npm run verify:shared
npm run scan:invoices
npm run build
npm --prefix backend run check
npm run ocr:check
```

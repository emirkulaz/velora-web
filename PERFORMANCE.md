# Performance baseline

Measured on 2026-08-14 with `npm run build` using the production Vite configuration.

## Frontend bundle

| Metric | Before | After route-level splitting |
| --- | ---: | ---: |
| Main application JavaScript | 535.41 kB | 236.27 kB |
| Main application gzip | 140.42 kB | 72.59 kB |
| Largest feature chunk | Included in main | Finance 32.75 kB |

The main JavaScript payload decreased by 55.9% (67.83 kB gzip). ERP feature modules are loaded only when their menu is opened. Shared translations remain a separate cacheable chunk. This removes the Vite 500 kB warning without changing API behavior or production data.

## Backend query work

Dashboard and customer-ledger totals are aggregated by PostgreSQL instead of loading full ledgers into Node.js (backend commit `f2d1828`). This bounds application memory and reduces transfer volume. Query filters remain scoped by `companyId`.

## Guardrails

- Large list endpoints retain bounded responses and server-side filters where available.
- PDF responses are streamed/downloaded as blobs and object URLs are revoked after use.
- No cache is added to financial writes or tenant-specific authorization decisions.
- Re-run the production build and record bundle sizes when adding a top-level module.
- Railway memory should be observed after deployment; application-level measurement cannot prove the platform's 1 GB peak without production telemetry.

## Follow-up measurements

Capture p50/p95 duration and row counts for `/dashboard/executive`, `/customer-ledger/summary`, `/cash-flow`, and the largest list endpoints from structured production logs. Add an index only after `EXPLAIN (ANALYZE, BUFFERS)` demonstrates a repeatable bottleneck; never experiment against production writes.

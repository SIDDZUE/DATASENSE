# DataSense AI — Universal AIoT Data Intelligence Platform

A working, local-first AIoT data intelligence platform: upload a structured dataset,
profile it, train real ML models, detect anomalies, replay historical sensor streams,
and turn evidence into decision findings — with PDF/JSON reports.

Everything users see is computed from real uploaded data. There are no placeholder
charts, invented metrics or fake customers.

- **Backend:** FastAPI + pandas + scikit-learn + SQLite (Python 3.10)
- **Frontend:** Next.js 15 (App Router) + React 19 + Tailwind v4 + Recharts
- **Datasets:** 5 genuine public datasets, 2,379,992 rows total, full provenance in
  [`docs/DATASETS.md`](docs/DATASETS.md)
- **No auth, no payments** — single-user local demo, by design

## Quick start (Windows PowerShell)

```powershell
# 1. install everything (venv, Python deps, datasets, npm packages)
.\scripts\setup.ps1

# 2. start the API on http://127.0.0.1:8000  (docs at /docs)
.\scripts\start.ps1

# 3. build and start the UI on http://localhost:3000
cd frontend
npm run build
npm run start
```

Stop both processes with `.\scripts\stop.ps1`.

> Run the frontend from a production build (`npm run build` + `npm run start`). The
> project is verified in that mode; Next.js dev mode adds its own hydration warnings
> that do not occur in production.

## What you can do

| Page | Purpose |
|------|---------|
| `/` | Landing page describing the platform |
| `/dashboard` | Live counts, storage, recent analyses and findings |
| `/datasets` | Upload CSV / Parquet / JSON, or inspect the five shipped datasets |
| `/datasets/[id]` | Schema, per-column stats, histograms, correlation matrix, quality checks, 50-row preview |
| `/explorer` | Paged data browser |
| `/data-quality` | Missing values, duplicates, constant columns, class imbalance |
| `/analysis` | Train classification, regression, clustering or anomaly models — 8 classifiers, 6 regressors, 3 clusterers, Isolation Forest |
| `/models` | Every trained model with real test-split metrics, confusion matrix, artifact download, delete |
| `/anomalies` | Isolation Forest results with ground-truth comparison where labels exist |
| `/iot-monitor` | Historical replay of timestamped datasets with live inference, speed control, pause/resume/stop |
| `/decisions` | Evidence-backed findings with severity, recommendation and stated limitations |
| `/reports` | Generate and download PDF/JSON reports; see file size and health |
| `/settings` | Runtime configuration and API details |
| `/pricing` | Product packaging page (no payments are processed) |

## Verified status

| Check | Result |
|-------|--------|
| Backend test suite (`backend/tests/test_api.py`) | **27 passed** |
| Live API smoke test (`scripts/api_smoke_test.py`) | **all checks passed** |
| Browser audit, 14 routes + interactions (`frontend/scripts/ui-audit.mjs`) | **14/14 pages, 0 console errors** |
| Upload + cascade-delete E2E (`frontend/scripts/e2e-upload.mjs`) | **passed** |

Details, commands and every fix: [`docs/TESTING.md`](docs/TESTING.md).

## Project layout

```
DataSense-AI/
├── backend/
│   ├── app/            FastAPI app, API routers, services (profiling, ML, replay, reporting)
│   └── tests/          pytest suite (isolated temp database)
├── frontend/
│   ├── src/app/        Next.js App Router pages
│   ├── src/components/ UI primitives, charts, upload dialog, app shell
│   ├── src/lib/        API client, dataset context, formatting, types
│   └── scripts/        Playwright UI audit + upload E2E
├── data/               raw downloads (untouched) and processed Parquet
├── models/             trained model artifacts (.joblib)
├── reports/            generated PDF/JSON reports + screenshots
├── scripts/            setup, import, training, smoke test, maintenance
└── docs/               architecture, design, datasets, API, syllabus mapping, testing
```

## Documentation

- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — components, data flow, design decisions
- [`docs/DESIGN.md`](docs/DESIGN.md) — visual identity and design system
- [`docs/DATASETS.md`](docs/DATASETS.md) — provenance, checksums, licences, reference models
- [`docs/API_DOCUMENTATION.md`](docs/API_DOCUMENTATION.md) — endpoint reference
- [`docs/SYLLABUS_MAPPING.md`](docs/SYLLABUS_MAPPING.md) — AIoT syllabus coverage
- [`docs/TESTING.md`](docs/TESTING.md) — test suites, results, defects fixed, limitations
- [`FINAL_DELIVERY_REPORT.md`](FINAL_DELIVERY_REPORT.md) — honest delivery report

## Honest limitations

- Local single-user demo: no authentication, authorisation, multi-tenancy or billing.
- Feature attributions use permutation importance, not SHAP.
- Clustering is unsupervised and never scored against a ground truth.
- The AI4I dataset is synthetic (author-generated), and the breast-cancer models are
  research demonstrations, not medical tools. Both are labelled as such in the UI.
- No load, performance or penetration testing has been performed.

## License

Educational/demonstration project. Each bundled dataset keeps its original licence
(see `docs/DATASETS.md`).

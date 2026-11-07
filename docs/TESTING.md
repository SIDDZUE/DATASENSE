# DataSense AI — Testing

Everything below was executed against this build. Numbers are the observed results,
not targets. Commands assume `DataSense-AI/` as the working directory.

## 1. Backend test suite — 27 passed

**Location:** `backend/tests/test_api.py`
**Result:** `27 passed, 3 warnings in 16.13s` (warnings are upstream Starlette/FastAPI
deprecations only)

```powershell
cd backend
..\.venv\Scripts\python.exe -m pytest tests -q
```

The suite runs in-process with FastAPI's `TestClient` against an isolated temporary
SQLite database, so it never mutates the demo database and is safe to run repeatedly.

### Coverage (27 tests)

| Area | Tests |
|------|-------|
| System | `test_health`, `test_stats_shape` |
| Upload validation | unknown extension rejected, empty file rejected, garbage CSV rejected |
| Dataset intelligence | profile row counts, quality score bounds, preview pagination, unknown id 404 |
| Analysis | suggestions expose limitations; classification trains end-to-end; missing target rejected; unknown algorithm rejected |
| Models | prediction with probabilities, all-features requirement, delete route |
| Anomaly detection | Isolation Forest run with ground-truth label comparison |
| IoT replay | start → poll → stop lifecycle, start requires an existing dataset |
| Decisions | findings carry evidence + limitations |
| Reports | JSON generation, PDF generation, invalid dataset rejected |
| Export | CSV export, bad export kind rejected |
| Cascade delete | deleting a dataset removes models, findings, analyses, anomalies, replay sessions **and the processed Parquet, stored upload, model artifacts and report files** |

## 2. Live API smoke test — all checks passed

**Location:** `scripts/api_smoke_test.py`
**Target:** the running uvicorn server on `http://127.0.0.1:8000`

```powershell
.\.venv\Scripts\python.exe scripts\api_smoke_test.py
```

Observed results:

```
PASS  health datasets=5 models=3
PASS  datasets>=5 n=5
PASS  preview pagination
PASS  profile has n_rows
PASS  quality score 0-100 score=100.0
PASS  analysis suggestions first=classification
PASS  wdbc model exists
PASS  model prediction pred=M
PASS  prediction probabilities classes=['B', 'M']
PASS  delete model route status=404
PASS  replay start total=2075259
PASS  replay advances 1 -> 137
PASS  replay pause / resume / speed / stop (stop position 138)
PASS  anomaly results exist n=1
PASS  findings exist n=15
PASS  finding has evidence+limits
PASS  report json + pdf generated
PASS  report download 99794 bytes
PASS  dataset export 23056 bytes
PASS  upload rejects bad format status=400
PASS  upload rejects empty data status=400
RESULT: all checks passed
```

## 3. Browser UI audit — 14/14 pages, 0 console errors

**Location:** `frontend/scripts/ui-audit.mjs` (Playwright + Chromium)
**Target:** production build (`npm run build && npm run start`, `http://localhost:3000`)
**Artifacts:** full-page screenshots in `reports/screenshots/`

```powershell
cd frontend
npm run build
npm run start          # separate terminal
node scripts/ui-audit.mjs
```

Observed:

```
OK   landing          200  (+0 errors)
OK   dashboard        200  (+0 errors)
OK   datasets         200  (+0 errors)
OK   dataset-detail   200  (+0 errors)
OK   explorer         200  (+0 errors)
OK   data-quality     200  (+0 errors)
OK   analysis         200  (+0 errors)
OK   models           200  (+0 errors)
OK   anomalies        200  (+0 errors)
OK   iot-monitor      200  (+0 errors)
OK   decisions        200  (+0 errors)
OK   reports          200  (+0 errors)
OK   settings         200  (+0 errors)
OK   pricing          200  (+0 errors)
OK   dataset-detail-wdbc
OK   consistency /datasets/9c9fb0dd447f        header ok
OK   consistency /datasets/9d8fc1ec7786        header ok
OK   consistency /explorer?dataset=5616616def35 header ok
OK   consistency /analysis?dataset=88762f42d133 header ok
OK   mobile-dashboard
RESULT: 14/14 pages rendered, 0 console errors
```

The audit fails the run on any console error, page error or failed request, and it
asserts that the topbar dataset label matches the dataset each page actually renders.

## 4. Upload + cascade-delete E2E — passed

**Location:** `frontend/scripts/e2e-upload.mjs` (Playwright)

Drives the real upload dialog in the browser (file chooser), confirms the new dataset
appears in the list, then deletes it over the API and verifies the dataset row *and*
both on-disk copies (processed Parquet + stored upload) are gone.

```
PASS upload E2E — dataset appears in the list
PASS cleanup — dataset row and its processed/upload files deleted
pageerrors: 0
```

The fixture CSV is written to the OS temp directory, so the script cannot leave
residue in `data/uploads/` even if it fails mid-run.

## 4b. Generated-artifact audit — 0 orphans

**Location:** `scripts/prune_orphan_files.py`

Compares every file under `data/uploads`, `data/processed`, `models` and `reports`
against the database, so test residue cannot silently accumulate in the delivered
tree. Dry run by default.

```powershell
.\.venv\Scripts\python.exe scripts\prune_orphan_files.py            # report only
.\.venv\Scripts\python.exe scripts\prune_orphan_files.py --apply    # delete orphans
.\.venv\Scripts\python.exe scripts\prune_orphan_files.py --dedupe-reports --apply
```

Final state after cleaning 26 leftover test files and collapsing repeated
smoke-test reports to one PDF + one JSON pair per dataset:

```
datasets: 5 | models: 3 | reports: 2
orphans: uploads=0 processed=0 models=0 reports=0
```

## 5. Defects found by these tests and fixed

| # | Defect | Fix |
|---|--------|-----|
| 1 | Deleting a dataset left orphaned models, findings, analyses, anomalies, reports and artifact files | `DELETE /api/datasets/{id}` now cascades in the correct order and removes files |
| 2 | Deleting a model left its findings behind | `DELETE /api/models/{id}` added; orphaned rows from an earlier deletion cleaned |
| 3 | Nested `<a>` inside `<a>` in `Button asChild` produced React hydration errors | `asChild` now clones the single child instead of wrapping it |
| 4 | Replay `speed` change was ignored after start | speed re-read per emitted row |
| 5 | Replay `stop` was asynchronous and could report `running` | status set synchronously and persisted |
| 6 | PDF report crashed when an analysis entry was `null` | `reporting.py` guards empty analysis lists |
| 7 | Dataset detail histogram charts rendered empty | wired to real `stats.histogram` bins with an explicit empty-state message |
| 8 | `Reprofile` button did nothing | real button that reloads profile, quality and preview |
| 9 | Models page only showed two of three models and no confusion matrix | lists all models, real metrics, matrix, artifact/metadata download, delete |
| 10 | Decision Centre hid findings unless a dataset was picked | defaults to all findings, severity filter, dataset names |
| 11 | Dataset switcher, page body and topbar could name different datasets | `useResolvedDataset` syncs `?dataset=` deep links into the global context |
| 12 | Reports history could not be attributed to a dataset and showed no file health | list endpoint joins dataset name, file size and existence |
| 13 | Cascade delete removed DB rows but left the stored upload, generated report files and anomaly label files on disk | delete now unlinks processed Parquet, every upload-extension variant, model artifacts, anomaly labels and report files; the pytest cascade test asserts on-disk removal |
| 14 | Upload E2E called `process.exit()` before its `finally` cleanup, leaving a fixture CSV in `data/uploads/` | fixture moved to the OS temp dir and cleanup runs in `finally` |
| 15 | Upload E2E wrote its screenshot to `../../reports/screenshots/`, one level above the project | path corrected to `../reports/screenshots/`; stray file removed |

## 6. Known limitations

- No frontend unit/component tests; the browser audit and E2E script cover routing,
  console health, dataset consistency, upload and cascade delete.
- No performance or load benchmarks.
- No security testing. The app is a local single-user demo with no auth, no payments
  and no multi-tenant surface by design.
- The `why` explanations are permutation-importance based, not SHAP; the UI labels them
  accordingly.
- Clustering labels are unsupervised and are never validated against a ground truth.

# DataSense AI — API Documentation

Base URL: `http://127.0.0.1:8000`

All endpoints are under `/api/`. Request and response bodies are JSON unless otherwise noted.
OpenAPI spec is available at `http://127.0.0.1:8000/docs`.

## Health & Stats

### GET `/api/health`
Returns server health status.

**Response:**
```json
{
  "status": "ok",
  "app": "DataSense AI",
  "version": "1.0.0",
  "server_time": "2026-11-06T12:00:00Z",
  "database": { "path": "...", "exists": true, "datasets": 5, "models": 0, "findings": 7 },
  "python": "3.10.11",
  "platform": "Windows-10-...",
  "environment": { "project_root": "...", "data_dir": "..." }
}
```

### GET `/api/stats`
Returns platform-wide statistics.

**Response:**
```json
{
  "datasets": 5,
  "total_rows": 2380942,
  "total_bytes": 157286400,
  "analyses_by_status": { "completed": 3, "queued": 0, "failed": 0 },
  "models": 3,
  "reports": 0,
  "findings_by_severity": { "high": 1, "medium": 2, "low": 0, "info": 4 }
}
```

## Datasets

### GET `/api/datasets`
List all datasets.

**Response:** `{ "datasets": [ DatasetSummary, ... ] }`

### POST `/api/datasets/upload`
Upload a CSV file. Large files are stored as Parquet.

**Query params:** `name`, `source_url`, `provider`, `license`, `notes`

**Body:** `multipart/form-data` with `file` field

**Response:** `{ "id": "...", "name": "...", "n_rows": 10000, "n_cols": 14, "message": "..." }`

### GET `/api/datasets/{id}`
Get full dataset details including profile and quality.

**Response:** `Dataset` object (includes `profile` and `quality`)

### GET `/api/datasets/{id}/profile`
Get dataset profile.

**Response:** `Profile` object

### GET `/api/datasets/{id}/quality`
Get dataset quality assessment.

**Response:** `Quality` object

### GET `/api/datasets/{id}/preview`
Preview first N rows.

**Query params:** `limit` (default 50, max 200), `offset` (default 0)

**Response:** `{ "columns": [...], "total_rows": 10000, "offset": 0, "rows": [...] }`

### POST `/api/datasets/{id}/reprofile`
Re-run profiling on the dataset.

**Response:** `{ "status": "ok", "suggested_target": "Type" }`

### POST `/api/datasets/{id}/preprocess`
Apply preprocessing operations.

**Body:** `{ "operations": [...] }`

**Response:** `{ "status": "ok", "operations_applied": [...], "n_rows": ..., "n_cols": ... }`

### POST `/api/datasets/{id}/export/{kind}`
Export dataset as CSV or JSON. Returns a file download.

**Path param:** `kind` = `csv` or `json`

### DELETE `/api/datasets/{id}`
Delete a dataset.

**Response:** `{ "status": "deleted" }`

## Analysis

### POST `/api/datasets/{id}/analysis/suggest`
Get analysis task recommendations based on dataset profile.

**Response:** `{ "recommendations": [ Recommendation, ... ], "suggested_target": "Type" }`

### POST `/api/datasets/{id}/analysis/run`
Start an ML analysis run (background task).

**Body:**
```json
{
  "task": "classification",
  "config": {
    "target": "Type",
    "algorithm": "random_forest",
    "test_size": 0.2,
    "feature_columns": [...],
    "exclude_columns": [...]
  }
}
```

**Response:** `{ "analysis_id": "...", "status": "queued" }`

### GET `/api/analyses`
List analyses (optionally filtered by dataset).

**Query params:** `dataset_id`, `limit` (default 50)

**Response:** `{ "analyses": [ AnalysisSummary, ... ] }`

### GET `/api/analysis/{id}`
Get analysis details and results.

**Response:** `Analysis` object (includes `results` and `config`)

## Models

### GET `/api/models`
List trained models (optionally filtered by dataset).

**Query params:** `dataset_id`

**Response:** `{ "models": [ ModelRecord, ... ] }`

### GET `/api/models/{id}`
Get model details.

**Response:** `ModelRecord` object

### POST `/api/models/{id}/predict`
Make a prediction with a trained model.

**Body:** `{ "values": { "feature_name": value, ... } }`

**Response:** `{ "prediction": 0, "target_column": "Type", "probabilities": { ... } }`

### GET `/api/models/{id}/download`
Download the model artifact (joblib file).

### GET `/api/models/{id}/metadata`
Get model metadata JSON.

## Anomalies

### GET `/api/datasets/{id}/anomalies`
List anomaly detection results for a dataset.

**Response:** `{ "anomalies": [ AnomalyResult, ... ] }`

## Decisions (Findings)

### GET `/api/decisions`
List evidence-backed findings (optionally filtered by dataset).

**Query params:** `dataset_id`

**Response:** `{ "findings": [ Finding, ... ] }`

### PATCH `/api/decisions/{id}`
Update finding status.

**Body:** `{ "status": "acknowledged" }`

**Response:** `{ "id": "...", "status": "acknowledged" }`

## Reports

### POST `/api/reports/generate`
Generate a PDF or JSON report for a dataset.

**Body:** `{ "dataset_id": "...", "format": "pdf" }`

**Response:** `{ "report_id": "...", "filename": "...", "download_url": "..." }`

### GET `/api/reports`
List generated reports.

**Query params:** `dataset_id`

**Response:** `{ "reports": [ ReportRecord, ... ] }`

### GET `/api/reports/{id}/download`
Download a generated report.

## IoT Replay

### POST `/api/iot/replay/start`
Start a historical replay session.

**Body:**
```json
{
  "dataset_id": "...",
  "session_id": "...",
  "timestamp_column": "...",
  "columns": ["col1", "col2"],
  "speed": 1,
  "model_id": "..."
}
```

**Response:** `{ "session_id": "...", "status": "running", "total": 10000, "columns": [...] }`

### POST `/api/iot/replay/pause`
Pause a replay session.

**Body:** `{ "session_id": "..." }`

### POST `/api/iot/replay/resume`
Resume a paused replay session.

**Body:** `{ "session_id": "..." }`

### POST `/api/iot/replay/stop`
Stop a replay session.

**Body:** `{ "session_id": "..." }`

### POST `/api/iot/replay/speed`
Set replay speed.

**Body:** `{ "session_id": "...", "speed": 2 }`

### GET `/api/iot/replay/poll`
Poll for new replay entries.

**Query params:** `session_id`, `since` (position)

**Response:** `{ "session_id": "...", "status": "...", "position": 100, "total": 10000, "entries": [...] }`

## Type Definitions

Key TypeScript types (from `frontend/src/lib/types.ts`):

- **DatasetSummary** — id, name, n_rows, n_cols, suggested_target, format, etc.
- **Profile** — n_rows, n_cols, sampled, columns, numeric_columns, correlation, etc.
- **Quality** — score, per_column, issues, imbalance, duplicate_rows, total_missing
- **Recommendation** — task, title, why, required_columns, assumptions, limitations, confidence
- **AnalysisSummary** — id, task_type, algorithm, target_column, status, progress
- **ModelRecord** — id, algorithm, task_type, target_column, metrics, train_rows, test_rows
- **Finding** — title, explanation, evidence, severity, recommendation, limitations, status
- **AnomalyResult** — method, n_rows, n_flagged, contamination, results

# DataSense AI — Syllabus Mapping

This document maps the DataSense AI platform to common AIoT / data science course syllabus
topics. Each platform feature corresponds to specific learning outcomes.

## Data Acquisition & Management

| Syllabus Topic | Platform Feature | Location |
|----------------|------------------|----------|
| Dataset ingestion from public repositories | Pre-loaded 5 datasets with provenance | `/datasets` |
| CSV / Parquet file upload | Upload endpoint with format detection | `/api/datasets/upload` |
| Data storage (SQLite + Parquet) | SQLite metadata + Parquet data files | Backend services |
| Data provenance tracking | Source URL, provider, license, download date | `docs/DATASETS.md` |

## Data Profiling & Exploration

| Syllabus Topic | Platform Feature | Location |
|----------------|------------------|----------|
| Descriptive statistics | n_rows, n_cols, missing, mean, std, min, max | `/api/datasets/[id]/profile` |
| Data types (numeric, categorical, datetime) | Semantic type classification | Profile columns |
| Missing data analysis | Missing count, percentage, per-column | Quality endpoint |
| Correlation analysis | Correlation matrix heatmap | Dataset detail page |
| Data preview / sampling | First N rows table | `/api/datasets/[id]/preview` |
| Duplicate detection | Duplicate row count | Profiling service |

## Data Quality

| Syllabus Topic | Platform Feature | Location |
|----------------|------------------|----------|
| Quality scoring (0-100) | Overall quality score | `/api/datasets/[id]/quality` |
| Per-column quality checks | Missing %, outliers, constant detection | Quality per_column |
| Class imbalance detection | Minority %, imbalanced flag | Quality imbalance |
| Outlier detection (IQR) | Outlier count and percentage | Quality per_column |

## Machine Learning

| Syllabus Topic | Platform Feature | Location |
|----------------|------------------|----------|
| Supervised learning — classification | Random Forest, Logistic Regression | `/api/datasets/[id]/analysis/run` |
| Supervised learning — regression | Random Forest regressor | `/api/datasets/[id]/analysis/run` |
| Unsupervised learning — clustering | K-Means, DBSCAN | `/api/datasets/[id]/analysis/run` |
| Unsupervised learning — anomaly detection | Isolation Forest | `/api/datasets/[id]/analysis/run` |
| Train/test split | Configurable test_size (default 0.2) | ML engine config |
| Cross-validation | 5-fold CV with mean/std | Model metrics |
| Classification metrics | Accuracy, precision, recall, F1, PR-AUC | Model metrics |
| Regression metrics | MAE, RMSE, R² | Model metrics |
| Confusion matrix | Per-class breakdown | Model metrics |
| Feature importance | Model feature rankings | Model metrics |
| Model persistence | joblib artifacts saved to disk | `/models` directory |

## IoT & Time-Series

| Syllabus Topic | Platform Feature | Location |
|----------------|------------------|----------|
| Timestamp column detection | Automatic datetime column identification | Profiling service |
| Historical data replay | Simulated IoT stream with configurable speed | `/iot-monitor` |
| Replay controls | Start, pause, resume, stop, speed adjustment | IoT monitor page |
| Live inference during replay | Model predictions on streamed data | IoT monitor (when model selected) |
| Stream visualization | Real-time readings display | IoT monitor page |

## Decision Intelligence

| Syllabus Topic | Platform Feature | Location |
|----------------|------------------|----------|
| Evidence-backed findings | Findings with evidence and limitations | `/decisions` |
| Correlation ≠ causation | Disclosed in all findings | Decision engine |
| Uncertainty disclosure | Limitations field on every finding | Decision engine |
| Finding status workflow | Open, acknowledged, dismissed | Decisions API |
| Severity classification | High, medium, low, info | Badge tone mapping |

## Reporting & Export

| Syllabus Topic | Platform Feature | Location |
|----------------|------------------|----------|
| PDF report generation | ReportLab-based PDF reports | `/api/reports/generate` |
| JSON report export | Structured JSON export | `/api/reports/generate` |
| CSV data export | Dataset export as CSV | `/api/datasets/[id]/export/csv` |
| JSON data export | Dataset export as JSON | `/api/datasets/[id]/export/json` |
| Model artifact download | joblib file download | `/api/models/[id]/download` |

## Academic Alignment

This platform supports coursework in:

- **Data Science** — profiling, exploration, ML, evaluation
- **Machine Learning** — algorithms, metrics, validation
- **AIoT** — sensor data, replay, streaming, anomaly detection
- **Data Quality** — scoring, cleaning, validation
- **Decision Support** — evidence-based recommendations, limitations

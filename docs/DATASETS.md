# DataSense AI — Datasets and Provenance

Five genuine public datasets are pre-loaded. Each one is downloaded from its original
public repository, converted to Parquet without altering values, checksummed, and
profiled by the backend (row/column counts in the table below are computed from the
stored files, not typed in by hand).

Raw downloads are kept under `data/raw/`; the Parquet files the app reads are under
`data/processed/`. Redistribution is governed by each dataset's own licence.

## Summary

| Dataset | Rows | Columns | Timestamp | Licence | Provider |
|---------|------|---------|-----------|---------|----------|
| AI4I 2020 Predictive Maintenance | 10,000 | 14 | no | CC BY 4.0 | Stephan Matzka — UCI ML Repository |
| Breast Cancer Wisconsin (Diagnostic) | 569 | 32 | no | CC BY 4.0 | W. Wolberg, O. Mangasarian — UCI ML Repository |
| Credit Card Fraud Detection | 284,807 | 31 | no | ODbL | Université Libre de Bruxelles (MLG), via OpenML 42175 |
| Individual Household Electric Power Consumption | 2,075,259 | 8 | yes | CC BY 4.0 | Georges Hebrail, Alice Berard — UCI ML Repository |
| UCI Air Quality | 9,357 | 14 | yes | CC BY 4.0 | S. De Vito et al. — UCI ML Repository |

Total: 2,379,992 rows.

## 1. AI4I 2020 Predictive Maintenance

- **Source:** https://archive.ics.uci.edu/dataset/601/ai4i+2020+predictive+maintenance+dataset
- **Original file:** `ai4i2020.csv` → `9c9fb0dd447f.parquet`
- **Checksum (SHA-256):** `e9b3dc735de4c06dbb8bb9f1b05d4c24a9293d06ad8177cf1ecca30b1f25fd2b`
- **Download date:** 2026-11-06
- **Used for:** industrial predictive maintenance; classification of `Machine failure`
  and the five failure-mode flags (`TWF`, `HDF`, `PWF`, `OSF`, `RNF`).

**Honesty note:** this dataset is *synthetic*, generated from a real milling-process
model by the dataset authors. It is not factory-collected telemetry, and the app says
so in the dataset notes.

## 2. Breast Cancer Wisconsin (Diagnostic)

- **Source:** https://archive.ics.uci.edu/dataset/17/breast+cancer+wisconsin+diagnostic
- **Original file:** `wdbc.csv` → `9d8fc1ec7786.parquet`
- **Checksum (SHA-256):** `8b57a0c7f3b9786d3c22ff28b5f065c038f25007c05194839182c563f5f6b136`
- **Download date:** 2026-11-06
- **Used for:** binary classification of `diagnosis` (M/B).

Column names were reconstructed from the distributed `wdbc.names` file because the
original CSV has no header row. Model outputs are research demonstrations and are
explicitly labelled as **not medical diagnoses**.

## 3. Credit Card Fraud Detection

- **Source:** https://www.openml.org/d/42175
- **Original file:** `creditcard.csv` → `2ee15716c59a.parquet`
- **Checksum (SHA-256):** `3e9a956086c89d513d23965cf2e405c8a501a2fb679624f4eaaa186fb5663f45`
- **Download date:** 2026-11-06
- **Used for:** highly imbalanced classification (`Class`, 0.172% fraud) and PR-AUC
  discussion under class imbalance.

Downloaded from OpenML because the original Kaggle listing requires authentication.
Features `V1..V28` are PCA-anonymised by the original authors; this is not a live
payment system and no cardholder data is present.

## 4. Individual Household Electric Power Consumption

- **Source:** https://archive.ics.uci.edu/dataset/235/individual+household+electric+power+consumption
- **Original file:** `household_power.parquet` → `88762f42d133.parquet`
- **Checksum (SHA-256):** `ee6f69d632a85052f402ce596f89456d7c0ec7b2f083f304378ffa33035f4f23`
- **Download date:** 2026-11-06
- **Used for:** the IoT historical replay simulator (minute-level readings, 2006–2010)
  and time-series exploration.

Timestamps are derived from the original `Date` + `Time` columns; `?` missing markers
are converted to `NaN`. This is the largest dataset (2,075,259 rows) and the one used
in the smoke test's replay run.

## 5. UCI Air Quality

- **Source:** https://archive.ics.uci.edu/dataset/360/air+quality
- **Original file:** `air_quality.csv` → `5616616def35.parquet`
- **Checksum (SHA-256):** `29fc57c3d2289be3ceaf07e2b3ad258bb4109fc9a8c2bec80786fc89d63dbbf2`
- **Download date:** 2026-11-06
- **Used for:** environmental sensor regression (e.g. predicting `C6H6(GT)`) and replay.

`-200` missing markers are converted to `NaN`; the timestamp column is derived from
`Date` + `Time`.

## Reference models trained on these datasets

These are the models shipped with the demo database. Metrics are stored test-split
results, reproducible with `scripts/train_demo_models.py`.

| Model | Dataset | Target | Key metrics |
|-------|---------|--------|-------------|
| Random Forest (classification) | AI4I 2020 | `Machine failure` | accuracy 0.9815, PR-AUC 0.7841, ROC-AUC 0.9658, F1-macro 0.8224 |
| Random Forest (classification) | Breast Cancer WDBC | `diagnosis` | accuracy 0.9649, PR-AUC 0.9901, ROC-AUC 0.9936, F1-macro 0.9615 |
| Random Forest (regression) | UCI Air Quality | `C6H6(GT)` | R² 0.9997, RMSE 0.1253, MAE 0.0167 |
| K-Means | AI4I 2020 | — | 3 clusters, silhouette 0.2614 |
| Isolation Forest | AI4I 2020 | — | 200 flagged rows (2.0%), precision 0.205 vs real failure labels |

The earlier `Type`-target model (accuracy 0.3055) was removed: `Type` is a product
quality class, not a failure outcome, and the extra class made the demo misleading.

## Reproducing the import

```powershell
# from DataSense-AI/
.\.venv\Scripts\python.exe scripts\import_datasets.py
.\.venv\Scripts\python.exe scripts\train_demo_models.py
```

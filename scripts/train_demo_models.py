"""Clean orphaned model/analysis rows and train the reference demo models.

Reference models (all computed from the real imported datasets):
  1. AI4I 2020  -> Random Forest classification on 'Machine failure'
                   (failure-mode sub-labels excluded to prevent target leakage)
  2. WDBC       -> Random Forest classification on 'diagnosis'
  3. AI4I 2020  -> K-Means clustering on process sensor features
  4. AI4I 2020  -> Isolation Forest anomaly detection with label evaluation
  5. Air Quality-> Random Forest regression on benzene concentration C6H6(GT)

Run:  .venv\\Scripts\\python.exe scripts\\train_demo_models.py
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

import pandas as pd

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "backend"))

from app.database import db, new_id, load_json          # noqa: E402
from app.config import MODELS_DIR                       # noqa: E402
from app.services.ml_engine import (train_supervised, run_clustering,  # noqa: E402
                                    run_anomaly_detection)
from app.services.decision_engine import generate_findings  # noqa: E402


def clean_orphans() -> None:
    """Remove models/analyses/findings whose dataset no longer exists."""
    with db() as conn:
        ds_ids = {r["id"] for r in conn.execute("SELECT id FROM datasets").fetchall()}
        orphans = [r["dataset_id"] for r in conn.execute(
            "SELECT dataset_id, COUNT(*) c FROM models GROUP BY dataset_id").fetchall()
            if r["dataset_id"] not in ds_ids]
        for ds in orphans:
            print(f"removing orphaned rows for deleted dataset {ds}")
            conn.execute("DELETE FROM models WHERE dataset_id=?", (ds,))
            conn.execute("DELETE FROM analyses WHERE dataset_id=?", (ds,))
            conn.execute("DELETE FROM findings WHERE dataset_id=?", (ds,))
            conn.execute("DELETE FROM anomalies WHERE dataset_id=?", (ds,))
    if not orphans:
        print("no orphaned rows found")


def persist_analysis(dataset_id: str, task: str, algorithm: str, target: str,
                     config: dict, result: dict, model_id: str | None) -> str:
    analysis_id = new_id()
    with db() as conn:
        conn.execute(
            "INSERT INTO analyses (id, dataset_id, task_type, algorithm, "
            "target_column, config_json, status, progress, results_json, "
            "model_id, completed_at) VALUES (?,?,?,?,?,?,?,?,?,?,datetime('now'))",
            (analysis_id, dataset_id, task, algorithm, target,
             json.dumps(config, default=str), "completed", 100,
             json.dumps(result, default=str), model_id))
    return analysis_id


def persist_model(dataset_id: str, analysis_id: str, result: dict) -> str:
    model_id = new_id()
    with db() as conn:
        conn.execute(
            "INSERT INTO models (id, dataset_id, analysis_id, algorithm, task_type, "
            "target_column, feature_columns_json, preprocessing_json, metrics_json, "
            "artifact_path, train_rows, test_rows) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)",
            (model_id, dataset_id, analysis_id, result["algorithm"],
             result["task"], result["target"],
             json.dumps(result["feature_columns"]),
             json.dumps(result["preprocessing"]),
             json.dumps(result["metrics"]),
             result.get("artifact_path"), result["train_rows"], result["test_rows"]))
    return model_id


def persist_anomaly(dataset_id: str, analysis_id: str, result: dict,
                    contamination: float) -> None:
    with db() as conn:
        conn.execute(
            "INSERT INTO anomalies (id, dataset_id, analysis_id, method, params_json, "
            "n_rows, n_flagged, contamination, results_json) VALUES (?,?,?,?,?,?,?,?,?)",
            (new_id(), dataset_id, analysis_id, "isolation_forest",
             json.dumps({"contamination": contamination}),
             result["rows_scored"], result["n_flagged"], contamination,
             json.dumps(result, default=str)))


def persist_findings(dataset_id: str, analysis_id: str | None, model_id: str | None,
                     result: dict, dataset_name: str) -> None:
    for f in generate_findings(profile=None, quality=None, analysis=result,
                               dataset_name=dataset_name):
        with db() as conn:
            conn.execute(
                "INSERT INTO findings (id, dataset_id, analysis_id, model_id, title, "
                "explanation, evidence_json, severity, recommendation, limitations) "
                "VALUES (?,?,?,?,?,?,?,?,?,?)",
                (new_id(), dataset_id, analysis_id, model_id, f["title"],
                 f["explanation"], json.dumps(f["evidence"]), f["severity"],
                 f["recommendation"], f["limitations"]))


def dataset_name(dataset_id: str) -> str:
    with db() as conn:
        r = conn.execute("SELECT name FROM datasets WHERE id=?", (dataset_id,)).fetchone()
    return r["name"] if r else "dataset"


def load(dataset_id: str) -> pd.DataFrame:
    with db() as conn:
        r = conn.execute("SELECT file_path, format FROM datasets WHERE id=?",
                         (dataset_id,)).fetchone()
    return pd.read_parquet(r["file_path"])


def main() -> int:
    clean_orphans()

    ai4i = "9c9fb0dd447f"
    wdbc = "9d8fc1ec7786"
    air = "5616616def35"

    # ---- 1. AI4I machine-failure classification (leakage-safe) ------------
    print("\n[1/5] AI4I Random Forest -> Machine failure")
    df = load(ai4i)
    cfg = {"target": "Machine failure", "algorithm": "random_forest",
           "exclude_columns": ["UDI", "Product ID", "TWF", "HDF", "PWF", "OSF", "RNF"]}
    res = train_supervised(df, task="classification", target=cfg["target"],
                           algorithm=cfg["algorithm"],
                           exclude_cols=cfg["exclude_columns"],
                           artifact_dir=MODELS_DIR, dataset_id=ai4i)
    aid = persist_analysis(ai4i, "classification", cfg["algorithm"], cfg["target"], cfg, res, None)
    mid = persist_model(ai4i, aid, res)
    with db() as conn:
        conn.execute("UPDATE analyses SET model_id=? WHERE id=?", (mid, aid))
    persist_findings(ai4i, aid, mid, res, dataset_name(ai4i))
    print(f"    acc={res['metrics']['accuracy']} pr_auc={res['metrics'].get('pr_auc')} "
          f"roc_auc={res['metrics'].get('roc_auc')} rows={res['train_rows']}/{res['test_rows']}")

    # ---- 2. WDBC diagnosis classification ---------------------------------
    print("\n[2/5] WDBC Random Forest -> diagnosis")
    df = load(wdbc)
    cfg = {"target": "diagnosis", "algorithm": "random_forest",
           "exclude_columns": ["id"]}
    res = train_supervised(df, task="classification", target=cfg["target"],
                           algorithm=cfg["algorithm"], exclude_cols=cfg["exclude_columns"],
                           artifact_dir=MODELS_DIR, dataset_id=wdbc)
    aid = persist_analysis(wdbc, "classification", cfg["algorithm"], cfg["target"], cfg, res, None)
    mid = persist_model(wdbc, aid, res)
    with db() as conn:
        conn.execute("UPDATE analyses SET model_id=? WHERE id=?", (mid, aid))
    persist_findings(wdbc, aid, mid, res, dataset_name(wdbc))
    print(f"    acc={res['metrics']['accuracy']} f1={res['metrics']['f1_macro']}")

    # ---- 3. AI4I K-Means clustering ---------------------------------------
    print("\n[3/5] AI4I K-Means clustering")
    df = load(ai4i)
    feats = ["Air temperature [K]", "Process temperature [K]",
             "Rotational speed [rpm]", "Torque [Nm]", "Tool wear [min]"]
    cfg = {"algorithm": "kmeans", "n_clusters": 3, "feature_columns": feats}
    res = run_clustering(df, algorithm="kmeans", feature_cols=feats, n_clusters=3)
    aid = persist_analysis(ai4i, "clustering", "kmeans", None, cfg, res, None)
    persist_findings(ai4i, aid, None, res, dataset_name(ai4i))
    print(f"    silhouette={res['metrics'].get('silhouette')} "
          f"sizes={res['metrics']['cluster_sizes']}")

    # ---- 4. AI4I anomaly detection with label evaluation ------------------
    print("\n[4/5] AI4I Isolation Forest (label evaluation vs Machine failure)")
    res = run_anomaly_detection(df, feature_cols=feats, contamination=0.02,
                                label_column="Machine failure")
    aid = persist_analysis(ai4i, "anomaly", "isolation_forest", None,
                           {"feature_columns": feats, "contamination": 0.02}, res, None)
    persist_anomaly(ai4i, aid, res, 0.02)
    persist_findings(ai4i, aid, None, res, dataset_name(ai4i))
    print(f"    flagged={res['n_flagged']} ({res['flagged_pct']}%) "
          f"label_eval={res.get('label_evaluation')}")

    # ---- 5. Air Quality regression (benzene from co-sensors) --------------
    print("\n[5/5] Air Quality Random Forest regression -> C6H6(GT)")
    df = load(air)
    # UCI Air Quality marks sensor faults with -200; treat as missing for training
    df = df.replace(-200.0, pd.NA)
    cfg = {"target": "C6H6(GT)", "algorithm": "random_forest_regressor",
           "exclude_columns": ["timestamp"]}
    res = train_supervised(df, task="regression", target=cfg["target"],
                           algorithm=cfg["algorithm"], exclude_cols=cfg["exclude_columns"],
                           artifact_dir=MODELS_DIR, dataset_id=air)
    aid = persist_analysis(air, "regression", cfg["algorithm"], cfg["target"], cfg, res, None)
    mid = persist_model(air, aid, res)
    with db() as conn:
        conn.execute("UPDATE analyses SET model_id=? WHERE id=?", (mid, aid))
    persist_findings(air, aid, mid, res, dataset_name(air))
    print(f"    r2={res['metrics']['r2']} rmse={res['metrics']['rmse']}")

    print("\nDone. Reference models trained with real metrics.")
    return 0


if __name__ == "__main__":
    sys.exit(main())

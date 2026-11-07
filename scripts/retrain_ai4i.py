"""One-off: retrain the AI4I Machine-failure model (artifact was lost)."""
import json, sys
from pathlib import Path
import pandas as pd

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "backend"))

from app.database import db, new_id
from app.config import MODELS_DIR
from app.services.ml_engine import train_supervised
from app.services.decision_engine import generate_findings

AI4I = "9c9fb0dd447f"

# remove the broken rows (model without artifact) + linked analysis/findings
with db() as conn:
    r = conn.execute(
        "SELECT id, analysis_id FROM models WHERE dataset_id=? AND target_column=?",
        (AI4I, "Machine failure")).fetchone()
    if r:
        conn.execute("DELETE FROM findings WHERE model_id=?", (r["id"],))
        conn.execute("DELETE FROM analyses WHERE id=?", (r["analysis_id"],))
        conn.execute("DELETE FROM models WHERE id=?", (r["id"],))
        print("removed stale rows:", r["id"])

with db() as conn:
    row = conn.execute("SELECT name, file_path FROM datasets WHERE id=?", (AI4I,)).fetchone()
df = pd.read_parquet(row["file_path"])

cfg = {"target": "Machine failure", "algorithm": "random_forest",
       "exclude_columns": ["UDI", "Product ID", "TWF", "HDF", "PWF", "OSF", "RNF"]}
res = train_supervised(df, task="classification", target=cfg["target"],
                       algorithm=cfg["algorithm"], exclude_cols=cfg["exclude_columns"],
                       artifact_dir=MODELS_DIR, dataset_id=AI4I)
assert Path(res["artifact_path"]).exists(), "artifact missing!"

aid, mid = new_id(), new_id()
with db() as conn:
    conn.execute(
        "INSERT INTO analyses (id, dataset_id, task_type, algorithm, target_column, "
        "config_json, status, progress, results_json, model_id, completed_at) "
        "VALUES (?,?,?,?,?,?,?,?,?,?,datetime('now'))",
        (aid, AI4I, "classification", cfg["algorithm"], cfg["target"],
         json.dumps(cfg, default=str), "completed", 100,
         json.dumps(res, default=str), mid))
    conn.execute(
        "INSERT INTO models (id, dataset_id, analysis_id, algorithm, task_type, "
        "target_column, feature_columns_json, preprocessing_json, metrics_json, "
        "artifact_path, train_rows, test_rows) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)",
        (mid, AI4I, aid, res["algorithm"], res["task"], res["target"],
         json.dumps(res["feature_columns"]), json.dumps(res["preprocessing"]),
         json.dumps(res["metrics"]), res["artifact_path"],
         res["train_rows"], res["test_rows"]))
    for f in generate_findings(profile=None, quality=None, analysis=res,
                               dataset_name=row["name"]):
        conn.execute(
            "INSERT INTO findings (id, dataset_id, analysis_id, model_id, title, "
            "explanation, evidence_json, severity, recommendation, limitations) "
            "VALUES (?,?,?,?,?,?,?,?,?,?)",
            (new_id(), AI4I, aid, mid, f["title"], f["explanation"],
             json.dumps(f["evidence"]), f["severity"], f["recommendation"],
             f["limitations"]))

print(f"retrained OK: acc={res['metrics']['accuracy']} "
      f"pr_auc={res['metrics'].get('pr_auc')} artifact={res['artifact_path']}")

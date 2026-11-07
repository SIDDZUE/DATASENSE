import json
import sqlite3
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
db = sqlite3.connect(ROOT / "data" / "datasense.db")
db.row_factory = sqlite3.Row
cur = db.cursor()

print("--- models ---")
for r in cur.execute("SELECT id, dataset_id, algorithm, task_type, target_column, "
                     "metrics_json, train_rows, test_rows, artifact_path FROM models "
                     "ORDER BY created_at"):
    m = json.loads(r["metrics_json"] or "{}")
    keep = {k: (round(v, 4) if isinstance(v, float) else v) for k, v in m.items()
            if k in ("accuracy", "precision_macro", "recall_macro", "f1_macro",
                     "pr_auc", "roc_auc", "r2", "rmse", "mae", "silhouette",
                     "inertia", "n_clusters")}
    print(f"{r['id']} {r['algorithm']:24} {r['task_type']:14} target={r['target_column']!s:18}")
    print(f"    train={r['train_rows']} test={r['test_rows']} metrics={keep}")

print("\n--- anomalies ---")
for r in cur.execute("SELECT id, dataset_id, method, n_rows, n_flagged, contamination FROM anomalies"):
    pct = 100.0 * r["n_flagged"] / r["n_rows"] if r["n_rows"] else 0
    print(f"{r['id']} {r['method']} n_rows={r['n_rows']} flagged={r['n_flagged']} "
          f"({pct:.2f}%) contamination={r['contamination']}")

print("\n--- counts ---")
for t in ("datasets", "analyses", "models", "anomalies", "findings", "reports", "replay_sessions"):
    print(t, cur.execute(f"SELECT COUNT(*) FROM {t}").fetchone()[0])
db.close()

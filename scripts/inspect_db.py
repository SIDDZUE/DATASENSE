"""Quick DB inspection utility (compact)."""
import sqlite3, json, sys
sys.stdout.reconfigure(encoding="utf-8", errors="replace")

DB = "data/datasense.db"
conn = sqlite3.connect(DB)
conn.row_factory = sqlite3.Row

tables = [r[0] for r in conn.execute("SELECT name FROM sqlite_master WHERE type='table'").fetchall()]
print("TABLES:", tables)
print()
print("=== DATASETS ===")
for r in conn.execute("SELECT id, name, original_filename, format, n_rows, n_cols, source_url, suggested_target FROM datasets").fetchall():
    print(json.dumps(dict(r), default=str)[:300])
print()
print("=== MODELS ===")
for r in conn.execute("SELECT id, dataset_id, analysis_id, algorithm, task_type, target_column, created_at FROM models").fetchall():
    print(dict(r))
print()
for t in ("findings", "analyses", "reports", "replay_sessions", "anomalies"):
    if t in tables:
        n = conn.execute(f"SELECT COUNT(*) c FROM {t}").fetchone()["c"]
        print(f"{t}: {n} rows")

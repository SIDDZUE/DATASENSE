"""One-off cleanup of orphaned rows left by a model/dataset deleted before the
cascade-delete fix landed. Idempotent: safe to run more than once."""

import os
import sqlite3

DB = r"C:\Users\Siddarth\Desktop\B.Tech\PROJECTS\IoT PROJECTS\DataSense-AI\data\datasense.db"
c = sqlite3.connect(DB)
cur = c.cursor()

removed = {"findings": 0, "analyses": 0, "reports": 0}

# 1. findings pointing at a model that no longer exists
cur.execute(
    "SELECT f.id FROM findings f LEFT JOIN models m ON f.model_id = m.id "
    "WHERE f.model_id IS NOT NULL AND m.id IS NULL"
)
for (fid,) in cur.fetchall():
    cur.execute("DELETE FROM findings WHERE id = ?", (fid,))
    removed["findings"] += 1

# 2. analyses pointing at a model that no longer exists
cur.execute(
    "SELECT a.id FROM analyses a LEFT JOIN models m ON a.model_id = m.id "
    "WHERE a.model_id IS NOT NULL AND m.id IS NULL"
)
for (aid,) in cur.fetchall():
    cur.execute("DELETE FROM findings WHERE analysis_id = ?", (aid,))
    removed["findings"] += cur.rowcount
    cur.execute("DELETE FROM analyses WHERE id = ?", (aid,))
    removed["analyses"] += 1

# 3. reports pointing at a dataset that no longer exists
cur.execute(
    "SELECT r.id, r.file_path FROM reports r LEFT JOIN datasets d ON r.dataset_id = d.id "
    "WHERE r.dataset_id IS NOT NULL AND d.id IS NULL"
)
for rid, path in cur.fetchall():
    cur.execute("DELETE FROM reports WHERE id = ?", (rid,))
    removed["reports"] += 1
    if path and os.path.exists(path) and "pytest_" in os.path.basename(path):
        try:
            os.remove(path)
            print("removed test artifact:", path)
        except OSError as exc:
            print("could not remove", path, exc)

c.commit()

print("removed:", removed)
for t in ("datasets", "analyses", "models", "anomalies", "findings", "reports", "replay_sessions"):
    cur.execute(f"SELECT COUNT(*) FROM {t}")
    print(f"  {t}: {cur.fetchone()[0]}")
c.close()

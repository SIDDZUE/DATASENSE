import json
import sqlite3
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
db = sqlite3.connect(ROOT / "data" / "datasense.db")
db.row_factory = sqlite3.Row
cur = db.cursor()

for r in cur.execute("SELECT id, algorithm, results_json FROM analyses ORDER BY created_at"):
    data = json.loads(r["results_json"] or "{}")
    print(f"{r['algorithm']:24} keys={list(data.keys())}")

row = cur.execute("SELECT results_json FROM analyses WHERE algorithm='kmeans'").fetchone()
print("\nkmeans results_json:")
print(json.dumps(json.loads(row["results_json"]), indent=2)[:1200])
db.close()

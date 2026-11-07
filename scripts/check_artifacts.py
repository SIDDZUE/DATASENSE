"""Verify every model row's artifact exists on disk."""
import sqlite3, sys
from pathlib import Path
sys.stdout.reconfigure(encoding="utf-8")

conn = sqlite3.connect("data/datasense.db")
conn.row_factory = sqlite3.Row
ok = True
for r in conn.execute("SELECT id, algorithm, target_column, artifact_path FROM models").fetchall():
    exists = Path(r["artifact_path"]).exists() if r["artifact_path"] else False
    ok = ok and exists
    print(("OK " if exists else "MISSING ") + f"{r['id']} {r['algorithm']} -> {r['target_column']}")
print("ALL ARTIFACTS OK" if ok else "SOME MISSING")

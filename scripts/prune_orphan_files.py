"""Audit generated artifacts on disk against the database (dry run by default).

Usage:
    python scripts/prune_orphan_files.py                  # report only
    python scripts/prune_orphan_files.py --apply          # delete unreferenced files
    python scripts/prune_orphan_files.py --dedupe-reports # keep only the newest
                                                          # PDF+JSON pair per dataset
"""

from __future__ import annotations

import sqlite3
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DB = ROOT / "data" / "datasense.db"
APPLY = "--apply" in sys.argv
DEDUPE = "--dedupe-reports" in sys.argv

conn = sqlite3.connect(DB)
conn.row_factory = sqlite3.Row
cur = conn.cursor()

dataset_ids = {r["id"] for r in cur.execute("SELECT id FROM datasets")}
model_paths = {r["artifact_path"] for r in cur.execute("SELECT artifact_path FROM models") if r["artifact_path"]}
report_paths = {r["file_path"] for r in cur.execute("SELECT file_path FROM reports") if r["file_path"]}
anomaly_paths = {r["labels_path"] for r in cur.execute("SELECT labels_path FROM anomalies") if r["labels_path"]}

def prune(path: Path, keep: set[str], label: str) -> int:
    if not path.exists():
        return 0
    removed = 0
    for f in sorted(path.iterdir()):
        if not f.is_file():
            continue
        if str(f) in keep:
            continue
        print(f"  orphan {label}: {f.name} ({f.stat().st_size} bytes)")
        if APPLY:
            f.unlink()
        removed += 1
    return removed

print("datasets:", len(dataset_ids), "| models:", len(model_paths),
      "| reports:", len(report_paths))

# uploads: keep only <dataset_id>.<ext>
uploads_keep: set[str] = set()
for ext in ("csv", "json", "parquet"):
    for did in dataset_ids:
        uploads_keep.add(str(ROOT / "data" / "uploads" / f"{did}.{ext}"))

n1 = prune(ROOT / "data" / "uploads", uploads_keep, "upload")

# processed: keep only files referenced by a dataset row (file_path)
processed_keep: set[str] = set()
for r in cur.execute("SELECT file_path FROM datasets"):
    if r["file_path"]:
        processed_keep.add(str(Path(r["file_path"])))
        processed_keep.add(str(ROOT / "data" / "processed" / Path(r["file_path"]).name))
n2 = prune(ROOT / "data" / "processed", processed_keep, "parquet")

# models: keep referenced joblib files only
n3 = prune(ROOT / "models", {str(Path(p)) for p in model_paths}, "model")

# reports: keep referenced files and screenshot pngs
reports_keep = {str(Path(p)) for p in report_paths}
reports_keep |= {str(f) for f in (ROOT / "reports" / "screenshots").glob("*.png")}
n4 = 0
for f in sorted((ROOT / "reports").iterdir()):
    if f.is_file() and str(f) not in reports_keep:
        print(f"  orphan report: {f.name} ({f.stat().st_size} bytes)")
        if APPLY:
            f.unlink()
        n4 += 1

print(f"orphans: uploads={n1} processed={n2} models={n3} reports={n4}")
if not APPLY:
    print("dry run only - pass --apply to delete")

# Optional: collapse repeated smoke-test reports down to the newest pair per
# dataset, so the demo history does not show the same report five times.
if DEDUPE:
    rows = cur.execute(
        "SELECT id, dataset_id, format, file_path, created_at FROM reports "
        "ORDER BY dataset_id, format, created_at DESC"
    ).fetchall()
    seen: set[tuple[str, str]] = set()
    dupes = []
    for r in rows:
        key = (r["dataset_id"], r["format"])
        if key in seen:
            dupes.append(r)
        else:
            seen.add(key)
    print(f"duplicate reports: {len(dupes)}")
    for r in dupes:
        print(f"  stale report: {Path(r['file_path']).name}")
        if APPLY:
            cur.execute("DELETE FROM reports WHERE id=?", (r["id"],))
            Path(r["file_path"]).unlink(missing_ok=True)
    if APPLY:
        conn.commit()
    else:
        print("dry run only - pass --apply to delete")

conn.close()

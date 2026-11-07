import re
import sqlite3
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
db = sqlite3.connect(ROOT / "data" / "datasense.db")
rows = db.execute("SELECT id, name, checksum, n_rows, n_cols, original_filename FROM datasets").fetchall()

doc = (ROOT / "docs" / "DATASETS.md").read_text(encoding="utf-8")
checksums = set(re.findall(r"\b[0-9a-f]{64}\b", doc))

print(f"checksums in docs/DATASETS.md: {len(checksums)}")
print(f"datasets in db: {len(rows)}\n")
for r in rows:
    has = r[2] in checksums
    print(f"{'OK ' if has else 'MISSING'} {r[1][:45]:45} {r[2][:16]}... rows={r[3]} cols={r[4]} file={r[5]}")

extra = checksums - {r[2] for r in rows}
if extra:
    print("\nchecksums in doc that match no dataset:")
    for e in sorted(extra):
        print("  ", e)
db.close()

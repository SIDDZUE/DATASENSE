import sqlite3, os

DB = r"C:\Users\Siddarth\Desktop\B.Tech\PROJECTS\IoT PROJECTS\DataSense-AI\data\datasense.db"
c = sqlite3.connect(DB)
cur = c.cursor()

print("--- datasets ---")
cur.execute("SELECT id, name FROM datasets")
for r in cur.fetchall():
    print("  ", r)

print("\n--- analyses ---")
cur.execute(
    "SELECT a.id, a.algorithm, a.task_type, a.target_column, a.status, a.model_id, "
    "(SELECT COUNT(*) FROM models m WHERE m.id=a.model_id), a.dataset_id "
    "FROM analyses a"
)
for r in cur.fetchall():
    print("  ", r)

print("\n--- orphan findings ---")
cur.execute(
    "SELECT f.id, substr(f.title,1,70), f.model_id, f.analysis_id FROM findings f "
    "LEFT JOIN models m ON f.model_id=m.id WHERE f.model_id IS NOT NULL AND m.id IS NULL"
)
for r in cur.fetchall():
    print("  ", r)

print("\n--- orphan reports ---")
cur.execute(
    "SELECT r.id, r.dataset_id, r.report_type, r.format, r.file_path FROM reports r "
    "LEFT JOIN datasets d ON r.dataset_id=d.id WHERE r.dataset_id IS NOT NULL AND d.id IS NULL"
)
for r in cur.fetchall():
    print("  ", r, "exists=", os.path.exists(r[4]) if r[4] else None)

print("\n--- analyses referencing missing models ---")
cur.execute(
    "SELECT a.id, a.algorithm, a.target_column, a.model_id FROM analyses a "
    "LEFT JOIN models m ON a.model_id=m.id WHERE a.model_id IS NOT NULL AND m.id IS NULL"
)
for r in cur.fetchall():
    print("  ", r)

c.close()

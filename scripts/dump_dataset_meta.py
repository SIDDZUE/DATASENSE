import sqlite3, json

DB = r"C:\Users\Siddarth\Desktop\B.Tech\PROJECTS\IoT PROJECTS\DataSense-AI\data\datasense.db"
c = sqlite3.connect(DB)
c.row_factory = sqlite3.Row
cur = c.cursor()
cur.execute("SELECT * FROM datasets ORDER BY name")
for r in cur.fetchall():
    d = dict(r)
    d.pop("profile_json", None)
    d.pop("quality_json", None)
    print(json.dumps(d, indent=2, default=str))
    print("-" * 70)
c.close()

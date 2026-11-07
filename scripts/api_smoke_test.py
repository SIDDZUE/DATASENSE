"""End-to-end API smoke test: replay, predict, delete, reports.

Run:  .venv\\Scripts\\python.exe scripts\\api_smoke_test.py
Exits 0 only if every check passes.
"""
import json
import sys
import time

import httpx

sys.stdout.reconfigure(encoding="utf-8", errors="replace")

API = "http://127.0.0.1:8000"
FAILS = []


def check(name: str, ok: bool, detail: str = ""):
    print(f"{'PASS' if ok else 'FAIL'}  {name} {detail}")
    if not ok:
        FAILS.append(name)


def main() -> int:
    c = httpx.Client(timeout=120)

    health = c.get(f"{API}/api/health").json()
    check("health", health["status"] == "ok", f"datasets={health['database']['datasets']} models={health['database']['models']}")

    datasets = {d["name"]: d for d in c.get(f"{API}/api/datasets").json()["datasets"]}
    check("datasets>=5", len(datasets) >= 5, f"n={len(datasets)}")

    power = datasets["Individual Household Electric Power Consumption"]
    ai4i = datasets["AI4I 2020 Predictive Maintenance"]

    # ---- preview pagination
    p1 = c.get(f"{API}/api/datasets/{power['id']}/preview", params={"limit": 10, "offset": 0}).json()
    p2 = c.get(f"{API}/api/datasets/{power['id']}/preview", params={"limit": 10, "offset": 10}).json()
    check("preview pagination", len(p1["rows"]) == 10 and len(p2["rows"]) == 10
          and p1["rows"][0] != p2["rows"][0])

    # ---- profile & quality
    prof = c.get(f"{API}/api/datasets/{ai4i['id']}/profile").json()
    qual = c.get(f"{API}/api/datasets/{ai4i['id']}/quality").json()
    check("profile has n_rows", prof.get("n_rows") == 10000)
    check("quality score 0-100", isinstance(qual.get("score"), (int, float)) and 0 <= qual["score"] <= 100,
          f"score={qual.get('score')}")

    # ---- analysis suggestions
    sug = c.post(f"{API}/api/datasets/{ai4i['id']}/analysis/suggest").json()
    check("analysis suggestions", len(sug.get("recommendations", [])) >= 1,
          f"first={sug['recommendations'][0]['task'] if sug.get('recommendations') else '-'}")

    # ---- model list + prediction
    models = c.get(f"{API}/api/models").json()["models"]
    wdbc_model = next((m for m in models if m["dataset_name"] == "Breast Cancer Wisconsin (Diagnostic)"), None)
    check("wdbc model exists", wdbc_model is not None)
    if wdbc_model:
        feats = c.get(f"{API}/api/models/{wdbc_model['id']}").json()["features"]
        # real feature value from the first dataset row
        row = c.get(f"{API}/api/datasets/{wdbc_model['dataset_id']}/preview", params={"limit": 1}).json()["rows"][0]
        values = {f: row[f] for f in feats if f in row}
        pred = c.post(f"{API}/api/models/{wdbc_model['id']}/predict", json={"values": values})
        ok = pred.status_code == 200 and "prediction" in pred.json()
        check("model prediction", ok, f"pred={pred.json().get('prediction') if ok else pred.text[:120]}")
        proba = pred.json().get("probabilities", {})
        check("prediction probabilities", len(proba) == 2, f"classes={list(proba)}")

    # ---- model delete endpoint exists (create+delete a throwaway train run is slow,
    #      so verify route presence via 404 on unknown id instead of 405)
    r = c.delete(f"{API}/api/models/nonexistent123")
    check("delete model route", r.status_code == 404, f"status={r.status_code}")

    # ---- IoT replay end-to-end on Household Power
    cols = ["Global_active_power", "Global_reactive_power", "Voltage"]
    start = c.post(f"{API}/api/iot/replay/start", json={
        "dataset_id": power["id"], "columns": cols, "speed": 50.0})
    check("replay start", start.status_code == 200, f"total={start.json().get('total') if start.status_code == 200 else start.text[:150]}")
    if start.status_code == 200:
        sid = start.json()["session_id"]
        poll1 = c.get(f"{API}/api/iot/replay/poll", params={"session_id": sid, "since": 0}).json()
        time.sleep(2.5)
        poll2 = c.get(f"{API}/api/iot/replay/poll", params={"session_id": sid, "since": 0}).json()
        n1 = poll1.get("events") and len(poll1["events"]) or poll1.get("position", 0)
        n2 = poll2.get("events") and len(poll2["events"]) or poll2.get("position", 0)
        check("replay advances", n2 > n1, f"{n1} -> {n2}")
        pau = c.post(f"{API}/api/iot/replay/pause", json={"session_id": sid}).json()
        check("replay pause", pau.get("status") == "paused", str(pau)[:80])
        res = c.post(f"{API}/api/iot/replay/resume", json={"session_id": sid}).json()
        check("replay resume", res.get("status") in ("running", "resumed"), str(res)[:80])
        spd = c.post(f"{API}/api/iot/replay/speed", json={"session_id": sid, "speed": 100}).json()
        check("replay speed", spd.get("speed") == 100, str(spd)[:80])
        stp = c.post(f"{API}/api/iot/replay/stop", json={"session_id": sid}).json()
        check("replay stop", stp.get("status") in ("stopped", "stopped_by_user", "idle"), str(stp)[:80])

    # ---- anomaly runs recorded
    anoms = c.get(f"{API}/api/datasets/{ai4i['id']}/anomalies").json()
    check("anomaly results exist", len(anoms.get("anomalies", [])) >= 1,
          f"n={len(anoms.get('anomalies', []))}")

    # ---- findings
    findings = c.get(f"{API}/api/decisions").json()["findings"]
    check("findings exist", len(findings) >= 5, f"n={len(findings)}")
    if findings:
        f0 = findings[0]
        check("finding has evidence+limits", bool(f0.get("evidence")) and bool(f0.get("limitations")),
              f"title={f0.get('title', '')[:60]}")

    # ---- report generation (JSON for speed) + PDF
    rep = c.post(f"{API}/api/reports/generate", json={"dataset_id": ai4i["id"], "format": "json"})
    check("report json", rep.status_code == 200, rep.json().get("filename", ""))
    rep_pdf = c.post(f"{API}/api/reports/generate", json={"dataset_id": ai4i["id"], "format": "pdf"})
    check("report pdf", rep_pdf.status_code == 200, rep_pdf.json().get("filename", ""))
    if rep.status_code == 200:
        dl = c.get(f"{API}{rep.json()['download_url']}")
        check("report download", dl.status_code == 200 and len(dl.content) > 500,
              f"{len(dl.content)} bytes")

    # ---- export endpoint
    exp = c.get(f"{API}/api/datasets/{ai4i['id']}/export/profile")
    check("dataset export", exp.status_code == 200 and len(exp.content) > 500,
          f"{len(exp.content)} bytes")

    # ---- upload validation: reject a bad extension
    files = {"file": ("evil.exe", b"MZ fake binary")}
    r = c.post(f"{API}/api/datasets/upload", files=files)
    check("upload rejects bad format", r.status_code == 400, f"status={r.status_code}")

    # ---- upload validation: empty CSV
    files = {"file": ("empty.csv", b"col1,col2\n")}
    r = c.post(f"{API}/api/datasets/upload", files=files)
    check("upload rejects empty data", r.status_code == 400, f"status={r.status_code}")

    print()
    if FAILS:
        print(f"RESULT: {len(FAILS)} FAILURES: {FAILS}")
        return 1
    print("RESULT: all checks passed")
    return 0


if __name__ == "__main__":
    sys.exit(main())

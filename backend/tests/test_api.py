"""DataSense AI backend test suite.

Runs against an isolated temporary SQLite database (the real database and
uploaded datasets are never touched). Model training uses a small synthetic
dataset so the suite stays fast.

Run:  .venv\\Scripts\\python.exe -m pytest backend/tests -v
"""
from __future__ import annotations

import io
import os
import sys
import time
import tempfile
from pathlib import Path

import pytest

BACKEND = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BACKEND))

# ---- isolate the database BEFORE importing the app -------------------------
import app.database as database  # noqa: E402

_tmpdir = tempfile.mkdtemp(prefix="datasense_test_")
database.DB_PATH = Path(_tmpdir) / "test_datasense.db"

from fastapi.testclient import TestClient  # noqa: E402
from app.main import app  # noqa: E402
from app.database import init_db  # noqa: E402

init_db()
client = TestClient(app)


# ---------------------------------------------------------------- fixtures
def _csv(rows: list[str]) -> io.BytesIO:
    return io.BytesIO(("col_a,col_b,col_c,label,ts\n" + "\n".join(rows)).encode())


LABELS = [0, 1] * 30

@pytest.fixture(scope="module")
def dataset_id():
    """Upload a small synthetic classification dataset."""
    rows = [
        f"{i * 0.37:.3f},{(i * 17) % 100 / 10:.2f},{'x' if i % 2 else 'y'},{LABELS[i]},2026-01-0{i % 9 + 1}T10:00:00"
        for i in range(60)
    ]
    r = client.post("/api/datasets/upload",
                    files={"file": ("synthetic.csv", _csv(rows))},
                    params={"name": "Synthetic Test Data", "source_url": "internal://test",
                            "provider": "pytest", "license": "MIT"})
    assert r.status_code == 200, r.text
    return r.json()["id"]


def wait_for_analysis(analysis_id: str, timeout: float = 120):
    deadline = time.time() + timeout
    while time.time() < deadline:
        a = client.get(f"/api/analysis/{analysis_id}").json()
        if a["status"] in ("completed", "failed"):
            return a
        time.sleep(0.5)
    raise TimeoutError("analysis did not finish")


# ---------------------------------------------------------------- system
def test_health():
    r = client.get("/api/health")
    assert r.status_code == 200
    assert r.json()["status"] == "ok"


def test_stats_shape():
    r = client.get("/api/stats")
    assert r.status_code == 200
    body = r.json()
    for key in ("datasets", "total_rows", "models", "findings_by_severity"):
        assert key in body


# ---------------------------------------------------------------- upload validation
def test_upload_rejects_unknown_format():
    r = client.post("/api/datasets/upload",
                    files={"file": ("payload.exe", b"MZ\x90\x00not-a-dataset")})
    assert r.status_code == 400


def test_upload_rejects_empty_dataset():
    r = client.post("/api/datasets/upload",
                    files={"file": ("empty.csv", io.BytesIO(b"a,b\n").read())})
    assert r.status_code == 400


def test_upload_rejects_garbage_csv():
    r = client.post("/api/datasets/upload",
                    files={"file": ("junk.csv", io.BytesIO(b"\xff\xfe\x00\x01binary".join([b"x"] * 10)))})
    assert r.status_code in (400, 500)  # must not crash the server


# ---------------------------------------------------------------- dataset intel
def test_dataset_profile(dataset_id):
    r = client.get(f"/api/datasets/{dataset_id}/profile")
    assert r.status_code == 200
    p = r.json()
    assert p["n_rows"] == 60 and p["n_cols"] == 5
    assert "col_a" in p["numeric_columns"]
    # the recommender may pick any low-cardinality column as a candidate target
    assert p["suggested_target"] in ("label", "col_c", None)


def test_dataset_quality(dataset_id):
    r = client.get(f"/api/datasets/{dataset_id}/quality")
    assert r.status_code == 200
    q = r.json()
    assert isinstance(q["score"], (int, float)) and 0 <= q["score"] <= 100


def test_preview_pagination(dataset_id):
    a = client.get(f"/api/datasets/{dataset_id}/preview", params={"limit": 10, "offset": 0}).json()
    b = client.get(f"/api/datasets/{dataset_id}/preview", params={"limit": 10, "offset": 10}).json()
    assert len(a["rows"]) == 10 and len(b["rows"]) == 10
    assert a["rows"][0] != b["rows"][0]
    assert a["total_rows"] == 60


def test_unknown_dataset_404():
    assert client.get("/api/datasets/does-not-exist").status_code == 404
    assert client.get("/api/datasets/does-not-exist/profile").status_code == 404


def test_analysis_suggestions(dataset_id):
    r = client.post(f"/api/datasets/{dataset_id}/analysis/suggest")
    assert r.status_code == 200
    recs = r.json()["recommendations"]
    assert isinstance(recs, list) and len(recs) >= 1
    assert {"task", "why"} <= set(recs[0].keys()) | {"reason", "rationale"}  # tolerant of key naming


# ---------------------------------------------------------------- supervised ML
def test_train_classification(dataset_id):
    r = client.post(f"/api/datasets/{dataset_id}/analysis/run", json={
        "task": "classification", "config": {
            "target": "label", "algorithm": "random_forest",
            "exclude_columns": ["ts"]}})
    assert r.status_code == 200
    result = wait_for_analysis(r.json()["analysis_id"])
    assert result["status"] == "completed", result.get("error")
    m = result["results"]["metrics"]
    assert "accuracy" in m and "confusion_matrix" in m
    assert result["results"]["train_rows"] + result["results"]["test_rows"] <= 60
    assert result["results"]["target"] == "label"
    assert result["model_id"]


def test_train_rejects_missing_target(dataset_id):
    r = client.post(f"/api/datasets/{dataset_id}/analysis/run", json={
        "task": "classification", "config": {"algorithm": "random_forest"}})
    assert r.status_code == 400


def test_train_rejects_unknown_algorithm(dataset_id):
    r = client.post(f"/api/datasets/{dataset_id}/analysis/run", json={
        "task": "classification", "config": {"target": "label", "algorithm": "quantum_net"}})
    assert r.status_code == 200
    result = wait_for_analysis(r.json()["analysis_id"])
    assert result["status"] == "failed"  # surfaced as a failed analysis, not a crash


def test_model_prediction(dataset_id):
    models = client.get("/api/models", params={"dataset_id": dataset_id}).json()["models"]
    assert models, "no model registered after training"
    model = models[0]
    feats = client.get(f"/api/models/{model['id']}").json()["features"]
    row = client.get(f"/api/datasets/{dataset_id}/preview", params={"limit": 1}).json()["rows"][0]
    values = {f: row[f] for f in feats if f in row}
    r = client.post(f"/api/models/{model['id']}/predict", json={"values": values})
    assert r.status_code == 200
    body = r.json()
    assert "prediction" in body and "probabilities" in body


def test_predict_requires_all_features(dataset_id):
    models = client.get("/api/models", params={"dataset_id": dataset_id}).json()["models"]
    r = client.post(f"/api/models/{models[0]['id']}/predict", json={"values": {}})
    assert r.status_code == 400


def test_model_delete(dataset_id):
    # train a throwaway model then delete it
    r = client.post(f"/api/datasets/{dataset_id}/analysis/run", json={
        "task": "classification", "config": {"target": "label", "algorithm": "decision_tree",
                                             "exclude_columns": ["ts"]}})
    result = wait_for_analysis(r.json()["analysis_id"])
    model_id = result["model_id"]
    artifact = Path(client.get(f"/api/models/{model_id}").json()["artifact_path"])
    assert artifact.exists()

    d = client.delete(f"/api/models/{model_id}")
    assert d.status_code == 200
    assert client.get(f"/api/models/{model_id}").status_code == 404
    assert not artifact.exists(), "artifact should be removed from disk"


# ---------------------------------------------------------------- unsupervised
def test_clustering(dataset_id):
    r = client.post(f"/api/datasets/{dataset_id}/analysis/run", json={
        "task": "clustering", "config": {"algorithm": "kmeans", "n_clusters": 2,
                                         "feature_columns": ["col_a", "col_b"]}})
    result = wait_for_analysis(r.json()["analysis_id"])
    assert result["status"] == "completed", result.get("error")
    m = result["results"]["metrics"]
    assert m["n_clusters_found"] == 2
    assert "cluster_sizes" in m


def test_anomaly_detection_with_labels(dataset_id):
    r = client.post(f"/api/datasets/{dataset_id}/analysis/run", json={
        "task": "anomaly", "config": {"contamination": 0.1, "label_column": "label",
                                      "feature_columns": ["col_a", "col_b"]}})
    result = wait_for_analysis(r.json()["analysis_id"])
    assert result["status"] == "completed", result.get("error")
    res = result["results"]
    assert res["n_flagged"] == int(res["rows_scored"] * 0.1) or res["n_flagged"] > 0
    assert res["n_flagged"] > 0
    anomalies = client.get(f"/api/datasets/{dataset_id}/anomalies").json()["anomalies"]
    assert len(anomalies) >= 1


# ---------------------------------------------------------------- replay
def test_replay_lifecycle(dataset_id):
    start = client.post("/api/iot/replay/start", json={
        "dataset_id": dataset_id, "columns": ["col_a", "col_b"], "speed": 20})
    assert start.status_code == 200
    sid = start.json()["session_id"]
    assert start.json()["total"] == 60

    time.sleep(1.2)
    poll1 = client.get("/api/iot/replay/poll", params={"session_id": sid}).json()
    time.sleep(1.0)
    poll2 = client.get("/api/iot/replay/poll", params={"session_id": sid}).json()
    pos1 = poll1.get("position", len(poll1.get("events") or []))
    pos2 = poll2.get("position", len(poll2.get("events") or []))
    assert pos2 >= pos1 and pos2 > 0, "replay must advance through real rows"

    assert client.post("/api/iot/replay/pause", json={"session_id": sid}).json()["status"] == "paused"
    assert client.post("/api/iot/replay/resume", json={"session_id": sid}).json()["status"] in ("running", "resumed")
    assert client.post("/api/iot/replay/speed", json={"session_id": sid, "speed": 5}).json()["speed"] == 5
    assert client.post("/api/iot/replay/stop", json={"session_id": sid}).json()["status"] == "stopped"


def test_replay_requires_existing_dataset():
    r = client.post("/api/iot/replay/start", json={"dataset_id": "missing"})
    assert r.status_code == 404


# ---------------------------------------------------------------- decisions & reports
def test_findings_have_evidence(dataset_id):
    findings = client.get("/api/decisions", params={"dataset_id": dataset_id}).json()["findings"]
    assert isinstance(findings, list)
    for f in findings:
        assert f["title"]
        assert f["evidence"] is not None
        assert f["limitations"] is not None


def test_report_generation_json(dataset_id):
    r = client.post("/api/reports/generate", json={"dataset_id": dataset_id, "format": "json"})
    assert r.status_code == 200
    dl = client.get(r.json()["download_url"])
    assert dl.status_code == 200 and len(dl.content) > 200


def test_report_generation_pdf(dataset_id):
    r = client.post("/api/reports/generate", json={"dataset_id": dataset_id, "format": "pdf"})
    assert r.status_code == 200
    dl = client.get(r.json()["download_url"])
    assert dl.status_code == 200
    assert dl.content[:4] == b"%PDF", "must be a real PDF file"


def test_report_requires_valid_dataset():
    r = client.post("/api/reports/generate", json={"dataset_id": "missing", "format": "pdf"})
    assert r.status_code == 404


# ---------------------------------------------------------------- exports & deletion
def test_dataset_export_csv(dataset_id):
    r = client.get(f"/api/datasets/{dataset_id}/export/csv")
    assert r.status_code == 200
    assert b"col_a" in r.content


def test_dataset_export_rejects_bad_kind(dataset_id):
    assert client.get(f"/api/datasets/{dataset_id}/export/virus").status_code == 400


def test_delete_dataset_cascades(dataset_id):
    # ensure the dataset has a finding + analysis first
    assert client.get(f"/api/datasets/{dataset_id}/profile").status_code == 200
    models_before = client.get("/api/models", params={"dataset_id": dataset_id}).json()["models"]
    assert models_before

    # record every on-disk artifact so we can prove the files are removed too
    from pathlib import Path
    from app.config import UPLOAD_DIR, dataset_processed_path
    artifact_files = [Path(m["artifact_path"]) for m in models_before if m.get("artifact_path")]
    assert artifact_files and all(p.exists() for p in artifact_files)
    processed = dataset_processed_path(dataset_id)
    assert processed.exists()
    uploads = list(UPLOAD_DIR.glob(f"{dataset_id}.*"))
    assert uploads

    # a generated report file must also be removed by the cascade
    gen = client.post("/api/reports/generate", json={"dataset_id": dataset_id, "format": "json"})
    assert gen.status_code == 200
    from app.config import REPORTS_DIR
    report_files = [p for p in REPORTS_DIR.glob(f"*report_*.json")
                    if p.name.endswith(gen.json()["filename"])]
    assert report_files and report_files[0].exists()

    r = client.delete(f"/api/datasets/{dataset_id}")
    assert r.status_code == 200
    assert client.get(f"/api/datasets/{dataset_id}").status_code == 404
    assert client.get("/api/models", params={"dataset_id": dataset_id}).json()["models"] == []
    assert client.get("/api/decisions", params={"dataset_id": dataset_id}).json()["findings"] == []

    # nothing may survive on disk
    assert not processed.exists()
    assert not any(p.exists() for p in artifact_files)
    assert list(UPLOAD_DIR.glob(f"{dataset_id}.*")) == []
    assert not report_files[0].exists()

"""Anomaly results API."""
from __future__ import annotations

from fastapi import APIRouter, HTTPException

from ..database import db, load_json, row_to_dict

router = APIRouter(prefix="/api", tags=["anomalies"])


@router.get("/datasets/{dataset_id}/anomalies")
def list_anomalies(dataset_id: str):
    with db() as conn:
        rows = conn.execute(
            "SELECT id, method, params_json, n_rows, n_flagged, contamination, "
            "results_json, created_at FROM anomalies WHERE dataset_id=? "
            "ORDER BY created_at DESC", (dataset_id,)).fetchall()
    out = []
    for r in rows:
        d = row_to_dict(r)
        d["results"] = load_json(d.pop("results_json"))
        d["params"] = load_json(d.pop("params_json"))
        out.append(d)
    return {"anomalies": out}


@router.get("/anomalies/{anomaly_id}")
def get_anomaly(anomaly_id: str):
    with db() as conn:
        row = conn.execute("SELECT * FROM anomalies WHERE id=?",
                           (anomaly_id,)).fetchone()
    if not row:
        raise HTTPException(404, "Anomaly run not found.")
    d = row_to_dict(row)
    d["results"] = load_json(d.pop("results_json"))
    return d

"""DataSense AI — FastAPI application entry point."""
from __future__ import annotations

import platform
import sys
from datetime import datetime, timezone

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .config import APP_NAME, APP_VERSION, DATA_DIR, DB_PATH, PROJECT_ROOT
from .database import db, init_db
from .api import anomalies, analysis, datasets, decisions, iot, models, reports

app = FastAPI(
    title=f"{APP_NAME} API",
    version=APP_VERSION,
    description=(
        "Universal AIoT data-intelligence API: dataset profiling, data quality, "
        "machine learning, anomaly detection, historical IoT replay, "
        "evidence-backed decision findings and report exports. "
        "All metrics are computed from real uploaded datasets."
    ),
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000",
                   "http://localhost:3001", "http://127.0.0.1:3001"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

for r in (datasets.router, analysis.router, models.router, anomalies.router,
          iot.router, decisions.router, reports.router):
    app.include_router(r)


@app.on_event("startup")
def startup():
    init_db()


@app.get("/api/health", tags=["system"])
def health():
    with db() as conn:
        n_datasets = conn.execute("SELECT COUNT(*) c FROM datasets").fetchone()["c"]
        n_models = conn.execute("SELECT COUNT(*) c FROM models").fetchone()["c"]
        n_findings = conn.execute("SELECT COUNT(*) c FROM findings").fetchone()["c"]
    return {
        "status": "ok",
        "app": APP_NAME,
        "version": APP_VERSION,
        "server_time": datetime.now(timezone.utc).isoformat(),
        "database": {"path": str(DB_PATH), "exists": DB_PATH.exists(),
                     "datasets": n_datasets, "models": n_models,
                     "findings": n_findings},
        "python": sys.version.split()[0],
        "platform": platform.platform(),
        "environment": {"project_root": str(PROJECT_ROOT),
                        "data_dir": str(DATA_DIR)},
    }


@app.get("/api/stats", tags=["system"])
def stats():
    """Aggregate real usage statistics for the dashboard (no fabrication)."""
    with db() as conn:
        ds = conn.execute(
            "SELECT COUNT(*) c, COALESCE(SUM(n_rows),0) r, "
            "COALESCE(SUM(size_bytes),0) s FROM datasets").fetchone()
        an = conn.execute(
            "SELECT status, COUNT(*) c FROM analyses GROUP BY status").fetchall()
        mo = conn.execute("SELECT COUNT(*) c FROM models").fetchone()
        fi = conn.execute(
            "SELECT severity, COUNT(*) c FROM findings GROUP BY severity").fetchall()
        rep = conn.execute("SELECT COUNT(*) c FROM reports").fetchone()
    return {
        "datasets": ds["c"], "total_rows": ds["r"], "total_bytes": ds["s"],
        "analyses_by_status": {r["status"]: r["c"] for r in an},
        "models": mo["c"], "reports": rep["c"],
        "findings_by_severity": {r["severity"]: r["c"] for r in fi},
    }

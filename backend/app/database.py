"""SQLite persistence layer (stdlib sqlite3, WAL mode)."""
import json
import sqlite3
import uuid
from contextlib import contextmanager
from typing import Any

from .config import DB_PATH

SCHEMA = """
CREATE TABLE IF NOT EXISTS datasets (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    original_filename TEXT NOT NULL,
    format TEXT NOT NULL,
    file_path TEXT NOT NULL,
    size_bytes INTEGER,
    checksum TEXT,
    n_rows INTEGER,
    n_cols INTEGER,
    has_timestamp INTEGER DEFAULT 0,
    timestamp_column TEXT,
    suggested_target TEXT,
    profile_json TEXT,
    quality_json TEXT,
    source_url TEXT,
    provider TEXT,
    download_date TEXT,
    license TEXT,
    notes TEXT,
    created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS analyses (
    id TEXT PRIMARY KEY,
    dataset_id TEXT NOT NULL,
    task_type TEXT NOT NULL,          -- classification | regression | clustering | anomaly | timeseries
    algorithm TEXT,
    target_column TEXT,
    config_json TEXT,
    status TEXT DEFAULT 'queued',     -- queued | running | completed | failed
    progress INTEGER DEFAULT 0,
    error TEXT,
    results_json TEXT,
    model_id TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    completed_at TEXT
);

CREATE TABLE IF NOT EXISTS models (
    id TEXT PRIMARY KEY,
    dataset_id TEXT NOT NULL,
    analysis_id TEXT,
    algorithm TEXT NOT NULL,
    task_type TEXT NOT NULL,
    target_column TEXT,
    feature_columns_json TEXT,
    preprocessing_json TEXT,
    metrics_json TEXT,
    artifact_path TEXT,
    train_rows INTEGER,
    test_rows INTEGER,
    created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS anomalies (
    id TEXT PRIMARY KEY,
    dataset_id TEXT NOT NULL,
    analysis_id TEXT,
    method TEXT NOT NULL,
    params_json TEXT,
    n_rows INTEGER,
    n_flagged INTEGER,
    contamination REAL,
    results_json TEXT,
    labels_path TEXT,
    created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS findings (
    id TEXT PRIMARY KEY,
    dataset_id TEXT NOT NULL,
    analysis_id TEXT,
    model_id TEXT,
    title TEXT NOT NULL,
    explanation TEXT,
    evidence_json TEXT,
    severity TEXT,                    -- info | low | medium | high
    recommendation TEXT,
    limitations TEXT,
    status TEXT DEFAULT 'open',       -- open | acknowledged | dismissed
    created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS reports (
    id TEXT PRIMARY KEY,
    dataset_id TEXT,
    report_type TEXT NOT NULL,
    format TEXT NOT NULL,
    file_path TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS replay_sessions (
    id TEXT PRIMARY KEY,
    dataset_id TEXT NOT NULL,
    timestamp_column TEXT,
    columns_json TEXT,
    speed REAL DEFAULT 1.0,
    status TEXT DEFAULT 'idle',       -- idle | running | paused | stopped | finished
    position INTEGER DEFAULT 0,
    total_rows INTEGER,
    inferences_json TEXT,
    created_at TEXT DEFAULT (datetime('now'))
);
"""


def get_conn() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH, timeout=30)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA foreign_keys=ON")
    return conn


@contextmanager
def db():
    conn = get_conn()
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def init_db() -> None:
    with get_conn() as conn:
        conn.executescript(SCHEMA)


def new_id() -> str:
    return uuid.uuid4().hex[:12]


def row_to_dict(row: sqlite3.Row) -> dict[str, Any]:
    return {k: row[k] for k in row.keys()}


def load_json(text: str | None, default: Any = None) -> Any:
    if not text:
        return default
    try:
        return json.loads(text)
    except (json.JSONDecodeError, TypeError):
        return default

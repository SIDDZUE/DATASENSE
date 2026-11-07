"""Dataset management API: upload, profile, preview, quality, export, delete."""
from __future__ import annotations

import json
import shutil
from datetime import datetime, timezone

import pandas as pd
from fastapi import APIRouter, File, HTTPException, Query, UploadFile

from ..config import (dataset_processed_path, dataset_upload_path,
                      EXPORTS_DIR, UPLOAD_DIR)
from ..database import db, load_json, new_id, row_to_dict
from ..services import ingestion, profiling
from ..services.decision_engine import generate_findings

router = APIRouter(prefix="/api/datasets", tags=["datasets"])


def _regenerate_findings(dataset_id: str, dataset_row, profile, quality):
    """Refresh the dataset-overview finding after (re)profiling."""
    with db() as conn:
        conn.execute("DELETE FROM findings WHERE dataset_id=? AND analysis_id IS NULL",
                     (dataset_id,))
        for f in generate_findings(profile=profile, quality=quality,
                                   analysis=None,
                                   dataset_name=dataset_row["name"]):
            conn.execute(
                "INSERT INTO findings (id, dataset_id, title, explanation, "
                "evidence_json, severity, recommendation, limitations) "
                "VALUES (?,?,?,?,?,?,?,?)",
                (new_id(), dataset_id, f["title"], f["explanation"],
                 json.dumps(f["evidence"]), f["severity"], f["recommendation"],
                 f["limitations"]))


@router.post("/upload")
async def upload_dataset(
    file: UploadFile = File(...),
    name: str = Query(None),
    source_url: str = Query(None),
    provider: str = Query(None),
    license: str = Query(None),
    notes: str = Query(None),
):
    dataset_id = new_id()
    dest = dataset_upload_path(dataset_id, file.filename or "dataset.csv")
    try:
        with open(dest, "wb") as f:
            shutil.copyfileobj(file.file, f)
    except Exception as e:
        raise HTTPException(500, f"Failed to store upload: {e}")

    try:
        fmt = ingestion.validate_upload(dest)
    except ingestion.IngestionError as e:
        dest.unlink(missing_ok=True)
        raise HTTPException(400, str(e))

    try:
        df = ingestion.read_tabular(dest, fmt)
    except ingestion.IngestionError as e:
        dest.unlink(missing_ok=True)
        raise HTTPException(400, str(e))

    if df.empty:
        dest.unlink(missing_ok=True)
        raise HTTPException(400, "Dataset contains no rows.")

    profile = profiling.build_profile(df)
    quality = profiling.build_quality(df, profile)

    # persist a processed parquet copy for fast later access
    try:
        processed = dataset_processed_path(dataset_id)
        df.to_parquet(processed, index=False)
        file_path = str(processed)
        effective_fmt = "parquet"
    except Exception:
        file_path = str(dest)
        effective_fmt = fmt

    checksum = ingestion.file_checksum(dest)
    ts_col = next((c for c in profile["datetime_columns"]), None)

    with db() as conn:
        conn.execute(
            "INSERT INTO datasets (id, name, original_filename, format, file_path, "
            "size_bytes, checksum, n_rows, n_cols, has_timestamp, timestamp_column, "
            "suggested_target, profile_json, quality_json, source_url, provider, "
            "download_date, license, notes) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
            (dataset_id, name or Path_name(file.filename), file.filename or "dataset",
             effective_fmt, file_path, dest.stat().st_size, checksum,
             profile["n_rows"], profile["n_cols"], int(bool(ts_col)), ts_col,
             profile.get("suggested_target"), _to_json(profile), _to_json(quality),
             source_url, provider, datetime.now(timezone.utc).date().isoformat(),
             license, notes))
    _regenerate_findings(dataset_id, {"name": name or file.filename}, profile, quality)

    return {"id": dataset_id, "name": name or file.filename,
            "n_rows": profile["n_rows"], "n_cols": profile["n_cols"],
            "message": "Dataset uploaded and profiled successfully."}


def Path_name(fn: str | None) -> str:
    return (fn or "Dataset").rsplit(".", 1)[0] or "Dataset"


def _to_json(obj) -> str:
    return json.dumps(obj, default=str)


@router.get("")
def list_datasets():
    with db() as conn:
        rows = conn.execute(
            "SELECT id, name, original_filename, format, n_rows, n_cols, "
            "has_timestamp, timestamp_column, suggested_target, size_bytes, "
            "source_url, provider, license, download_date, created_at "
            "FROM datasets ORDER BY created_at DESC").fetchall()
    return {"datasets": [row_to_dict(r) for r in rows]}


@router.get("/{dataset_id}")
def get_dataset(dataset_id: str):
    with db() as conn:
        row = conn.execute("SELECT * FROM datasets WHERE id=?",
                           (dataset_id,)).fetchone()
    if not row:
        raise HTTPException(404, "Dataset not found.")
    d = row_to_dict(row)
    d["profile"] = load_json(d.pop("profile_json"))
    d["quality"] = load_json(d.pop("quality_json"))
    return d


@router.get("/{dataset_id}/profile")
def get_profile(dataset_id: str):
    with db() as conn:
        row = conn.execute("SELECT profile_json FROM datasets WHERE id=?",
                           (dataset_id,)).fetchone()
    if not row:
        raise HTTPException(404, "Dataset not found.")
    return load_json(row["profile_json"], {})


@router.get("/{dataset_id}/quality")
def get_quality(dataset_id: str):
    with db() as conn:
        row = conn.execute("SELECT quality_json FROM datasets WHERE id=?",
                           (dataset_id,)).fetchone()
    if not row:
        raise HTTPException(404, "Dataset not found.")
    return load_json(row["quality_json"], {})


@router.get("/{dataset_id}/preview")
def preview(dataset_id: str, limit: int = Query(50, le=200),
            offset: int = Query(0, ge=0)):
    df = _load_df(dataset_id)
    sub = df.iloc[offset:offset + limit]
    return {"columns": [str(c) for c in df.columns],
            "total_rows": int(len(df)),
            "offset": offset, "rows": profiling.json_safe_records(sub)}


@router.post("/{dataset_id}/reprofile")
def reprofile(dataset_id: str):
    """Re-run profiling (e.g. after the user corrects interpretation)."""
    df = _load_df(dataset_id)
    profile = profiling.build_profile(df)
    quality = profiling.build_quality(df, profile)
    ts_col = next((c for c in profile["datetime_columns"]), None)
    with db() as conn:
        row = conn.execute("SELECT name FROM datasets WHERE id=?",
                           (dataset_id,)).fetchone()
        if not row:
            raise HTTPException(404, "Dataset not found.")
        conn.execute(
            "UPDATE datasets SET profile_json=?, quality_json=?, n_rows=?, "
            "n_cols=?, has_timestamp=?, timestamp_column=?, suggested_target=? "
            "WHERE id=?",
            (_to_json(profile), _to_json(quality), profile["n_rows"],
             profile["n_cols"], int(bool(ts_col)), ts_col,
             profile.get("suggested_target"), dataset_id))
    _regenerate_findings(dataset_id, row, profile, quality)
    return {"status": "ok", "suggested_target": profile.get("suggested_target")}


@router.post("/{dataset_id}/preprocess")
def preprocess(dataset_id: str, config: dict):
    """Apply documented, reversible preprocessing to produce a NEW processed copy.

    The original raw file is never modified. Operations and their effects are
    returned for user inspection.
    """
    df = _load_df(dataset_id)
    ops = config.get("operations", [])
    applied = []
    try:
        for op in ops:
            kind = op.get("type")
            if kind == "drop_columns":
                cols = [c for c in op.get("columns", []) if c in df.columns]
                df = df.drop(columns=cols)
                applied.append(f"Dropped columns: {', '.join(cols)}")
            elif kind == "drop_duplicates":
                before = len(df)
                df = df.drop_duplicates()
                applied.append(f"Removed {before - len(df)} duplicate rows")
            elif kind == "fill_missing_numeric":
                cols = [c for c in df.columns if pd.api.types.is_numeric_dtype(df[c])]
                strategy = op.get("strategy", "median")
                if strategy == "median":
                    df[cols] = df[cols].fillna(df[cols].median())
                elif strategy == "mean":
                    df[cols] = df[cols].fillna(df[cols].mean())
                else:
                    df[cols] = df[cols].fillna(0)
                applied.append(f"Filled missing numeric values ({strategy}) in "
                               f"{len(cols)} columns")
            elif kind == "drop_missing_rows":
                subset = op.get("columns") or None
                before = len(df)
                df = df.dropna(subset=subset)
                applied.append(f"Dropped {before - len(df)} rows with missing values")
            elif kind == "rename_column":
                old, new = op.get("from"), op.get("to")
                if old in df.columns and new:
                    df = df.rename(columns={old: new})
                    applied.append(f"Renamed '{old}' → '{new}'")
            elif kind == "datetime_parse":
                col = op.get("column")
                if col in df.columns:
                    df[col] = pd.to_datetime(df[col], errors="coerce", format="mixed")
                    applied.append(f"Parsed '{col}' as datetime")
            else:
                raise HTTPException(400, f"Unknown preprocessing operation '{kind}'")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(500, f"Preprocessing failed: {e}")

    processed = dataset_processed_path(dataset_id)
    df.to_parquet(processed, index=False)
    profile = profiling.build_profile(df)
    quality = profiling.build_quality(df, profile)
    ts_col = next((c for c in profile["datetime_columns"]), None)
    with db() as conn:
        row = conn.execute("SELECT name FROM datasets WHERE id=?",
                           (dataset_id,)).fetchone()
        conn.execute(
            "UPDATE datasets SET file_path=?, format='parquet', profile_json=?, "
            "quality_json=?, n_rows=?, n_cols=?, has_timestamp=?, timestamp_column=?, "
            "suggested_target=?, notes=COALESCE(notes,'') || ? WHERE id=?",
            (str(processed), _to_json(profile), _to_json(quality),
             profile["n_rows"], profile["n_cols"], int(bool(ts_col)), ts_col,
             profile.get("suggested_target"),
             f"\n[Preprocessed {datetime.now(timezone.utc).isoformat()}]: "
             + "; ".join(applied), dataset_id))
    _regenerate_findings(dataset_id, row, profile, quality)
    return {"status": "ok", "operations_applied": applied,
            "n_rows": profile["n_rows"], "n_cols": profile["n_cols"]}


@router.get("/{dataset_id}/export/{kind}")
def export_dataset(dataset_id: str, kind: str):
    df = _load_df(dataset_id)
    with db() as conn:
        row = conn.execute("SELECT name FROM datasets WHERE id=?",
                           (dataset_id,)).fetchone()
    safe_name = (row["name"] or dataset_id).replace(" ", "_")[:40]
    if kind == "csv":
        out = EXPORTS_DIR / f"{safe_name}_export.csv"
        df.to_csv(out, index=False)
    elif kind == "xlsx":
        out = EXPORTS_DIR / f"{safe_name}_export.xlsx"
        df.to_excel(out, index=False)
    elif kind == "profile":
        out = EXPORTS_DIR / f"{safe_name}_profile.json"
        out.write_text(_to_json(load_json_query(dataset_id)), encoding="utf-8")
    elif kind == "quality":
        out = EXPORTS_DIR / f"{safe_name}_quality.json"
        out.write_text(_to_json(load_json_query(dataset_id, field="quality_json")),
                       encoding="utf-8")
    else:
        raise HTTPException(400, "kind must be csv|xlsx|profile|quality")
    from fastapi.responses import FileResponse
    return FileResponse(out, filename=out.name)


def load_json_query(dataset_id: str, field: str = "profile_json"):
    with db() as conn:
        row = conn.execute(f"SELECT {field} FROM datasets WHERE id=?",
                           (dataset_id,)).fetchone()
    return load_json(row[field] if row else None, {})


@router.delete("/{dataset_id}")
def delete_dataset(dataset_id: str):
    with db() as conn:
        row = conn.execute("SELECT file_path FROM datasets WHERE id=?",
                           (dataset_id,)).fetchone()
        if not row:
            raise HTTPException(404, "Dataset not found.")
        # collect every on-disk path that belongs to this dataset, then delete rows
        artifact_paths = [r["artifact_path"] for r in conn.execute(
            "SELECT artifact_path FROM models WHERE dataset_id=? AND artifact_path "
            "IS NOT NULL", (dataset_id,)).fetchall()]
        report_paths = [r["file_path"] for r in conn.execute(
            "SELECT file_path FROM reports WHERE dataset_id=? AND file_path "
            "IS NOT NULL", (dataset_id,)).fetchall()]
        label_paths = [r["labels_path"] for r in conn.execute(
            "SELECT labels_path FROM anomalies WHERE dataset_id=? AND labels_path "
            "IS NOT NULL", (dataset_id,)).fetchall()]
        conn.execute("DELETE FROM models WHERE dataset_id=?", (dataset_id,))
        conn.execute("DELETE FROM datasets WHERE id=?", (dataset_id,))
        conn.execute("DELETE FROM findings WHERE dataset_id=?", (dataset_id,))
        conn.execute("DELETE FROM analyses WHERE dataset_id=?", (dataset_id,))
        conn.execute("DELETE FROM anomalies WHERE dataset_id=?", (dataset_id,))
        conn.execute("DELETE FROM replay_sessions WHERE dataset_id=?", (dataset_id,))
        # reports table may not carry a dataset column in old schemas
        try:
            conn.execute("DELETE FROM reports WHERE dataset_id=?", (dataset_id,))
        except Exception:
            pass

    from pathlib import Path
    from ..config import dataset_processed_path

    # processed parquet, every stored upload variant, model artifacts,
    # anomaly label files and generated report files
    dataset_processed_path(dataset_id).unlink(missing_ok=True)
    for p in artifact_paths + report_paths + label_paths:
        Path(p).unlink(missing_ok=True)
    for ext in (".csv", ".json", ".parquet", ".xlsx", ".xls"):
        (UPLOAD_DIR / f"{dataset_id}{ext}").unlink(missing_ok=True)
    return {"status": "deleted", "id": dataset_id}


def _load_df(dataset_id: str) -> pd.DataFrame:
    with db() as conn:
        row = conn.execute("SELECT file_path, format FROM datasets WHERE id=?",
                           (dataset_id,)).fetchone()
    if not row:
        raise HTTPException(404, "Dataset not found.")
    from pathlib import Path
    try:
        return ingestion.read_tabular(Path(row["file_path"]), row["format"])
    except ingestion.IngestionError as e:
        raise HTTPException(400, str(e))

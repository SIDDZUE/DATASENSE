"""IoT historical replay API.

Replay endpoints operate on genuine timestamped datasets. The UI must label
this clearly as a simulated stream from historical records.
"""
from __future__ import annotations

from fastapi import APIRouter, HTTPException

from ..database import db, new_id, row_to_dict
from ..services.replay import replay_manager

router = APIRouter(prefix="/api/iot", tags=["iot"])


@router.post("/replay/start")
def start_replay(body: dict):
    dataset_id = body.get("dataset_id")
    if not dataset_id:
        raise HTTPException(400, "dataset_id is required.")
    with db() as conn:
        ds = conn.execute("SELECT id, timestamp_column FROM datasets WHERE id=?",
                          (dataset_id,)).fetchone()
    if not ds:
        raise HTTPException(404, "Dataset not found.")
    session_id = body.get("session_id") or new_id()
    try:
        info = replay_manager.start(
            session_id, dataset_id,
            timestamp_column=body.get("timestamp_column") or ds["timestamp_column"],
            columns=body.get("columns") or [],
            speed=float(body.get("speed", 5.0)),
            model_id=body.get("model_id"))
    except ValueError as e:
        raise HTTPException(400, str(e))
    with db() as conn:
        conn.execute(
            "INSERT OR REPLACE INTO replay_sessions (id, dataset_id, timestamp_column, "
            "columns_json, speed, status, position, total_rows) "
            "VALUES (?,?,?,?,?,?,?,?)",
            (session_id, dataset_id, info.get("columns") and ds["timestamp_column"],
             str(info["columns"]), float(body.get("speed", 5.0)), "running", 0,
             info["total"]))
    return info


@router.post("/replay/pause")
def pause_replay(body: dict):
    try:
        return replay_manager.pause(body.get("session_id", ""))
    except ValueError as e:
        raise HTTPException(404, str(e))


@router.post("/replay/resume")
def resume_replay(body: dict):
    try:
        return replay_manager.resume(body.get("session_id", ""))
    except ValueError as e:
        raise HTTPException(404, str(e))


@router.post("/replay/stop")
def stop_replay(body: dict):
    return replay_manager.stop(body.get("session_id", ""))


@router.post("/replay/speed")
def set_speed(body: dict):
    try:
        return replay_manager.set_speed(body.get("session_id", ""),
                                        float(body.get("speed", 5.0)))
    except ValueError as e:
        raise HTTPException(404, str(e))


@router.get("/replay/poll")
def poll_replay(session_id: str, since: int = 0):
    try:
        return replay_manager.poll(session_id, since)
    except ValueError as e:
        raise HTTPException(404, str(e))


@router.get("/replay/sessions")
def list_sessions():
    with db() as conn:
        rows = conn.execute(
            "SELECT id, dataset_id, timestamp_column, speed, status, position, "
            "total_rows, created_at FROM replay_sessions ORDER BY created_at DESC"
        ).fetchall()
    return {"sessions": [row_to_dict(r) for r in rows]}

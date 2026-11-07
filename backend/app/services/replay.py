"""Historical-data replay: simulates an IoT stream from a genuine timestamped
dataset. No random readings are ever produced — rows are replayed in timestamp
order at adjustable speed, with optional live inference through a trained
model artifact.

Label shown in the UI: "Historical dataset replay — simulated IoT stream."
"""
from __future__ import annotations

import asyncio
import json
import threading
import time
from datetime import datetime, timezone

import pandas as pd

from ..database import db, load_json
from ..config import dataset_upload_path
from .ingestion import read_tabular


class ReplayManager:
    """Manages one active replay session (start/pause/resume/stop)."""

    def __init__(self):
        self._lock = threading.Lock()
        self._sessions: dict[str, dict] = {}

    # -------------------------------------------------- control
    def start(self, session_id: str, dataset_id: str, timestamp_column: str | None,
              columns: list[str], speed: float, model_id: str | None) -> dict:
        with self._lock:
            if session_id in self._sessions and self._sessions[session_id]["thread"].is_alive():
                raise ValueError("Replay already running for this session.")
            fmt = "csv"
            path = None
            with db() as conn:
                row = conn.execute(
                    "SELECT file_path, format FROM datasets WHERE id=?",
                    (dataset_id,)).fetchone()
            if not row:
                raise ValueError(f"Dataset {dataset_id} not found.")
            path = row["file_path"]
            fmt = row["format"]
            df = read_tabular(_resolve(path), fmt)
            if timestamp_column and timestamp_column in df.columns:
                ts = pd.to_datetime(df[timestamp_column], errors="coerce", format="mixed")
                order = ts.sort_values(na_position="last").index
                df = df.loc[order].reset_index(drop=True)
            cols = [c for c in columns if c in df.columns] or list(df.columns)[:8]
            df = df[cols + ([timestamp_column] if timestamp_column and timestamp_column not in cols else [])]

            payload = {"model": None}
            if model_id:
                with db() as conn:
                    m = conn.execute(
                        "SELECT artifact_path FROM models WHERE id=?",
                        (model_id,)).fetchone()
                if m and m["artifact_path"]:
                    import joblib
                    payload["model"] = joblib.load(m["artifact_path"])
                    with db() as conn:
                        mm = conn.execute(
                            "SELECT feature_columns_json, target_column FROM models WHERE id=?",
                            (model_id,)).fetchone()
                    payload["features"] = load_json(mm["feature_columns_json"], [])
                    payload["target"] = mm["target_column"]

            state = {
                "dataset_id": dataset_id, "df": df, "cols": cols,
                "timestamp_column": timestamp_column, "speed": max(0.1, speed),
                "status": "running", "position": 0, "total": int(len(df)),
                "thread": None, "stop_event": threading.Event(),
                "pause_event": threading.Event(),
                "inferences": [], "model": payload["model"],
                "features": payload.get("features"), "target": payload.get("target"),
                "queue": asyncio.queues.Queue() if False else None,  # set by caller
            }
            self._sessions[session_id] = state
            t = threading.Thread(target=self._run, args=(session_id,), daemon=True)
            state["thread"] = t
            t.start()
            return {"session_id": session_id, "status": "running",
                    "total": state["total"], "columns": cols}

    def _run(self, session_id: str) -> None:
        state = self._sessions.get(session_id)
        if not state:
            return
        df, cols = state["df"], state["cols"]
        model, features = state["model"], state["features"]
        for i in range(state["position"], len(df)):
            if state["stop_event"].is_set():
                state["status"] = "stopped"
                break
            while state["pause_event"].is_set():
                if state["stop_event"].is_set():
                    state["status"] = "stopped"
                    return
                time.sleep(0.1)
            # re-read speed every row so live speed changes take effect
            base_delay = 0.5 / max(0.1, state["speed"])
            row = df.iloc[i]
            record = {c: (None if pd.isna(row[c]) else
                          (float(row[c]) if isinstance(row[c], (int, float)) and not isinstance(row[c], bool)
                           else str(row[c]))) for c in cols}
            entry = {"position": i, "timestamp": (
                str(row[state["timestamp_column"]])
                if state["timestamp_column"] and not pd.isna(row[state["timestamp_column"]])
                else datetime.now(timezone.utc).isoformat()),
                "record": record}
            if model is not None and features:
                try:
                    X = pd.DataFrame([{f: row.get(f) for f in features}])
                    pred = model.predict(X)[0]
                    entry["prediction"] = pred.item() if hasattr(pred, "item") else str(pred)
                    if hasattr(model, "predict_proba"):
                        proba = model.predict_proba(X)[0]
                        entry["probabilities"] = {str(c): round(float(p), 4)
                                                  for c, p in zip(model.classes_, proba)}
                except Exception as e:
                    entry["prediction_error"] = str(e)[:120]
            state["position"] = i + 1
            state["inferences"].append(entry)
            if len(state["inferences"]) > 500:
                state["inferences"] = state["inferences"][-500:]
            state["last_entry"] = entry
            time.sleep(base_delay)
        else:
            state["status"] = "finished"
        # persist final state
        with db() as conn:
            conn.execute(
                "UPDATE replay_sessions SET status=?, position=? WHERE id=?",
                (state["status"], state["position"], session_id))

    def pause(self, session_id: str) -> dict:
        state = self._sessions.get(session_id)
        if not state:
            raise ValueError("No active replay session.")
        state["pause_event"].set()
        state["status"] = "paused"
        return {"session_id": session_id, "status": "paused",
                "position": state["position"]}

    def resume(self, session_id: str) -> dict:
        state = self._sessions.get(session_id)
        if not state:
            raise ValueError("No active replay session.")
        state["pause_event"].clear()
        state["status"] = "running"
        return {"session_id": session_id, "status": "running",
                "position": state["position"]}

    def stop(self, session_id: str) -> dict:
        state = self._sessions.get(session_id)
        if not state:
            return {"session_id": session_id, "status": "idle"}
        state["stop_event"].set()
        state["pause_event"].clear()
        state["thread"].join(timeout=3)
        # report the user-visible state synchronously: the loop honours
        # stop_event at its next check, so no further rows will be emitted
        if state["status"] not in ("finished",):
            state["status"] = "stopped"
        with db() as conn:
            conn.execute(
                "UPDATE replay_sessions SET status=?, position=? WHERE id=?",
                (state["status"], state["position"], session_id))
        return {"session_id": session_id, "status": state["status"],
                "position": state["position"]}

    def set_speed(self, session_id: str, speed: float) -> dict:
        state = self._sessions.get(session_id)
        if not state:
            raise ValueError("No active replay session.")
        state["speed"] = max(0.1, speed)
        return {"session_id": session_id, "speed": state["speed"]}

    def poll(self, session_id: str, since: int) -> dict:
        """Fetch entries after index `since` plus current status."""
        state = self._sessions.get(session_id)
        if not state:
            raise ValueError("No active replay session.")
        entries = [e for e in state["inferences"] if e["position"] >= since]
        return {
            "session_id": session_id, "status": state["status"],
            "position": state["position"], "total": state["total"],
            "entries": entries[-100:],
        }


def _resolve(path: str) -> "Path":
    from pathlib import Path
    return Path(path)


replay_manager = ReplayManager()

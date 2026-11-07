"""Model registry API: list models, inspect, predict, download artifacts."""
from __future__ import annotations

from pathlib import Path

import joblib
import pandas as pd
from fastapi import APIRouter, HTTPException

from ..database import db, load_json, row_to_dict

router = APIRouter(prefix="/api/models", tags=["models"])


@router.get("")
def list_models(dataset_id: str | None = None):
    q = ("SELECT m.id, m.dataset_id, m.analysis_id, m.algorithm, m.task_type, "
         "m.target_column, m.artifact_path, m.train_rows, m.test_rows, "
         "m.metrics_json, m.created_at, d.name AS dataset_name, "
         "CASE WHEN d.id IS NULL THEN 1 ELSE 0 END AS dataset_missing "
         "FROM models m LEFT JOIN datasets d ON d.id = m.dataset_id")
    args: list = []
    if dataset_id:
        q += " WHERE m.dataset_id=?"
        args.append(dataset_id)
    q += " ORDER BY m.created_at DESC"
    with db() as conn:
        rows = conn.execute(q, args).fetchall()
    out = []
    for r in rows:
        d = row_to_dict(r)
        d["metrics"] = load_json(d.pop("metrics_json"))
        out.append(d)
    return {"models": out}


@router.get("/{model_id}")
def get_model(model_id: str):
    with db() as conn:
        row = conn.execute("SELECT * FROM models WHERE id=?", (model_id,)).fetchone()
    if not row:
        raise HTTPException(404, "Model not found.")
    d = row_to_dict(row)
    d["metrics"] = load_json(d.pop("metrics_json"))
    d["features"] = load_json(d.pop("feature_columns_json"))
    d["preprocessing"] = load_json(d.pop("preprocessing_json"))
    return d


@router.post("/{model_id}/predict")
def predict(model_id: str, body: dict):
    """Predict on user-supplied feature values (only real model output)."""
    with db() as conn:
        row = conn.execute(
            "SELECT artifact_path, feature_columns_json, target_column "
            "FROM models WHERE id=?", (model_id,)).fetchone()
    if not row:
        raise HTTPException(404, "Model not found.")
    if not row["artifact_path"] or not Path(row["artifact_path"]).exists():
        raise HTTPException(400, "Model artifact missing on disk.")
    features = load_json(row["feature_columns_json"], [])
    values = body.get("values") or {}
    missing = [f for f in features if f not in values]
    if missing:
        raise HTTPException(400, f"Missing feature values: {', '.join(missing[:5])}")
    try:
        pipeline = joblib.load(row["artifact_path"])
        X = pd.DataFrame([{f: values[f] for f in features}])
        pred = pipeline.predict(X)[0]
        out = {"prediction": pred.item() if hasattr(pred, "item") else str(pred),
               "target_column": row["target_column"]}
        if hasattr(pipeline, "predict_proba"):
            proba = pipeline.predict_proba(X)[0]
            out["probabilities"] = {str(c): round(float(p), 4)
                                    for c, p in zip(pipeline.classes_, proba)}
        return out
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(400, f"Prediction failed: {e}")


@router.get("/{model_id}/download")
def download_model(model_id: str):
    with db() as conn:
        row = conn.execute("SELECT artifact_path, algorithm FROM models WHERE id=?",
                           (model_id,)).fetchone()
    if not row or not row["artifact_path"] or not Path(row["artifact_path"]).exists():
        raise HTTPException(404, "Artifact not found.")
    from fastapi.responses import FileResponse
    p = Path(row["artifact_path"])
    return FileResponse(p, filename=f"datasense_{row['algorithm']}_{model_id}.joblib")


@router.get("/{model_id}/metadata")
def download_metadata(model_id: str):
    """Downloaded alongside the artifact to satisfy artifact metadata rules."""
    import json
    with db() as conn:
        row = conn.execute("SELECT * FROM models WHERE id=?", (model_id,)).fetchone()
    if not row:
        raise HTTPException(404, "Model not found.")
    d = row_to_dict(row)
    d["metrics"] = load_json(d.pop("metrics_json"))
    d["feature_columns"] = load_json(d.pop("feature_columns_json"))
    d["preprocessing"] = load_json(d.pop("preprocessing_json"))
    from ..config import EXPORTS_DIR
    out = EXPORTS_DIR / f"model_{model_id}_metadata.json"
    out.write_text(json.dumps(d, indent=2, default=str), encoding="utf-8")
    from fastapi.responses import FileResponse
    return FileResponse(out, filename=out.name)


@router.delete("/{model_id}")
def delete_model(model_id: str):
    """Remove a model record and its artifact from disk."""
    with db() as conn:
        row = conn.execute(
            "SELECT artifact_path FROM models WHERE id=?", (model_id,)).fetchone()
        if not row:
            raise HTTPException(404, "Model not found.")
        conn.execute("UPDATE analyses SET model_id=NULL WHERE model_id=?", (model_id,))
        conn.execute("DELETE FROM findings WHERE model_id=?", (model_id,))
        conn.execute("DELETE FROM models WHERE id=?", (model_id,))
    if row["artifact_path"]:
        Path(row["artifact_path"]).unlink(missing_ok=True)
    return {"status": "deleted", "id": model_id}

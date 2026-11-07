"""Decision Centre API: findings, evidence, status updates, export."""
from __future__ import annotations

from fastapi import APIRouter, HTTPException

from ..database import db, load_json, row_to_dict

router = APIRouter(prefix="/api/decisions", tags=["decisions"])


@router.get("")
def list_findings(dataset_id: str | None = None, severity: str | None = None,
                  status: str | None = None):
    q = "SELECT * FROM findings"
    where, args = [], []
    if dataset_id:
        where.append("dataset_id=?")
        args.append(dataset_id)
    if severity:
        where.append("severity=?")
        args.append(severity)
    if status:
        where.append("status=?")
        args.append(status)
    if where:
        q += " WHERE " + " AND ".join(where)
    q += " ORDER BY CASE severity WHEN 'high' THEN 0 WHEN 'medium' THEN 1 WHEN 'low' THEN 2 ELSE 3 END, created_at DESC"
    with db() as conn:
        rows = conn.execute(q, args).fetchall()
    out = []
    for r in rows:
        d = row_to_dict(r)
        d["evidence"] = load_json(d.pop("evidence_json"), {})
        out.append(d)
    return {"findings": out}


@router.patch("/{finding_id}")
def update_finding(finding_id: str, body: dict):
    status = body.get("status")
    if status not in ("open", "acknowledged", "dismissed"):
        raise HTTPException(400, "status must be open|acknowledged|dismissed")
    with db() as conn:
        row = conn.execute("SELECT id FROM findings WHERE id=?",
                           (finding_id,)).fetchone()
        if not row:
            raise HTTPException(404, "Finding not found.")
        conn.execute("UPDATE findings SET status=? WHERE id=?", (status, finding_id))
    return {"id": finding_id, "status": status}

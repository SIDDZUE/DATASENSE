"""Report generation API: PDF / CSV / JSON with download history."""
from __future__ import annotations

from datetime import datetime, timezone
from pathlib import Path

from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse

from ..config import REPORTS_DIR
from ..database import db, load_json, new_id, row_to_dict
from ..services.reporting import generate_pdf_report

router = APIRouter(prefix="/api/reports", tags=["reports"])


@router.post("/generate")
def generate_report(body: dict):
    dataset_id = body.get("dataset_id")
    fmt = body.get("format", "pdf")
    if not dataset_id:
        raise HTTPException(400, "dataset_id is required.")
    if fmt not in ("pdf", "json"):
        raise HTTPException(400, "format must be pdf|json")

    with db() as conn:
        ds_row = conn.execute("SELECT * FROM datasets WHERE id=?",
                              (dataset_id,)).fetchone()
        if not ds_row:
            raise HTTPException(404, "Dataset not found.")
        analyses = conn.execute(
            "SELECT results_json FROM analyses WHERE dataset_id=? AND status='completed' "
            "ORDER BY created_at DESC", (dataset_id,)).fetchall()
        finding_rows = conn.execute(
            "SELECT title, explanation, evidence_json, severity, recommendation, "
            "limitations FROM findings WHERE dataset_id=? ORDER BY created_at DESC",
            (dataset_id,)).fetchall()

    dataset = row_to_dict(ds_row)
    profile = load_json(dataset.pop("profile_json"))
    quality = load_json(dataset.pop("quality_json"))
    analyses_list = [parsed for a in analyses if a["results_json"]
                     for parsed in [load_json(a["results_json"])]
                     if isinstance(parsed, dict)]
    findings = []
    for f in finding_rows:
        d = row_to_dict(f)
        d["evidence"] = load_json(d.pop("evidence_json"), {})
        findings.append(d)

    safe = (dataset["name"] or dataset_id).replace(" ", "_")[:40]
    stamp = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
    report_id = new_id()

    if fmt == "pdf":
        out = REPORTS_DIR / f"{safe}_report_{stamp}.pdf"
        generate_pdf_report(dataset=dataset, profile=profile, quality=quality,
                            analyses=analyses_list, findings=findings, out_path=out)
    else:
        import json
        out = REPORTS_DIR / f"{safe}_report_{stamp}.json"
        out.write_text(json.dumps({
            "dataset": {k: dataset.get(k) for k in
                        ("id", "name", "original_filename", "format", "n_rows",
                         "n_cols", "source_url", "provider", "license",
                         "download_date", "checksum")},
            "profile": profile, "quality": quality,
            "analyses": analyses_list, "findings": findings,
            "generated_at": datetime.now(timezone.utc).isoformat(),
        }, indent=2, default=str), encoding="utf-8")

    with db() as conn:
        conn.execute(
            "INSERT INTO reports (id, dataset_id, report_type, format, file_path) "
            "VALUES (?,?,?,?,?)",
            (report_id, dataset_id, "analysis_report", fmt, str(out)))
    return {"report_id": report_id, "filename": out.name,
            "download_url": f"/api/reports/{report_id}/download"}


@router.get("")
def list_reports(dataset_id: str | None = None):
    q = ("SELECT r.*, d.name AS dataset_name FROM reports r "
         "LEFT JOIN datasets d ON r.dataset_id = d.id")
    args: list = []
    if dataset_id:
        q += " WHERE r.dataset_id=?"
        args.append(dataset_id)
    q += " ORDER BY r.created_at DESC"
    with db() as conn:
        rows = conn.execute(q, args).fetchall()
    out = []
    for r in rows:
        item = row_to_dict(r)
        path = Path(item.get("file_path") or "")
        item["size_bytes"] = path.stat().st_size if path.is_file() else None
        item["exists"] = path.is_file()
        out.append(item)
    return {"reports": out}


@router.get("/{report_id}/download")
def download_report(report_id: str):
    with db() as conn:
        row = conn.execute("SELECT file_path FROM reports WHERE id=?",
                           (report_id,)).fetchone()
    if not row:
        raise HTTPException(404, "Report not found.")
    p = Path(row["file_path"])
    if not p.exists():
        raise HTTPException(404, "Report file missing on disk.")
    return FileResponse(p, filename=p.name)

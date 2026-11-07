"""Report generation: PDF (reportlab), CSV, JSON exports.

Reports contain only values computed from actual datasets/analyses.
"""
from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path

import pandas as pd
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import cm
from reportlab.platypus import (Paragraph, SimpleDocTemplate, Spacer, Table,
                                TableStyle)

from ..config import EXPORTS_DIR, REPORTS_DIR, APP_NAME, APP_VERSION


def _styles():
    ss = getSampleStyleSheet()
    ss.add(ParagraphStyle("H1X", parent=ss["Title"], fontSize=20,
                          textColor=colors.HexColor("#0f172a"), spaceAfter=4))
    ss.add(ParagraphStyle("H2X", parent=ss["Heading2"], fontSize=13,
                          textColor=colors.HexColor("#1e293b"),
                          spaceBefore=12, spaceAfter=4))
    ss.add(ParagraphStyle("Meta", parent=ss["Normal"], fontSize=9,
                          textColor=colors.HexColor("#64748b")))
    ss.add(ParagraphStyle("Body", parent=ss["Normal"], fontSize=10, leading=14))
    ss.add(ParagraphStyle("Small", parent=ss["Normal"], fontSize=8.5,
                          textColor=colors.HexColor("#475569")))
    return ss


def _table(data: list[list[str]], widths=None) -> Table:
    t = Table(data, colWidths=widths, hAlign="LEFT")
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#0f172a")),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTSIZE", (0, 0), (-1, -1), 8.5),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1),
         [colors.white, colors.HexColor("#f1f5f9")]),
        ("GRID", (0, 0), (-1, -1), 0.4, colors.HexColor("#cbd5e1")),
        ("TOPPADDING", (0, 0), (-1, -1), 3),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
    ]))
    return t


def generate_pdf_report(*, dataset: dict, profile: dict | None,
                        quality: dict | None, analyses: list[dict],
                        findings: list[dict], out_path: Path) -> Path:
    ss = _styles()
    doc = SimpleDocTemplate(
        str(out_path), pagesize=A4, leftMargin=2 * cm, rightMargin=2 * cm,
        topMargin=1.8 * cm, bottomMargin=1.8 * cm,
        title=f"{APP_NAME} — Analysis Report")
    story = []
    now = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")

    story.append(Paragraph(f"{APP_NAME} — Data Intelligence Report", ss["H1X"]))
    story.append(Paragraph(
        f"Generated {now} · {APP_NAME} v{APP_VERSION} · All values computed from "
        "the actual dataset; none are estimated or simulated.", ss["Meta"]))
    story.append(Spacer(1, 10))

    # ---- provenance
    story.append(Paragraph("1. Dataset & Provenance", ss["H2X"]))
    rows = [
        ["Name", dataset.get("name") or "-"],
        ["Original file", dataset.get("original_filename") or "-"],
        ["Format", (dataset.get("format") or "-").upper()],
        ["Records × Columns",
         f"{dataset.get('n_rows', '?')} × {dataset.get('n_cols', '?')}"],
        ["Source URL", dataset.get("source_url") or "User upload (provenance not documented)"],
        ["Provider", dataset.get("provider") or "-"],
        ["Licence", dataset.get("license") or "-"],
        ["Download/Upload date", dataset.get("download_date") or "-"],
        ["SHA-256 checksum", (dataset.get("checksum") or "-")[:32] + "…"],
    ]
    story.append(_table(rows, widths=[4.5 * cm, 12.5 * cm]))

    if profile:
        story.append(Paragraph("2. Schema & Column Statistics", ss["H2X"]))
        col_rows = [["Column", "Type", "Missing", "Notes"]]
        for name, info in list(profile["columns"].items())[:25]:
            notes = ""
            st = info.get("stats") or {}
            if info["semantic_type"] == "numeric" and st:
                notes = (f"mean {st.get('mean', 0):.3f}, std {st.get('std', 0):.3f}, "
                         f"min {st.get('min', 0):.3g}, max {st.get('max', 0):.3g}")
            elif info["semantic_type"] == "categorical" and st:
                notes = f"{st.get('unique', '?')} unique values"
            elif info["semantic_type"] == "datetime" and st:
                notes = f"{st.get('min', '?')} → {st.get('max', '?')}"
            col_rows.append([name, info["semantic_type"], str(info["missing"]), notes])
        story.append(_table(col_rows, widths=[4.2 * cm, 2.6 * cm, 1.8 * cm, 8.4 * cm]))

    if quality:
        story.append(Paragraph("3. Data Quality", ss["H2X"]))
        story.append(Paragraph(
            f"Quality score: <b>{quality.get('score', 'n/a')}/100</b> · "
            f"{quality.get('total_missing', 0)} missing cells · "
            f"{quality.get('duplicate_rows', 0)} duplicate rows.", ss["Body"]))
        for issue in quality.get("issues", []):
            story.append(Paragraph(f"• [{issue['severity'].upper()}] {issue['message']}",
                                   ss["Small"]))

    # ---- analyses (skip entries that could not be parsed or are not dicts)
    analyses = [a for a in (analyses or []) if isinstance(a, dict)]
    if analyses:
        story.append(Paragraph("4. Analyses Performed", ss["H2X"]))
        for a in analyses:
            m = a.get("metrics") if isinstance(a.get("metrics"), dict) else {}
            head = (f"{a.get('algorithm_name', a.get('task'))} — {a.get('task')}"
                    + (f" (target: {a['target']})" if a.get("target") else ""))
            story.append(Paragraph(f"<b>{head}</b>", ss["Body"]))
            metric_pairs = [f"{k}: {v}" for k, v in m.items()
                            if isinstance(v, (int, float, str))]
            if metric_pairs:
                story.append(Paragraph(" · ".join(metric_pairs[:10]), ss["Small"]))
            imp = a.get("feature_importance") or []
            if imp:
                story.append(Paragraph(
                    "Top features: " + ", ".join(
                        f"{i['feature']} ({i['importance']:.4f})" for i in imp[:5]),
                    ss["Small"]))
            story.append(Spacer(1, 6))

    # ---- findings
    if findings:
        story.append(Paragraph("5. Key Findings & Recommendations", ss["H2X"]))
        for i, f in enumerate(findings, 1):
            story.append(Paragraph(f"{i}. {f['title']} "
                                   f"[{f.get('severity', 'info').upper()}]", ss["Body"]))
            if f.get("explanation"):
                story.append(Paragraph(f["explanation"], ss["Small"]))
            if f.get("recommendation"):
                story.append(Paragraph(f"<b>Recommendation:</b> {f['recommendation']}",
                                       ss["Small"]))
            if f.get("limitations"):
                story.append(Paragraph(f"<b>Limitations:</b> {f['limitations']}",
                                       ss["Small"]))
            story.append(Spacer(1, 5))

    story.append(Paragraph("6. Ethical & Interpretation Notes", ss["H2X"]))
    for note in [
        "Correlation or model importance does not establish causation.",
        "Model metrics describe held-out splits of this dataset only and do not "
        "guarantee production performance.",
        "If this dataset concerns people (e.g. medical research data), outputs are "
        "research-grade and must not be treated as clinical diagnoses.",
        "No values in this report are fabricated: every number originates from the "
        "uploaded dataset or a computation executed on it.",
    ]:
        story.append(Paragraph(f"• {note}", ss["Small"]))

    doc.build(story)
    return out_path


def export_processed_csv(df: pd.DataFrame, name: str) -> Path:
    out = EXPORTS_DIR / f"{name}.csv"
    df.to_csv(out, index=False)
    return out


def export_json(data, name: str) -> Path:
    out = EXPORTS_DIR / f"{name}.json"
    out.write_text(json.dumps(data, indent=2, default=str), encoding="utf-8")
    return out

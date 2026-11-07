"""Rule-based analysis recommender.

Inspects the dataset profile and recommends suitable analysis tasks with
explicit reasons, assumptions and limitations. No LLM dependency — this must
work offline.
"""
from __future__ import annotations

import pandas as pd


def recommend_analyses(profile: dict, df: pd.DataFrame) -> list[dict]:
    """Return a ranked list of recommended analysis tasks for this dataset."""
    recs: list[dict] = []
    n = profile["n_rows"]
    numeric = profile["numeric_columns"]
    categorical = profile["categorical_columns"]
    datetimes = profile["datetime_columns"]
    target = profile.get("suggested_target")

    def add(task, title, why, required, assumptions, limitations, outputs, confidence):
        recs.append({
            "task": task, "title": title, "why": why,
            "required_columns": required, "assumptions": assumptions,
            "limitations": limitations, "expected_outputs": outputs,
            "confidence": confidence,
        })

    # ---- supervised: classification
    if target and target in df.columns:
        t_sem = profile["columns"][target]["semantic_type"]
        if t_sem in ("categorical", "boolean") or (
                t_sem == "numeric" and df[target].nunique() <= 12):
            imbalance = profile.get("quality", {}).get("imbalance")
            lim = ["Model performance depends on representative data.",
                   "Correlation-based features do not imply causation."]
            if imbalance and imbalance.get("imbalanced"):
                lim.append("Severe class imbalance — rely on PR-AUC/recall, not accuracy.")
            add(
                "classification", f"Classification on '{target}'",
                f"Column '{target}' is a categorical/boolean label with "
                f"{df[target].nunique()} distinct values across {n} rows.",
                [target] + numeric[:20],
                ["'target' is the label you want to predict.",
                 "Rows are independent observations."],
                lim,
                ["Accuracy, precision, recall, F1", "Confusion matrix",
                 "ROC-AUC / PR-AUC (binary)", "Feature importance"],
                "high")
        elif t_sem == "numeric":
            add(
                "regression", f"Regression on '{target}'",
                f"Column '{target}' is a continuous numeric variable — suitable "
                "target for regression models.",
                [target] + numeric[:20],
                ["Relationships are approximately learnable from the features."],
                ["Extrapolation beyond observed ranges is unreliable.",
                 "R² on held-out data is the honest generalisation estimate."],
                ["MAE / RMSE / R²", "Feature importance", "Predicted vs actual spread"],
                "high")

    # ---- unsupervised
    if len(numeric) >= 2:
        add(
            "clustering", "K-Means clustering",
            f"{len(numeric)} numeric columns available; grouping may reveal "
            "natural structure without labels.",
            numeric[:15], [],
            ["Clusters group similar rows but do NOT prove any group is "
             "defective, risky or anomalous.",
             "K-Means assumes roughly spherical, similarly-sized clusters."],
            ["Cluster sizes", "Silhouette score", "Per-cluster feature means"],
            "medium")
        add(
            "anomaly", "Anomaly detection (Isolation Forest)",
            "Unsupervised outlier scoring can surface unusual rows without labels.",
            numeric[:15], ["Contamination rate is an assumption (default 5%)."],
            ["Flagged rows are statistically unusual, not necessarily faults.",
             "Without ground-truth labels, precision/recall cannot be computed."],
            ["Anomaly scores", "Top anomalous records", "Flagged percentage"],
            "medium")

    # ---- time series / replay
    if datetimes and len(numeric) >= 1:
        add(
            "timeseries", "Time-series exploration & IoT replay",
            f"Timestamp column '{datetimes[0]}' with numeric measurements "
            f"{numeric[:3]} — the dataset can be replayed as a simulated IoT stream.",
            datetimes[:1] + numeric[:5],
            ["Timestamps are ordered and represent observation time."],
            ["Historical replay is a simulation — no physical sensor is connected.",
             "Naive trend extrapolation ignores seasonality unless modelled."],
            ["Trend charts", "Replay stream with live inference", "Rolling statistics"],
            "medium")
    elif datetimes:
        add(
            "timeseries", "Temporal exploration",
            f"Timestamp column '{datetimes[0]}' found — temporal summaries and "
            "replay are possible.",
            datetimes[:1], ["Timestamps are ordered."],
            ["Without numeric measures, replay inference is limited to viewing records."],
            ["Temporal summaries", "Replay stream"], "medium")

    # ---- warnings for tiny data
    if n < 100:
        recs.insert(0, {
            "task": "warning", "title": "Small dataset warning",
            "why": f"Only {n} rows — models may generalise poorly.",
            "required_columns": [], "assumptions": [],
            "limitations": ["Results are indicative only at this size."],
            "expected_outputs": [], "confidence": "info",
        })
    return recs

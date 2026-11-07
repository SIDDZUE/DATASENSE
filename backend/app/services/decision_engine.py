"""Decision-intelligence engine: converts analysis results into
evidence-backed findings. Every finding carries real numbers from the
actual computation that produced it, plus limitations.

Rules: correlation ≠ causation; no invented savings or risk percentages;
uncertainty is always disclosed.
"""
from __future__ import annotations


def generate_findings(*, profile: dict | None, quality: dict | None,
                      analysis: dict | None, dataset_name: str) -> list[dict]:
    findings: list[dict] = []

    # ---------- data-quality findings
    if quality:
        score = quality.get("score")
        if score is not None and score < 80:
            findings.append({
                "title": f"Data quality needs attention (score {score}/100)",
                "explanation": "Automated quality checks found issues that may "
                               "affect model reliability.",
                "evidence": {
                    "quality_score": score,
                    "missing_cells": quality.get("total_missing"),
                    "duplicate_rows": quality.get("duplicate_rows"),
                    "issues": [i["message"] for i in quality.get("issues", [])],
                },
                "severity": "high" if score < 60 else "medium",
                "recommendation": "Review the Data Quality page; handle missing "
                                  "values and duplicates before drawing conclusions.",
                "limitations": "Quality scoring is heuristic, based on missingness, "
                               "duplication and constant columns only.",
            })
        imb = quality.get("imbalance")
        if imb and imb.get("imbalanced"):
            findings.append({
                "title": f"Class imbalance in '{imb['target']}'",
                "explanation": f"The minority class covers only "
                               f"{imb['minority_pct']}% of rows. Accuracy alone will "
                               "be misleading for this dataset.",
                "evidence": {"distribution": imb["distribution"],
                             "minority_pct": imb["minority_pct"]},
                "severity": "medium",
                "recommendation": "Use precision/recall/PR-AUC; consider class "
                                  "weights or resampling when training.",
                "limitations": "Imbalance is measured on this dataset only.",
            })

    # ---------- supervised-model findings
    if analysis and analysis.get("task") in ("classification", "regression"):
        metrics = analysis.get("metrics", {})
        target = analysis.get("target")
        algo = analysis.get("algorithm_name")
        if analysis["task"] == "classification":
            findings.append({
                "title": f"{algo} predicts '{target}' with "
                         f"accuracy {metrics.get('accuracy', 'n/a')}",
                "explanation": f"A held-out test set of {analysis.get('test_rows')} rows "
                               f"was never seen during training. Macro F1 = "
                               f"{metrics.get('f1_macro', 'n/a')}.",
                "evidence": {
                    "algorithm": algo,
                    "accuracy": metrics.get("accuracy"),
                    "precision_macro": metrics.get("precision_macro"),
                    "recall_macro": metrics.get("recall_macro"),
                    "f1_macro": metrics.get("f1_macro"),
                    "roc_auc": metrics.get("roc_auc"),
                    "pr_auc": metrics.get("pr_auc"),
                    "cv_mean": metrics.get("cv_mean"),
                    "test_rows": analysis.get("test_rows"),
                },
                "severity": "info",
                "recommendation": "Inspect the confusion matrix for which classes are "
                                  "confused, then validate on newer data before "
                                  "operational use.",
                "limitations": "Performance is measured on this dataset's held-out "
                               "split; it does not guarantee production behaviour. "
                               "Prediction ≠ causal explanation.",
            })
        else:
            findings.append({
                "title": f"{algo} explains {metrics.get('r2', 'n/a')} of variance in '{target}'",
                "explanation": f"R² of {metrics.get('r2', 'n/a')} on {analysis.get('test_rows')} "
                               f"held-out rows; RMSE = {metrics.get('rmse', 'n/a')}.",
                "evidence": {"r2": metrics.get("r2"), "rmse": metrics.get("rmse"),
                             "mae": metrics.get("mae"),
                             "cv_mean": metrics.get("cv_mean"),
                             "test_rows": analysis.get("test_rows")},
                "severity": "info",
                "recommendation": "Check feature importance; verify the most influential "
                                  "features make domain sense before acting on predictions.",
                "limitations": "R² is computed on this dataset only. Association between "
                               "features and the target is not causation.",
            })

        imp = analysis.get("feature_importance") or []
        if imp:
            top = imp[0]
            findings.append({
                "title": f"'{top['feature']}' is the most influential feature",
                "explanation": "Permutation importance on the held-out test set shows "
                               f"this feature changes model performance the most when "
                               "shuffled.",
                "evidence": {"top_features": imp[:5],
                             "method": "permutation importance (5 repeats, test split)"},
                "severity": "info",
                "recommendation": f"Investigate how '{top['feature']}' is produced; "
                                  "validate the relationship with additional observations.",
                "limitations": "Importance reflects predictive contribution within this "
                               "model — it does not establish causation.",
            })

    # ---------- clustering findings
    if analysis and analysis.get("task") == "clustering":
        m = analysis.get("metrics", {})
        profiles = analysis.get("cluster_profiles", {})
        sizes = {k: v["size"] for k, v in profiles.items()}
        findings.append({
            "title": f"{m.get('n_clusters_found', '?')} clusters detected "
                     f"(silhouette {m.get('silhouette', 'n/a')})",
            "explanation": "Rows were grouped by feature similarity. Cluster profiles "
                           "show the mean of each feature per group.",
            "evidence": {"cluster_sizes": sizes, "silhouette": m.get("silhouette"),
                         "noise_points": m.get("noise_points"),
                         "profiles": {k: v["feature_means"]
                                      for k, v in list(profiles.items())[:6]}},
            "severity": "info",
            "recommendation": "Compare cluster feature means against domain knowledge; "
                              "clusters are descriptive, not diagnostic.",
            "limitations": "A cluster being unusual does not mean it is defective or "
                           "dangerous. Silhouette assumes convex clusters.",
        })

    # ---------- anomaly findings
    if analysis and analysis.get("task") == "anomaly":
        flagged = analysis.get("n_flagged", 0)
        pct = analysis.get("flagged_pct", 0)
        sev = "medium" if pct <= 10 else "high"
        le = analysis.get("label_evaluation")
        ev = {"n_flagged": flagged, "flagged_pct": pct,
              "contamination": analysis.get("contamination"),
              "rows_scored": analysis.get("rows_scored")}
        if le:
            ev["label_check"] = le
        findings.append({
            "title": f"{flagged} unusual rows flagged ({pct}% of dataset)",
            "explanation": "Isolation Forest isolated rows that are statistically "
                           "different from the majority.",
            "evidence": ev,
            "severity": sev,
            "recommendation": "Review the top flagged records on the Anomalies page "
                              "against domain knowledge before treating them as faults.",
            "limitations": "Statistical outliers are not necessarily faults. "
                           + ("Label-based precision/recall are computed against the "
                              "provided labels as-is." if le else
                              "No ground-truth labels available, so detection quality "
                              "cannot be verified."),
        })

    # ---------- dataset overview finding
    if profile:
        findings.append({
            "title": f"'{dataset_name}' profiled: {profile['n_rows']} rows × {profile['n_cols']} columns",
            "explanation": f"{len(profile['numeric_columns'])} numeric, "
                           f"{len(profile['categorical_columns'])} categorical, "
                           f"{len(profile['datetime_columns'])} datetime columns; "
                           f"{profile['missing_pct']}% missing cells overall.",
            "evidence": {"rows": profile["n_rows"], "columns": profile["n_cols"],
                         "missing_pct": profile["missing_pct"],
                         "duplicates": profile["duplicate_rows"]},
            "severity": "info",
            "recommendation": "Use the Explorer page to inspect distributions and "
                              "correlations before modelling.",
            "limitations": "Profile statistics describe this dataset only.",
        })
    return findings

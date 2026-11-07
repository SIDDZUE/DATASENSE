"""Dataset profiling: schema inference, statistics, data-quality analysis.

Every number produced here comes from the actual file contents.
"""
from __future__ import annotations

import numpy as np
import pandas as pd

from ..config import PREVIEW_ROWS

# ---------------------------------------------------------------- type inference

def infer_column_types(df: pd.DataFrame) -> dict[str, dict]:
    """Infer a semantic type for every column."""
    out: dict[str, dict] = {}
    n = len(df)
    for col in df.columns:
        s = df[col]
        info: dict = {"name": str(col), "pandas_dtype": str(s.dtype)}
        non_null = s.dropna()
        missing = int(s.isna().sum())

        if pd.api.types.is_bool_dtype(s):
            semantic = "boolean"
        elif pd.api.types.is_datetime64_any_dtype(s):
            semantic = "datetime"
        elif pd.api.types.is_numeric_dtype(s):
            semantic = "numeric"
        else:
            semantic = "categorical"
            # datetime strings?
            if non_null.size:
                sample = non_null.astype(str).head(200)
                parsed = pd.to_datetime(sample, errors="coerce", format="mixed")
                if parsed.notna().mean() > 0.9:
                    semantic = "datetime"
                else:
                    nums = pd.to_numeric(
                        sample.str.replace(",", "", regex=False).str.strip(),
                        errors="coerce")
                    if non_null.size and nums.notna().mean() > 0.95:
                        semantic = "numeric"
        # identifier-like detection
        if non_null.size:
            uniq_ratio = non_null.nunique() / len(non_null)
            if semantic in ("categorical",) and uniq_ratio > 0.95 and n > 20:
                semantic = "identifier"
            if semantic == "categorical" and non_null.nunique() <= max(30, 0.05 * n):
                pass  # stays categorical
        info.update(semantic_type=semantic, missing=missing)
        out[str(col)] = info
    return out


def _numeric_stats(s: pd.Series) -> dict:
    s = pd.to_numeric(s, errors="coerce").dropna()
    if s.empty:
        return {}
    q1, q2, q3 = (float(np.percentile(s, p)) for p in (25, 50, 75))
    iqr = q3 - q1
    lo, hi = q1 - 1.5 * iqr, q3 + 1.5 * iqr
    outliers = int(((s < lo) | (s > hi)).sum())
    sk = float(s.skew()) if len(s) > 2 else 0.0
    return {
        "count": int(s.size), "mean": float(s.mean()), "median": float(s.median()),
        "std": float(s.std()) if len(s) > 1 else 0.0,
        "variance": float(s.var()) if len(s) > 1 else 0.0,
        "min": float(s.min()), "max": float(s.max()),
        "q1": q1, "q3": q3, "iqr": iqr,
        "outliers_iqr": outliers,
        "skewness": sk,
        "histogram": _histogram(s),
    }


def _histogram(s: pd.Series, bins: int = 20) -> list[dict]:
    counts, edges = np.histogram(s, bins=bins)
    return [
        {"bin_start": float(edges[i]), "bin_end": float(edges[i + 1]),
         "count": int(counts[i])}
        for i in range(len(counts))
    ]


def _categorical_stats(s: pd.Series, top_k: int = 12) -> dict:
    vc = s.value_counts(dropna=True).head(top_k)
    return {
        "unique": int(s.nunique(dropna=True)),
        "top_values": [{"value": str(v), "count": int(c)} for v, c in vc.items()],
        "mode": str(s.mode(dropna=True).iloc[0]) if not s.dropna().empty else None,
    }


def build_profile(df: pd.DataFrame, *, sample_limit: int = 500_000) -> dict:
    """Full dataset profile (stats computed on real data).

    For very large datasets the column statistics are computed on a random
    sample of ``sample_limit`` rows, while ``n_rows`` always reports the true
    total row count so the UI never understates dataset size.
    """
    total_rows = int(len(df))
    if len(df) > sample_limit:
        df = df.sample(n=sample_limit, random_state=42)
        sampled = True
    else:
        sampled = False

    col_types = infer_column_types(df)
    columns: dict[str, dict] = {}
    numeric_cols, categorical_cols, datetime_cols = [], [], []
    for name, info in col_types.items():
        s = df[name]
        entry = dict(info)
        if info["semantic_type"] == "numeric":
            entry["stats"] = _numeric_stats(s)
            numeric_cols.append(name)
        elif info["semantic_type"] == "categorical":
            entry["stats"] = _categorical_stats(s)
            categorical_cols.append(name)
        elif info["semantic_type"] == "datetime":
            parsed = pd.to_datetime(s, errors="coerce", format="mixed")
            entry["stats"] = {
                "parsed_count": int(parsed.notna().sum()),
                "min": str(parsed.min()) if parsed.notna().any() else None,
                "max": str(parsed.max()) if parsed.notna().any() else None,
            }
            datetime_cols.append(name)
        else:
            entry["stats"] = {"unique": int(s.nunique(dropna=True))}
        columns[name] = entry

    # correlation matrix for numeric columns (max 25 to stay readable)
    corr = {}
    if len(numeric_cols) > 1:
        sub = df[numeric_cols[:25]].apply(pd.to_numeric, errors="coerce")
        cm = sub.corr(numeric_only=True)
        corr = {c: {c2: (None if pd.isna(v) else round(float(v), 4))
                    for c2, v in row.items()} for c, row in cm.items()}

    # duplicated rows (on the analysed sample)
    dup_count = int(df.duplicated().sum())

    profile = {
        "n_rows": total_rows,
        "profiled_rows": int(len(df)),
        "n_cols": int(df.shape[1]),
        "sampled": sampled,
        "columns": columns,
        "numeric_columns": numeric_cols,
        "categorical_columns": categorical_cols,
        "datetime_columns": datetime_cols,
        "identifier_columns": [c for c, i in columns.items()
                               if i["semantic_type"] == "identifier"],
        "boolean_columns": [c for c, i in columns.items()
                            if i["semantic_type"] == "boolean"],
        "duplicate_rows": dup_count,
        "total_missing": int(df.isna().sum().sum()),
        "missing_pct": round(float(df.isna().sum().sum()) / max(1, df.size) * 100, 3),
        "correlation": corr,
        "memory_mb": round(float(df.memory_usage(deep=True).sum()) / 1e6, 2),
    }

    # target suggestion (a column that looks like a label)
    profile["suggested_target"] = suggest_target(profile, df)
    return profile


def suggest_target(profile: dict, df: pd.DataFrame) -> str | None:
    """Heuristic label detection — always shown to the user for confirmation."""
    best, best_score = None, 0.0
    for name, info in profile["columns"].items():
        sem = info["semantic_type"]
        if sem in ("identifier", "datetime"):
            continue
        s = df[name].dropna()
        if s.empty:
            continue
        score = 0.0
        uniq = s.nunique()
        if sem == "boolean":
            score = 0.9
        elif sem == "categorical" and 2 <= uniq <= 10:
            score = 0.8 + (0.1 if uniq == 2 else 0)
        elif sem == "categorical" and 10 < uniq <= 25:
            score = 0.5
        elif sem == "numeric" and uniq <= 10:
            score = 0.7
        # penalise obvious binary flags that are 95%+ one value (probably a flag not label)
        if score and uniq == 2:
            top_freq = s.value_counts(normalize=True).iloc[0]
            if top_freq > 0.995:
                score *= 0.5
        # penalise name hints like id
        if any(t in name.lower() for t in ("id", "uuid", "index", "no.", "number")):
            score *= 0.3
        if score > best_score:
            best, best_score = name, score
    return best


# ---------------------------------------------------------------- quality

def build_quality(df: pd.DataFrame, profile: dict) -> dict:
    """Data-quality report: missing, duplicates, constants, outliers, imbalance."""
    n = max(1, len(df))
    per_column = []
    for name, info in profile["columns"].items():
        s = df[name]
        missing_pct = round(float(s.isna().sum()) / n * 100, 2)
        item = {
            "column": name, "semantic_type": info["semantic_type"],
            "missing": info["missing"], "missing_pct": missing_pct,
        }
        if info["semantic_type"] == "numeric" and "stats" in info and info["stats"]:
            item["outliers_iqr"] = info["stats"].get("outliers_iqr", 0)
            item["outlier_pct"] = round(item["outliers_iqr"] / n * 100, 2)
        if s.dropna().nunique() <= 1:
            item["constant"] = True
        elif s.dropna().nunique() / max(1, s.dropna().size) < 0.001 and s.dropna().nunique() <= 5:
            item["near_constant"] = True
        per_column.append(item)

    issues: list[dict] = []
    high_missing = [c["column"] for c in per_column if c["missing_pct"] > 30]
    if high_missing:
        issues.append({
            "code": "high_missing", "severity": "high",
            "message": f"{len(high_missing)} column(s) missing >30% of values: "
                       + ", ".join(high_missing[:5])})
    if profile["duplicate_rows"] > 0:
        issues.append({
            "code": "duplicates", "severity": "medium",
            "message": f"{profile['duplicate_rows']} duplicate row(s) detected."})
    constants = [c["column"] for c in per_column if c.get("constant")]
    if constants:
        issues.append({
            "code": "constant_columns", "severity": "low",
            "message": f"Constant column(s) with a single value: "
                       + ", ".join(constants[:8])})
    outlier_cols = {c["column"]: c.get("outlier_pct", 0) for c in per_column
                    if c.get("outlier_pct", 0) > 5}
    if outlier_cols:
        issues.append({
            "code": "outliers", "severity": "medium",
            "message": "IQR outliers >5% in: "
                       + ", ".join(f"{k} ({v}%)" for k, v in list(outlier_cols.items())[:6])})

    imbalance = None
    target = profile.get("suggested_target")
    if target and target in df.columns:
        vc = df[target].value_counts(normalize=True, dropna=True)
        if 2 <= len(vc) <= 20:
            imbalance = {
                "target": target,
                "distribution": {str(k): round(float(v), 4) for k, v in vc.items()},
                "minority_pct": round(float(vc.min()) * 100, 2),
                "imbalanced": bool(vc.min() < 0.2),
            }
            if imbalance["imbalanced"]:
                issues.append({
                    "code": "class_imbalance", "severity": "medium",
                    "message": f"Target '{target}' is imbalanced: minority class "
                               f"{imbalance['minority_pct']}% of rows. Use PR-AUC / "
                               f"recall, not accuracy alone."})

    score = 100.0
    score -= len(high_missing) * 8
    score -= min(15, profile["duplicate_rows"] / n * 100 * 2)
    score -= len(constants) * 3
    score -= min(10, profile["missing_pct"] / 2)
    quality = {
        "score": round(max(0.0, min(100.0, score)), 1),
        "per_column": per_column,
        "issues": issues,
        "imbalance": imbalance,
        "duplicate_rows": profile["duplicate_rows"],
        "total_missing": profile["total_missing"],
    }
    return quality


def preview_records(df: pd.DataFrame, limit: int = PREVIEW_ROWS) -> list[dict]:
    """JSON-safe preview rows."""
    sub = df.head(limit)
    return json_safe_records(sub)


def json_safe_records(df: pd.DataFrame) -> list[dict]:
    out = []
    for record in df.to_dict(orient="records"):
        clean = {}
        for k, v in record.items():
            if v is None or (isinstance(v, float) and np.isnan(v)):
                clean[str(k)] = None
            elif isinstance(v, (np.integer,)):
                clean[str(k)] = int(v)
            elif isinstance(v, (np.floating,)):
                clean[str(k)] = float(v)
            elif isinstance(v, (np.bool_,)):
                clean[str(k)] = bool(v)
            elif isinstance(v, pd.Timestamp):
                clean[str(k)] = str(v)
            else:
                clean[str(k)] = v
        out.append(clean)
    return out

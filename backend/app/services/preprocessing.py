"""Leakage-safe preprocessing configuration and transforms.

All fitted transforms are recorded so users can inspect what happened.
Fitting happens on training data only for supervised tasks.
"""
from __future__ import annotations

import numpy as np
import pandas as pd
from sklearn.compose import ColumnTransformer
from sklearn.impute import SimpleImputer
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder, StandardScaler


def derive_datetime_features(df: pd.DataFrame, datetime_cols: list[str],
                             drop_original: bool = False) -> tuple[pd.DataFrame, list[str]]:
    """Extract year/month/day/hour/dow from datetime columns."""
    created = []
    out = df.copy()
    for col in datetime_cols:
        parsed = pd.to_datetime(out[col], errors="coerce", format="mixed")
        for feat, getter in (("year", lambda p: p.dt.year),
                             ("month", lambda p: p.dt.month),
                             ("day", lambda p: p.dt.day),
                             ("hour", lambda p: p.dt.hour),
                             ("dayofweek", lambda p: p.dt.dayofweek)):
            name = f"{col}_{feat}"
            out[name] = getter(parsed).astype("float64")
            created.append(name)
        if drop_original:
            out = out.drop(columns=[col])
    return out, created


def build_preprocessor(X: pd.DataFrame, *, scale: bool = True) -> tuple[ColumnTransformer, dict]:
    """Build a ColumnTransformer for feature matrix X.

    Numeric: median imputation + optional standardisation.
    Categorical: most-frequent imputation + one-hot encoding (max 30 levels).
    Returns (transformer, description-of-steps).
    """
    num_cols = [c for c in X.columns
                if pd.api.types.is_numeric_dtype(X[c])]
    cat_cols = [c for c in X.columns
                if not pd.api.types.is_numeric_dtype(X[c])]
    num_steps = [("imputer", SimpleImputer(strategy="median"))]
    if scale:
        num_steps.append(("scaler", StandardScaler()))
    num_pipeline = Pipeline(num_steps)
    cat_pipeline = Pipeline([
        ("imputer", SimpleImputer(strategy="most_frequent")),
        ("onehot", OneHotEncoder(handle_unknown="ignore", max_categories=30,
                                 sparse_output=False)),
    ])
    pre = ColumnTransformer([
        ("num", num_pipeline, num_cols),
        ("cat", cat_pipeline, cat_cols),
    ], remainder="drop")
    description = {
        "numeric_columns": num_cols,
        "categorical_columns": cat_cols,
        "numeric": ("median impute" + (" + standardise" if scale else "")),
        "categorical": "most-frequent impute + one-hot (max 30 categories)",
        "scaling": scale,
    }
    return pre, description


def clean_target(y: pd.Series):
    """Return (y_clean, task_kind) where task_kind is class|regression."""
    y = y.dropna()
    if pd.api.types.is_numeric_dtype(y):
        uniq = y.nunique()
        if uniq <= 20 and y.isin([0, 1]).all():
            return y.astype(int), "class"
        if uniq <= 12 and pd.api.types.is_float_dtype(y) and (y == y.round()).all():
            return y.astype(int), "class"
        return y, "regression"
    return y, "class"


def train_test_indices(n: int, test_size: float = 0.2, seed: int = 42):
    rng = np.random.RandomState(seed)
    idx = rng.permutation(n)
    cut = int(n * (1 - test_size))
    return idx[:cut], idx[cut:]

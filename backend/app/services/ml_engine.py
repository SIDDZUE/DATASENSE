"""Machine-learning engine: supervised, unsupervised, anomaly detection.

All metrics come from real computation on the selected dataset.
Model artifacts are persisted with full metadata (algorithm, feature schema,
preprocessing, metrics, version).
"""
from __future__ import annotations

import json
import platform
from datetime import datetime, timezone
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
from sklearn.cluster import DBSCAN, AgglomerativeClustering, KMeans
from sklearn.ensemble import (AdaBoostClassifier, AdaBoostRegressor,
                              IsolationForest, RandomForestClassifier,
                              RandomForestRegressor)
from sklearn.linear_model import (LinearRegression, LogisticRegression)
from sklearn.metrics import (accuracy_score, confusion_matrix, f1_score,
                             mean_absolute_error, mean_squared_error,
                             precision_recall_fscore_support, r2_score,
                             recall_score, precision_score, silhouette_score)
from sklearn.model_selection import cross_val_score, train_test_split
from sklearn.naive_bayes import GaussianNB
from sklearn.neighbors import KNeighborsClassifier, KNeighborsRegressor
from sklearn.neural_network import MLPClassifier
from sklearn.pipeline import Pipeline
from sklearn.svm import SVC, SVR
from sklearn.tree import DecisionTreeClassifier, DecisionTreeRegressor

from .preprocessing import build_preprocessor, clean_target

MODEL_VERSION = "1.0.0"
RANDOM_STATE = 42

CLASSIFICATION_ALGOS = {
    "logistic_regression": ("Logistic Regression", "Unit II — Logistic Regression",
                            lambda: LogisticRegression(max_iter=2000, random_state=RANDOM_STATE)),
    "knn": ("K-Nearest Neighbours", "Unit II — kNN",
            lambda: KNeighborsClassifier(n_neighbors=5)),
    "decision_tree": ("Decision Tree", "Unit III — Decision Tree",
                      lambda: DecisionTreeClassifier(random_state=RANDOM_STATE)),
    "svm": ("Support Vector Machine", "Unit III — SVM",
            lambda: SVC(probability=True, random_state=RANDOM_STATE)),
    "naive_bayes": ("Gaussian Naive Bayes", "Unit III — Naive Bayes",
                    lambda: GaussianNB()),
    "random_forest": ("Random Forest", "Unit III — Bagging / Random Forests",
                      lambda: RandomForestClassifier(n_estimators=150, random_state=RANDOM_STATE, n_jobs=-1)),
    "adaboost": ("AdaBoost", "Unit III — Boosting",
                 lambda: AdaBoostClassifier(n_estimators=100, random_state=RANDOM_STATE)),
    "ann_mlp": ("Neural Network (MLP)", "Unit IV — Feed-forward ANN / Backpropagation",
                lambda: MLPClassifier(hidden_layer_sizes=(64, 32), max_iter=500,
                                      early_stopping=True, random_state=RANDOM_STATE)),
}
REGRESSION_ALGOS = {
    "linear_regression": ("Linear Regression", "Unit II — Simple/Multiple Linear Regression",
                          lambda: LinearRegression()),
    "knn_regressor": ("K-Nearest Neighbours", "Unit II — kNN (regression)",
                      lambda: KNeighborsRegressor(n_neighbors=5)),
    "decision_tree_regressor": ("Decision Tree", "Unit III — Decision Tree (regression)",
                                lambda: DecisionTreeRegressor(random_state=RANDOM_STATE)),
    "svr": ("Support Vector Regression", "Unit III — SVM (regression)",
            lambda: SVR()),
    "random_forest_regressor": ("Random Forest", "Unit III — Random Forest (regression)",
                                lambda: RandomForestRegressor(n_estimators=150, random_state=RANDOM_STATE, n_jobs=-1)),
    "adaboost_regressor": ("AdaBoost", "Unit III — Boosting (regression)",
                           lambda: AdaBoostRegressor(n_estimators=100, random_state=RANDOM_STATE)),
}
CLUSTERING_ALGOS = {
    "kmeans": ("K-Means", "Unit III — K-Means clustering"),
    "hierarchical": ("Hierarchical (Agglomerative)", "Unit III — Hierarchical clustering"),
    "dbscan": ("DBSCAN", "Unit III — DBSCAN clustering"),
}
ANOMALY_ALGOS = {
    "isolation_forest": ("Isolation Forest", "Unit III — unsupervised anomaly detection"),
}


class MLInputError(ValueError):
    pass


def _prepare_xy(df: pd.DataFrame, target: str, feature_cols: list[str] | None,
                exclude: list[str] | None):
    if target not in df.columns:
        raise MLInputError(f"Target column '{target}' not found in dataset.")
    if feature_cols:
        feats = [c for c in feature_cols if c in df.columns and c != target]
    else:
        feats = [c for c in df.columns if c != target]
    if exclude:
        feats = [c for c in feats if c not in set(exclude)]
    if not feats:
        raise MLInputError("No usable feature columns remain after exclusions.")
    X = df[feats].copy()
    y_raw = df[target].copy()
    mask = X.notna().any(axis=1) & y_raw.notna()
    X, y_raw = X[mask].reset_index(drop=True), y_raw[mask].reset_index(drop=True)
    y, kind = clean_target(y_raw)
    return X, y, kind, feats


# ---------------------------------------------------------------- supervised

def train_supervised(df: pd.DataFrame, *, task: str, target: str,
                     algorithm: str, feature_cols: list[str] | None = None,
                     exclude_cols: list[str] | None = None,
                     test_size: float = 0.2, cv_folds: int = 5,
                     artifact_dir: Path | None = None,
                     dataset_id: str = "adhoc") -> dict:
    """Train one supervised model with leakage-safe preprocessing and full evaluation."""
    X, y, kind, feats = _prepare_xy(df, target, feature_cols, exclude_cols)
    if len(X) < 30:
        raise MLInputError(f"Too few usable rows ({len(X)}) for reliable training; "
                           "need at least 30.")

    registry = CLASSIFICATION_ALGOS if task == "classification" else REGRESSION_ALGOS
    # accept friendly aliases so one algorithm name works across tasks
    alias = {("regression", "random_forest"): "random_forest_regressor",
             ("classification", "random_forest_regressor"): "random_forest"}
    algorithm = alias.get((task, algorithm), algorithm)
    if algorithm not in registry:
        raise MLInputError(f"Unknown {task} algorithm '{algorithm}'. "
                           f"Available: {', '.join(registry)}")

    strat = y if task == "classification" and y.nunique() > 1 else None
    try:
        X_tr, X_te, y_tr, y_te = train_test_split(
            X, y, test_size=test_size, random_state=RANDOM_STATE, stratify=strat)
    except ValueError:
        X_tr, X_te, y_tr, y_te = train_test_split(
            X, y, test_size=test_size, random_state=RANDOM_STATE)
    pre, pre_desc = build_preprocessor(X_tr)

    estimator = registry[algorithm][2]()
    pipeline = Pipeline([("preprocessing", pre), ("model", estimator)])
    pipeline.fit(X_tr, y_tr)

    metrics: dict = {}
    cv_note = None
    # ---- cross-validation (on training split)
    try:
        scoring = "accuracy" if task == "classification" else "r2"
        cv = min(cv_folds, max(2, len(y_tr) // 10))
        if cv >= 2:
            scores = cross_val_score(pipeline, X_tr, y_tr, cv=cv, scoring=scoring)
            metrics["cv_mean"] = round(float(scores.mean()), 4)
            metrics["cv_std"] = round(float(scores.std()), 4)
            metrics["cv_folds"] = int(cv)
    except Exception as e:  # CV is best-effort
        cv_note = f"Cross-validation skipped: {e}"

    y_pred = pipeline.predict(X_te)

    if task == "classification":
        labels = sorted(pd.unique(y).tolist())
        metrics.update({
            "accuracy": round(float(accuracy_score(y_te, y_pred)), 4),
            "precision_macro": round(float(precision_score(
                y_te, y_pred, average="macro", zero_division=0)), 4),
            "recall_macro": round(float(recall_score(
                y_te, y_pred, average="macro", zero_division=0)), 4),
            "f1_macro": round(float(f1_score(
                y_te, y_pred, average="macro", zero_division=0)), 4),
            "n_classes": len(labels),
            "class_labels": [str(l) for l in labels],
        })
        cm = confusion_matrix(y_te, y_pred, labels=labels)
        metrics["confusion_matrix"] = {
            "labels": [str(l) for l in labels],
            "matrix": cm.astype(int).tolist(),
        }
        # ROC/PR AUC for binary problems with probability support
        if len(labels) == 2 and hasattr(pipeline, "predict_proba"):
            try:
                from sklearn.metrics import roc_auc_score, average_precision_score
                pos_label = labels[-1]
                proba = pipeline.predict_proba(X_te)[:, list(labels).index(pos_label)]
                y_bin = (y_te == pos_label).astype(int)
                metrics["roc_auc"] = round(float(roc_auc_score(y_bin, proba)), 4)
                metrics["pr_auc"] = round(float(average_precision_score(y_bin, proba)), 4)
            except Exception:
                pass
        if y.nunique() > 1:
            dist = y.value_counts(normalize=True)
            metrics["class_distribution"] = {str(k): round(float(v), 4)
                                             for k, v in dist.items()}
    else:
        metrics.update({
            "mae": round(float(mean_absolute_error(y_te, y_pred)), 4),
            "mse": round(float(mean_squared_error(y_te, y_pred)), 4),
            "rmse": round(float(np.sqrt(mean_squared_error(y_te, y_pred))), 4),
            "r2": round(float(r2_score(y_te, y_pred)), 4),
        })

    # ---- feature importance (permutation on test set; real values)
    importance = _permutation_importance(pipeline, X_te, y_te,
                                         task=task, max_features=15)

    artifact_path = None
    if artifact_dir is not None:
        artifact_dir.mkdir(parents=True, exist_ok=True)
        artifact_path = artifact_dir / f"{dataset_id}_{algorithm}_{datetime.now(timezone.utc).strftime('%Y%m%d%H%M%S')}.joblib"
        joblib.dump(pipeline, artifact_path)

    result = {
        "task": task, "kind": kind, "algorithm": algorithm,
        "algorithm_name": registry[algorithm][0],
        "syllabus_topic": registry[algorithm][1],
        "target": target, "feature_columns": feats,
        "preprocessing": pre_desc,
        "train_rows": int(len(X_tr)), "test_rows": int(len(X_te)),
        "metrics": metrics, "feature_importance": importance,
        "cv_note": cv_note,
        "model_version": MODEL_VERSION,
        "trained_at": datetime.now(timezone.utc).isoformat(),
        "python": platform.python_version(),
        "artifact_path": str(artifact_path) if artifact_path else None,
    }
    return result


def _permutation_importance(pipeline: Pipeline, X_te: pd.DataFrame, y_te: pd.Series,
                            *, task: str, max_features: int = 15) -> list[dict]:
    try:
        from sklearn.inspection import permutation_importance
        scoring = "accuracy" if task == "classification" else "r2"
        r = permutation_importance(pipeline, X_te, y_te, scoring=scoring,
                                   n_repeats=5, random_state=RANDOM_STATE,
                                   n_jobs=-1)
        # column-transformer output names are encoded; map back via original columns
        pairs = sorted(zip(X_te.columns, r.importances_mean),
                       key=lambda t: -abs(t[1]))[:max_features]
        return [{"feature": str(f), "importance": round(float(v), 6)}
                for f, v in pairs]
    except Exception:
        # fall back to native feature_importances_ where the model exposes it
        try:
            model = pipeline.named_steps["model"]
            pre = pipeline.named_steps["preprocessing"]
            names = pre.get_feature_names_out()
            imp = getattr(model, "feature_importances_", None)
            if imp is None:
                return []
            agg: dict[str, float] = {}
            for name, v in zip(names, imp):
                base = str(name).split("__")[-1].split("_", 1)[0]
                agg[base] = agg.get(base, 0.0) + float(v)
            pairs = sorted(agg.items(), key=lambda t: -t[1])[:max_features]
            return [{"feature": f, "importance": round(v, 6)} for f, v in pairs]
        except Exception:
            return []


# ---------------------------------------------------------------- clustering

def run_clustering(df: pd.DataFrame, *, algorithm: str,
                   feature_cols: list[str] | None = None,
                   exclude_cols: list[str] | None = None,
                   n_clusters: int = 3,
                   dbscan_eps: float | None = None,
                   dbscan_min_samples: int = 5) -> dict:
    X_all, _, _, feats = _prepare_xy(df, target=df.columns[0],
                                     feature_cols=feature_cols, exclude=exclude_cols)
    # clustering uses all rows of X (target irrelevant) — rebuild without target semantics
    if feature_cols:
        feats = [c for c in feature_cols if c in df.columns]
    else:
        feats = [c for c in df.columns
                 if pd.api.types.is_numeric_dtype(df[c])]
        if exclude_cols:
            feats = [c for c in feats if c not in set(exclude_cols)]
    if not feats:
        raise MLInputError("Clustering requires at least one numeric feature column.")
    X = df[feats].apply(pd.to_numeric, errors="coerce").dropna()
    if len(X) < 30:
        raise MLInputError(f"Too few complete numeric rows ({len(X)}) for clustering.")

    pre, pre_desc = build_preprocessor(X, scale=True)
    Xs = pre.fit_transform(X)

    params: dict = {}
    if algorithm == "kmeans":
        n = max(2, min(int(n_clusters), 12))
        model = KMeans(n_clusters=n, n_init=10, random_state=RANDOM_STATE)
        labels = model.fit_predict(Xs)
        params["n_clusters"] = n
    elif algorithm == "hierarchical":
        n = max(2, min(int(n_clusters), 12))
        model = AgglomerativeClustering(n_clusters=n)
        labels = model.fit_predict(Xs)
        params["n_clusters"] = n
    elif algorithm == "dbscan":
        model = DBSCAN(eps=dbscan_eps if dbscan_eps else 0.5,
                       min_samples=dbscan_min_samples)
        labels = model.fit_predict(Xs)
        params["eps"] = model.eps
        params["min_samples"] = model.min_samples
    else:
        raise MLInputError(f"Unknown clustering algorithm '{algorithm}'.")

    valid = labels[labels != -1]
    n_clusters_found = int(len(set(valid)))
    metrics: dict = {
        "n_clusters_found": n_clusters_found,
        "noise_points": int((labels == -1).sum()),
        "cluster_sizes": {str(int(k)): int(v)
                          for k, v in zip(*np.unique(labels, return_counts=True))},
    }
    sil = None
    if 2 <= n_clusters_found < len(Xs) and algorithm != "dbscan" or (
            algorithm == "dbscan" and 2 <= n_clusters_found < len(Xs)):
        try:
            sample = Xs if len(Xs) <= 5000 else Xs[np.random.RandomState(42).choice(len(Xs), 5000, replace=False)]
            lab_sample = labels if len(Xs) <= 5000 else labels[
                np.random.RandomState(42).choice(len(Xs), 5000, replace=False)]
            if len(set(lab_sample[lab_sample != -1])) >= 2:
                sil = float(silhouette_score(sample[lab_sample != -1],
                                             lab_sample[lab_sample != -1]))
        except Exception:
            sil = None
    if sil is not None:
        metrics["silhouette"] = round(sil, 4)

    # real per-cluster feature means — evidence for cluster interpretation
    profiles = {}
    for lab in sorted(set(labels)):
        mask = labels == lab
        profiles[str(int(lab))] = {
            "size": int(mask.sum()),
            "feature_means": {c: round(float(X.iloc[np.where(mask)[0]][c].mean()), 4)
                              for c in feats[:10]},
        }

    return {
        "task": "clustering", "algorithm": algorithm,
        "algorithm_name": CLUSTERING_ALGOS[algorithm][0],
        "syllabus_topic": CLUSTERING_ALGOS[algorithm][1],
        "feature_columns": feats, "preprocessing": pre_desc,
        "rows_clustered": int(len(X)), "params": params,
        "metrics": metrics, "cluster_profiles": profiles,
        "labels_preview": labels[:500].tolist(),
        "model_version": MODEL_VERSION,
        "trained_at": datetime.now(timezone.utc).isoformat(),
    }


# ---------------------------------------------------------------- anomalies

def run_anomaly_detection(df: pd.DataFrame, *, algorithm: str = "isolation_forest",
                          feature_cols: list[str] | None = None,
                          exclude_cols: list[str] | None = None,
                          contamination: float = 0.05,
                          label_column: str | None = None) -> dict:
    if algorithm != "isolation_forest":
        raise MLInputError(f"Unknown anomaly algorithm '{algorithm}'.")
    if feature_cols:
        feats = [c for c in feature_cols if c in df.columns]
    else:
        feats = [c for c in df.columns if pd.api.types.is_numeric_dtype(df[c])]
        if exclude_cols:
            feats = [c for c in feats if c not in set(exclude_cols)]
    if not feats:
        raise MLInputError("Anomaly detection requires at least one numeric feature column.")
    X = df[feats].apply(pd.to_numeric, errors="coerce")
    valid_mask = X.notna().any(axis=1)
    X = X[valid_mask].fillna(X.median(numeric_only=True))
    model = IsolationForest(n_estimators=200, contamination=contamination,
                            random_state=RANDOM_STATE, n_jobs=-1)
    labels = model.fit_predict(X)          # -1 anomaly, 1 normal
    scores = -model.score_samples(X)       # higher = more anomalous

    flagged = int((labels == -1).sum())
    result = {
        "task": "anomaly", "algorithm": "isolation_forest",
        "algorithm_name": ANOMALY_ALGOS["isolation_forest"][0],
        "syllabus_topic": ANOMALY_ALGOS["isolation_forest"][1],
        "feature_columns": feats, "rows_scored": int(len(X)),
        "contamination": contamination,
        "n_flagged": flagged,
        "flagged_pct": round(flagged / max(1, len(X)) * 100, 2),
        "score_stats": {
            "mean": round(float(scores.mean()), 4),
            "std": round(float(scores.std()), 4),
            "max": round(float(scores.max()), 4),
        },
        "top_anomalies": [],
        "model_version": MODEL_VERSION,
        "trained_at": datetime.now(timezone.utc).isoformat(),
    }

    order = np.argsort(-scores)[:100]
    for i in order:
        row = {c: (None if pd.isna(df.loc[X.index[i], c]) else
                   (float(df.loc[X.index[i], c]) if pd.api.types.is_numeric_dtype(df[c])
                    else str(df.loc[X.index[i], c]))) for c in feats[:8]}
        result["top_anomalies"].append({
            "row_index": int(X.index[i]), "anomaly_score": round(float(scores[i]), 4),
            "record": row,
        })

    # When genuine labels exist, report real precision/recall against them
    if label_column and label_column in df.columns:
        y_raw = df.loc[X.index, label_column]
        y_true = pd.to_numeric(y_raw, errors="coerce")
        if y_true.dropna().nunique() == 2:
            # assume 1 = anomaly/positive class in the source data
            y_bin = (y_true.fillna(0) > 0).astype(int)
            pred = (labels == -1).astype(int)
            if y_bin.sum() > 0:
                result["label_evaluation"] = {
                    "label_column": label_column,
                    "precision": round(float(precision_score(y_bin, pred, zero_division=0)), 4),
                    "recall": round(float(recall_score(y_bin, pred, zero_division=0)), 4),
                    "f1": round(float(f1_score(y_bin, pred, zero_division=0)), 4),
                    "actual_positive_pct": round(float(y_bin.mean()) * 100, 2),
                }
    return result


def save_model_metadata(path: Path, meta: dict) -> None:
    path.write_text(json.dumps(meta, indent=2, default=str), encoding="utf-8")

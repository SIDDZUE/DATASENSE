"""Prepare the genuine UCI datasets into clean CSVs + provenance manifest.

Sources (all directly downloadable, no authentication):
  1. AI4I 2020 Predictive Maintenance  — UCI 601 (CC BY 4.0)
  2. Air Quality                       — UCI 360 (CC BY 4.0)
  3. Breast Cancer Wisconsin (Diagn.)  — UCI 17  (CC BY 4.0)
  4. Household Electric Power          — UCI 235 (CC BY 4.0)
  5. Credit-card fraud                 — OpenML 42175 (ULB; Kaggle original, ODbL)

Run from DataSense-AI/ with the venv python.
"""
from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path

import numpy as np
import pandas as pd

ROOT = Path(__file__).resolve().parent.parent
RAW = ROOT / "data" / "raw"
EXTRACTED = RAW / "extracted"
PREPARED = RAW / "prepared"
META = ROOT / "data" / "metadata"
PREPARED.mkdir(parents=True, exist_ok=True)
META.mkdir(parents=True, exist_ok=True)

manifest: list[dict] = []


def record(**kw):
    manifest.append(kw)
    print("recorded:", kw["name"])


# ---------------------------------------------------------------- 1. AI4I
def prepare_ai4i():
    src = EXTRACTED / "ai4i2020" / "ai4i2020.csv"
    df = pd.read_csv(src)
    out = PREPARED / "ai4i2020.csv"
    df.to_csv(out, index=False)
    record(
        name="AI4I 2020 Predictive Maintenance",
        original_filename="ai4i2020.csv",
        prepared_file=str(out),
        format="csv",
        n_rows=int(len(df)), n_cols=int(df.shape[1]),
        source_url="https://archive.ics.uci.edu/dataset/601/ai4i+2020+predictive+maintenance+dataset",
        provider="Stephan Matzka — UCI Machine Learning Repository",
        download_date=datetime.now(timezone.utc).date().isoformat(),
        license="CC BY 4.0",
        notes=("Synthetic industrial dataset generated from a real milling-process "
               "model. It is NOT factory-collected telemetry. Contains labelled "
               "failures (Machine failure + 5 failure modes)."),
        has_labels=True,
    )


# ---------------------------------------------------------------- 2. Air quality
def prepare_air_quality():
    src = EXTRACTED / "airquality" / "AirQualityUCI.csv"
    df = pd.read_csv(src, sep=";", decimal=",")
    df = df.drop(columns=[c for c in df.columns if str(c).startswith("Unnamed")],
                 errors="ignore")
    df = df.dropna(how="all")
    # UCI convention: -200 marks missing measurements
    num = [c for c in df.columns if c not in ("Date", "Time")]
    df[num] = df[num].replace(-200, np.nan).apply(pd.to_numeric, errors="coerce")
    ts = pd.to_datetime(df["Date"].astype(str) + " " +
                        df["Time"].astype(str).str.replace(".", ":", regex=False),
                        errors="coerce", dayfirst=True)
    df.insert(0, "timestamp", ts)
    df = df.drop(columns=["Date", "Time"])
    df = df[df["timestamp"].notna()]
    out = PREPARED / "air_quality.csv"
    df.to_csv(out, index=False)
    record(
        name="UCI Air Quality",
        original_filename="AirQualityUCI.csv",
        prepared_file=str(out),
        format="csv",
        n_rows=int(len(df)), n_cols=int(df.shape[1]),
        source_url="https://archive.ics.uci.edu/dataset/360/air+quality",
        provider="S. De Vito et al. — UCI Machine Learning Repository",
        download_date=datetime.now(timezone.utc).date().isoformat(),
        license="CC BY 4.0",
        notes=("Air-quality sensor measurements (CO, NMHC, C6H6, NOx, NO2, O3, "
               "temperature, humidity) from an Italian city. -200 missing markers "
               "converted to NaN. Timestamp column derived from Date+Time."),
        has_labels=False,
    )


# ---------------------------------------------------------------- 3. WDBC
WDBC_FEATURES = [
    "radius", "texture", "perimeter", "area", "smoothness", "compactness",
    "concavity", "concave_points", "symmetry", "fractal_dimension",
]
WDBC_COLUMNS = ["id", "diagnosis"] + [f"{f}_{s}" for s in
                                      ("mean", "se", "worst") for f in WDBC_FEATURES]


def prepare_wdbc():
    src = EXTRACTED / "breastcancer" / "wdbc.data"
    df = pd.read_csv(src, header=None, names=WDBC_COLUMNS)
    out = PREPARED / "wdbc.csv"
    df.to_csv(out, index=False)
    record(
        name="Breast Cancer Wisconsin (Diagnostic)",
        original_filename="wdbc.data",
        prepared_file=str(out),
        format="csv",
        n_rows=int(len(df)), n_cols=int(df.shape[1]),
        source_url="https://archive.ics.uci.edu/dataset/17/breast+cancer+wisconsin+diagnostic",
        provider="W. Wolberg, O. Mangasarian — UCI Machine Learning Repository",
        download_date=datetime.now(timezone.utc).date().isoformat(),
        license="CC BY 4.0",
        notes=("Public research dataset. diagnosis M/B is the label. Column headers "
               "reconstructed from wdbc.names (the original file has no header). "
               "Outputs must not be presented as medical diagnoses."),
        has_labels=True,
    )


# ---------------------------------------------------------------- 4. Household power
def prepare_household():
    src = EXTRACTED / "household_power" / "household_power_consumption.txt"
    df = pd.read_csv(src, sep=";", na_values="?", low_memory=False)
    ts = pd.to_datetime(df["Date"].astype(str) + " " + df["Time"].astype(str),
                        errors="coerce", dayfirst=True)
    df.insert(0, "timestamp", ts)
    df = df.drop(columns=["Date", "Time"])
    for c in df.columns[1:]:
        df[c] = pd.to_numeric(df[c], errors="coerce")
    df = df[df["timestamp"].notna()]
    out = PREPARED / "household_power.parquet"
    df.to_parquet(out, index=False)
    record(
        name="Individual Household Electric Power Consumption",
        original_filename="household_power_consumption.txt",
        prepared_file=str(out),
        format="parquet",
        n_rows=int(len(df)), n_cols=int(df.shape[1]),
        source_url="https://archive.ics.uci.edu/dataset/235/individual+household+electric+power+consumption",
        provider="Georges Hebrail, Alice Berard — UCI Machine Learning Repository",
        download_date=datetime.now(timezone.utc).date().isoformat(),
        license="CC BY 4.0",
        notes=("Minute-level electrical measurements of one household (2006-2010). "
               "Timestamps derived from Date+Time; '?' missing values → NaN. "
               "Ideal genuine time-series for the IoT replay simulator."),
        has_labels=False,
    )


# ---------------------------------------------------------------- 5. Credit-card fraud
def prepare_creditcard():
    from sklearn.datasets import fetch_openml
    try:
        bunch = fetch_openml(data_id=42175, as_frame=True, parser="auto")
        df = bunch.frame
        df.columns = [str(c).strip() for c in df.columns]
        if "Class" not in df.columns:
            raise ValueError(f"unexpected columns: {df.columns.tolist()[:6]}")
        out = PREPARED / "creditcard.csv"
        df.to_csv(out, index=False)
        record(
            name="Credit Card Fraud Detection",
            original_filename="creditcard.csv",
            prepared_file=str(out),
            format="csv",
            n_rows=int(len(df)), n_cols=int(df.shape[1]),
            source_url="https://www.openml.org/d/42175",
            provider="Universite Libre de Bruxelles (MLG) — original Kaggle dataset",
            download_date=datetime.now(timezone.utc).date().isoformat(),
            license="ODbL (Open Database License) per original distribution",
            notes=("Financial research dataset (PCA-anonymised features, 'Class' "
                   "label, 0.172% fraud). Downloaded via OpenML because Kaggle "
                   "authentication was unavailable. Not a live payment integration."),
            has_labels=True,
        )
    except Exception as e:
        print("creditcard download FAILED:", e)
        manifest_failed.append({
            "name": "Credit Card Fraud Detection",
            "source_url": "https://www.kaggle.com/datasets/mlg-ulb/creditcardfraud",
            "status": "not acquired",
            "reason": f"Kaggle CLI not authenticated; OpenML fallback failed: {e}",
        })


manifest_failed: list[dict] = []


if __name__ == "__main__":
    for fn in (prepare_ai4i, prepare_air_quality, prepare_wdbc,
               prepare_household, prepare_creditcard):
        try:
            fn()
        except Exception as e:
            print(f"{fn.__name__} FAILED: {e}")

    manifest.sort(key=lambda m: m["name"])
    (META / "dataset_manifest.json").write_text(
        json.dumps({"generated_at": datetime.now(timezone.utc).isoformat(),
                    "acquired": manifest, "not_acquired": manifest_failed},
                   indent=2), encoding="utf-8")
    print(f"\nManifest written: {len(manifest)} acquired, "
          f"{len(manifest_failed)} not acquired")

"""Import prepared datasets into the running DataSense API with provenance.

Reads data/metadata/dataset_manifest.json (produced by prepare_datasets.py)
and POSTs each prepared file to /api/datasets/upload.
"""
from __future__ import annotations

import json
import sys
import time
from pathlib import Path

import httpx

ROOT = Path(__file__).resolve().parent.parent
MANIFEST = ROOT / "data" / "metadata" / "dataset_manifest.json"
API = "http://127.0.0.1:8000"

EXTRA_NOTES = {
    "AI4I 2020 Predictive Maintenance": "Cross-domain suite: industrial predictive maintenance.",
    "UCI Air Quality": "Cross-domain suite: environmental sensor regression + replay.",
    "Breast Cancer Wisconsin (Diagnostic)": "Cross-domain suite: healthcare research classification.",
    "Individual Household Electric Power Consumption": "Cross-domain suite: energy time-series + IoT replay.",
    "Credit Card Fraud Detection": "Cross-domain suite: imbalanced financial classification.",
}


def main() -> int:
    if not MANIFEST.exists():
        print("Manifest missing — run prepare_datasets.py first.")
        return 1
    manifest = json.loads(MANIFEST.read_text(encoding="utf-8"))
    acquired = manifest.get("acquired", [])

    with httpx.Client(timeout=600) as client:
        try:
            client.get(f"{API}/api/health").raise_for_status()
        except Exception as e:
            print(f"API not reachable at {API}: {e}")
            return 1

        existing = {d["original_filename"] for d in
                    client.get(f"{API}/api/datasets").json()["datasets"]}

        for item in acquired:
            name = item["name"]
            src = Path(item["prepared_file"])
            if not src.exists():
                print(f"SKIP {name}: prepared file missing ({src})")
                continue
            filename = src.name
            if filename in existing:
                print(f"SKIP {name}: already imported")
                continue
            params = {
                "name": name,
                "source_url": item.get("source_url", ""),
                "provider": item.get("provider", ""),
                "license": item.get("license", ""),
                "notes": (item.get("notes", "") + " " + EXTRA_NOTES.get(name, "")).strip(),
            }
            t0 = time.time()
            print(f"Uploading {filename} ({src.stat().st_size/1e6:.1f} MB)…")
            with open(src, "rb") as f:
                r = client.post(f"{API}/api/datasets/upload", params=params,
                                files={"file": (filename, f)})
            if r.status_code == 200:
                body = r.json()
                print(f"  OK {body['id']} — {body['n_rows']:,} rows × "
                      f"{body['n_cols']} cols in {time.time()-t0:.1f}s")
            else:
                print(f"  FAILED {r.status_code}: {r.text[:300]}")
    return 0


if __name__ == "__main__":
    sys.exit(main())

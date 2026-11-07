"""Central configuration: paths, limits, constants."""
from pathlib import Path

# Project root = DataSense-AI/ (backend/ sits directly inside it)
PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
BACKEND_ROOT = PROJECT_ROOT / "backend"

DATA_DIR = PROJECT_ROOT / "data"
RAW_DIR = DATA_DIR / "raw"
UPLOAD_DIR = DATA_DIR / "uploads"
PROCESSED_DIR = DATA_DIR / "processed"
METADATA_DIR = DATA_DIR / "metadata"
EXPORTS_DIR = DATA_DIR / "exports"

MODELS_DIR = PROJECT_ROOT / "models"
ARTIFACTS_DIR = PROJECT_ROOT / "artifacts"
REPORTS_DIR = PROJECT_ROOT / "reports"

DB_PATH = DATA_DIR / "datasense.db"

for _d in (DATA_DIR, RAW_DIR, UPLOAD_DIR, PROCESSED_DIR, METADATA_DIR,
           EXPORTS_DIR, MODELS_DIR, ARTIFACTS_DIR, REPORTS_DIR):
    _d.mkdir(parents=True, exist_ok=True)

# Limits
MAX_UPLOAD_BYTES = 200 * 1024 * 1024          # 200 MB hard cap
PROFILE_FULL_READ_MAX_BYTES = 120 * 1024 * 1024  # read whole file up to this
PREVIEW_ROWS = 50
CHUNKSIZE = 50_000

ALLOWED_EXTENSIONS = {".csv", ".xlsx", ".xls", ".json", ".parquet"}

APP_NAME = "DataSense AI"
APP_VERSION = "1.0.0"


def dataset_upload_path(dataset_id: str, original_filename: str) -> Path:
    """Safe per-dataset raw storage path. Original file is never modified."""
    safe = Path(original_filename).name  # strip any directory components
    ext = Path(safe).suffix.lower() or ".csv"
    return UPLOAD_DIR / f"{dataset_id}{ext}"


def dataset_processed_path(dataset_id: str) -> Path:
    return PROCESSED_DIR / f"{dataset_id}.parquet"

"""Safe dataset ingestion: CSV / XLSX / JSON / Parquet readers.

Never mutates the original file. Handles encoding issues, malformed rows
and large files via chunked reads where appropriate.
"""
from __future__ import annotations

import hashlib
from pathlib import Path

import pandas as pd

from ..config import (ALLOWED_EXTENSIONS, CHUNKSIZE, MAX_UPLOAD_BYTES,
                      PROFILE_FULL_READ_MAX_BYTES)

FORMAT_READERS = {
    ".csv": "csv", ".xlsx": "excel", ".xls": "excel", ".json": "json",
    ".parquet": "parquet",
}


class IngestionError(ValueError):
    """Raised for any user-facing file problem (bad format, too large...)."""


def validate_upload(path: Path) -> str:
    ext = path.suffix.lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise IngestionError(
            f"Unsupported file format '{ext}'. Supported: "
            + ", ".join(sorted(ALLOWED_EXTENSIONS))
        )
    size = path.stat().st_size
    if size > MAX_UPLOAD_BYTES:
        mb = MAX_UPLOAD_BYTES // (1024 * 1024)
        raise IngestionError(f"File exceeds the {mb} MB upload limit.")
    if size == 0:
        raise IngestionError("File is empty.")
    return FORMAT_READERS[ext]


def file_checksum(path: Path) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for block in iter(lambda: f.read(1 << 20), b""):
            h.update(block)
    return h.hexdigest()


def read_tabular(path: Path, fmt: str, *, nrows: int | None = None,
                 usecols: list[str] | None = None) -> pd.DataFrame:
    """Read a dataset into a DataFrame with per-format error handling."""
    try:
        if fmt == "csv":
            return _read_csv(path, nrows=nrows, usecols=usecols)
        if fmt == "excel":
            return pd.read_excel(path, nrows=nrows, usecols=usecols)
        if fmt == "json":
            return pd.read_json(path, convert_dates=False)
        if fmt == "parquet":
            cols = usecols
            return pd.read_parquet(path, columns=cols)
    except IngestionError:
        raise
    except UnicodeDecodeError as e:
        raise IngestionError(
            "Could not decode file. Please re-save it as UTF-8 CSV.") from e
    except pd.errors.EmptyDataError as e:
        raise IngestionError("File contains no data rows.") from e
    except pd.errors.ParserError as e:
        raise IngestionError(f"Malformed file, could not parse rows: {e}") from e
    except ValueError as e:
        raise IngestionError(f"Could not parse file: {e}") from e
    raise IngestionError(f"Unsupported format '{fmt}'.")


def _read_csv(path: Path, nrows: int | None, usecols: list[str] | None) -> pd.DataFrame:
    # Try utf-8 first, then latin-1 (common for older exports).
    for enc in ("utf-8", "utf-8-sig", "latin-1"):
        try:
            return pd.read_csv(
                path, encoding=enc, nrows=nrows, usecols=usecols,
                on_bad_lines="skip", low_memory=False,
            )
        except UnicodeDecodeError:
            continue
    raise IngestionError("Could not decode CSV with utf-8 or latin-1 encodings.")


def count_rows(path: Path, fmt: str) -> int:
    """Row count without loading everything when the file is large."""
    size = path.stat().st_size
    if fmt == "csv" and size > PROFILE_FULL_READ_MAX_BYTES:
        n = 0
        for chunk in pd.read_csv(path, chunksize=CHUNKSIZE, on_bad_lines="skip"):
            n += len(chunk)
        return n
    df = read_tabular(path, fmt)
    return int(len(df))


def iter_chunks(path: Path, fmt: str, chunksize: int = CHUNKSIZE):
    """Yield DataFrame chunks (CSV only falls back to single frame)."""
    if fmt == "csv":
        reader = pd.read_csv(path, chunksize=chunksize, on_bad_lines="skip")
        yield from reader
    else:
        yield read_tabular(path, fmt)


def dataframe_to_parquet(df: pd.DataFrame, out_path: Path) -> None:
    df.to_parquet(out_path, index=False)

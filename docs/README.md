# DataSense AI — Universal AIoT Data Intelligence Platform

A complete, working multi-page AIoT data intelligence platform built with FastAPI + Next.js.

Upload any structured dataset, profile it, train real machine-learning models, detect anomalies,
replay historical IoT streams, and turn evidence into decisions.

## What This Is

DataSense AI is a **local demo mode** SaaS platform for AIoT data intelligence. It is:

- **Real, not mocked** — every dataset is from a public repository (UCI ML Repository, OpenML)
  with full provenance. No fabricated data.
- **Genuine ML pipeline** — classification, regression, clustering, and anomaly detection
  powered by scikit-learn. Models are actually trained on your data.
- **IoT historical replay** — timestamped datasets can be replayed as simulated sensor streams
  with live inference and configurable speed.
- **Decision engine** — evidence-backed findings with disclosed limitations. Correlation is not
  causation; uncertainty is always stated.
- **No auth, no payments** — runs entirely on your machine.

## Stack

| Layer | Technology |
|-------|------------|
| Backend | FastAPI, Python 3.10, pandas, scikit-learn, reportlab, SQLite |
| Frontend | Next.js 15.5.29, React 19, Tailwind v4, Recharts, lucide-react |
| Data | 5 genuine public datasets (2M+ rows total), Parquet + SQLite |
| Design | "Research instrument" — warm paper, ink navy, signal amber, hairline rules |

## Quick Start

### 1. Setup (PowerShell)

```powershell
# From the DataSense-AI directory
.\scripts\setup.ps1
```

This creates the Python venv, installs dependencies, imports datasets, and installs frontend packages.

### 2. Start the backend

```powershell
.\scripts\start.ps1
```

This starts the FastAPI backend on `http://127.0.0.1:8000`.

### 3. Start the frontend

```powershell
cd frontend
npm run build
npm run start
```

This starts the Next.js frontend on `http://localhost:3000`. The project is verified
against a production build; `npm run dev` also works but adds its own dev-only warnings
that do not appear in production.

### 4. Stop

```powershell
.\scripts\stop.ps1
```

## Routes

| Route | Description |
|-------|-------------|
| `/` | Marketing landing page |
| `/dashboard` | Platform overview and recent activity |
| `/datasets` | Dataset library and upload |
| `/datasets/[id]` | Dataset detail, profile, preview |
| `/explorer` | Data browser with pagination |
| `/data-quality` | Automated quality checks |
| `/analysis` | ML training (classification, regression, clustering, anomaly) |
| `/models` | Trained models and metrics |
| `/anomalies` | Anomaly detection results |
| `/iot-monitor` | Historical IoT replay |
| `/decisions` | Evidence-backed findings |
| `/reports` | PDF/JSON report generation |
| `/settings` | Platform configuration |
| `/pricing` | Product packaging (no payments are processed) |

## Datasets

Five genuine public datasets are pre-loaded:

| Dataset | Rows | Source | License |
|---------|------|--------|---------|
| AI4I 2020 Predictive Maintenance | 10,000 | UCI | CC BY 4.0 |
| Air Quality (Multi-site) | 9,357 | UCI | CC BY 4.0 |
| Wisconsin Breast Cancer (WDBC) | 569 | UCI | CC BY 4.0 |
| Household Power Consumption | 2,075,259 | UCI | CC BY 4.0 |
| Credit Card Fraud | 284,807 | OpenML 42175 | ODbL |

See `docs/DATASETS.md` for full details.

## Documentation

- `docs/ARCHITECTURE.md` — System architecture
- `docs/DESIGN.md` — Design system and visual identity
- `docs/DATASETS.md` — Dataset details and provenance
- `docs/API_DOCUMENTATION.md` — API endpoint reference
- `docs/SYLLABUS_MAPPING.md` — Academic syllabus mapping
- `docs/TESTING.md` — Testing approach and results

## License

This project is for educational and demonstration purposes. Datasets retain their original licenses.

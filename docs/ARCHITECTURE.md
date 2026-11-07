# DataSense AI — Architecture

## Overview

DataSense AI is a two-tier application: a FastAPI backend serving a REST API and a Next.js
frontend consuming it. Both run locally on the developer's machine. No authentication, no
payments, no external cloud services.

## Backend Architecture

### Technology Stack

- **Python 3.10** with venv
- **FastAPI** — web framework with automatic OpenAPI docs
- **pandas** — data manipulation and analysis
- **scikit-learn** — machine learning models
- **reportlab** — PDF report generation
- **SQLite (stdlib)** — embedded database for metadata, profiles, analyses, models, findings
- **uvicorn** — ASGI server

### Directory Layout

```
backend/
├── app/
│   ├── main.py           # FastAPI app, CORS, router inclusion, health/stats
│   ├── api/
│   │   ├── __init__.py
│   │   ├── main.py       # Health and stats routes
│   │   ├── datasets.py   # Upload, profile, quality, preview, export, delete
│   │   ├── analysis.py   # Recommendations, training runs, results
│   │   ├── models.py     # Model CRUD, prediction, download
│   │   ├── anomalies.py  # Anomaly detection results
│   │   ├── iot.py        # Historical replay session management
│   │   ├── decisions.py  # Evidence-backed findings
│   │   └── reports.py    # Report generation
│   ├── services/
│   │   ├── __init__.py
│   │   ├── ingestion.py  # CSV/Parquet upload validation and reading
│   │   ├── profiling.py  # Data profiling (n_rows, n_cols, stats, correlations)
│   │   ├── quality.py    # Quality scoring, per-column checks, imbalance
│   │   ├── ml_engine.py  # Supervised/unsupervised model training
│   │   ├── recommender.py# Analysis task recommendations
│   │   ├── decision_engine.py  # Evidence-backed findings generation
│   │   └── replay.py     # Historical IoT replay session management
│   ├── database.py       # SQLite connection context manager, helpers
│   └── config.py         # Paths and directory configuration
├── tests/                # Backend test suite
└── requirements.txt
```

### API Design

- All endpoints under `/api/`
- RESTful resource-oriented design
- JSON request/response bodies
- SQLite for metadata storage; Parquet files for large dataset storage
- Background threads for ML training (non-blocking API responses)
- 34 registered OpenAPI paths

### Key Services

| Service | Responsibility |
|---------|---------------|
| `ingestion.py` | Validate and read uploaded CSV/Parquet files |
| `profiling.py` | Compute dataset profile (rows, cols, types, stats, correlations) |
| `quality.py` | Quality scoring, per-column checks, imbalance detection |
| `ml_engine.py` | Train supervised/unsupervised ML models with scikit-learn |
| `recommender.py` | Recommend analysis tasks based on dataset profile |
| `decision_engine.py` | Generate evidence-backed findings with limitations |
| `replay.py` | Manage historical IoT replay sessions |

## Frontend Architecture

### Technology Stack

- **Next.js 15.5.29** — App Router with Turbopack
- **React 19** — UI framework
- **Tailwind v4** — Styling with CSS custom properties
- **Recharts** — Data visualization
- **lucide-react** — Icons
- **clsx** — Conditional class names

### Directory Layout

```
frontend/
├── src/
│   ├── app/
│   │   ├── layout.tsx          # Root layout (fonts, globals)
│   │   ├── page.tsx            # Redirect to /dashboard
│   │   ├── (marketing)/        # Marketing route group
│   │   │   ├── layout.tsx
│   │   │   └── page.tsx        # Landing page
│   │   └── (app)/              # App route group
│   │       ├── layout.tsx      # Wraps AppShell + providers
│   │       ├── dashboard/page.tsx
│   │       ├── datasets/page.tsx
│   │       ├── datasets/[id]/page.tsx
│   │       ├── explorer/page.tsx
│   │       ├── data-quality/page.tsx
│   │       ├── analysis/page.tsx
│   │       ├── models/page.tsx
│   │       ├── anomalies/page.tsx
│   │       ├── iot-monitor/page.tsx
│   │       ├── decisions/page.tsx
│   │       ├── reports/page.tsx
│   │       └── settings/page.tsx
│   ├── components/
│   │   ├── ui.tsx              # UI primitives (Button, Panel, Badge, Stat, etc.)
│   │   ├── charts.tsx          # Recharts components
│   │   ├── app-shell.tsx       # Sidebar navigation shell
│   │   └── dataset-switcher.tsx# Active dataset selector
│   └── lib/
│       ├── api.ts              # Typed API client
│       ├── dataset-context.tsx # Active dataset provider
│       ├── types.ts            # TypeScript type definitions
│       └── format.ts           # Formatting utilities
├── next.config.ts
├── package.json
└── tailwind.config.ts
```

### State Management

- `DatasetProvider` — Context for active dataset selection, persisted to localStorage
- `ToastProvider` — Context for toast notifications
- Each page fetches data directly from the API via `api.ts`

### Design Tokens

Defined in `globals.css` as CSS custom properties:
- `--paper` (#f5f2ec) — warm paper background
- `--ink` (#141922) — primary text
- `--accent` (#a9661a) — signal amber
- `--teal` (#1d6a66) — secondary accent
- `--line` (#e0d9cc) — hairline rules

Fonts: Instrument Serif (display), Geist (UI), Geist Mono (numbers)

## Data Flow

1. User uploads or selects a dataset via the frontend
2. Backend stores metadata in SQLite and data as Parquet
3. Frontend fetches dataset profile, quality, and preview via API
4. User configures and runs an ML analysis (classification, regression, clustering, anomaly)
5. Backend trains model in a background thread, stores results in SQLite
6. Frontend polls for completion, displays metrics and visualizations
7. User can generate reports (PDF/JSON) or export data

## Security

- No authentication (local demo mode)
- No authorization (single user)
- CORS enabled for localhost frontend
- No external API calls

## Deployment

Designed for local development only. Both backend and frontend run on `localhost`. No
containerization, no cloud deployment, no CI/CD pipeline.

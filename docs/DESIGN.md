# DataSense AI — Design

## Design Identity: "Research Instrument"

DataSense AI uses a "research instrument" design language — calm, precise, and trustworthy.
Inspired by laboratory equipment, scientific instruments, and academic publications rather
than consumer SaaS gradients and glows.

## Color Palette

| Token | Hex | Usage |
|-------|-----|-------|
| `--paper` | `#f5f2ec` | Background (warm off-white) |
| `--surface` | `#fffefb` | Cards and panels |
| `--surface-2` | `#efebe2` | Subtle surface variations |
| `--ink` | `#141922` | Primary text |
| `--ink-2` | `#3c4350` | Secondary text |
| `--muted` | `#6f6a60` | Helper text, labels |
| `--line` | `#e0d9cc` | Hairline rules |
| `--line-strong` | `#c9c0af` | Stronger borders |
| `--accent` | `#a9661a` | Signal amber — primary accent |
| `--accent-ink` | `#fffaf2` | Text on accent background |
| `--accent-soft` | `#f2e3cb` | Light accent backgrounds |
| `--teal` | `#1d6a66` | Secondary accent — data viz |
| `--danger` | `#a33a2b` | Errors, warnings |
| `--ok` | `#3f6b35` | Success states |

## Typography

| Font | Usage |
|------|-------|
| **Instrument Serif** | Display headings, brand name |
| **Geist** | UI text, body copy |
| **Geist Mono** | Numbers, code, data values |

## Visual Principles

1. **Hairline rules, not shadows** — Panels use 1px borders (`--line`) instead of heavy
   drop shadows, creating a flat, instrument-like appearance.

2. **Warm paper, not stark white** — The `--paper` background (#f5f2ec) reduces eye strain
   and feels more like a physical document than a screen.

3. **Signal colors used sparingly** — Amber (`#a9661a`) draws attention to important
   actions and findings. Teal (`#1d6a66`) represents data and measurements.

4. **Numerals in mono** — All numbers use `Geist Mono` with `tabular-nums` for consistent
   vertical alignment in tables and stats.

5. **No gradients** — Flat colors only. Gradients read as consumer SaaS and undermine the
   research instrument aesthetic.

## UI Components

All components live in `frontend/src/components/ui.tsx`:

| Component | Purpose |
|-----------|---------|
| `Button` | Primary, secondary, ghost, danger variants; supports `asChild` for Link wrapping |
| `Panel` | Card container with optional title, eyebrow, and actions |
| `Badge` | Status labels with tone variants (neutral, accent, ok, danger, muted, teal) |
| `Stat` | Key-value metric display with optional trend subtext |
| `EmptyState` | Placeholder for empty data with optional action |
| `ErrorState` | Error display with retry action |
| `Skeleton` / `LoadingRows` | Loading placeholders |
| `Field` / `Input` / `Select` / `Textarea` | Form controls |
| `DataTable` | Simple HTML table with header and body |
| `Tabs` | Tab navigation |
| `Dialog` | Modal dialog |
| `ToastProvider` / `useToast` | Toast notifications |
| `Progress` | Progress bar |

## Chart Components

All charts live in `frontend/src/components/charts.tsx`:

| Component | Purpose |
|-----------|---------|
| `HistogramChart` | Bar chart for numeric distributions |
| `LineSeriesChart` | Multi-line time series |
| `ScatterPlot` | Scatter plot with optional grouping |
| `BarSeriesChart` | Horizontal/vertical bar chart |
| `CorrelationHeatmap` | Correlation matrix heatmap |

Chart colors use the design token palette: amber, teal, slateblue, clay, moss, plum.

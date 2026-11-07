"use client";

import { api } from "@/lib/api";
import { fmtBytes, fmtNumber, fmtFloat, fmtPct, fmtDate, timeAgo, titleCase } from "@/lib/format";
import { Button, Panel, Stat, Badge, DataTable, EmptyState, ErrorState, Skeleton, LoadingRows } from "@/components/ui";
import { useEffect, useState } from "react";
import { HistogramChart, BarSeriesChart, CorrelationHeatmap } from "@/components/charts";
import { Database, Play, Download, RefreshCw, BarChart3, Waves } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useDataset } from "@/lib/dataset-context";

export default function DatasetDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const { activeId, setActiveId } = useDataset();
  const [dataset, setDataset] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [quality, setQuality] = useState<any>(null);
  const [preview, setPreview] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = (signal: { cancelled: boolean }) => {
    Promise.all([
      api.getDataset(id).catch(() => null),
      api.getProfile(id).catch(() => null),
      api.getQuality(id).catch(() => null),
      api.preview(id, 50, 0).catch(() => null),
    ]).then(([d, p, q, pr]) => {
      if (!signal.cancelled) {
        if (d) setDataset(d);
        if (p) setProfile(p);
        if (q) setQuality(q);
        if (pr) setPreview(pr);
        setLoading(false);
        if (!d) setError("Dataset not found.");
      }
    });
  };

  useEffect(() => {
    const signal = { cancelled: false };
    load(signal);
    return () => { signal.cancelled = true; };
  }, [id]);

  // Keep the global dataset switcher in sync with the dataset being viewed,
  // so the topbar never labels one dataset while the page shows another.
  useEffect(() => {
    if (id && activeId && id !== activeId) setActiveId(id);
  }, [id, activeId, setActiveId]);

  if (loading) return (
    <div className="space-y-4">
      <Panel title="Dataset profile" eyebrow="Overview"><LoadingRows cols={4} rows={2} /></Panel>
      <Panel title="Preview" eyebrow="First 50 rows"><LoadingRows cols={6} rows={6} /></Panel>
    </div>
  );

  if (error) return <ErrorState message={error} retry={() => window.location.reload()} />;

  const p = profile!;
  const q = quality!;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[17px] font-semibold text-ink">{dataset.name}</h1>
          <p className="text-[11.5px] text-muted">{dataset.original_filename} · {dataset.provider ?? "Unknown provider"} · {dataset.license ?? "Unknown license"}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => { api.reprofile(id).then(() => load({ cancelled: false })).catch(() => {}); }}>
            <RefreshCw size={14} /> Reprofile
          </Button>
          <Button variant="secondary" size="sm" asChild>
            <a href={api.exportUrl(id, "csv")}><Download size={14} /> CSV</a>
          </Button>
          <Button variant="secondary" size="sm" asChild>
            <a href={api.exportUrl(id, "json")}><Download size={14} /> JSON</a>
          </Button>
        </div>
      </div>

      {/* Key stats */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Rows" value={fmtNumber(p.n_rows)} sub={p.sampled ? "sampled for profiling" : "total rows"} />
        <Stat label="Columns" value={p.n_cols} sub={p.numeric_columns.length + " numeric · " + p.categorical_columns.length + " categorical"} />
        <Stat label="Missing" value={fmtPct(p.missing_pct)} sub={p.total_missing + " cells"} tone={p.missing_pct > 10 ? "danger" : "teal"} />
        <Stat label="Quality" value={q.score + "/100"} sub={q.score < 60 ? "Needs attention" : "Good"} tone={q.score < 60 ? "danger" : "teal"} />
      </div>

      <div className="grid gap-6 grid-cols-1 lg:grid-cols-3">
        {/* Column profile */}
        <div className="lg:col-span-2">
          <Panel title="Column profile" eyebrow="Schema">
            {p.columns ? (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-[12px]">
                  <thead>
                    <tr className="border-b border-line">
                      <th className="px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted">Column</th>
                      <th className="px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted">Type</th>
                      <th className="px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted text-right">Missing</th>
                      <th className="px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted text-right">Stats</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {Object.entries(p.columns).map(([name, col]: [string, any]) => (
                      <tr key={name}>
                        <td className="px-3 py-2 font-mono text-[11px]">{name}</td>
                        <td className="px-3 py-2">
                          <Badge tone={col.semantic_type === "numeric" ? "teal" : col.semantic_type === "categorical" ? "accent" : "neutral"}>
                            {titleCase(col.semantic_type)}
                          </Badge>
                        </td>
                        <td className="px-3 py-2 text-right">{fmtPct(col.missing / (p.n_rows || 1) * 100, 1)}</td>
                        <td className="px-3 py-2 text-right">
                          {col.stats && col.stats.mean != null ? fmtFloat(col.stats.mean, 2) : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : <EmptyState title="No column data" body="Profile the dataset to see column details." />}
          </Panel>
        </div>

        {/* Correlation heatmap */}
        <div className="lg:col-span-1">
          <Panel title="Correlation" eyebrow="Numeric columns">
            {p.correlation && Object.keys(p.correlation).length > 0 ? (
              <CorrelationHeatmap matrix={p.correlation} height={320} />
            ) : (
              <EmptyState title="No correlations" body="Not enough numeric columns." />
            )}
          </Panel>
        </div>
      </div>

      {/* Charts row */}
      <div className="grid gap-6 grid-cols-1 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Panel title="Numeric distributions" eyebrow="Histograms">
            <div className="grid gap-4 grid-cols-1 md:grid-cols-2">
              {p.numeric_columns.slice(0, 4).map((col: string) => {
                const hist = (p.columns?.[col]?.stats?.histogram ?? []) as
                  { bin_start: number; bin_end: number; count: number }[];
                return hist.length > 0 ? (
                  <HistogramChart key={col} data={hist} xLabel={col} height={200} />
                ) : (
                  <div key={col} className="flex items-center justify-center h-[200px] text-[11px] text-muted">
                    No distribution data for {col}
                  </div>
                );
              })}
            </div>
          </Panel>
        </div>

        <div className="lg:col-span-1">
          <Panel title="Quality issues" eyebrow="Automated checks">
            {q.issues && q.issues.length > 0 ? (
              <div className="space-y-3">
                {q.issues.map((issue: any, i: number) => (
                  <div key={i} className="flex items-start gap-2 p-2 rounded bg-surface-2">
                    <Badge tone={issue.severity === "high" ? "danger" : issue.severity === "medium" ? "accent" : "muted"}>{issue.code}</Badge>
                    <div className="text-[12px] leading-relaxed">{issue.message}</div>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState title="No issues" body="Automated checks found no quality problems." />
            )}
          </Panel>
        </div>
      </div>

      {/* Preview table */}
      <Panel title="Preview (first 50 rows)" eyebrow="Data">
        {preview ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[11px]">
              <thead>
                <tr className="border-b border-line">
                  {preview.columns.map((c: string) => (
                    <th key={c} className="px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted">{c}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {preview.rows.map((row: Record<string, any>, i: number) => (
                  <tr key={i} className="hover:bg-surface-2">
                    {preview.columns.map((c: string) => (
                      <td key={c} className="px-3 py-2 font-mono text-[10.5px]">{row[c] == null ? "—" : String(row[c])}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="mt-2 flex items-center justify-between">
              <span className="text-[11px] text-muted">{preview.total_rows} total rows · showing {preview.rows.length}</span>
              <Button variant="ghost" size="sm" asChild>
                <a href={`/explorer?dataset=${id}`}>Open in Explorer →</a>
              </Button>
            </div>
          </div>
        ) : <EmptyState title="No preview" body="Unable to load preview." />}
      </Panel>
    </div>
  );
}

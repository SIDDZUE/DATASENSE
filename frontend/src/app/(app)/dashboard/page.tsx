"use client";

import { api } from "@/lib/api";
import { fmtBytes, fmtNumber, fmtPct, timeAgo } from "@/lib/format";
import { Badge, Panel, Stat, EmptyState, Button, Skeleton, LoadingRows } from "@/components/ui";
import { useEffect, useState } from "react";
import { HistogramChart, LineSeriesChart, BarSeriesChart } from "@/components/charts";
import { LayoutDashboard } from "lucide-react";

export default function DashboardPage() {
  const [stats, setStats] = useState<any>({ datasets: 0, total_rows: 0, models: 0, reports: 0, findings_by_severity: {} });
  const [analyses, setAnalyses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    Promise.all([api.stats(), api.listAnalyses()]).then(
      ([s, a]) => { if (!cancelled) { setStats(s); setAnalyses(a.analyses); setLoading(false); } },
      () => { if (!cancelled) setLoading(false); }
    );
    return () => { cancelled = true; };
  }, []);

  if (loading) return (
    <div className="flex flex-col gap-4">
      <Panel title="Platform overview" eyebrow="Dashboard"><LoadingRows cols={3} rows={2} /></Panel>
      <Panel title="Recent analyses" eyebrow="Activity"><LoadingRows cols={3} rows={4} /></Panel>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[17px] font-semibold text-ink">Dashboard</h1>
          <p className="text-[11.5px] text-muted">Platform overview and recent activity.</p>
        </div>
        <Button variant="primary" size="sm" asChild>
          <a href="/datasets">Go to datasets</a>
        </Button>
      </div>

      {/* Stats row */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Datasets" value={fmtNumber(stats.datasets)} sub="Loaded into the platform" />
        <Stat label="Total rows" value={fmtNumber(stats.total_rows)} sub="Across all datasets" tone="teal" />
        <Stat label="Models" value={fmtNumber(stats.models)} sub="Trained &amp; saved" tone="accent" />
        <Stat label="Reports" value={fmtNumber(stats.reports)} sub="Generated &amp; downloadable" />
      </div>

      <div className="grid gap-6 grid-cols-1 lg:grid-cols-3">
        <Panel title="Findings by severity" eyebrow="Decisions">
          <div className="space-y-3">
            {Object.entries(stats.findings_by_severity || {}).map(([sev, count]) => (
              <div key={sev} className="flex items-baseline justify-between">
                <span className="text-[12px] text-muted">{sev.charAt(0).toUpperCase() + sev.slice(1)}</span>
                <span className={`num text-[16px] font-semibold ${toneColor(sev)}`}>{Number(count)}</span>
                <Badge tone={sev === "high" ? "danger" : sev === "medium" ? "accent" : "muted"}>{sev}</Badge>
              </div>
            ))}
            {Object.keys(stats.findings_by_severity || {}).length === 0 && (
              <div className="text-[12px] text-muted">No findings yet.</div>
            )}
          </div>
        </Panel>

        <Panel title="Storage" eyebrow="Platform">
          <div className="space-y-3">
            <div className="flex items-baseline justify-between">
              <span className="text-[12px] text-muted">Total data size</span>
              <span className="num text-[15px] font-semibold text-ink">{fmtBytes(stats.total_bytes)}</span>
            </div>
            <div className="w-full h-1 rounded bg-surface-2">
              <div className="h-full rounded bg-teal" style={{ width: Math.min(100, (stats.total_bytes / (1024*1024*100)) * 100) + "%" }} />
            </div>
            <p className="text-[11px] text-muted">Approximate visualisation of stored data volume.</p>
          </div>
        </Panel>

        <Panel title="System status" eyebrow="Platform">
          <div className="flex items-center gap-3">
            <div className="h-2.5 w-2.5 rounded-full bg-ok" />
            <span className="text-[12px] text-ok">API online</span>
          </div>
          <div className="mt-3 space-y-2">
            <div className="flex items-baseline justify-between">
              <span className="text-[12px] text-muted">Backend</span>
              <span className="num text-[13px] font-semibold text-ink">FastAPI + scikit-learn</span>
            </div>
            <div className="flex items-baseline justify-between">
              <span className="text-[12px] text-muted">Frontend</span>
              <span className="num text-[13px] font-semibold text-ink">Next.js 15 + Tailwind v4</span>
            </div>
          </div>
        </Panel>
      </div>

      {/* Recent analyses */}
      <Panel title="Recent analyses" eyebrow="Activity">
        {analyses.length === 0 ? (
          <EmptyState
            title="No analyses yet"
            body="Run a classification, regression, clustering or anomaly detection from the Analysis page."
            action={<Button variant="primary" size="sm" asChild><a href="/analysis">Create analysis</a></Button>}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[12px]">
              <thead>
                <tr className="border-b border-line">
                  <th className="px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted">Task</th>
                  <th className="px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted">Target</th>
                  <th className="px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted">Algorithm</th>
                  <th className="px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted">Status</th>
                  <th className="px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted text-right">When</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {analyses.slice(0, 8).map((a) => (
                  <tr key={a.id}>
                    <td className="px-3 py-2.5">{a.task_type}</td>
                    <td className="px-3 py-2.5 text-muted">{a.target_column ?? "—"}</td>
                    <td className="px-3 py-2.5 text-muted">{a.algorithm ?? "—"}</td>
                    <td className="px-3 py-2.5">
                      <Badge tone={a.status === "completed" ? "ok" : a.status === "failed" ? "danger" : "muted"}>
                        {a.status}
                      </Badge>
                    </td>
                    <td className="px-3 py-2.5 text-muted text-right">{timeAgo(a.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </div>
  );
}

function toneColor(sev: string) {
  if (sev === "high") return "text-danger";
  if (sev === "medium") return "text-accent";
  if (sev === "low") return "text-muted";
  return "text-ok";
}
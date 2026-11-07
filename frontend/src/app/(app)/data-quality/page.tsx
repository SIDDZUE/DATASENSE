"use client";

import { api } from "@/lib/api";
import { fmtNumber, fmtPct } from "@/lib/format";
import { Button, Panel, Badge, Stat, EmptyState, Skeleton, LoadingRows } from "@/components/ui";
import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useResolvedDataset } from "@/lib/dataset-context";
import { BarSeriesChart } from "@/components/charts";
import { Database, ShieldCheck } from "lucide-react";

export default function DataQualityPage() {
  const searchParams = useSearchParams();
  const datasetId = useResolvedDataset(searchParams.get("dataset"));
  const [quality, setQuality] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!datasetId) return;
    let cancelled = false;
    Promise.all([api.getQuality(datasetId!), api.getProfile(datasetId!)]).then(
      ([q, p]) => { if (!cancelled) { setQuality(q); setProfile(p); setLoading(false); } },
      () => { if (!cancelled) setLoading(false); }
    );
    return () => { cancelled = true; };
  }, [datasetId]);

  if (!datasetId) {
    return (
      <Panel title="Data quality" eyebrow="Inspection">
        <EmptyState
          title="No dataset selected"
          body="Choose a dataset from the top bar switcher."
          action={<Button variant="primary" size="sm" asChild><a href="/datasets">Go to datasets</a></Button>}
        />
      </Panel>
    );
  }

  if (loading) return (
    <Panel title="Data quality" eyebrow="Inspection">
      <div className="space-y-4"><LoadingRows cols={4} rows={3} /></div>
    </Panel>
  );

  const q = quality!;
  const p = profile!;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[17px] font-semibold text-ink">Data quality</h1>
          <p className="text-[11.5px] text-muted">Automated quality checks for the selected dataset.</p>
        </div>
        <Button variant="secondary" size="sm" asChild>
          <a href={`/datasets/${datasetId}`}>Back to dataset</a>
        </Button>
      </div>

      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Quality score" value={q.score + "/100"} sub={q.score < 60 ? "Needs attention" : "Good"} tone={q.score < 60 ? "danger" : "teal"} />
        <Stat label="Missing cells" value={fmtNumber(q.total_missing)} sub={fmtPct(q.duplicate_rows === undefined ? 0 : q.duplicate_rows === 0 ? 0 : q.duplicate_rows, 1)} />
        <Stat label="Duplicate rows" value={fmtNumber(q.duplicate_rows)} sub="Exact duplicates" />
        <Stat label="Columns checked" value={fmtNumber(q.per_column.length)} sub="Per-column analysis" />
      </div>

      <div className="grid gap-6 grid-cols-1 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Panel title="Per-column issues" eyebrow="Detailed checks">
            {q.per_column && q.per_column.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-[12px]">
                  <thead>
                    <tr className="border-b border-line">
                      <th className="px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted">Column</th>
                      <th className="px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted">Type</th>
                      <th className="px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted text-right">Missing</th>
                      <th className="px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted text-right">Outliers</th>
                      <th className="px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted text-right">Constant</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {q.per_column.map((col: any, i: number) => (
                      <tr key={i} className="hover:bg-surface-2">
                        <td className="px-3 py-2 font-mono text-[11px]">{col.column}</td>
                        <td className="px-3 py-2"><Badge tone="neutral">{col.semantic_type}</Badge></td>
                        <td className="px-3 py-2 text-right">{fmtPct(col.missing_pct, 1)}</td>
                        <td className="px-3 py-2 text-right">{col.outlier_pct != null ? fmtPct(col.outlier_pct, 1) : "—"}</td>
                        <td className="px-3 py-2 text-right">{col.constant ? "Yes" : "No"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <EmptyState title="No column data" body="Run profiling to see per-column details." />
            )}
          </Panel>
        </div>

        <div className="lg:col-span-1">
          <Panel title="Imbalance" eyebrow="Target distribution">
            {q.imbalance ? (
              <div className="space-y-3">
                <div className="flex items-baseline justify-between mb-2">
                  <span className="text-[12px] text-muted">Target</span>
                  <span className="font-mono text-[12px] text-ink">{q.imbalance.target}</span>
                </div>
                <div className="space-y-1">
                  {Object.entries(q.imbalance.distribution as Record<string, number>).map(([label, pct]) => (
                    <div key={label} className="flex items-center gap-2">
                      <span className="text-[11px] w-16">{label}</span>
                      <div className="flex-1 h-1.5 rounded bg-surface-2">
                        <div className="h-full rounded bg-accent" style={{ width: pct + "%" }} />
                      </div>
                      <span className="num text-[11px] w-10 text-right">{fmtPct(pct)}</span>
                    </div>
                  ))}
                </div>
                <div className="mt-2">
                  <Badge tone={q.imbalance.imbalanced ? "danger" : "ok"}>
                    {q.imbalance.imbalanced ? "Imbalanced" : "Balanced"}
                  </Badge>
                </div>
              </div>
            ) : (
              <EmptyState title="No imbalance data" body="No target column detected." />
            )}
          </Panel>

          <Panel title="Issues list" eyebrow="Automated flags">
            {q.issues && q.issues.length > 0 ? (
              <div className="space-y-2">
                {q.issues.map((issue: any, i: number) => (
                  <div key={i} className="flex items-start gap-2 p-2 rounded bg-surface-2 border border-line/50">
                    <Badge tone={issue.severity === "high" ? "danger" : issue.severity === "medium" ? "accent" : "muted"}>{issue.code}</Badge>
                    <span className="text-[11.5px]">{issue.message}</span>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState title="No issues" body="Automated checks found no quality problems." />
            )}
          </Panel>
        </div>
      </div>
    </div>
  );
}

"use client";

import { api } from "@/lib/api";
import { fmtNumber, fmtPct, timeAgo } from "@/lib/format";
import { Button, Panel, Badge, EmptyState, Stat, Skeleton, LoadingRows } from "@/components/ui";
import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useResolvedDataset } from "@/lib/dataset-context";
import { Activity, Play } from "lucide-react";

export const dynamic = "force-dynamic";

export default function AnomaliesPage() {
  const searchParams = useSearchParams();
  const datasetId = useResolvedDataset(searchParams.get("dataset"));
  const [anomalies, setAnomalies] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!datasetId) return;
    loadAnomalies();
  }, [datasetId]);

  async function loadAnomalies() {
    try {
      const res = await api.listAnomalies(datasetId!);
      setAnomalies(res.anomalies);
    } catch { setAnomalies([]); } finally { setLoading(false); }
  }

  if (!datasetId) {
    return (
      <Panel title="Anomalies" eyebrow="Outlier detection">
        <EmptyState
          title="No dataset selected"
          body="Choose a dataset from the top bar switcher."
          action={<Button variant="primary" size="sm" asChild><a href="/datasets">Go to datasets</a></Button>}
        />
      </Panel>
    );
  }

  if (loading) return (
    <Panel title="Anomalies" eyebrow="Outlier detection">
      <div className="p-4"><LoadingRows cols={3} rows={3} /></div>
    </Panel>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[17px] font-semibold text-ink">Anomalies</h1>
          <p className="text-[11.5px] text-muted">Unsupervised outlier detection results.</p>
        </div>
        <Button variant="secondary" size="sm" asChild>
          <a href={`/datasets/${datasetId}`}>Back to dataset</a>
        </Button>
      </div>

      {anomalies.length === 0 ? (
        <Panel title="No anomalies yet" eyebrow="Outlier detection">
          <EmptyState
            title="No anomaly results"
            body="Run anomaly detection from the Analysis page to flag unusual rows."
            action={<Button variant="primary" size="sm" asChild><a href="/analysis">Go to analysis</a></Button>}
          />
        </Panel>
      ) : (
        <div className="space-y-4">
          {anomalies.map((a) => (
            <Panel key={a.id} title={`${a.method} anomaly detection`} eyebrow="Results">
              <div className="grid gap-4 grid-cols-1 sm:grid-cols-3">
                <Stat label="Rows scored" value={fmtNumber(a.n_rows)} />
                <Stat label="Flagged" value={fmtNumber(a.n_flagged)} tone="danger" />
                <Stat label="Flagged %" value={fmtPct(a.results?.flagged_pct ?? 0)} tone="danger" />
              </div>

              <div className="mt-4 border-t border-line pt-4">
                <div className="text-[10px] font-semibold uppercase tracking-[0.1em] text-muted mb-2">Top anomalous records</div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-[11px]">
                    <thead>
                      <tr className="border-b border-line">
                        <th className="px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted">Row</th>
                        <th className="px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted text-right">Score</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-line">
                      {a.results?.top_anomalies?.slice(0, 10).map((anom: any, i: number) => (
                        <tr key={i}>
                          <td className="px-3 py-2 font-mono text-[10.5px]">{anom.row_index}</td>
                          <td className="px-3 py-2 text-right num text-[10.5px]">{anom.anomaly_score != null ? anom.anomaly_score.toFixed(4) : "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="mt-3 flex items-center gap-1 text-[11px] text-muted">
                <span>Contamination: {fmtPct(a.contamination ?? 0)}</span>
                <span aria-hidden>·</span>
                <span>Created {timeAgo(a.created_at)}</span>
              </div>
            </Panel>
          ))}
        </div>
      )}
    </div>
  );
}



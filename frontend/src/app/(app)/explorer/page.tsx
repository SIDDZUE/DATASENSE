"use client";

import { api } from "@/lib/api";
import { fmtNumber, fmtFloat } from "@/lib/format";
import { Button, Panel, DataTable, EmptyState, Skeleton, Badge, LoadingRows } from "@/components/ui";
import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useResolvedDataset } from "@/lib/dataset-context";
import { ScatterPlot, LineSeriesChart, BarSeriesChart } from "@/components/charts";

export const dynamic = "force-dynamic";

export default function ExplorerPage() {
  const searchParams = useSearchParams();
  const datasetId = useResolvedDataset(searchParams.get("dataset"));
  const [columns, setColumns] = useState<string[]>([]);
  const [rows, setRows] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [limit, setLimit] = useState(50);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!datasetId) return;
    load();
  }, [datasetId, offset, limit]);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await api.preview(datasetId!, limit, offset);
      setColumns(res.columns);
      setRows(res.rows);
      setTotal(res.total_rows);
    } catch (e: any) {
      setError(e.message || "Failed to load preview.");
    } finally {
      setLoading(false);
    }
  }

  if (error) return <ErrorState message={error} retry={load} />;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[17px] font-semibold text-ink">Explorer</h1>
          <p className="text-[11.5px] text-muted">Browse dataset contents with pagination.</p>
        </div>
        {datasetId && (
          <Button variant="secondary" size="sm" asChild>
            <a href={`/datasets/${datasetId}`}>Back to dataset</a>
          </Button>
        )}
      </div>

      {!datasetId ? (
        <Panel title="Select a dataset" eyebrow="Explorer">
          <EmptyState
            title="No dataset selected"
            body="Choose a dataset from the top bar switcher or add ?dataset=<id> to the URL."
            action={<Button variant="primary" size="sm" asChild><a href="/datasets">Go to datasets</a></Button>}
          />
        </Panel>
      ) : (
        <div className="grid gap-6 grid-cols-1 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <Panel title="Data preview" eyebrow={`Dataset ${datasetId} · ${total} rows`}>
              {loading ? (
                <div className="p-4"><LoadingRows cols={6} rows={6} /></div>
              ) : rows.length === 0 ? (
                <EmptyState title="No rows" body="This dataset has no rows to display." />
              ) : (
                <>
                  <div className="overflow-x-auto mb-4">
                    <table className="w-full text-left text-[11px]">
                      <thead>
                        <tr className="border-b border-line">
                          {columns.map((c) => (
                            <th key={c} className="px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted">{c}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-line">
                        {rows.map((row, i) => (
                          <tr key={i} className="hover:bg-surface-2">
                            {columns.map((c) => (
                              <td key={c} className="px-3 py-2 font-mono text-[10.5px]">{row[c] == null ? "—" : String(row[c])}</td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] text-muted">
                      Showing {offset + 1}–{Math.min(offset + limit, total)} of {fmtNumber(total)}
                    </span>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={offset === 0}
                        onClick={() => setOffset(Math.max(0, offset - limit))}
                      >
                        Prev
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={offset + limit >= total}
                        onClick={() => setOffset(offset + limit)}
                      >
                        Next
                      </Button>
                      <select
                        value={limit}
                        onChange={(e) => { setLimit(Number(e.target.value)); setOffset(0); }}
                        className="rounded-[4px] border border-line-strong bg-surface px-2 py-1 text-[11px] text-ink focus:border-accent focus:outline-none"
                      >
                        {[25, 50, 100].map((l) => (
                          <option key={l} value={l}>{l}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </>
              )}
            </Panel>
          </div>

          <div className="lg:col-span-1">
            <Panel title="Quick charts" eyebrow="Numeric columns">
              <p className="text-[11px] text-muted mb-3">Visualise numeric columns from the current page.</p>
              {rows.length > 0 ? (
                <div className="space-y-3">
                  {Object.keys(rows[0] || {}).slice(0, 3).map((col) => {
                    const numericRows = rows.filter((r) => typeof r[col] === "number");
                    if (numericRows.length === 0) return null;
                    return (
                      <div key={col}>
                        <div className="text-[10px] font-semibold uppercase tracking-[0.1em] text-muted mb-1">{col}</div>
                        <BarSeriesChart
                          data={numericRows.map((r, i) => ({ x: i, y: r[col] }))}
                          xKey="x"
                          yKey="y"
                          height={140}
                        />
                      </div>
                    );
                  })}
                </div>
              ) : (
                <EmptyState title="No data" body="Load rows to see charts." />
              )}
            </Panel>
          </div>
        </div>
      )}
    </div>
  );
}

function ErrorState({ message, retry }: { message: string; retry: () => void }) {
  return (
    <div className="flex flex-col items-center gap-3 border border-dashed border-line-strong px-6 py-10 text-center">
      <p className="max-w-lg text-[13px] text-ink-2">{message}</p>
      <Button size="sm" onClick={retry}>Try again</Button>
    </div>
  );
}

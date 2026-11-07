"use client";

import { api } from "@/lib/api";
import { fmtBytes, fmtNumber, fmtDate, fmtPct } from "@/lib/format";
import { Button, Panel, DataTable, EmptyState, Badge } from "@/components/ui";
import { UploadDialog } from "@/components/upload-dialog";
import { useEffect, useState } from "react";
import { Database, Upload, RefreshCw } from "lucide-react";

export default function DatasetsPage() {
  const [datasets, setDatasets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    try {
      const res = await api.listDatasets();
      setDatasets(res.datasets);
    } catch { setDatasets([]); } finally { setLoading(false); }
  }

  async function deleteDataset(id: string, name: string) {
    if (confirmDelete !== id) { setConfirmDelete(id); return; }
    setConfirmDelete(null);
    try {
      await api.deleteDataset(id);
      await load();
    } catch { alert(`Failed to delete "${name}".`); }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[17px] font-semibold text-ink">Datasets</h1>
          <p className="text-[11.5px] text-muted">Manage and explore your uploaded datasets.</p>
        </div>
        <Button variant="primary" size="sm" onClick={() => setUploadOpen(true)}>
          <Upload size={14} /> Upload dataset
        </Button>
      </div>

      <div className="grid gap-4 grid-cols-1 lg:grid-cols-12">
        <div className="lg:col-span-8">
          <Panel title={datasets.length === 0 ? "No datasets" : `Datasets (${datasets.length})`} eyebrow="Data library" actions={
            <button onClick={() => { setRefreshing(true); load().finally(() => setRefreshing(false)); }} className="rounded p-1.5 text-muted hover:bg-surface-2" aria-label="Refresh">
              <RefreshCw size={14} className={refreshing ? "animate-spin" : ""} />
            </button>
          }>
            {loading ? (
              <div className="p-4"><SkeletonRow cols={6} rows={4} /></div>
            ) : datasets.length === 0 ? (
              <EmptyState
                title="No datasets yet"
                body="Upload a CSV, XLSX, JSON or Parquet file to profile and analyse it. Genuine public datasets are also pre-loaded."
                action={<Button variant="primary" size="sm" onClick={() => setUploadOpen(true)}><Upload size={14} /> Upload a dataset</Button>}
              />
            ) : (
              <div className="space-y-2 overflow-x-auto">
                <table className="w-full text-left text-[12px]">
                  <thead>
                    <tr className="border-b border-line">
                      <th className="px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted">Name</th>
                      <th className="px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted text-right">Rows</th>
                      <th className="px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted text-right">Cols</th>
                      <th className="px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted text-right">Size</th>
                      <th className="px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted">Format</th>
                      <th className="px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted text-right">Target</th>
                      <th className="px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted">Added</th>
                      <th className="px-3 py-2" aria-label="Actions" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {datasets.map((d) => (
                      <tr key={d.id} className="hover:bg-surface-2 transition-colors">
                        <td className="px-3 py-2.5">
                          <a href={`/datasets/${d.id}`} className="text-ink hover:text-accent font-medium">{d.name}</a>
                          <div className="text-[10px] text-muted">{d.original_filename}{d.provider ? ` · ${d.provider}` : ""}</div>
                        </td>
                        <td className="px-3 py-2.5 text-right num">{fmtNumber(d.n_rows)}</td>
                        <td className="px-3 py-2.5 text-right num">{d.n_cols}</td>
                        <td className="px-3 py-2.5 text-right">{fmtBytes(d.size_bytes)}</td>
                        <td className="px-3 py-2.5">
                          <Badge tone="neutral">{d.format.toUpperCase()}</Badge>
                        </td>
                        <td className="px-3 py-2.5 text-right">
                          <span className={d.suggested_target ? "text-ok font-medium" : "text-muted"}>{d.suggested_target ?? "—"}</span>
                        </td>
                        <td className="px-3 py-2.5 text-muted">{fmtDate(d.created_at)}</td>
                        <td className="px-3 py-2.5 text-right">
                          <button
                            onClick={() => deleteDataset(d.id, d.name)}
                            className={confirmDelete === d.id
                              ? "rounded-[3px] border border-danger/40 bg-danger/10 px-1.5 py-0.5 text-[10px] font-semibold text-danger"
                              : "rounded-[3px] border border-transparent px-1.5 py-0.5 text-[10px] text-muted hover:border-danger/30 hover:text-danger"}
                            title={confirmDelete === d.id ? "Click again to confirm" : "Delete dataset"}
                          >
                            {confirmDelete === d.id ? "Confirm delete" : "Delete"}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>
        </div>

        <div className="lg:col-span-4">
          <Panel title="Upload dataset" eyebrow="Add data">
            <p className="text-[11.5px] text-muted mb-4">
              Upload a CSV, XLSX, JSON or Parquet file. It is validated, profiled automatically and stored as
              Parquet for fast access — the original file is never modified.
            </p>
            <Button variant="secondary" size="sm" onClick={() => setUploadOpen(true)}>
              <Upload size={14} /> Select file
            </Button>
            <div className="mt-3 space-y-1">
              <div className="flex items-baseline gap-1">
                <span className="text-[10px] text-muted">Pre-loaded:</span>
                <span className="num text-[11px] font-semibold text-ink">{datasets.length}</span>
              </div>
              <div className="flex items-baseline gap-1">
                <span className="text-[10px] text-muted">Providers:</span>
                <span className="text-[11px] text-muted">UCI · OpenML</span>
              </div>
            </div>
          </Panel>
        </div>
      </div>

      <UploadDialog open={uploadOpen} onClose={() => setUploadOpen(false)}
        onUploaded={() => { load(); }} />
    </div>
  );
}

function SkeletonRow({ cols, rows }: { cols: number; rows: number }) {
  return (
    <div className="space-y-2 p-4">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="grid gap-2" style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}>
          {Array.from({ length: cols }).map((_, j) => (
            <div key={j} className="h-4 bg-surface-2 rounded" />
          ))}
        </div>
      ))}
    </div>
  );
}

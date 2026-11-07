"use client";

import { api } from "@/lib/api";
import { fmtBytes, fmtDate, fmtNumber } from "@/lib/format";
import { Button, Panel, Badge, EmptyState, Skeleton, LoadingRows } from "@/components/ui";
import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useDataset, useResolvedDataset } from "@/lib/dataset-context";
import { FileText, Download } from "lucide-react";

export default function ReportsPage() {
  const searchParams = useSearchParams();
  // ?dataset= narrows the history list; generation always targets the
  // currently active dataset so the page stays usable without a deep link.
  const urlDataset = searchParams.get("dataset");
  const listFilter = urlDataset ?? undefined;
  const datasetId = useResolvedDataset(urlDataset);
  const { active } = useDataset();
  const [reports, setReports] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    loadReports();
  }, [listFilter]);

  async function loadReports() {
    try {
      const res = await api.listReports(listFilter);
      setReports(res.reports);
    } catch { setReports([]); } finally { setLoading(false); }
  }

  async function generateReport(format: "pdf" | "json") {
    if (!datasetId) return;
    setGenerating(true);
    try {
      const res = await api.generateReport(datasetId, format);
      setGenerating(false);
      alert(`Report generated: ${res.filename}\nDownload: ${res.download_url}`);
      loadReports();
    } catch (e: any) {
      setGenerating(false);
      alert(e.message || "Failed to generate report.");
    }
  }

  if (loading) return (
    <Panel title="Reports" eyebrow="Generated reports">
      <div className="p-4"><LoadingRows cols={3} rows={3} /></div>
    </Panel>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[17px] font-semibold text-ink">Reports</h1>
          <p className="text-[11.5px] text-muted">
            Generate and download PDF or JSON reports.
            {active && datasetId ? ` New reports use ${active.name}.` : ""}
          </p>
        </div>
        {datasetId && (
          <div className="flex items-center gap-2">
            <Button variant="secondary" size="sm" onClick={() => generateReport("pdf")} disabled={generating}>
              {generating ? (
                <span className="flex items-center gap-1">
                  <span className="h-3 w-3 animate-spin rounded-full border border-current border-t-transparent" />
                  Generating…
                </span>
              ) : (
                <>
                  <Download size={14} /> PDF
                </>
              )}
            </Button>
            <Button variant="secondary" size="sm" onClick={() => generateReport("json")} disabled={generating}>
              {generating ? null : (
                <>
                  <Download size={14} /> JSON
                </>
              )}
            </Button>
          </div>
        )}
      </div>

      {!datasetId ? (
        <Panel title="Reports" eyebrow="Generated reports">
          <EmptyState
            title="No dataset selected"
            body="Choose a dataset from the top bar switcher."
            action={<Button variant="primary" size="sm" asChild><a href="/datasets">Go to datasets</a></Button>}
          />
        </Panel>
      ) : reports.length === 0 ? (
        <Panel title="No reports yet" eyebrow="Generated reports">
          <EmptyState
            title="No reports generated"
            body="Generate a PDF or JSON report for the selected dataset."
          />
        </Panel>
      ) : (
        <Panel title="Generated reports" eyebrow="History">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[12px]">
              <thead>
                <tr className="border-b border-line">
                  <th className="px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted">Dataset</th>
                  <th className="px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted">Type</th>
                  <th className="px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted">Format</th>
                  <th className="px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted">Size</th>
                  <th className="px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted">Created</th>
                  <th className="px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {reports.map((r) => (
                  <tr key={r.id}>
                    <td className="px-3 py-2.5">{r.dataset_name ?? <span className="text-muted">unknown dataset</span>}</td>
                    <td className="px-3 py-2.5">{r.report_type}</td>
                    <td className="px-3 py-2.5"><Badge tone="neutral">{r.format.toUpperCase()}</Badge></td>
                    <td className="px-3 py-2.5 text-muted">
                      {r.size_bytes == null ? "missing" : fmtBytes(r.size_bytes)}
                    </td>
                    <td className="px-3 py-2.5 text-muted">{fmtDate(r.created_at)}</td>
                    <td className="px-3 py-2.5 text-right">
                      {r.exists === false ? (
                        <span className="text-[11px] text-danger">file missing</span>
                      ) : (
                        <a href={api.reportDownloadUrl(r.id)} className="text-accent text-[11px] font-medium hover:underline">Download</a>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      )}
    </div>
  );
}

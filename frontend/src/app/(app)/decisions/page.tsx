"use client";

import { api } from "@/lib/api";
import { fmtNumber, timeAgo } from "@/lib/format";
import { Button, Panel, Badge, EmptyState, ErrorState, Skeleton, LoadingRows } from "@/components/ui";
import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useDataset } from "@/lib/dataset-context";
import { Sparkles, FileText } from "lucide-react";

const SEVERITY_ORDER: Record<string, number> = { high: 0, medium: 1, low: 2, info: 3 };

export default function DecisionsPage() {
  const searchParams = useSearchParams();
  const { datasets, active, activeId, setActiveId } = useDataset();
  // default: every finding across the platform (like the models library);
  // ?dataset=... narrows to one dataset via a deep link
  const urlDataset = searchParams.get("dataset");
  const datasetId = urlDataset ?? null;

  // keep the topbar/switcher aligned with a dataset-scoped deep link
  useEffect(() => {
    if (urlDataset && urlDataset !== activeId) setActiveId(urlDataset);
  }, [urlDataset, activeId, setActiveId]);

  const [findings, setFindings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [severity, setSeverity] = useState<string>("all");

  useEffect(() => {
    loadFindings();
  }, [datasetId]);

  async function loadFindings() {
    try {
      const res = await api.listFindings(datasetId ?? undefined);
      setFindings(res.findings);
    } catch { setFindings([]); } finally { setLoading(false); }
  }

  const nameById = new Map(datasets.map((d) => [d.id, d.name]));

  async function updateStatus(id: string, status: string) {
    try {
      await api.updateFinding(id, status);
      loadFindings();
    } catch { alert("Failed to update finding."); }
  }

  if (loading) return (
    <Panel title="Decision centre" eyebrow="Evidence-backed findings">
      <div className="p-4"><LoadingRows cols={3} rows={3} /></div>
    </Panel>
  );

  const visible = findings
    .filter((f) => severity === "all" || f.severity === severity)
    .sort((a, b) => (SEVERITY_ORDER[a.severity] ?? 9) - (SEVERITY_ORDER[b.severity] ?? 9));
  const counts = findings.reduce<Record<string, number>>((acc, f) => {
    acc[f.severity] = (acc[f.severity] ?? 0) + 1; return acc;
  }, {});

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-[17px] font-semibold text-ink">Decision centre</h1>
          <p className="text-[11.5px] text-muted">
            {datasetId
              ? `Evidence-backed findings for ${active?.name ?? "the selected dataset"}.`
              : "Evidence-backed findings across every dataset. Each finding states its evidence and its limitations."}
          </p>
        </div>
        {datasetId && (
          <Button variant="secondary" size="sm" asChild>
            <a href="/decisions">Show all datasets</a>
          </Button>
        )}
      </div>

      {findings.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted">Priority</span>
          {["all", "high", "medium", "low", "info"].map((s) => (
            <button key={s} onClick={() => setSeverity(s)}
              className={"rounded-[4px] border px-2.5 py-1 text-[11px] font-medium capitalize transition-colors " +
                (severity === s ? "border-accent bg-accent-soft text-accent" : "border-line-strong text-ink-2 hover:bg-surface-2")}>
              {s}{s !== "all" && counts[s] ? ` (${counts[s]})` : ""}
            </button>
          ))}
        </div>
      )}

      {visible.length === 0 ? (
        <Panel title="No findings yet" eyebrow="Decision centre">
          <EmptyState
            title="No findings"
            body="Run an analysis or profile a dataset to generate evidence-backed findings."
            action={<Button variant="primary" size="sm" asChild><a href="/analysis">Go to analysis</a></Button>}
          />
        </Panel>
      ) : (
        <div className="space-y-3">
          {visible.map((f) => (
            <Panel key={f.id} title={f.title} eyebrow="Finding" actions={
              <div className="flex items-center gap-1">
                <Badge tone={f.severity === "high" ? "danger" : f.severity === "medium" ? "accent" : f.severity === "low" ? "muted" : "ok"}>{f.severity}</Badge>
                <Badge tone="neutral">{f.status}</Badge>
              </div>
            }>
              <div className="text-[12px] leading-relaxed mb-3">{f.explanation}</div>

              {f.evidence && Object.keys(f.evidence).length > 0 && (
                <div className="mb-3">
                  <div className="text-[10px] font-semibold uppercase tracking-[0.1em] text-muted mb-1">Evidence</div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-[11px]">
                      <tbody className="divide-y divide-line">
                        {Object.entries(f.evidence).map(([k, v]) => (
                          <tr key={k}>
                            <td className="px-3 py-1 font-mono text-[10px] text-muted w-1/3">{k}</td>
                            <td className="px-3 py-1 text-[11px]">{typeof v === "object" ? JSON.stringify(v) : String(v)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {f.limitations && (
                <div className="pt-3 border-t border-line/50">
                  <div className="text-[10px] font-semibold uppercase tracking-[0.1em] text-muted mb-1">Limitations</div>
                  <p className="text-[11px] text-muted">{f.limitations}</p>
                </div>
              )}

              <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] text-muted">
                <span>Created {timeAgo(f.created_at)}</span>
                <span aria-hidden>·</span>
                {f.dataset_id && (
                  <span>Dataset: <span className="text-ink-2">{nameById.get(f.dataset_id) ?? f.dataset_id.slice(0, 8) + "…"}</span></span>
                )}
                {f.analysis_id && (<><span aria-hidden>·</span><span>From an analysis run</span></>)}
              </div>
            </Panel>
          ))}
        </div>
      )}
    </div>
  );
}



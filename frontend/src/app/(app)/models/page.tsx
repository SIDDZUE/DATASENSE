"use client";

import { api } from "@/lib/api";
import { fmtNumber, fmtFloat, fmtPct, timeAgo, titleCase } from "@/lib/format";
import { Button, Panel, Badge, EmptyState, LoadingRows, useToast } from "@/components/ui";
import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useDataset } from "@/lib/dataset-context";
import { Download, FileJson, Trash2 } from "lucide-react";

export const dynamic = "force-dynamic";

const HEADLINE: Record<string, string[]> = {
  classification: ["accuracy", "pr_auc", "roc_auc", "f1_macro"],
  regression: ["r2", "rmse", "mae"],
};

export default function ModelsPage() {
  const searchParams = useSearchParams();
  const datasetFilter = searchParams.get("dataset");
  const { activeId, setActiveId } = useDataset();
  const { push } = useToast();
  const [models, setModels] = useState<any[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  // a dataset-scoped deep link should also drive the topbar/switcher
  useEffect(() => {
    if (datasetFilter && datasetFilter !== activeId) setActiveId(datasetFilter);
  }, [datasetFilter, activeId, setActiveId]);

  const loadModels = useCallback(async () => {
    try {
      setError(null);
      const res = await api.listModels(datasetFilter ?? undefined);
      setModels(res.models);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load models.");
      setModels([]);
    }
  }, [datasetFilter]);

  useEffect(() => { loadModels(); }, [loadModels]);

  async function deleteModel(id: string) {
    if (!confirm("Delete this model and its saved artifact?")) return;
    try {
      await api.deleteModel(id);
      push("Model deleted.", "success");
      loadModels();
    } catch {
      push("Failed to delete model.", "error");
    }
  }

  if (models === null && !error) return (
    <Panel title="Models" eyebrow="Trained models">
      <div className="p-4"><LoadingRows cols={3} rows={4} /></div>
    </Panel>
  );

  if (error) {
    return (
      <Panel title="Models" eyebrow="Trained models">
        <EmptyState title="Could not load models" body={error}
          action={<Button size="sm" onClick={loadModels}>Try again</Button>} />
      </Panel>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-[17px] font-semibold text-ink">Models</h1>
          <p className="text-[11.5px] text-muted">
            {datasetFilter
              ? "Models trained on the selected dataset."
              : "All trained models across the platform. Train new models from the Analysis page."}
          </p>
        </div>
        {datasetFilter && (
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" asChild>
              <a href="/models">Show all models</a>
            </Button>
            <Button variant="secondary" size="sm" asChild>
              <a href={`/datasets/${datasetFilter}`}>Back to dataset</a>
            </Button>
          </div>
        )}
      </div>

      {models!.length === 0 ? (
        <Panel title="No models yet" eyebrow="Trained models">
          <EmptyState
            title="No models trained"
            body="Run an analysis to train a model — classification, regression, clustering or anomaly detection. Every metric shown here is computed from real held-out data."
            action={<Button variant="primary" size="sm" asChild><a href="/analysis">Go to analysis</a></Button>}
          />
        </Panel>
      ) : (
        <div className="space-y-4">
          {models!.map((m) => {
            const headline = HEADLINE[m.task_type] ?? [];
            const cm = m.metrics?.confusion_matrix;
            return (
              <Panel key={m.id} dense className="overflow-hidden">
                <header className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-3">
                  <div>
                    <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted">
                      {titleCase(m.task_type)} · {m.dataset_name ?? "Unknown dataset"}
                      {m.dataset_missing ? " (dataset deleted)" : ""}
                    </div>
                    <h2 className="text-[14px] font-semibold text-ink">
                      {titleCase(m.algorithm)}
                      {m.target_column && (
                        <span className="text-[12px] font-normal text-ink-2"> · target: <span className="font-mono text-[11.5px]">{m.target_column}</span></span>
                      )}
                    </h2>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <a href={api.modelDownloadUrl(m.id)} title="Download trained artifact (.joblib)"
                      className="inline-flex items-center gap-1.5 rounded-[4px] border border-line-strong bg-surface px-2.5 py-1.5 text-xs text-ink hover:bg-surface-2">
                      <Download size={13} /> Artifact
                    </a>
                    <a href={api.modelMetadataUrl(m.id)} title="Download model metadata (JSON)"
                      className="inline-flex items-center gap-1.5 rounded-[4px] border border-line-strong bg-surface px-2.5 py-1.5 text-xs text-ink hover:bg-surface-2">
                      <FileJson size={13} /> Metadata
                    </a>
                    <button onClick={() => deleteModel(m.id)} title="Delete model"
                      className="inline-flex items-center gap-1.5 rounded-[4px] border border-danger/40 bg-transparent px-2.5 py-1.5 text-xs text-danger hover:bg-danger/10">
                      <Trash2 size={13} />
                    </button>
                  </div>
                </header>

                <div className="px-5 py-4">
                  {/* headline metrics */}
                  <div className="grid gap-4 grid-cols-2 sm:grid-cols-4 mb-4">
                    {headline.filter((k) => typeof m.metrics?.[k] === "number").map((k) => (
                      <div key={k} className="border-l-2 border-line-strong pl-3">
                        <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted">{k.replace(/_/g, " ")}</div>
                        <div className="num mt-1 text-xl font-semibold text-ink">{fmtFloat(m.metrics[k], 4)}</div>
                      </div>
                    ))}
                    <div className="border-l-2 border-line-strong pl-3">
                      <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted">Train / test rows</div>
                      <div className="num mt-1 text-xl font-semibold text-ink">
                        {fmtNumber(m.train_rows)}<span className="text-[13px] text-muted"> / {fmtNumber(m.test_rows)}</span>
                      </div>
                    </div>
                  </div>

                  {/* full metric list */}
                  {m.metrics && Object.keys(m.metrics).length > 0 && (
                    <details className="mb-3 group">
                      <summary className="cursor-pointer text-[11px] font-semibold uppercase tracking-[0.1em] text-muted hover:text-ink-2 select-none">
                        All evaluation metrics
                      </summary>
                      <div className="mt-2 grid gap-1 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
                        {Object.entries(m.metrics).map(([k, v]) => {
                          if (typeof v !== "number") return null;
                          return (
                            <div key={k} className="flex items-baseline justify-between border-b border-line/60 py-1">
                              <span className="text-[11px] text-muted">{k.replace(/_/g, " ")}</span>
                              <span className="num text-[12px] font-medium">{fmtFloat(v, 4)}</span>
                            </div>
                          );
                        })}
                      </div>
                      {typeof m.metrics.class_distribution === "object" && (
                        <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-muted">
                          <span className="font-semibold uppercase tracking-[0.1em]">Class balance:</span>
                          {Object.entries(m.metrics.class_distribution).map(([cls, share]) => (
                            <Badge key={cls} tone={typeof share === "number" && share < 0.1 ? "danger" : "neutral"}>
                              {cls}: {fmtPct((share as number) * 100, 2)}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </details>
                  )}

                  {/* confusion matrix */}
                  {cm?.labels && (
                    <div className="border border-line rounded-[4px] p-3">
                      <div className="text-[10px] font-semibold uppercase tracking-[0.1em] text-muted mb-2">Confusion matrix (test split)</div>
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-[11px]">
                          <thead>
                            <tr className="border-b border-line">
                              <th className="px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.1em] text-muted">actual \ predicted</th>
                              {cm.labels.map((lbl: string, i: number) => (
                                <th key={i} className="px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.1em] text-muted">{lbl}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {cm.matrix.map((row: number[], i: number) => (
                              <tr key={i}>
                                <td className="px-2 py-1 font-mono text-[10px] text-muted">{cm.labels[i]}</td>
                                {row.map((v, j) => (
                                  <td key={j} className={"px-2 py-1 num text-[10.5px] " + (i === j ? "text-ok font-semibold" : "text-danger")}>{v}</td>
                                ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  <div className="mt-3 text-[11px] text-muted">Trained {timeAgo(m.created_at)}</div>
                </div>
              </Panel>
            );
          })}
        </div>
      )}
    </div>
  );
}

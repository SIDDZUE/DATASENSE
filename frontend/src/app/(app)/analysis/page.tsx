"use client";

import { api } from "@/lib/api";
import { fmtFloat, timeAgo } from "@/lib/format";
import { Button, Panel, Badge, EmptyState, useToast, Progress } from "@/components/ui";
import { useDataset, useResolvedDataset } from "@/lib/dataset-context";
import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { FlaskConical, BrainCircuit, Activity, Waves, Play } from "lucide-react";

export const dynamic = "force-dynamic";

type TaskConfig = {
  task: string;
  target?: string;
  algorithm?: string;
  feature_columns?: string[];
  exclude_columns?: string[];
  test_size?: number;
  n_clusters?: number;
  dbscan_eps?: number;
  dbscan_min_samples?: number;
  contamination?: number;
  label_column?: string;
};

const TASKS = [
  { value: "classification", label: "Classification", icon: FlaskConical, desc: "Predict a categorical label (Unit II/III supervised learning)." },
  { value: "regression", label: "Regression", icon: Waves, desc: "Predict a continuous value (Unit II regression)." },
  { value: "clustering", label: "Clustering", icon: BrainCircuit, desc: "Find natural groups without labels (Unit III unsupervised)." },
  { value: "anomaly", label: "Anomaly detection", icon: Activity, desc: "Flag unusual rows with Isolation Forest (Unit III)." },
];

const ALGORITHMS: Record<string, { value: string; label: string }[]> = {
  classification: [
    { value: "random_forest", label: "Random Forest" },
    { value: "logistic_regression", label: "Logistic Regression" },
    { value: "knn", label: "K-Nearest Neighbours" },
    { value: "decision_tree", label: "Decision Tree" },
    { value: "svm", label: "Support Vector Machine" },
    { value: "naive_bayes", label: "Gaussian Naive Bayes" },
    { value: "adaboost", label: "AdaBoost" },
    { value: "ann_mlp", label: "Neural Network (MLP)" },
  ],
  regression: [
    { value: "random_forest_regressor", label: "Random Forest" },
    { value: "linear_regression", label: "Linear Regression" },
    { value: "knn_regressor", label: "K-Nearest Neighbours" },
    { value: "decision_tree_regressor", label: "Decision Tree" },
    { value: "svr", label: "Support Vector Regression" },
    { value: "adaboost_regressor", label: "AdaBoost" },
  ],
  clustering: [
    { value: "kmeans", label: "K-Means" },
    { value: "hierarchical", label: "Hierarchical (Agglomerative)" },
    { value: "dbscan", label: "DBSCAN" },
  ],
  anomaly: [
    { value: "isolation_forest", label: "Isolation Forest" },
  ],
};

const selectCls =
  "w-full rounded-[4px] border border-line-strong bg-surface px-2.5 py-2 text-[13px] text-ink focus:border-accent focus:outline-none";

export default function AnalysisPage() {
  const searchParams = useSearchParams();
  const { active } = useDataset();
  const datasetId = useResolvedDataset(searchParams.get("dataset"));
  const { push } = useToast();
  const [task, setTask] = useState<string>("classification");
  const [config, setConfig] = useState<TaskConfig>({ task: "classification", algorithm: "random_forest" });
  const [analyses, setAnalyses] = useState<any[]>([]);
  const [columns, setColumns] = useState<string[]>([]);
  const [suggestedTarget, setSuggestedTarget] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const loadAnalyses = useCallback(async () => {
    if (!datasetId) return;
    try {
      const res = await api.listAnalyses(datasetId);
      setAnalyses(res.analyses);
      return res.analyses;
    } catch { setAnalyses([]); return []; }
  }, [datasetId]);

  // dataset columns for the target dropdown
  useEffect(() => {
    setColumns([]); setSuggestedTarget(null);
    setConfig({ task, algorithm: ALGORITHMS[task][0].value });
    if (!datasetId) return;
    api.getProfile(datasetId).then((p) => {
      const cols = [
        ...(p.categorical_columns ?? []),
        ...(p.boolean_columns ?? []),
        ...(p.numeric_columns ?? []),
      ];
      setColumns(cols);
      setSuggestedTarget(p.suggested_target ?? null);
      setConfig((c) => ({
        ...c,
        target: p.suggested_target ?? undefined,
        label_column: p.suggested_target ?? undefined,
      }));
    }).catch(() => {});
  }, [datasetId, task]);

  // initial + polling load while jobs run
  useEffect(() => {
    loadAnalyses();
    pollRef.current = setInterval(async () => {
      const rows = await loadAnalyses();
      if (rows && !rows.some((a) => a.status === "queued" || a.status === "running") && pollRef.current) {
        // keep polling cheaply; nothing to stop — the interval is cheap
      }
    }, 2500);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [loadAnalyses]);

  async function runAnalysis() {
    if (!datasetId) return;
    setRunning(true);
    try {
      await api.runAnalysis(datasetId, task, config);
      push("Analysis queued — training on real data.", "success");
      await loadAnalyses();
    } catch (e) {
      push(e instanceof Error ? e.message : "Failed to start analysis.", "error");
    } finally { setRunning(false); }
  }

  if (!datasetId) {
    return (
      <Panel title="Analysis" eyebrow="ML pipeline">
        <EmptyState
          title="No dataset selected"
          body="Choose a dataset from the top bar switcher to run analyses, or open one from the datasets library."
          action={<Button variant="primary" size="sm" asChild><a href="/datasets">Go to datasets</a></Button>}
        />
      </Panel>
    );
  }

  const activeAnalyses = analyses.filter((a) => a.status === "queued" || a.status === "running");

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-[17px] font-semibold text-ink">Analysis</h1>
          <p className="text-[11.5px] text-muted">
            Train and evaluate machine-learning models on <span className="font-medium text-ink-2">{active?.name ?? "the selected dataset"}</span>.
          </p>
        </div>
        <Button variant="secondary" size="sm" asChild>
          <a href={`/datasets/${datasetId}`}>Back to dataset</a>
        </Button>
      </div>

      {suggestedTarget && (
        <div className="flex items-start gap-2 rounded-[4px] border border-accent/30 bg-accent-soft px-3.5 py-2.5 text-[12px] text-accent">
          <FlaskConical size={14} className="mt-0.5 shrink-0" />
          <span>
            The recommender suggests <span className="font-mono font-semibold">{suggestedTarget}</span> as a target for
            this dataset. You can change it below — nothing is trained without your confirmation.
          </span>
        </div>
      )}

      <div className="grid gap-6 grid-cols-1 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Panel title="Run new analysis" eyebrow="Configure">
            <div className="space-y-4">
              <div>
                <span className="block text-[11px] font-semibold uppercase tracking-[0.1em] text-muted mb-2">Task type</span>
                <div className="flex flex-wrap gap-2">
                  {TASKS.map((t) => (
                    <button
                      key={t.value}
                      onClick={() => {
                        setTask(t.value);
                        setConfig({ ...config, task: t.value, algorithm: ALGORITHMS[t.value][0].value });
                      }}
                      className={
                        "flex items-center gap-2 rounded-[4px] border px-3 py-2 text-[12px] transition-colors " +
                        (task === t.value ? "border-accent bg-accent-soft text-accent" : "border-line-strong bg-surface text-ink-2 hover:bg-surface-2")
                      }
                    >
                      <t.icon size={14} />
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>

              {(task === "classification" || task === "regression") && (
                <div>
                  <span className="block text-[11px] font-semibold uppercase tracking-[0.1em] text-muted mb-2">Target column</span>
                  {columns.length > 0 ? (
                    <select
                      value={config.target || ""}
                      onChange={(e) => setConfig({ ...config, target: e.target.value })}
                      className={selectCls}
                    >
                      <option value="">— select a column —</option>
                      {columns.map((c) => <option key={c} value={c}>{c}</option>)}
                    </select>
                  ) : (
                    <input
                      value={config.target || ""}
                      onChange={(e) => setConfig({ ...config, target: e.target.value })}
                      className={selectCls}
                      placeholder="e.g. Machine failure"
                    />
                  )}
                  <p className="mt-1 text-[11px] text-muted">
                    Supervised training requires a labelled column. The target is never used as a feature.
                  </p>
                </div>
              )}

              {task === "anomaly" && (
                <div>
                  <span className="block text-[11px] font-semibold uppercase tracking-[0.1em] text-muted mb-2">Label column (optional)</span>
                  <select
                    value={config.label_column || ""}
                    onChange={(e) => setConfig({ ...config, label_column: e.target.value || undefined })}
                    className={selectCls}
                  >
                    <option value="">— none (fully unsupervised) —</option>
                    {columns.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                  <p className="mt-1 text-[11px] text-muted">
                    If a binary label exists, Isolation Forest results are scored against it (precision/recall). Otherwise unsupervised scores only.
                  </p>
                </div>
              )}

              <div className="grid gap-4 grid-cols-1 sm:grid-cols-2">
                <div>
                  <span className="block text-[11px] font-semibold uppercase tracking-[0.1em] text-muted mb-2">Algorithm</span>
                  <select
                    value={config.algorithm || ALGORITHMS[task][0].value}
                    onChange={(e) => setConfig({ ...config, algorithm: e.target.value })}
                    className={selectCls}
                  >
                    {ALGORITHMS[task].map((a) => <option key={a.value} value={a.value}>{a.label}</option>)}
                  </select>
                </div>
                {task === "clustering" && (
                  <div>
                    <span className="block text-[11px] font-semibold uppercase tracking-[0.1em] text-muted mb-2">Clusters (K)</span>
                    <input
                      type="number" min={2} max={12}
                      value={config.n_clusters || 3}
                      onChange={(e) => setConfig({ ...config, n_clusters: Number(e.target.value) || 3 })}
                      className={selectCls}
                    />
                  </div>
                )}
                {task === "anomaly" && (
                  <div>
                    <span className="block text-[11px] font-semibold uppercase tracking-[0.1em] text-muted mb-2">Contamination</span>
                    <input
                      type="number" step="0.01" min={0.01} max={0.5}
                      value={config.contamination || 0.05}
                      onChange={(e) => setConfig({ ...config, contamination: Number(e.target.value) || 0.05 })}
                      className={selectCls}
                    />
                  </div>
                )}
              </div>

              <Button variant="primary" onClick={runAnalysis}
                disabled={running || (!config.target && (task === "classification" || task === "regression"))}>
                <Play size={14} />
                {running ? "Queuing…" : (task === "classification" || task === "regression") && !config.target
                  ? "Select a target column first" : "Run analysis"}
              </Button>
            </div>
          </Panel>
        </div>

        <div className="space-y-6">
          <Panel title="Task guide" eyebrow="What each task does">
            <div className="space-y-3">
              {TASKS.map((t) => (
                <div key={t.value} className="p-2 rounded bg-surface-2">
                  <div className="flex items-start gap-2 mb-1">
                    <t.icon size={14} className="text-muted mt-0.5" />
                    <span className="text-[12px] font-semibold text-ink">{t.label}</span>
                  </div>
                  <p className="text-[11px] text-muted">{t.desc}</p>
                </div>
              ))}
            </div>
          </Panel>

          <Panel title="How it works" eyebrow="Honest ML">
            <ul className="space-y-2 text-[11px] text-muted">
              <li>• Real scikit-learn models — no mock results</li>
              <li>• Stratified train/test split + cross-validation on training data</li>
              <li>• Preprocessing fitted on training data only (no leakage)</li>
              <li>• PR-AUC reported for imbalanced targets</li>
              <li>• Correlation ≠ causation — limitations disclosed</li>
            </ul>
          </Panel>
        </div>
      </div>

      {activeAnalyses.length > 0 && (
        <Panel title="Running now" eyebrow="Live status">
          <div className="space-y-2 px-5 py-4">
            {activeAnalyses.map((a) => (
              <div key={a.id} className="flex items-center gap-3">
                <span className="w-40 shrink-0 text-[12px] text-ink">{a.task_type}{a.target_column ? ` · ${a.target_column}` : ""}</span>
                <Progress value={a.progress ?? 10} />
                <span className="num w-10 text-right text-[11px] text-muted">{a.progress ?? 0}%</span>
              </div>
            ))}
          </div>
        </Panel>
      )}

      <Panel title="Analysis history" eyebrow="Recent runs">
        {analyses.length === 0 ? (
          <EmptyState title="No analyses yet" body="Configure and run your first analysis above." />
        ) : (
          <div className="px-5 py-3">
            <table className="w-full text-left text-[12px]">
              <thead>
                <tr className="border-b border-line">
                  {["Task", "Target", "Algorithm", "Status", "When"].map((h) => (
                    <th key={h} className="px-2 py-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {analyses.map((a) => (
                  <tr key={a.id} className="hover:bg-surface-2">
                    <td className="px-2 py-2">{titleCase(a.task_type)}</td>
                    <td className="px-2 py-2 font-mono text-[11px]">{a.target_column ?? "—"}</td>
                    <td className="px-2 py-2">{a.algorithm?.replace(/_/g, " ") ?? "—"}</td>
                    <td className="px-2 py-2">
                      {a.status === "completed" ? <Badge tone="ok">completed</Badge>
                        : a.status === "failed" ? (
                          <span title={a.error ?? ""}><Badge tone="danger">failed</Badge></span>
                        ) : <Badge tone="accent">{a.status}</Badge>}
                    </td>
                    <td className="px-2 py-2 text-muted">{timeAgo(a.created_at)}</td>
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

function titleCase(s: string): string {
  return s.replace(/[_-]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

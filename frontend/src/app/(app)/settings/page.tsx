"use client";

import { api } from "@/lib/api";
import { fmtNumber } from "@/lib/format";
import { Button, Panel, Badge, EmptyState, Stat, Skeleton, LoadingRows } from "@/components/ui";
import { useEffect, useState } from "react";
import { Settings, ShieldCheck, Database, Info } from "lucide-react";

export default function SettingsPage() {
  const [stats, setStats] = useState<any>(null);
  const [health, setHealth] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    Promise.all([api.stats(), api.health()]).then(
      ([s, h]) => { if (!cancelled) { setStats(s); setHealth(h); setLoading(false); } },
      () => { if (!cancelled) setLoading(false); }
    );
    return () => { cancelled = true; };
  }, []);

  if (loading) return (
    <Panel title="Settings" eyebrow="Platform settings">
      <div className="p-4"><LoadingRows cols={3} rows={3} /></div>
    </Panel>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[17px] font-semibold text-ink">Settings</h1>
          <p className="text-[11.5px] text-muted">Platform configuration and system information.</p>
        </div>
      </div>

      <div className="grid gap-6 grid-cols-1 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Panel title="Platform" eyebrow="Configuration">
            <div className="space-y-4">
              <div className="flex items-baseline justify-between">
                <span className="text-[12px] text-muted">Mode</span>
                <Badge tone="teal">Local demo</Badge>
              </div>
              <div className="flex items-baseline justify-between">
                <span className="text-[12px] text-muted">Authentication</span>
                <span className="text-[12px] font-mono text-ink">None</span>
              </div>
              <div className="flex items-baseline justify-between">
                <span className="text-[12px] text-muted">Payments</span>
                <span className="text-[12px] font-mono text-ink">None</span>
              </div>
              <div className="flex items-baseline justify-between">
                <span className="text-[12px] text-muted">Backend API</span>
                <span className="font-mono text-[11px] text-muted">http://127.0.0.1:8000</span>
              </div>
              <div className="flex items-baseline justify-between">
                <span className="text-[12px] text-muted">Database</span>
                <span className="font-mono text-[11px] text-muted">SQLite (stdlib)</span>
              </div>
              <div className="flex items-baseline justify-between">
                <span className="text-[12px] text-muted">Python</span>
                <span className="font-mono text-[11px] text-muted">{health?.python ?? "3.10.x"}</span>
              </div>
            </div>
          </Panel>

          <Panel title="Data provenance" eyebrow="Sources">
            <div className="space-y-3">
              <div className="flex items-start gap-2 p-2 rounded bg-surface-2">
                <Database size={14} className="text-muted mt-0.5" />
                <div>
                  <div className="text-[12px] font-semibold text-ink">UCI Machine Learning Repository</div>
                  <div className="text-[11px] text-muted">AI4I 2020, Air Quality, WDBC, Household Power — CC BY 4.0</div>
                </div>
              </div>
              <div className="flex items-start gap-2 p-2 rounded bg-surface-2">
                <Info size={14} className="text-muted mt-0.5" />
                <div>
                  <div className="text-[12px] font-semibold text-ink">OpenML</div>
                  <div className="text-[11px] text-muted">Credit Card Fraud (dataset 42175) — ODbL</div>
                </div>
              </div>
              <div className="flex items-start gap-2 p-2 rounded bg-surface-2">
                <ShieldCheck size={14} className="text-muted mt-0.5" />
                <div>
                  <div className="text-[12px] font-semibold text-ink">No fabricated data</div>
                  <div className="text-[11px] text-muted">Every metric is computed from genuine datasets.</div>
                </div>
              </div>
            </div>
          </Panel>
        </div>

        <div className="lg:col-span-1">
          <Panel title="System status" eyebrow="Health">
            {health ? (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <div className="h-2.5 w-2.5 rounded-full bg-ok" />
                  <span className="text-[12px] text-ok">API online</span>
                </div>
                <div className="flex items-baseline justify-between">
                  <span className="text-[12px] text-muted">Version</span>
                  <span className="font-mono text-[11px] text-ink">{health.version ?? "1.0.0"}</span>
                </div>
                <div className="flex items-baseline justify-between">
                  <span className="text-[12px] text-muted">Server time</span>
                  <span className="font-mono text-[11px] text-muted">{health.server_time ?? "—"}</span>
                </div>
                <div className="mt-2">
                  <Stat label="Datasets" value={fmtNumber(stats?.datasets ?? 0)} />
                  <Stat label="Models" value={fmtNumber(stats?.models ?? 0)} />
                  <Stat label="Reports" value={fmtNumber(stats?.reports ?? 0)} />
                </div>
              </div>
            ) : (
              <EmptyState title="Offline" body="Unable to reach the backend API." />
            )}
          </Panel>

          <Panel title="About" eyebrow="DataSense AI">
            <p className="text-[11px] leading-relaxed text-muted">
              A universal AIoT data intelligence platform. Upload structured data, profile it,
              train real ML models, detect anomalies, replay IoT streams, and generate evidence-backed decisions.
            </p>
            <div className="mt-3 text-[10px] text-muted">
              No auth · No payments · Local demo mode
            </div>
          </Panel>
        </div>
      </div>
    </div>
  );
}

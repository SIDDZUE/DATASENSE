"use client";

import { api } from "@/lib/api";
import { fmtNumber, timeAgo } from "@/lib/format";
import { Button, Panel, Badge, EmptyState, Skeleton } from "@/components/ui";
import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useDataset, useResolvedDataset } from "@/lib/dataset-context";
import { Radio, Play, Pause, X, RefreshCw } from "lucide-react";
import { LineSeriesChart } from "@/components/charts";

export const dynamic = "force-dynamic";

export default function IoTMonitorPage() {
  const searchParams = useSearchParams();
  const { active } = useDataset();
  const datasetId = useResolvedDataset(searchParams.get("dataset"));
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [status, setStatus] = useState<string>("idle");
  const [position, setPosition] = useState(0);
  const [total, setTotal] = useState(0);
  const [columns, setColumns] = useState<string[]>([]);
  const [entries, setEntries] = useState<any[]>([]);
  const [speed, setSpeed] = useState(1);
  const [modelId, setModelId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const pollRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const startReplay = async () => {
    if (!datasetId) return;
    setLoading(true);
    try {
      const res = await api.startReplay({
        dataset_id: datasetId!,
        speed,
        model_id: modelId || undefined,
      });
      setSessionId(res.session_id);
      setStatus("running");
      setTotal(res.total);
      setColumns(res.columns);
      poll();
    } catch (e: any) {
      alert(e.message || "Failed to start replay.");
    } finally {
      setLoading(false);
    }
  };

  const pauseReplay = async () => {
    if (!sessionId) return;
    const res = await api.pauseReplay(sessionId);
    setStatus(res.status);
    setPosition(res.position);
  };

  const resumeReplay = async () => {
    if (!sessionId) return;
    const res = await api.resumeReplay(sessionId);
    setStatus(res.status);
    setPosition(res.position);
    poll();
  };

  const stopReplay = async () => {
    if (!sessionId) return;
    const res = await api.stopReplay(sessionId);
    setStatus(res.status);
    setPosition(res.position);
    setSessionId(null);
    if (pollRef.current) clearTimeout(pollRef.current);
  };

  const setReplaySpeed = async (s: number) => {
    setSpeed(s);
    if (!sessionId) return;
    await api.setReplaySpeed(sessionId, s);
  };

  const poll = useCallback(async () => {
    if (!sessionId || status !== "running") return;
    try {
      const res = await api.pollReplay(sessionId, position);
      setPosition(res.position);
      setEntries((prev) => [...prev, ...res.entries].slice(-200));
      if (res.status === "running" || res.status === "paused") {
        pollRef.current = setTimeout(() => poll(), 1000);
      } else {
        setStatus(res.status);
      }
    } catch {
      /* poll failed, retry */
      pollRef.current = setTimeout(() => poll(), 2000);
    }
  }, [sessionId, status, position]);

  useEffect(() => {
    return () => { if (pollRef.current) clearTimeout(pollRef.current); };
  }, []);

  useEffect(() => {
    if (status === "running") poll();
  }, [status, poll]);

  if (!datasetId) {
    return (
      <Panel title="IoT monitor" eyebrow="Historical replay">
        <EmptyState
          title="No dataset selected"
          body="Choose a dataset with a timestamp column from the top bar switcher."
          action={<Button variant="primary" size="sm" asChild><a href="/datasets">Go to datasets</a></Button>}
        />
      </Panel>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[17px] font-semibold text-ink">IoT monitor</h1>
          <p className="text-[11.5px] text-muted">Replay historical data as a simulated sensor stream.</p>
        </div>
        <Button variant="secondary" size="sm" asChild>
          <a href={`/datasets/${datasetId}`}>Back to dataset</a>
        </Button>
      </div>

      {/* Controls */}
      <Panel title="Replay controls" eyebrow="Historical replay (simulated)">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Button variant={status === "idle" ? "primary" : "secondary"} size="sm" onClick={startReplay} disabled={loading || status === "running"}>
              {status === "idle" ? <Play size={14} /> : <Radio size={14} />} Start replay
            </Button>
            <Button variant="ghost" size="sm" onClick={pauseReplay} disabled={status !== "running"}>
              <Pause size={14} /> Pause
            </Button>
            <Button variant="ghost" size="sm" onClick={resumeReplay} disabled={status !== "paused"}>
              <Play size={14} /> Resume
            </Button>
            <Button variant="ghost" size="sm" onClick={stopReplay} disabled={status === "idle"}>
              <X size={14} /> Stop
            </Button>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-muted">Speed</span>
            <select
              value={speed}
              onChange={(e) => setReplaySpeed(Number(e.target.value))}
              className="rounded-[4px] border border-line-strong bg-surface px-2 py-1 text-[11px] text-ink focus:border-accent focus:outline-none"
            >
              {[0.5, 1, 2, 5, 10].map((s) => <option key={s} value={s}>{s}x</option>)}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-muted">Model</span>
            <select
              value={modelId || ""}
              onChange={(e) => setModelId(e.target.value || null)}
              className="rounded-[4px] border border-line-strong bg-surface px-2 py-1 text-[11px] text-ink focus:border-accent focus:outline-none"
            >
              <option value="">None</option>
            </select>
          </div>
          <div className="flex items-center gap-2">
            <Badge tone={status === "running" ? "ok" : status === "paused" ? "accent" : "muted"}>{status}</Badge>
            <span className="text-[11px] text-muted num">{position} / {total}</span>
          </div>
        </div>
      </Panel>

      {/* Live stream */}
      <div className="grid gap-6 grid-cols-1 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Panel title="Live stream" eyebrow={active?.name ? `Historical replay · ${active.name}` : `Historical replay`}>
            {entries.length === 0 ? (
              <EmptyState title="No stream data" body="Start replay to see live sensor readings." />
            ) : (
              <div className="space-y-3">
                {entries.slice(-50).map((e, i) => (
                  <div key={i} className="flex items-start justify-between p-2 rounded bg-surface-2 border border-line/50">
                    <div>
                      <div className="font-mono text-[11px] text-ink">{e.timestamp}</div>
                      <div className="text-[11px] text-muted">{e.record}</div>
                    </div>
                    <div className="text-right">
                      <div className="num text-[11px] font-medium">{e.position}</div>
                      {e.prediction != null && (
                        <div className="text-[10px] text-muted">Pred: {e.prediction}</div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Panel>
        </div>

        <div className="lg:col-span-1">
          <Panel title="Status" eyebrow="Replay session">
            <div className="space-y-3">
              <div className="flex items-baseline justify-between">
                <span className="text-[12px] text-muted">Session</span>
                <span className="num text-[12px] font-semibold">{sessionId ?? "—"}</span>
              </div>
              <div className="flex items-baseline justify-between">
                <span className="text-[12px] text-muted">Status</span>
                <Badge tone={status === "running" ? "ok" : "muted"}>{status}</Badge>
              </div>
              <div className="flex items-baseline justify-between">
                <span className="text-[12px] text-muted">Position</span>
                <span className="num text-[12px] font-semibold">{position}</span>
              </div>
              <div className="flex items-baseline justify-between">
                <span className="text-[12px] text-muted">Total</span>
                <span className="num text-[12px] font-semibold">{total}</span>
              </div>
            </div>
          </Panel>

          <Panel title="About replay" eyebrow="Important">
            <p className="text-[11px] leading-relaxed text-muted">
              Historical replay is a <strong>simulation</strong> — no physical sensor is connected.
              Data is streamed from the stored dataset at the selected speed.
            </p>
          </Panel>
        </div>
      </div>
    </div>
  );
}

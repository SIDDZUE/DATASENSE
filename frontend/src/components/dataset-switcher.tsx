"use client";

import { Database, RefreshCw } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { useDataset } from "@/lib/dataset-context";

export function DatasetSwitcher() {
  const { datasets, activeId, setActiveId, refresh, loading } = useDataset();
  const [busy, setBusy] = useState(false);

  async function onRefresh() {
    setBusy(true);
    await refresh();
    setBusy(false);
  }

  if (loading) {
    return <div className="skeleton h-7 w-40" />;
  }

  if (datasets.length === 0) {
    return (
      <Link
        href="/datasets"
        className="flex items-center gap-1.5 rounded-[4px] border border-dashed border-line-strong px-2.5 py-1.5 text-[11px] text-muted hover:border-accent hover:text-accent"
      >
        <Database size={12} /> Add a dataset
      </Link>
    );
  }

  return (
    <div className="flex items-center gap-1">
      <label className="sr-only" htmlFor="dataset-switcher">Active dataset</label>
      <select
        id="dataset-switcher"
        value={activeId ?? ""}
        onChange={(e) => setActiveId(e.target.value)}
        className="max-w-[210px] rounded-[4px] border border-line-strong bg-surface px-2 py-1.5 text-[11.5px] text-ink focus:border-accent focus:outline-none"
      >
        {datasets.map((d) => (
          <option key={d.id} value={d.id}>{d.name}</option>
        ))}
      </select>
      <button
        onClick={onRefresh}
        aria-label="Refresh dataset list"
        className="rounded p-1.5 text-muted hover:bg-surface-2 hover:text-ink-2"
      >
        <RefreshCw size={13} className={busy ? "animate-spin" : ""} />
      </button>
    </div>
  );
}

"use client";

import {
  createContext, useCallback, useContext, useEffect, useMemo, useState,
} from "react";
import { api } from "./api";
import type { DatasetSummary } from "./types";

type DatasetContextValue = {
  datasets: DatasetSummary[];
  activeId: string | null;
  active: DatasetSummary | null;
  loading: boolean;
  error: string | null;
  setActiveId: (id: string | null) => void;
  refresh: () => Promise<void>;
};

const DatasetContext = createContext<DatasetContextValue | null>(null);
const STORAGE_KEY = "datasense.activeDataset";

export function DatasetProvider({ children }: { children: React.ReactNode }) {
  const [datasets, setDatasets] = useState<DatasetSummary[]>([]);
  const [activeId, setActiveIdState] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setError(null);
      const res = await api.listDatasets();
      setDatasets(res.datasets);
      setActiveIdState((current) => {
        const stored = current ?? (typeof window !== "undefined"
          ? window.localStorage.getItem(STORAGE_KEY) : null);
        if (stored && res.datasets.some((d) => d.id === stored)) return stored;
        return res.datasets[0]?.id ?? null;
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not reach the DataSense API.");
    } finally {
      setLoading(false);
    }
  }, []);

  const setActiveId = useCallback((id: string | null) => {
    setActiveIdState(id);
    if (typeof window !== "undefined") {
      if (id) window.localStorage.setItem(STORAGE_KEY, id);
      else window.localStorage.removeItem(STORAGE_KEY);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const value = useMemo<DatasetContextValue>(() => ({
    datasets,
    activeId,
    active: datasets.find((d) => d.id === activeId) ?? null,
    loading,
    error,
    setActiveId,
    refresh,
  }), [datasets, activeId, loading, error, setActiveId, refresh]);

  return <DatasetContext.Provider value={value}>{children}</DatasetContext.Provider>;
}

export function useDataset() {
  const ctx = useContext(DatasetContext);
  if (!ctx) throw new Error("useDataset must be used inside DatasetProvider");
  return ctx;
}

/**
 * Resolve the dataset a page should show, preferring an explicit `?dataset=`
 * URL parameter and falling back to the globally active dataset.
 *
 * When the URL names a different dataset than the global context, the context
 * is updated so the topbar label, the switcher and the page body always agree.
 */
export function useResolvedDataset(paramId: string | null) {
  const { activeId, setActiveId } = useDataset();
  const resolved = paramId || activeId;

  useEffect(() => {
    if (paramId && paramId !== activeId) setActiveId(paramId);
  }, [paramId, activeId, setActiveId]);

  return resolved;
}

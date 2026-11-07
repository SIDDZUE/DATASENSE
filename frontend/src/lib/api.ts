import type {
  Analysis, AnalysisSummary, AnomalyResult, Dataset, DatasetSummary,
  Finding, ModelRecord, Profile, Quality, Recommendation, ReportRecord,
  ReplayPoll, Stats,
} from "./types";

export const API_BASE =
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") || "http://127.0.0.1:8000";

class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      ...(init?.body instanceof FormData
        ? {}
        : { "Content-Type": "application/json" }),
      ...(init?.headers || {}),
    },
    cache: "no-store",
  });
  if (!res.ok) {
    let detail = `${res.status} ${res.statusText}`;
    try {
      const body = await res.json();
      detail = typeof body.detail === "string" ? body.detail : JSON.stringify(body.detail);
    } catch {
      /* keep default */
    }
    throw new ApiError(detail, res.status);
  }
  return res.json() as Promise<T>;
}

export const api = {
  health: () => request<{ status: string }>("/api/health"),
  stats: () => request<Stats>("/api/stats"),

  // datasets
  listDatasets: () => request<{ datasets: DatasetSummary[] }>("/api/datasets"),
  getDataset: (id: string) => request<Dataset>(`/api/datasets/${id}`),
  getProfile: (id: string) => request<Profile>(`/api/datasets/${id}/profile`),
  getQuality: (id: string) => request<Quality>(`/api/datasets/${id}/quality`),
  preview: (id: string, limit = 50, offset = 0) =>
    request<{ columns: string[]; total_rows: number; offset: number; rows: Record<string, any>[] }>(
      `/api/datasets/${id}/preview?limit=${limit}&offset=${offset}`
    ),
  upload: (file: File, meta: { name?: string; source_url?: string; provider?: string; license?: string; notes?: string }) => {
    const fd = new FormData();
    fd.append("file", file);
    const q = new URLSearchParams();
    Object.entries(meta).forEach(([k, v]) => v && q.set(k, v));
    return request<{ id: string; name: string; n_rows: number; n_cols: number; message: string }>(
      `/api/datasets/upload${q.toString() ? `?${q}` : ""}`,
      { method: "POST", body: fd }
    );
  },
  deleteDataset: (id: string) =>
    request<{ status: string }>(`/api/datasets/${id}`, { method: "DELETE" }),
  reprofile: (id: string) =>
    request<{ status: string; suggested_target: string | null }>(
      `/api/datasets/${id}/reprofile`, { method: "POST" }
    ),
  preprocess: (id: string, operations: any[]) =>
    request<{ status: string; operations_applied: string[]; n_rows: number; n_cols: number }>(
      `/api/datasets/${id}/preprocess`,
      { method: "POST", body: JSON.stringify({ operations }) }
    ),
  exportUrl: (id: string, kind: string) => `${API_BASE}/api/datasets/${id}/export/${kind}`,

  // analysis
  suggest: (id: string) =>
    request<{ recommendations: Recommendation[]; suggested_target: string | null }>(
      `/api/datasets/${id}/analysis/suggest`, { method: "POST" }
    ),
  runAnalysis: (id: string, task: string, config: Record<string, any>) =>
    request<{ analysis_id: string; status: string }>(
      `/api/datasets/${id}/analysis/run`,
      { method: "POST", body: JSON.stringify({ task, config }) }
    ),
  listAnalyses: (datasetId?: string) =>
    request<{ analyses: AnalysisSummary[] }>(
      `/api/analyses${datasetId ? `?dataset_id=${datasetId}` : ""}`
    ),
  getAnalysis: (id: string) => request<Analysis>(`/api/analysis/${id}`),

  // models
  listModels: (datasetId?: string) =>
    request<{ models: ModelRecord[] }>(`/api/models${datasetId ? `?dataset_id=${datasetId}` : ""}`),
  getModel: (id: string) => request<ModelRecord>(`/api/models/${id}`),
  predict: (id: string, values: Record<string, any>) =>
    request<{ prediction: number | string; target_column: string; probabilities?: Record<string, number> }>(
      `/api/models/${id}/predict`,
      { method: "POST", body: JSON.stringify({ values }) }
    ),
  modelDownloadUrl: (id: string) => `${API_BASE}/api/models/${id}/download`,
  modelMetadataUrl: (id: string) => `${API_BASE}/api/models/${id}/metadata`,
  deleteModel: (id: string) =>
    request<{ status: string; id: string }>(`/api/models/${id}`, { method: "DELETE" }),

  // anomalies
  listAnomalies: (datasetId: string) =>
    request<{ anomalies: AnomalyResult[] }>(`/api/datasets/${datasetId}/anomalies`),

  // decisions
  listFindings: (datasetId?: string) =>
    request<{ findings: Finding[] }>(`/api/decisions${datasetId ? `?dataset_id=${datasetId}` : ""}`),
  updateFinding: (id: string, status: string) =>
    request<{ id: string; status: string }>(`/api/decisions/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ status }),
    }),

  // reports
  generateReport: (datasetId: string, format: "pdf" | "json") =>
    request<{ report_id: string; filename: string; download_url: string }>(
      "/api/reports/generate",
      { method: "POST", body: JSON.stringify({ dataset_id: datasetId, format }) }
    ),
  listReports: (datasetId?: string) =>
    request<{ reports: ReportRecord[] }>(`/api/reports${datasetId ? `?dataset_id=${datasetId}` : ""}`),
  reportDownloadUrl: (id: string) => `${API_BASE}/api/reports/${id}/download`,

  // iot replay
  startReplay: (body: {
    dataset_id: string;
    session_id?: string;
    timestamp_column?: string;
    columns?: string[];
    speed?: number;
    model_id?: string;
  }) =>
    request<{ session_id: string; status: string; total: number; columns: string[] }>(
      "/api/iot/replay/start",
      { method: "POST", body: JSON.stringify(body) }
    ),
  pauseReplay: (session_id: string) =>
    request<{ status: string; position: number }>("/api/iot/replay/pause", {
      method: "POST",
      body: JSON.stringify({ session_id }),
    }),
  resumeReplay: (session_id: string) =>
    request<{ status: string; position: number }>("/api/iot/replay/resume", {
      method: "POST",
      body: JSON.stringify({ session_id }),
    }),
  stopReplay: (session_id: string) =>
    request<{ status: string; position: number }>("/api/iot/replay/stop", {
      method: "POST",
      body: JSON.stringify({ session_id }),
    }),
  setReplaySpeed: (session_id: string, speed: number) =>
    request<{ speed: number }>("/api/iot/replay/speed", {
      method: "POST",
      body: JSON.stringify({ session_id, speed }),
    }),
  pollReplay: (session_id: string, since = 0) =>
    request<ReplayPoll>(`/api/iot/replay/poll?session_id=${session_id}&since=${since}`),
};

export { ApiError };

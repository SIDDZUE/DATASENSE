export type DatasetSummary = {
  id: string;
  name: string;
  original_filename: string;
  format: string;
  n_rows: number;
  n_cols: number;
  has_timestamp: number;
  timestamp_column: string | null;
  suggested_target: string | null;
  size_bytes: number | null;
  source_url: string | null;
  provider: string | null;
  license: string | null;
  download_date: string | null;
  created_at: string;
};

export type ColumnInfo = {
  name: string;
  pandas_dtype: string;
  semantic_type: "numeric" | "categorical" | "datetime" | "boolean" | "identifier";
  missing: number;
  stats?: Record<string, any>;
};

export type Profile = {
  n_rows: number;
  n_cols: number;
  sampled: boolean;
  columns: Record<string, ColumnInfo>;
  numeric_columns: string[];
  categorical_columns: string[];
  datetime_columns: string[];
  identifier_columns: string[];
  boolean_columns: string[];
  duplicate_rows: number;
  total_missing: number;
  missing_pct: number;
  correlation: Record<string, Record<string, number | null>>;
  memory_mb: number;
  suggested_target: string | null;
};

export type Quality = {
  score: number;
  per_column: Array<{
    column: string;
    semantic_type: string;
    missing: number;
    missing_pct: number;
    outliers_iqr?: number;
    outlier_pct?: number;
    constant?: boolean;
    near_constant?: boolean;
  }>;
  issues: Array<{ code: string; severity: string; message: string }>;
  imbalance: {
    target: string;
    distribution: Record<string, number>;
    minority_pct: number;
    imbalanced: boolean;
  } | null;
  duplicate_rows: number;
  total_missing: number;
};

export type Dataset = DatasetSummary & {
  file_path: string;
  checksum: string | null;
  notes: string | null;
  profile: Profile;
  quality: Quality;
};

export type Recommendation = {
  task: string;
  title: string;
  why: string;
  required_columns: string[];
  assumptions: string[];
  limitations: string[];
  expected_outputs: string[];
  confidence: string;
};

export type AnalysisSummary = {
  id: string;
  dataset_id: string;
  task_type: string;
  algorithm: string | null;
  target_column: string | null;
  status: string;
  progress: number;
  error: string | null;
  model_id: string | null;
  created_at: string;
  completed_at: string | null;
};

export type Analysis = AnalysisSummary & {
  results: any | null;
  config: any | null;
};

export type ModelRecord = {
  id: string;
  dataset_id: string;
  analysis_id: string | null;
  algorithm: string;
  task_type: string;
  target_column: string | null;
  artifact_path: string | null;
  train_rows: number;
  test_rows: number;
  metrics: Record<string, any>;
  created_at: string;
  features?: string[];
  preprocessing?: Record<string, any>;
};

export type Finding = {
  id: string;
  dataset_id: string;
  analysis_id: string | null;
  model_id: string | null;
  title: string;
  explanation: string | null;
  evidence: Record<string, any>;
  severity: "high" | "medium" | "low" | "info";
  recommendation: string | null;
  limitations: string | null;
  status: "open" | "acknowledged" | "dismissed";
  created_at: string;
};

export type ReportRecord = {
  id: string;
  dataset_id: string | null;
  report_type: string;
  format: string;
  file_path: string;
  created_at: string;
};

export type AnomalyResult = {
  id: string;
  method: string;
  params: Record<string, any>;
  n_rows: number;
  n_flagged: number;
  contamination: number;
  results: {
    rows_scored: number;
    n_flagged: number;
    flagged_pct: number;
    feature_columns: string[];
    top_anomalies: Array<{
      row_index: number;
      anomaly_score: number;
      record: Record<string, any>;
    }>;
    label_evaluation?: {
      label_column: string;
      precision: number;
      recall: number;
      f1: number;
      actual_positive_pct: number;
    };
    score_stats: Record<string, number>;
  };
  created_at: string;
};

export type ReplayEntry = {
  position: number;
  timestamp: string;
  record: Record<string, number | string | null>;
  prediction?: number | string;
  probabilities?: Record<string, number>;
  prediction_error?: string;
};

export type ReplayPoll = {
  session_id: string;
  status: string;
  position: number;
  total: number;
  entries: ReplayEntry[];
};

export type Stats = {
  datasets: number;
  total_rows: number;
  total_bytes: number;
  analyses_by_status: Record<string, number>;
  models: number;
  reports: number;
  findings_by_severity: Record<string, number>;
};

"use client";

import { api } from "@/lib/api";
import { Button, Dialog, Field, Input, Textarea, useToast } from "@/components/ui";
import { useRef, useState } from "react";
import { UploadCloud, FileUp } from "lucide-react";

const MAX_BYTES = 200 * 1024 * 1024; // must match backend MAX_UPLOAD_BYTES
const OK_EXT = [".csv", ".xlsx", ".xls", ".json", ".parquet"];

export function UploadDialog({ open, onClose, onUploaded }: {
  open: boolean;
  onClose: () => void;
  onUploaded: (id: string, name: string) => void;
}) {
  const { push } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [meta, setMeta] = useState({ name: "", source_url: "", provider: "", license: "", notes: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function pickFile(f: File | null) {
    setError(null);
    if (!f) { setFile(null); return; }
    const ext = "." + (f.name.split(".").pop() ?? "").toLowerCase();
    if (!OK_EXT.includes(ext)) {
      setError(`Unsupported format "${ext}". Allowed: ${OK_EXT.join(", ")}`);
      return;
    }
    if (f.size > MAX_BYTES) {
      setError(`File is ${(f.size / 1e6).toFixed(0)} MB — the limit is ${MAX_BYTES / 1e6} MB.`);
      return;
    }
    setFile(f);
    if (!meta.name) setMeta((m) => ({ ...m, name: f.name.replace(/\.[^.]+$/, "") }));
  }

  async function submit() {
    if (!file) { setError("Choose a file first."); return; }
    setBusy(true); setError(null);
    try {
      const res = await api.upload(file, meta);
      push(`Uploaded "${res.name}" — ${res.n_rows.toLocaleString()} rows × ${res.n_cols} columns profiled.`, "success");
      onUploaded(res.id, res.name);
      setFile(null);
      setMeta({ name: "", source_url: "", provider: "", license: "", notes: "" });
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed.");
    } finally { setBusy(false); }
  }

  return (
    <Dialog open={open} onClose={busy ? () => {} : onClose} title="Upload a dataset" wide>
      <div className="space-y-4">
        <p className="text-[12px] leading-relaxed text-muted">
          The file is validated, profiled and stored as Parquet. The original upload is kept untouched in
          <span className="font-mono text-[11px]"> data/uploads/</span>. Provide provenance where you know it —
          every metric in the platform traces back to this record.
        </p>

        <button
          onClick={() => fileRef.current?.click()}
          className={
            "flex w-full flex-col items-center justify-center gap-2 rounded-[6px] border border-dashed px-4 py-8 text-center transition-colors " +
            (file ? "border-accent/50 bg-accent-soft" : "border-line-strong bg-surface-2 hover:border-accent/50")
          }
        >
          {file ? <FileUp size={22} className="text-accent" /> : <UploadCloud size={22} className="text-muted" />}
          {file ? (
            <>
              <span className="text-[13px] font-medium text-ink">{file.name}</span>
              <span className="text-[11px] text-muted">{(file.size / 1024).toFixed(1)} KB — click to change</span>
            </>
          ) : (
            <>
              <span className="text-[13px] font-medium text-ink">Choose a file</span>
              <span className="text-[11px] text-muted">CSV · XLSX · JSON · Parquet — up to 200 MB</span>
            </>
          )}
        </button>
        <input ref={fileRef} type="file" accept=".csv,.xlsx,.xls,.json,.parquet" className="hidden"
          onChange={(e) => pickFile(e.target.files?.[0] ?? null)} />

        <div className="grid gap-3 grid-cols-1 sm:grid-cols-2">
          <Field label="Dataset name">
            <Input value={meta.name} onChange={(e) => setMeta({ ...meta, name: e.target.value })}
              placeholder="e.g. Factory line 3 vibration" />
          </Field>
          <Field label="Source URL">
            <Input value={meta.source_url} onChange={(e) => setMeta({ ...meta, source_url: e.target.value })}
              placeholder="https://archive.ics.uci.edu/…" />
          </Field>
          <Field label="Provider / author">
            <Input value={meta.provider} onChange={(e) => setMeta({ ...meta, provider: e.target.value })}
              placeholder="e.g. UCI ML Repository" />
          </Field>
          <Field label="Licence">
            <Input value={meta.license} onChange={(e) => setMeta({ ...meta, license: e.target.value })}
              placeholder="e.g. CC BY 4.0" />
          </Field>
        </div>
        <Field label="Notes" hint="What the columns mean, collection context, known caveats.">
          <Textarea value={meta.notes} onChange={(e) => setMeta({ ...meta, notes: e.target.value })}
            placeholder="Optional provenance notes…" />
        </Field>

        {error && (
          <div className="rounded-[4px] border border-danger/30 bg-danger/5 px-3 py-2 text-[12px] text-danger">{error}</div>
        )}

        <div className="flex items-center justify-end gap-2 border-t border-line pt-3">
          <Button variant="ghost" size="sm" onClick={onClose} disabled={busy}>Cancel</Button>
          <Button variant="primary" size="sm" onClick={submit} loading={busy} disabled={!file}>
            {busy ? "Uploading & profiling…" : "Upload & profile"}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}

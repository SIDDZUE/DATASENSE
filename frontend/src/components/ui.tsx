"use client";

import { clsx } from "clsx";
import { X } from "lucide-react";
import Link from "next/link";
import {
  Children, cloneElement, createContext, useCallback, useContext, useEffect, useRef, useState,
} from "react";

/* ------------------------------------------------------------------ Button */
type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md";
  loading?: boolean;
  asChild?: boolean;
  href?: string;
};

export function Button({
  variant = "secondary", size = "md", loading, className, children, asChild = false, href, ...rest
}: ButtonProps & { href?: string }) {
  const baseCls = clsx(
    "inline-flex items-center justify-center gap-2 rounded-[4px] border font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-50",
    size === "sm" ? "px-2.5 py-1.5 text-xs" : "px-3.5 py-2 text-[13px]",
    variant === "primary" && "border-accent bg-accent text-accent-ink hover:brightness-110",
    variant === "secondary" && "border-line-strong bg-surface text-ink hover:bg-surface-2",
    variant === "ghost" && "border-transparent bg-transparent text-ink-2 hover:bg-surface-2",
    variant === "danger" && "border-danger/40 bg-transparent text-danger hover:bg-danger/10",
    className
  );

  if (asChild) {
    // Radix-style: merge button styling onto the caller's single child element
    // (e.g. <Button asChild><a href="/datasets">…</a></Button>) so we never
    // render an <a> nested inside another <a>.
    const child = Children.only(children) as React.ReactElement<{
      className?: string;
    }>;
    return cloneElement(child, {
      className: clsx(baseCls, child.props.className),
    });
  }

  if (href) {
    return (
      <Link href={href} className={baseCls}>
        {loading && (
          <span className="h-3 w-3 animate-spin rounded-full border border-current border-t-transparent" />
        )}
        {children}
      </Link>
    );
  }

  return (
    <button
      {...rest}
      disabled={rest.disabled || loading}
      className={baseCls}
    >
      {loading && (
        <span className="h-3 w-3 animate-spin rounded-full border border-current border-t-transparent" />
      )}
      {children}
    </button>
  );
}

/* ------------------------------------------------------------------ Panel */
export function Panel({
  title, eyebrow, actions, children, className, dense,
}: {
  title?: React.ReactNode;
  eyebrow?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  dense?: boolean;
}) {
  return (
    <section className={clsx("panel rounded-[6px]", className)}>
      {(title || eyebrow || actions) && (
        <header className={clsx(
          "flex flex-wrap items-center justify-between gap-3 border-b border-line",
          dense ? "px-4 py-2.5" : "px-5 py-3.5"
        )}>
          <div>
            {eyebrow && (
              <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted">
                {eyebrow}
              </div>
            )}
            {title && <h2 className="text-[15px] font-semibold text-ink">{title}</h2>}
          </div>
          {actions && <div className="flex items-center gap-2">{actions}</div>}
        </header>
      )}
      {children}
    </section>
  );
}

/* ------------------------------------------------------------------ Badge */
export function Badge({
  children, tone = "neutral", className,
}: {
  children: React.ReactNode;
  tone?: "neutral" | "accent" | "ok" | "danger" | "muted" | "teal";
  className?: string;
}) {
  return (
    <span className={clsx(
      "inline-flex items-center gap-1 rounded-[3px] border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em]",
      tone === "neutral" && "border-line-strong bg-surface-2 text-ink-2",
      tone === "accent" && "border-accent/30 bg-accent-soft text-accent",
      tone === "ok" && "border-ok/30 bg-ok/10 text-ok",
      tone === "danger" && "border-danger/30 bg-danger/10 text-danger",
      tone === "muted" && "border-line bg-transparent text-muted",
      tone === "teal" && "border-teal/30 bg-teal/10 text-teal",
      className
    )}>
      {children}
    </span>
  );
}

/* ------------------------------------------------------------------ Stat */
export function Stat({
  label, value, sub, tone,
}: {
  label: string;
  value: React.ReactNode;
  sub?: React.ReactNode;
  tone?: "accent" | "teal" | "danger";
}) {
  return (
    <div className="border-l-2 border-line-strong pl-3.5">
      <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted">
        {label}
      </div>
      <div className={clsx(
        "num mt-1 text-2xl font-semibold leading-none",
        tone === "accent" && "text-accent",
        tone === "teal" && "text-teal",
        tone === "danger" && "text-danger",
        !tone && "text-ink"
      )}>
        {value}
      </div>
      {sub && <div className="mt-1 text-[11px] text-muted">{sub}</div>}
    </div>
  );
}

/* ------------------------------------------------------------------ Empty / Error / Skeleton */
export function EmptyState({
  icon, title, body, action,
}: {
  icon?: React.ReactNode;
  title: string;
  body?: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 px-6 py-16 text-center">
      {icon && <div className="text-muted">{icon}</div>}
      <h3 className="text-[15px] font-semibold text-ink">{title}</h3>
      {body && <div className="max-w-md text-[13px] leading-relaxed text-muted">{body}</div>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

export function ErrorState({ message, retry }: { message: string; retry?: () => void }) {
  return (
    <div className="flex flex-col items-center gap-3 border border-danger/30 bg-danger/5 px-6 py-10 text-center">
      <p className="max-w-lg text-[13px] text-danger">{message}</p>
      {retry && <Button size="sm" onClick={retry}>Try again</Button>}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={clsx("skeleton", className)} />;
}

export function LoadingRows({ cols = 4, rows = 6 }: { cols?: number; rows?: number }) {
  return (
    <div className="space-y-2 p-4">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="grid gap-2" style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}>
          {Array.from({ length: cols }).map((_, j) => (
            <Skeleton key={j} className="h-4" />
          ))}
        </div>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ Form fields */
export function Field({
  label, hint, children, className,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label className={clsx("block", className)}>
      <span className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.1em] text-muted">
        {label}
      </span>
      {children}
      {hint && <span className="mt-1 block text-[11px] text-muted">{hint}</span>}
    </label>
  );
}

const inputCls =
  "w-full rounded-[4px] border border-line-strong bg-surface px-2.5 py-2 text-[13px] text-ink placeholder:text-muted/70 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent";

export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={clsx(inputCls, props.className)} />;
}

export function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={clsx(inputCls, "pr-8", props.className)} />;
}

export function Textarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={clsx(inputCls, "min-h-20", props.className)} />;
}

/* ------------------------------------------------------------------ Table */
export function DataTable({
  head, children, className,
}: {
  head: React.ReactNode[];
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={clsx("overflow-x-auto", className)}>
      <table className="w-full border-collapse text-left text-[13px]">
        <thead>
          <tr className="border-b border-line">
            {head.map((h, i) => (
              <th key={i} className="whitespace-nowrap px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-line">{children}</tbody>
      </table>
    </div>
  );
}

/* ------------------------------------------------------------------ Tabs */
export function Tabs<T extends string>({
  tabs, value, onChange,
}: {
  tabs: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1 border-b border-line">
      {tabs.map((t) => (
        <button
          key={t.value}
          onClick={() => onChange(t.value)}
          className={clsx(
            "-mb-px border-b-2 px-3 py-2 text-[12px] font-medium transition-colors",
            value === t.value
              ? "border-accent text-ink"
              : "border-transparent text-muted hover:text-ink-2"
          )}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ Dialog */
export function Dialog({
  open, onClose, title, children, wide,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    if (!open && el.open) el.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => { if (e.target === ref.current) onClose(); }}
      className="w-[min(94vw,560px)] rounded-[6px] border border-line bg-surface p-0 text-ink backdrop:bg-black/40"
      style={wide ? { width: "min(94vw, 860px)" } : undefined}
    >
      <div className="flex items-center justify-between border-b border-line px-5 py-3">
        <h2 className="text-[15px] font-semibold">{title}</h2>
        <button onClick={onClose} aria-label="Close dialog" className="rounded p-1 text-muted hover:bg-surface-2 hover:text-ink">
          <X size={16} />
        </button>
      </div>
      <div className="max-h-[75vh] overflow-y-auto px-5 py-4">{children}</div>
    </dialog>
  );
}

/* ------------------------------------------------------------------ Toast */
type Toast = { id: number; message: string; tone: "info" | "success" | "error" };
const ToastContext = createContext<{
  push: (message: string, tone?: Toast["tone"]) => void;
} | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const push = useCallback((message: string, tone: Toast["tone"] = "info") => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, message, tone }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4500);
  }, []);
  return (
    <ToastContext.Provider value={{ push }}>
      {children}
      <div className="fixed bottom-4 right-4 z-50 flex w-[min(92vw,360px)] flex-col gap-2">
        {toasts.map((t) => (
          <div key={t.id} role="status" className={clsx(
            "rounded-[4px] border px-3.5 py-2.5 text-[12px] shadow-lg",
            t.tone === "success" && "border-ok/40 bg-surface text-ok",
            t.tone === "error" && "border-danger/40 bg-surface text-danger",
            t.tone === "info" && "border-line-strong bg-surface text-ink"
          )}>
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used inside ToastProvider");
  return ctx;
}

/* ------------------------------------------------------------------ Progress */
export function Progress({ value }: { value: number }) {
  return (
    <div className="h-1 w-full overflow-hidden rounded bg-surface-2">
      <div className="h-full bg-accent transition-all" style={{ width: `${Math.min(100, Math.max(0, value))}%` }} />
    </div>
  );
}

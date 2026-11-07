"use client";

import { clsx } from "clsx";
import {
  Activity, BarChart3, BrainCircuit, ChevronsLeft, ChevronsRight, Database,
  FileText, FlaskConical, LayoutDashboard, Map, Radio, Settings, ShieldCheck,
  Sparkles, Waves,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { useDataset } from "@/lib/dataset-context";
import { DatasetSwitcher } from "./dataset-switcher";

const NAV = [
  {
    group: "Observe",
    items: [
      { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, n: "01" },
      { href: "/datasets", label: "Datasets", icon: Database, n: "02" },
      { href: "/explorer", label: "Explorer", icon: Map, n: "03" },
      { href: "/data-quality", label: "Data quality", icon: ShieldCheck, n: "04" },
    ],
  },
  {
    group: "Model",
    items: [
      { href: "/analysis", label: "Analysis", icon: FlaskConical, n: "05" },
      { href: "/models", label: "Models", icon: BrainCircuit, n: "06" },
      { href: "/anomalies", label: "Anomalies", icon: Activity, n: "07" },
    ],
  },
  {
    group: "Decide",
    items: [
      { href: "/iot-monitor", label: "IoT monitor", icon: Radio, n: "08" },
      { href: "/decisions", label: "Decision centre", icon: Sparkles, n: "09" },
      { href: "/reports", label: "Reports", icon: FileText, n: "10" },
    ],
  },
  {
    group: "System",
    items: [
      { href: "/settings", label: "Settings", icon: Settings, n: "11" },
    ],
  },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { active } = useDataset();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [online, setOnline] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000"}/api/health`)
      .then((r) => r.ok)
      .then((ok) => !cancelled && setOnline(ok))
      .catch(() => !cancelled && setOnline(false));
    return () => { cancelled = true; };
  }, []);

  useEffect(() => { setMobileOpen(false); }, [pathname]);

  const pageTitle = (() => {
    for (const g of NAV) {
      const hit = g.items.find((i) => pathname === i.href || pathname.startsWith(i.href + "/"));
      if (hit) return hit.label;
    }
    if (pathname.startsWith("/datasets/")) return "Dataset";
    return "DataSense";
  })();

  return (
    <div className="min-h-screen bg-paper text-ink">
      {/* mobile overlay */}
      {mobileOpen && (
        <button
          aria-label="Close navigation"
          className="fixed inset-0 z-30 bg-black/40 lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      <aside
        className={clsx(
          "fixed inset-y-0 left-0 z-40 flex flex-col border-r border-line bg-surface transition-all",
          collapsed ? "lg:w-[68px]" : "lg:w-[236px]",
          "w-[236px]",
          mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        )}
      >
        {/* brand */}
        <div className="flex h-14 items-center gap-2.5 border-b border-line px-4">
          <Logomark />
          {!collapsed && (
            <div className="leading-none">
              <div className="text-[13px] font-semibold tracking-tight">DataSense AI</div>
              <div className="mt-0.5 text-[9px] font-medium uppercase tracking-[0.18em] text-muted">
                AIoT intelligence
              </div>
            </div>
          )}
        </div>

        <nav className="flex-1 overflow-y-auto px-2 py-3">
          {NAV.map((group) => (
            <div key={group.group} className="mb-4">
              {!collapsed && (
                <div className="mb-1 px-2 text-[9px] font-semibold uppercase tracking-[0.18em] text-muted">
                  {group.group}
                </div>
              )}
              <ul className="space-y-0.5">
                {group.items.map(({ href, label, icon: Icon, n }) => {
                  const activeItem = pathname === href || pathname.startsWith(href + "/");
                  return (
                    <li key={href}>
                      <Link
                        href={href}
                        title={label}
                        className={clsx(
                          "group flex items-center gap-2.5 rounded-[4px] px-2 py-1.5 text-[12.5px] transition-colors",
                          activeItem
                            ? "bg-accent-soft font-medium text-accent"
                            : "text-ink-2 hover:bg-surface-2"
                        )}
                      >
                        <Icon size={15} className={activeItem ? "text-accent" : "text-muted group-hover:text-ink-2"} />
                        {!collapsed && (
                          <>
                            <span className="flex-1 truncate">{label}</span>
                            <span className={clsx("num text-[9px]", activeItem ? "text-accent/70" : "text-muted/60")}>
                              {n}
                            </span>
                          </>
                        )}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>

        <div className="border-t border-line p-2">
          <button
            onClick={() => setCollapsed((c) => !c)}
            className="flex w-full items-center gap-2 rounded-[4px] px-2 py-1.5 text-[11px] text-muted hover:bg-surface-2 hover:text-ink-2"
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {collapsed ? <ChevronsRight size={14} /> : <ChevronsLeft size={14} />}
            {!collapsed && <span>Collapse</span>}
          </button>
        </div>
      </aside>

      <div className={clsx("flex min-h-screen flex-col transition-all", collapsed ? "lg:pl-[68px]" : "lg:pl-[236px]")}>
        {/* topbar */}
        <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b border-line bg-paper/95 px-4 backdrop-blur-sm sm:px-6">
          <button
            onClick={() => setMobileOpen(true)}
            className="rounded p-1.5 text-ink-2 hover:bg-surface-2 lg:hidden"
            aria-label="Open navigation"
          >
            <BarChart3 size={18} />
          </button>
          <div className="min-w-0">
            <h1 className="truncate text-[14px] font-semibold">{pageTitle}</h1>
            <p className="hidden truncate text-[10.5px] text-muted sm:block">
              {active ? `${active.name} · ${active.n_rows.toLocaleString()} rows` : "No dataset selected"}
            </p>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <span className={clsx(
              "hidden items-center gap-1.5 text-[10px] font-medium uppercase tracking-[0.12em] sm:flex",
              online === false ? "text-danger" : "text-muted"
            )}>
              <span className={clsx(
                "inline-block h-1.5 w-1.5 rounded-full",
                online === true ? "bg-ok" : online === false ? "bg-danger" : "bg-muted"
              )} />
              {online === true ? "API online" : online === false ? "API offline" : "Checking API"}
            </span>
            <DatasetSwitcher />
          </div>
        </header>

        <main className="mx-auto w-full max-w-[1440px] flex-1 px-4 py-6 sm:px-6 lg:px-8">
          {children}
        </main>

        <footer className="border-t border-line px-4 py-3 text-[10.5px] text-muted sm:px-6">
          DataSense AI · local demo mode · every metric is computed from genuine
          uploaded data ·{" "}
          <Link href="/" className="underline decoration-line-strong underline-offset-2 hover:text-ink-2">
            about this build
          </Link>
        </footer>
      </div>
    </div>
  );
}

export function Logomark({ size = 26 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true" fill="none">
      <rect x="1" y="1" width="30" height="30" rx="3" stroke="currentColor" strokeOpacity="0.25" />
      <path d="M6 22V16M11 22V11M16 22V6M21 22V13M26 22V17" stroke="currentColor" strokeWidth="2.4" strokeLinecap="square" />
      <path d="M6 26h20" stroke="currentColor" strokeOpacity="0.35" strokeWidth="1" />
      <circle cx="16" cy="6" r="2.2" fill="currentColor" />
    </svg>
  );
}

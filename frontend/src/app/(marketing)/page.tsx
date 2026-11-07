"use client";

import Link from "next/link";
import {
  ArrowRight, BarChart3, Database, FlaskConical, Radio, Sparkles,
  Waves, FileText, ShieldCheck, BrainCircuit, Settings,
} from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui";

const DATASETS = [
  {
    name: "AI4I 2020 Predictive Maintenance",
    rows: "10,000",
    cols: "14",
    provider: "UCI ML Repository",
    license: "CC BY 4.0",
    description:
      "Sensor data from a manufacturing machine with failure labels — ideal for classification and predictive maintenance.",
    icon: FlaskConical,
  },
  {
    name: "Air Quality (Multi-site)",
    rows: "9,357",
    cols: "14",
    provider: "UCI ML Repository",
    license: "CC BY 4.0",
    description:
      "Hourly air quality measurements from multiple monitoring stations — regression and time-series analysis.",
    icon: BarChart3,
  },
  {
    name: "Wisconsin Breast Cancer (WDBC)",
    rows: "569",
    cols: "32",
    provider: "UCI ML Repository",
    license: "CC BY 4.0",
    description:
      "Fine-needle aspirate cell characteristics for malignant/benign classification.",
    icon: ShieldCheck,
  },
  {
    name: "Household Power Consumption",
    rows: "2,075,259",
    cols: "8",
    provider: "UCI ML Repository",
    license: "CC BY 4.0",
    description:
      "Two-plus million household electricity meter readings — IoT replay and anomaly detection at scale.",
    icon: Radio,
  },
  {
    name: "Credit Card Fraud (OpenML 42175)",
    rows: "284,807",
    cols: "31",
    provider: "OpenML",
    license: "ODbL",
    description:
      "Highly imbalanced fraud transactions — anomaly detection and binary classification with real fraud labels.",
    icon: BrainCircuit,
  },
];

const FEATURES = [
  {
    title: "Real data, never invented",
    body:
      "Every dataset is sourced from public repositories (UCI, OpenML) with full provenance. No mock data, no placeholders.",
    icon: Database,
  },
  {
    title: "Genuine ML pipeline",
    body:
      "Classification, regression, clustering and anomaly detection with scikit-learn — real models trained on your data.",
    icon: FlaskConical,
  },
  {
    title: "IoT historical replay",
    body:
      "Replay timestamped datasets as simulated sensor streams with live inference and configurable speed.",
    icon: Radio,
  },
  {
    title: "Decision engine",
    body:
      "Evidence-backed findings with disclosed limitations — correlation is not causation, uncertainty is always stated.",
    icon: Sparkles,
  },
  {
    title: "PDF / CSV / JSON exports",
    body:
      "Generate reports, export profiles, quality metrics, model results and anomaly lists in standard formats.",
    icon: FileText,
  },
  {
    title: "No auth, no payments",
    body:
      "Local demo mode. Run the FastAPI backend and Next.js frontend on your machine — nothing to sign up for.",
    icon: Settings,
  },
];

export default function LandingPage() {
  const [navOpen, setNavOpen] = useState(false);
  const navLinks: [string, string][] = [
    ["/pricing", "Pricing"],
    ["/dashboard", "Platform"],
    ["/datasets", "Datasets"],
  ];

  return (
    <div className="min-h-screen bg-paper text-ink selection:bg-accent selection:text-accent-ink">
      {/* Navigation */}
      <nav className="sticky top-0 z-20 border-b border-line bg-paper/90 backdrop-blur-sm">
        <div className="mx-auto max-w-[1440px] px-4 py-3 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <Link href="/" className="flex items-center gap-2.5">
              <div className="flex h-7 w-7 items-center justify-center rounded-[3px] border border-accent bg-accent text-accent-ink font-display text-[16px] font-bold">
                DS
              </div>
              <span className="font-display text-[17px] font-semibold tracking-tight">DataSense AI</span>
            </Link>
            <div className="hidden lg:flex items-center gap-6">
              {navLinks.map(([href, label]) => (
                <Link key={href} href={href} className="text-[12px] text-ink-2 hover:text-accent transition-colors">
                  {label}
                </Link>
              ))}
              <Button variant="primary" size="sm" asChild>
                <Link href="/dashboard">Start exploring</Link>
              </Button>
            </div>
            <button
              onClick={() => setNavOpen(!navOpen)}
              className="lg:hidden p-1.5 text-ink-2 hover:bg-surface-2 rounded-[4px]"
              aria-label="Open menu"
            >
              <BarChart3 size={18} />
            </button>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <header className="px-4 py-12 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-3xl text-center">
          <div className="inline-flex items-center gap-2 rounded-[4px] border border-accent/30 bg-accent-soft px-3 py-1.5 mb-6">
            <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-accent">
              Local demo · No auth · No payments
            </span>
          </div>
          <h1 className="font-display text-[44px] leading-[1.1] font-semibold tracking-[-0.02em] sm:text-[56px] lg:text-[64px] mb-6">
            AIoT data intelligence,<br />
            computed from real data.
          </h1>
          <p className="text-[15px] leading-relaxed text-ink-2 max-w-lg mx-auto mb-10">
            Upload any structured dataset, profile it, train real machine-learning models, detect
            anomalies, replay historical IoT streams and turn evidence into decisions. Five genuine
            public datasets are pre-loaded and ready to explore.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Button variant="primary" size="md" asChild>
              <Link href="/dashboard">
                Open platform <ArrowRight size={16} />
              </Link>
            </Button>
            <Button variant="ghost" size="md" asChild>
              <Link href="/datasets">Browse datasets</Link>
            </Button>
          </div>
        </div>
      </header>

      {/* Dataset highlights */}
      <section className="border-y border-line py-16 bg-surface/50">
        <div className="mx-auto max-w-[1440px] px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between mb-12">
            <div>
              <h2 className="font-display text-[24px] font-semibold tracking-tight mb-1">Pre-loaded datasets</h2>
              <p className="text-[12px] text-muted">Genuine public data with full provenance — nothing is fabricated.</p>
            </div>
            <Link href="/datasets" className="text-[12px] font-medium text-accent hover:underline">
              View all →
            </Link>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {DATASETS.map((ds) => (
              <div key={ds.name} className="panel rounded-[6px] p-5 hover:border-accent/50 transition-colors">
                <div className="flex items-center gap-2 mb-3">
                  <ds.icon size={14} className="text-accent" />
                  <span className="text-[10px] font-semibold uppercase tracking-[0.1em] text-muted">
                    {ds.provider} · {ds.license}
                  </span>
                </div>
                <h3 className="text-[14px] font-semibold text-ink mb-2">{ds.name}</h3>
                <div className="flex items-baseline gap-1 mb-3">
                  <span className="num text-[20px] font-semibold">{ds.rows}</span>
                  <span className="text-[11px] text-muted">rows ·</span>
                  <span className="num text-[13px] font-semibold">{ds.cols}</span>
                  <span className="text-[11px] text-muted">columns</span>
                </div>
                <p className="text-[11.5px] leading-relaxed text-muted mb-4">{ds.description}</p>
                <Link href="/dashboard" className="inline-block text-[11px] font-semibold text-accent hover:underline">
                  Explore dataset
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-16">
        <div className="mx-auto max-w-[1440px] px-4 sm:px-6 lg:px-8">
          <h2 className="font-display text-[24px] font-semibold tracking-tight text-center mb-12">
            Built for evidence, not opinions
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {FEATURES.map((f) => (
              <div key={f.title} className="panel rounded-[6px] p-5">
                <div className="rounded-lg bg-accent-soft p-2.5 mb-4 inline-flex">
                  <f.icon size={16} className="text-accent" />
                </div>
                <h3 className="text-[14px] font-semibold text-ink mb-2">{f.title}</h3>
                <p className="text-[12px] leading-relaxed text-muted">{f.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 border-t border-line">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
          <div className="panel rounded-[8px] p-8 sm:p-12 text-center border-accent/40">
            <h2 className="font-display text-[26px] font-semibold tracking-tight mb-4">Ready to explore?</h2>
            <p className="text-[13px] leading-relaxed text-ink-2 max-w-lg mx-auto mb-8">
              The backend runs on FastAPI with scikit-learn models. The frontend is Next.js with
              Tailwind. Everything runs locally on your machine.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              <Button variant="primary" size="md" asChild>
                <Link href="/dashboard">Start exploring →</Link>
              </Button>
              <Button variant="ghost" size="md" asChild>
                <Link href="/datasets">Browse datasets →</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      <footer className="border-t border-line py-8 px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-[1440px] flex flex-col lg:flex-row items-center justify-between gap-3">
          <p className="text-[10px] text-muted">
            DataSense AI · local demo mode · every metric computed from genuine uploaded data
          </p>
          <div className="flex items-center gap-4 text-[10px] text-muted">
            <Link href="/" className="hover:text-ink-2 transition-colors">About this build</Link>
            <span aria-hidden>·</span>
            <Link href="/pricing" className="hover:text-ink-2 transition-colors">Pricing</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

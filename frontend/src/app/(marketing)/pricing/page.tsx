"use client";

import Link from "next/link";
import { Check, Minus } from "lucide-react";

const TIERS = [
  {
    name: "Local Demo",
    price: "Free",
    period: "forever",
    tagline: "Everything in this build. Runs on your machine.",
    highlight: true,
    features: [
      { label: "All 14 platform pages", included: true },
      { label: "5 genuine public datasets pre-loaded", included: true },
      { label: "Classification, regression, clustering, anomaly detection", included: true },
      { label: "IoT historical replay with live inference", included: true },
      { label: "Decision findings with disclosed limitations", included: true },
      { label: "PDF / CSV / JSON exports", included: true },
      { label: "No auth, no payments, no telemetry", included: true },
      { label: "Multi-user cloud deployment", included: false },
      { label: "Managed model registry & scheduled retraining", included: false },
    ],
    cta: { label: "Open the platform", href: "/dashboard" },
  },
  {
    name: "Self-Hosted Team",
    price: "You host it",
    period: "bring your own infra",
    tagline: "The same codebase deployed on your own infrastructure.",
    highlight: false,
    features: [
      { label: "Everything in Local Demo", included: true },
      { label: "Your own datasets, your own storage", included: true },
      { label: "Docker / compose packaging by you", included: true },
      { label: "Add auth yourself (middleware hooks exist)", included: true },
      { label: "Vendor support / SLA", included: false },
      { label: "Managed upgrades", included: false },
    ],
    cta: { label: "Read the architecture", href: "/settings" },
  },
  {
    name: "Enterprise SaaS",
    price: "—",
    period: "not part of this build",
    tagline: "Honestly: this build does not include a hosted service.",
    highlight: false,
    features: [
      { label: "Multi-tenant accounts & billing", included: false },
      { label: "Managed GPU training", included: false },
      { label: "Stream processing at scale", included: false },
      { label: "This page exists only to describe the roadmap", included: true },
    ],
    cta: { label: "Back to landing page", href: "/" },
  },
];

export default function PricingPage() {
  return (
    <div className="min-h-screen bg-paper text-ink">
      <nav className="border-b border-line">
        <div className="mx-auto flex max-w-[1200px] items-center justify-between px-4 py-4 sm:px-6">
          <Link href="/" className="font-display text-[18px] font-semibold tracking-tight">
            DataSense AI
          </Link>
          <Link href="/dashboard" className="text-[12px] font-medium text-accent hover:underline">
            Open platform →
          </Link>
        </div>
      </nav>

      <main className="mx-auto max-w-[1200px] px-4 py-14 sm:px-6">
        <div className="mb-12 max-w-2xl">
          <div className="mb-4 inline-flex items-center gap-2 rounded-[4px] border border-accent/30 bg-accent-soft px-3 py-1.5">
            <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-accent">
              Local demo · no payments
            </span>
          </div>
          <h1 className="font-display text-[38px] font-semibold leading-[1.1] tracking-[-0.02em] sm:text-[46px]">
            Pricing, stated honestly.
          </h1>
          <p className="mt-4 text-[14px] leading-relaxed text-ink-2">
            DataSense AI runs entirely on your machine. There is nothing to buy and nothing
            to sign up for. This page exists because a pricing page was part of the spec —
            so instead of a fake checkout, here is exactly what the build contains and
            what it does not.
          </p>
        </div>

        <div className="grid gap-5 lg:grid-cols-3">
          {TIERS.map((t) => (
            <section
              key={t.name}
              className={`panel rounded-[6px] p-6 ${
                t.highlight ? "border-accent/50 ring-1 ring-accent/30" : ""
              }`}
            >
              <div className="flex items-baseline justify-between">
                <h2 className="text-[15px] font-semibold">{t.name}</h2>
                {t.highlight && (
                  <span className="rounded-[3px] border border-accent/30 bg-accent-soft px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-accent">
                    This build
                  </span>
                )}
              </div>
              <div className="mt-3 flex items-baseline gap-2">
                <span className="num text-[30px] font-semibold leading-none">{t.price}</span>
                <span className="text-[11px] text-muted">{t.period}</span>
              </div>
              <p className="mt-2 text-[12px] leading-relaxed text-muted">{t.tagline}</p>
              <ul className="mt-5 space-y-2.5">
                {t.features.map((f) => (
                  <li key={f.label} className="flex items-start gap-2 text-[12.5px]">
                    {f.included ? (
                      <Check size={14} className="mt-0.5 shrink-0 text-ok" />
                    ) : (
                      <Minus size={14} className="mt-0.5 shrink-0 text-muted" />
                    )}
                    <span className={f.included ? "text-ink-2" : "text-muted line-through decoration-line-strong"}>
                      {f.label}
                    </span>
                  </li>
                ))}
              </ul>
              <Link
                href={t.cta.href}
                className={`mt-6 block rounded-[4px] border px-3.5 py-2 text-center text-[13px] font-medium transition-colors ${
                  t.highlight
                    ? "border-accent bg-accent text-accent-ink hover:brightness-110"
                    : "border-line-strong bg-surface text-ink hover:bg-surface-2"
                }`}
              >
                {t.cta.label}
              </Link>
            </section>
          ))}
        </div>

        <p className="mt-10 border-t border-line pt-6 text-[11.5px] leading-relaxed text-muted">
          No telemetry, no accounts, no payment processing exists anywhere in this codebase.
          Every metric in the platform is computed locally from the genuine datasets documented
          in <code className="font-mono">docs/DATASETS.md</code>.
        </p>
      </main>
    </div>
  );
}

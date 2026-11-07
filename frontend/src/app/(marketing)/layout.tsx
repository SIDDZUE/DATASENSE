import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "DataSense AI — AIoT Data Intelligence Platform",
  description:
    "Upload any structured dataset, profile it, train real machine-learning models, detect anomalies, replay historical IoT streams and turn evidence into decisions.",
};

export default function MarketingLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return <div className="min-h-screen bg-paper text-ink">{children}</div>;
}

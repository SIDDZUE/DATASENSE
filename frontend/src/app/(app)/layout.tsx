"use client";

import { Suspense } from "react";
import { DatasetProvider } from "@/lib/dataset-context";
import { ToastProvider } from "@/components/ui";
import { AppShell } from "@/components/app-shell";

export default function AppLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <DatasetProvider>
      <ToastProvider>
        <Suspense fallback={null}>
          <AppShell>{children}</AppShell>
        </Suspense>
      </ToastProvider>
    </DatasetProvider>
  );
}

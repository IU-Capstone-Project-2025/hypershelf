"use client";

import { HeaderContentProvider } from "@/components/util/HeaderContext";
import Header from "@/components/Header";
import { LogProvider } from "@/components/util/Log";
import { cn } from "@/lib/utils";
import { LoadingProvider } from "@/components/util/LoadingContext";

export default function ClientLayout({
  children
}: {
  children: React.ReactNode;
}) {
  return (
    <LogProvider>
      <HeaderContentProvider>
        <LoadingProvider>
          <Header />
          <main
            className={cn(
              "min-w-fit px-4 pb-4",
              typeof window !== "undefined" && window.innerHeight >= 400
                ? "pt-12"
                : "pt-8"
            )}
          >
            {children}
          </main>
        </LoadingProvider>
      </HeaderContentProvider>
    </LogProvider>
  );
}

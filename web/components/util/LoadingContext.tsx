"use client";

import { createContext, useContext, useState, ReactNode } from "react";

type LoadingCtx = {
  isLoading: boolean;
  setIsLoading: (v: boolean) => void;
};

const LoadingContext = createContext<LoadingCtx | undefined>(undefined);

export function LoadingProvider({ children }: { children: ReactNode }) {
  const [isLoading, setIsLoading] = useState(true);
  return (
    <LoadingContext.Provider value={{ isLoading, setIsLoading }}>
      {children}
    </LoadingContext.Provider>
  );
}

export function useLoading() {
  const ctx = useContext(LoadingContext);
  if (!ctx) throw new Error("useLoading must be inside <LoadingProvider>");
  return ctx;
}

"use client";

import { cn } from "@/lib/utils";
import { AnimatePresence, motion } from "framer-motion";
import {
  ReactNode,
  createContext,
  memo,
  useCallback,
  useContext,
  useEffect,
  useState
} from "react";

type Log = {
  id: string;
  message: string;
  expires: number;
  isError: boolean;
};

type LogDispatch = (response: unknown, isError?: boolean) => void;

type ResponseWithLogs = {
  _logs: unknown[];
  success?: boolean;
};

const hasLogs = (x: unknown): x is ResponseWithLogs => {
  if (typeof x !== "object" || x === null) return false;
  return (
    "_logs" in x && Array.isArray((x as Record<PropertyKey, unknown>)._logs)
  );
};

const buildLog = (message: string, isError: boolean): Log => ({
  id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
  message: message.trim(),
  expires: Date.now() + 10_000,
  isError
});

const normaliseResponse = (response: unknown, isError?: boolean): Log[] => {
  if (typeof response === "string") return [buildLog(response, !!isError)];

  if (hasLogs(response)) {
    const success = response.success ?? !isError;
    return response._logs
      .filter((l): l is string => typeof l === "string" && l.trim() !== "")
      .map(msg => buildLog(msg, !success));
  }

  return [];
};

const LogDispatchContext = createContext<LogDispatch | null>(null);

export function LogProvider({ children }: { children: ReactNode }) {
  const [logs, setLogs] = useState<Log[]>([]);

  const ingestLogs = useCallback<LogDispatch>((response, isError) => {
    setLogs(prev =>
      [...prev, ...normaliseResponse(response, isError)].slice(-7)
    );
  }, []);

  useEffect(() => {
    const iv = setInterval(() => {
      setLogs(prev => {
        const now = Date.now();
        const next = prev.filter(l => l.expires > now);
        return next.length === prev.length ? prev : next;
      });
    }, 1_000);
    return () => clearInterval(iv);
  }, []);

  return (
    <LogDispatchContext.Provider value={ingestLogs}>
      {children}
      <LogOverlay logs={logs} />
    </LogDispatchContext.Provider>
  );
}

const LogOverlay = memo(({ logs }: { logs: Log[] }) => (
  <div
    className={cn(
      "text-muted-foreground fixed right-0 bottom-0 flex flex-col gap-1 rounded-md bg-black/40 px-2 py-1 text-right text-[0.5rem] backdrop-blur-xl",
      logs.length === 0 && "hidden"
    )}
  >
    <AnimatePresence>
      {logs.map(log => (
        <motion.div
          key={log.id}
          initial={{ opacity: 0, y: 10, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -10, scale: 0.9 }}
          transition={{ duration: 0.3 }}
          className={log.isError ? "text-destructive" : ""}
        >
          {log.message}
        </motion.div>
      ))}
    </AnimatePresence>
  </div>
));
LogOverlay.displayName = "LogOverlay";

export function useLog(): LogDispatch {
  const ctx = useContext(LogDispatchContext);
  if (!ctx) throw new Error("useLog must be used within LogProvider");
  return ctx;
}

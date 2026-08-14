import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { createMockTelemetrySource, type TelemetrySource } from "./source";
import type { TelemetrySnapshot } from "./types";

const TelemetryContext = createContext<TelemetrySnapshot | null>(null);

export function TelemetryProvider({
  children,
  source,
}: {
  children: ReactNode;
  /** Swap in a REST/WebSocket source later without touching UI components. */
  source?: TelemetrySource;
}) {
  const sourceRef = useRef<TelemetrySource>(source ?? createMockTelemetrySource());
  const [snapshot, setSnapshot] = useState<TelemetrySnapshot>(() => sourceRef.current.getSnapshot());

  useEffect(() => sourceRef.current.subscribe(setSnapshot), []);

  return <TelemetryContext.Provider value={snapshot}>{children}</TelemetryContext.Provider>;
}

export function useTelemetry(): TelemetrySnapshot {
  const ctx = useContext(TelemetryContext);
  if (!ctx) throw new Error("useTelemetry must be used inside <TelemetryProvider>");
  return ctx;
}

export function useSensor(key: string) {
  const { sensors } = useTelemetry();
  return useMemo(() => sensors.find((s) => s.key === key), [sensors, key]);
}

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createMockTelemetrySource, type TelemetrySource } from "./source";
import { MANNEQUINS, type MannequinConfig } from "./fleet";
import type { BodyZoneId, SensorKey, TelemetrySnapshot } from "./types";

interface FleetValue {
  mannequins: MannequinConfig[];
  /** One live snapshot per mannequin, keyed by id. */
  snapshots: Record<string, TelemetrySnapshot>;
  selectedId: string;
  selectMannequin: (id: string) => void;
  selectedSensor: SensorKey | null;
  setSelectedSensor: (key: SensorKey | null) => void;
  selectedZone: BodyZoneId | null;
  setSelectedZone: (zone: BodyZoneId | null) => void;
}

const FleetContext = createContext<FleetValue | null>(null);

export function TelemetryProvider({
  children,
  sources,
}: {
  children: ReactNode;
  /** Swap in REST/WebSocket/MQTT sources later without touching UI components. */
  sources?: Record<string, TelemetrySource>;
}) {
  const sourcesRef = useRef<Record<string, TelemetrySource>>(
    sources ?? Object.fromEntries(MANNEQUINS.map((m) => [m.id, createMockTelemetrySource(m)])),
  );

  const [snapshots, setSnapshots] = useState<Record<string, TelemetrySnapshot>>(() =>
    Object.fromEntries(Object.entries(sourcesRef.current).map(([id, s]) => [id, s.getSnapshot()])),
  );
  const [selectedId, setSelectedId] = useState(MANNEQUINS[0]!.id);
  const [selectedSensor, setSelectedSensor] = useState<SensorKey | null>(null);
  const [selectedZone, setSelectedZone] = useState<BodyZoneId | null>(null);

  useEffect(() => {
    const unsubs = Object.entries(sourcesRef.current).map(([id, source]) =>
      source.subscribe((snap) => setSnapshots((prev) => ({ ...prev, [id]: snap }))),
    );
    return () => unsubs.forEach((u) => u());
  }, []);

  const selectMannequin = useCallback((id: string) => {
    setSelectedId(id);
    setSelectedSensor(null);
    setSelectedZone(null);
  }, []);

  const selectSensor = useCallback((key: SensorKey | null) => {
    setSelectedSensor(key);
  }, []);

  const value = useMemo<FleetValue>(
    () => ({
      mannequins: MANNEQUINS,
      snapshots,
      selectedId,
      selectMannequin,
      selectedSensor,
      setSelectedSensor: selectSensor,
      selectedZone,
      setSelectedZone,
    }),
    [snapshots, selectedId, selectMannequin, selectedSensor, selectSensor, selectedZone],
  );

  return <FleetContext.Provider value={value}>{children}</FleetContext.Provider>;
}

export function useFleet(): FleetValue {
  const ctx = useContext(FleetContext);
  if (!ctx) throw new Error("useFleet must be used inside <TelemetryProvider>");
  return ctx;
}

/** Snapshot of the currently selected mannequin — every panel reads through this. */
export function useTelemetry(): TelemetrySnapshot {
  const { snapshots, selectedId } = useFleet();
  const snap = snapshots[selectedId];
  if (!snap) throw new Error(`No telemetry snapshot for ${selectedId}`);
  return snap;
}

export function useSensor(key: string) {
  const { sensors } = useTelemetry();
  return useMemo(() => sensors.find((s) => s.key === key), [sensors, key]);
}

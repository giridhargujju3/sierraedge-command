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
import {
  createEsp32TelemetrySource,
  type Esp32Diagnostics,
  type Esp32TelemetrySource,
} from "./esp32Source";
import { isValidEsp32Host } from "./esp32";
import {
  playCritSirenWithFallback,
  primeAudioOnGesture,
  readSirenMuted,
  writeSirenMuted,
} from "./alertHorn";
import { MANNEQUINS, type MannequinConfig } from "./fleet";
import type { BodyZoneId, SensorKey, TelemetrySnapshot } from "./types";

/** localStorage keys for the ESP32 live-link configuration. */
const ESP32_IP_KEY = "esp32_ip";
const ESP32_LIVE_KEY = "esp32_live";
const ESP32_POLL_KEY = "esp32_poll_ms";
const DEFAULT_POLL_MS = 2000;

/** The physical rig binds to the first mannequin slot. */
const RIG_MANNEQUIN_ID = MANNEQUINS[0]?.id ?? "M1";

export interface Esp32Link {
  /** Host/IP exactly as saved by the operator ("" when unconfigured). */
  ip: string;
  setIp: (ip: string) => void;
  /** Master switch — off ⇒ every panel renders mock/demo telemetry. */
  liveMode: boolean;
  setLiveMode: (on: boolean) => void;
  pollMs: number;
  setPollMs: (ms: number) => void;
  /** Saved IP parses into a usable http endpoint. */
  ready: boolean;
  /** Live rig feed is actually running (hydrated + enabled + valid IP). */
  active: boolean;
  /** Mannequin slot fed by the physical rig. */
  rigMannequinId: string;
  diagnostics: Esp32Diagnostics | null;
}

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
  /** Critical-alert siren preference (TopBar toggle). */
  alertSirenMuted: boolean;
  setAlertSirenMuted: (muted: boolean) => void;
  esp32: Esp32Link;
}

const FleetContext = createContext<FleetValue | null>(null);

// __PROVIDER_BODY__

export function TelemetryProvider({
  children,
  sources,
}: {
  children: ReactNode;
  /** Swap in REST/WebSocket/MQTT sources later without touching UI components. */
  sources?: Record<string, TelemetrySource>;
}) {
  const [ip, setIpState] = useState("");
  const [liveMode, setLiveModeState] = useState(false);
  const [pollMs, setPollMsState] = useState(DEFAULT_POLL_MS);
  /** Guards against SSR hydration mismatches — settings load after mount. */
  const [hydrated, setHydrated] = useState(false);

  /** Critical-alert siren — muted flag persisted; audio primed on first gesture. */
  const [alertSirenMuted, setAlertSirenMutedState] = useState(false);
  const sirenMutedRef = useRef(alertSirenMuted);
  sirenMutedRef.current = alertSirenMuted;

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      setIpState(localStorage.getItem(ESP32_IP_KEY) ?? "");
      setLiveModeState(localStorage.getItem(ESP32_LIVE_KEY) === "1");
      const savedPoll = Number(localStorage.getItem(ESP32_POLL_KEY));
      if (Number.isFinite(savedPoll) && savedPoll >= 1000) setPollMsState(savedPoll);
      setAlertSirenMutedState(readSirenMuted());
    } catch {
      /* private mode — fall back to demo */
    }
    setHydrated(true);
    primeAudioOnGesture();
  }, []);

  const persist = useCallback((key: string, value: string) => {
    try {
      localStorage.setItem(key, value);
    } catch {
      /* ignore */
    }
  }, []);

  const setAlertSirenMuted = useCallback((muted: boolean) => {
    setAlertSirenMutedState(muted);
    writeSirenMuted(muted);
  }, []);

  const setIp = useCallback(
    (next: string) => {
      setIpState(next);
      persist(ESP32_IP_KEY, next);
    },
    [persist],
  );

  const setLiveMode = useCallback(
    (on: boolean) => {
      setLiveModeState(on);
      persist(ESP32_LIVE_KEY, on ? "1" : "0");
    },
    [persist],
  );

  const setPollMs = useCallback(
    (ms: number) => {
      const next = Math.min(60_000, Math.max(1_000, Math.round(ms)));
      setPollMsState(next);
      persist(ESP32_POLL_KEY, String(next));
    },
    [persist],
  );

  const ready = isValidEsp32Host(ip);
  const active = hydrated && liveMode && ready;

  const sourcesRef = useRef<Record<string, TelemetrySource>>(
    sources ?? Object.fromEntries(MANNEQUINS.map((m) => [m.id, createMockTelemetrySource(m)])),
  );

  const [snapshots, setSnapshots] = useState<Record<string, TelemetrySnapshot>>(() =>
    Object.fromEntries(Object.entries(sourcesRef.current).map(([id, s]) => [id, s.getSnapshot()])),
  );
  const [selectedId, setSelectedId] = useState(MANNEQUINS[0]!.id);
  const [selectedSensor, setSelectedSensor] = useState<SensorKey | null>(null);
  const [selectedZone, setSelectedZone] = useState<BodyZoneId | null>(null);

  /** Live rig source lifecycle — exists only while the ESP32 link is active. */
  const [rigSource, setRigSource] = useState<Esp32TelemetrySource | null>(null);
  const [rigDiagnostics, setRigDiagnostics] = useState<Esp32Diagnostics | null>(null);

  /** Siren trigger — fully packet-driven: while ANY sensor in the latest
   * packet is CRITICAL the siren (re)sounds (rate-limited by its cooldown);
   * the moment all channels return to normal it stays silent and re-arms. */
  const watchCritical = useCallback((snap: TelemetrySnapshot) => {
    const hasCrit = snap.sensors.some((s) => s.status === "crit");
    if (hasCrit && !sirenMutedRef.current) void playCritSirenWithFallback();
  }, []);

  useEffect(() => {
    if (!active) {
      setRigSource(null);
      setRigDiagnostics(null);
      return;
    }
    const config = MANNEQUINS.find((m) => m.id === RIG_MANNEQUIN_ID) ?? MANNEQUINS[0]!;
    const source = createEsp32TelemetrySource({ ip, config, pollMs });
    setRigSource(source);
    return () => source.destroy();
  }, [active, ip, pollMs]);

  useEffect(() => {
    const unsubs = Object.entries(sourcesRef.current)
      .filter(([id]) => !(active && id === RIG_MANNEQUIN_ID))
      .map(([id, source]) =>
        source.subscribe((snap) => {
          watchCritical(snap);
          setSnapshots((prev) => ({ ...prev, [id]: snap }));
        }),
      );

    let unsubRig: (() => void) | null = null;
    if (active && rigSource) {
      // Prime immediately so the rig slot stops showing mock data.
      setSnapshots((prev) => ({ ...prev, [RIG_MANNEQUIN_ID]: rigSource.getSnapshot() }));
      setRigDiagnostics(rigSource.getDiagnostics());
      unsubRig = rigSource.subscribe((snap) => {
        watchCritical(snap);
        setSnapshots((prev) => ({ ...prev, [snap.mannequinId]: snap }));
        setRigDiagnostics(rigSource.getDiagnostics());
      });
    }
    return () => {
      unsubs.forEach((u) => u());
      unsubRig?.();
    };
  }, [active, rigSource, watchCritical]);

  const selectMannequin = useCallback((id: string) => {
    setSelectedId(id);
    setSelectedSensor(null);
    setSelectedZone(null);
  }, []);

  const selectSensor = useCallback((key: SensorKey | null) => {
    setSelectedSensor(key);
  }, []);

  const esp32 = useMemo<Esp32Link>(
    () => ({
      ip,
      setIp,
      liveMode,
      setLiveMode,
      pollMs,
      setPollMs,
      ready,
      active,
      rigMannequinId: RIG_MANNEQUIN_ID,
      diagnostics: rigDiagnostics,
    }),
    [ip, setIp, liveMode, setLiveMode, pollMs, setPollMs, ready, active, rigDiagnostics],
  );

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
      alertSirenMuted,
      setAlertSirenMuted,
      esp32,
    }),
    [
      snapshots,
      selectedId,
      selectMannequin,
      selectedSensor,
      selectSensor,
      selectedZone,
      alertSirenMuted,
      setAlertSirenMuted,
      esp32,
    ],
  );

  return <FleetContext.Provider value={value}>{children}</FleetContext.Provider>;
}

export function useFleet(): FleetValue {
  const ctx = useContext(FleetContext);
  if (!ctx) throw new Error("useFleet must be used inside <TelemetryProvider>");
  return ctx;
}

/** ESP32 live-link status — settings page, TopBar badge and live panels read this. */
export function useEsp32Link(): Esp32Link {
  return useFleet().esp32;
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

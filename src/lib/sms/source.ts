import type {
  AlertItem,
  BodyZone,
  SensorReading,
  Status,
  TelemetrySnapshot,
  TrendSeries,
  Vital,
} from "./types";

/**
 * Telemetry source contract. The dashboard only ever talks to this interface,
 * so the mock generator below can be swapped for a REST poller or WebSocket
 * client without touching a single UI component.
 */
export interface TelemetrySource {
  getSnapshot(): TelemetrySnapshot;
  subscribe(listener: (snapshot: TelemetrySnapshot) => void): () => void;
}

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));
const drift = (v: number, amount: number, min: number, max: number) =>
  clamp(v + (Math.random() - 0.5) * amount, min, max);

const seedHistory = (base: number, spread: number, n = 24) =>
  Array.from({ length: n }, (_, i) => base + Math.sin(i / 2.4) * spread * 0.6 + (Math.random() - 0.5) * spread);

const clock = (offsetSeconds = 0) => {
  const d = new Date(Date.now() - offsetSeconds * 1000);
  return d.toLocaleTimeString("en-GB", { hour12: false });
};

const rangeStatus = (v: number, warn: [number, number], crit: [number, number]): Status => {
  if (v < crit[0] || v > crit[1]) return "crit";
  if (v < warn[0] || v > warn[1]) return "warn";
  return "ok";
};

const worst = (list: Status[]): Status =>
  list.includes("crit") ? "crit" : list.includes("warn") ? "warn" : "ok";

const trendPoints = (base: number, spread: number, n = 40) => {
  const now = Date.now();
  return Array.from({ length: n }, (_, i) => ({
    t: new Date(now - (n - i) * 60_000).toLocaleTimeString("en-GB", {
      hour: "2-digit",
      minute: "2-digit",
    }),
    v: Number((base + Math.sin(i / 3) * spread + (Math.random() - 0.5) * spread).toFixed(1)),
  }));
};

const ZONE_LAYOUT: Record<BodyZone["id"], { label: string; metrics: string[]; position: [number, number, number] }> = {
  head: { label: "HEAD", metrics: ["Impact Sensor", "Temperature"], position: [0, 1.62, 0.12] },
  upperBody: {
    label: "UPPER BODY",
    metrics: ["Heart Rate", "Respiration", "Posture"],
    position: [0.16, 1.25, 0.16],
  },
  arms: { label: "ARMS", metrics: ["Motion", "Temperature"], position: [-0.42, 1.05, 0.05] },
  core: { label: "CORE", metrics: ["Core Temp", "SpO2", "Hydration"], position: [0, 0.98, 0.18] },
  legs: { label: "LEGS", metrics: ["Motion", "Load", "Fatigue"], position: [0.16, 0.5, 0.1] },
};

type HistoryKey =
  | "heartRate"
  | "bodyTemp"
  | "spo2"
  | "respiration"
  | "stress"
  | "hydration"
  | "fatigue"
  | "motion";

interface MutableState {
  heartRate: number;
  bodyTemp: number;
  spo2: number;
  respiration: number;
  stress: number;
  hydration: number;
  fatigue: number;
  motion: number;
  battery: number;
  distance: number;
  calories: number;
  startedAt: number;
  histories: Record<HistoryKey, number[]>;
  alerts: AlertItem[];
  trends: TrendSeries[];
}

function initialState(): MutableState {
  return {
    heartRate: 72,
    bodyTemp: 36.7,
    spo2: 98,
    respiration: 18,
    stress: 22,
    hydration: 81,
    fatigue: 24,
    motion: 64,
    battery: 87,
    distance: 18.7,
    calories: 2450,
    startedAt: Date.now() - 4 * 3600_000 - 35 * 60_000,
    histories: {
      heartRate: seedHistory(72, 6),
      bodyTemp: seedHistory(36.7, 0.25),
      spo2: seedHistory(98, 1),
      respiration: seedHistory(18, 2),
      stress: seedHistory(22, 8),
      hydration: seedHistory(81, 6),
      fatigue: seedHistory(24, 8),
      motion: seedHistory(64, 12),
    },
    alerts: [
      { id: "a1", time: clock(120), severity: "ok", message: "Hydration level nominal" },
      { id: "a2", time: clock(320), severity: "ok", message: "All vitals within range" },
      { id: "a3", time: clock(640), severity: "warn", message: "Stress level elevated briefly" },
      { id: "a4", time: clock(1200), severity: "ok", message: "System self-check complete" },
    ],
    trends: [
      { key: "heartRate", label: "Heart Rate", unit: "BPM", color: "var(--hud)", points: trendPoints(72, 5) },
      { key: "coreTemp", label: "Core Body Temp", unit: "°C", color: "var(--ok)", points: trendPoints(36.8, 0.3) },
      { key: "spo2", label: "Blood Oxygen", unit: "%", color: "var(--hud-dim)", points: trendPoints(97.5, 1) },
      { key: "respiration", label: "Respiration", unit: "RPM", color: "var(--warn)", points: trendPoints(18, 1.6) },
    ],
  };
}

function pushHistory(list: number[], v: number) {
  const next = [...list, v];
  return next.length > 40 ? next.slice(next.length - 40) : next;
}

function buildSnapshot(s: MutableState): TelemetrySnapshot {
  const hrStatus = rangeStatus(s.heartRate, [55, 100], [45, 130]);
  const tempStatus = rangeStatus(s.bodyTemp, [36.1, 37.5], [35.5, 38.5]);
  const spo2Status = rangeStatus(s.spo2, [95, 100], [90, 100]);
  const respStatus = rangeStatus(s.respiration, [12, 22], [9, 28]);
  const stressStatus = rangeStatus(s.stress, [0, 55], [0, 78]);
  const hydrationStatus = rangeStatus(s.hydration, [60, 100], [45, 100]);
  const fatigueStatus = rangeStatus(s.fatigue, [0, 55], [0, 80]);

  const vitals: Vital[] = [
    {
      key: "heartRate",
      label: "Heart Rate",
      value: Math.round(s.heartRate),
      unit: "BPM",
      status: hrStatus,
      history: s.histories.heartRate,
    },
    {
      key: "bodyTemp",
      label: "Body Temp",
      value: Number(s.bodyTemp.toFixed(1)),
      unit: "°C",
      status: tempStatus,
      history: s.histories.bodyTemp,
    },
    {
      key: "spo2",
      label: "SpO2",
      value: Math.round(s.spo2),
      unit: "%",
      status: spo2Status,
      history: s.histories.spo2,
    },
    {
      key: "respiration",
      label: "Respiration",
      value: Math.round(s.respiration),
      unit: "RPM",
      status: respStatus,
      history: s.histories.respiration,
    },
  ];

  const level = (v: number) => (v < 35 ? "LOW" : v < 65 ? "MODERATE" : "HIGH");

  const sensors: SensorReading[] = [
    {
      key: "coreTemp",
      label: "Core Body Temp",
      value: Number(s.bodyTemp.toFixed(1)),
      unit: "°C",
      display: `${s.bodyTemp.toFixed(1)}°C`,
      status: tempStatus,
      history: s.histories.bodyTemp,
      zone: "core",
    },
    {
      key: "heartRate",
      label: "Heart Rate",
      value: Math.round(s.heartRate),
      unit: "BPM",
      display: `${Math.round(s.heartRate)} BPM`,
      status: hrStatus,
      history: s.histories.heartRate,
      zone: "upperBody",
    },
    {
      key: "respiration",
      label: "Respiration",
      value: Math.round(s.respiration),
      unit: "RPM",
      display: `${Math.round(s.respiration)} RPM`,
      status: respStatus,
      history: s.histories.respiration,
      zone: "upperBody",
    },
    {
      key: "spo2",
      label: "Blood Oxygen",
      value: Math.round(s.spo2),
      unit: "%",
      display: `${Math.round(s.spo2)}%`,
      status: spo2Status,
      history: s.histories.spo2,
      zone: "core",
    },
    {
      key: "stress",
      label: "Stress Level",
      value: Math.round(s.stress),
      unit: "%",
      display: level(s.stress),
      status: stressStatus,
      history: s.histories.stress,
      zone: "head",
    },
    {
      key: "hydration",
      label: "Hydration",
      value: Math.round(s.hydration),
      unit: "%",
      display: s.hydration > 70 ? "GOOD" : s.hydration > 55 ? "FAIR" : "LOW",
      status: hydrationStatus,
      history: s.histories.hydration,
      zone: "core",
    },
    {
      key: "fatigue",
      label: "Fatigue Level",
      value: Math.round(s.fatigue),
      unit: "%",
      display: level(s.fatigue),
      status: fatigueStatus,
      history: s.histories.fatigue,
      zone: "legs",
    },
    {
      key: "motion",
      label: "Motion Status",
      value: Math.round(s.motion),
      unit: "%",
      display: s.motion > 30 ? "ACTIVE" : "STATIONARY",
      status: "ok",
      history: s.histories.motion,
      zone: "arms",
    },
  ];

  const zones: BodyZone[] = (Object.keys(ZONE_LAYOUT) as BodyZone["id"][]).map((id) => {
    const zoneSensors = sensors.filter((sensor) => sensor.zone === id);
    return {
      id,
      label: ZONE_LAYOUT[id].label,
      metrics: ZONE_LAYOUT[id].metrics,
      sensors: zoneSensors.map((x) => x.key),
      status: worst(zoneSensors.map((x) => x.status)),
      position: ZONE_LAYOUT[id].position,
    };
  });

  const elapsed = Date.now() - s.startedAt;
  const hh = String(Math.floor(elapsed / 3600_000)).padStart(2, "0");
  const mm = String(Math.floor((elapsed % 3600_000) / 60_000)).padStart(2, "0");
  const ss = String(Math.floor((elapsed % 60_000) / 1000)).padStart(2, "0");

  const performance = Math.round(
    clamp(100 - (s.fatigue * 0.25 + s.stress * 0.2 + Math.abs(s.heartRate - 72) * 0.3), 40, 99),
  );

  return {
    soldier: {
      id: "7SE-ARMY-0245B",
      name: "Arjun Verma",
      rank: "Captain",
      unit: "21 PARA (SF)",
      mission: "Border Patrol",
      status: "ACTIVE",
      avatarUrl: "",
    },
    vitals,
    sensors,
    zones,
    equipment: [
      { id: "helmet", label: "Helmet", state: "OK" },
      { id: "vest", label: "Vest", state: "OK" },
      { id: "weapon", label: "Weapon System", state: "OK" },
      { id: "comms", label: "Communication", state: s.battery < 20 ? "WARNING" : "OK" },
      { id: "gps", label: "GPS Module", state: "OK" },
      { id: "power", label: "Power Pack", state: s.battery < 25 ? "WARNING" : "OK", battery: Math.round(s.battery) },
    ],
    alerts: s.alerts,
    location: {
      location: "Northern Sector",
      latitude: "34.4522° N",
      longitude: "77.5946° E",
      altitude: "2,850 m",
      ambientTemp: "-5 °C",
      humidity: "38 %",
      weather: "Clear",
      condition: "Cold / High Altitude",
    },
    mission: {
      name: "Border Patrol",
      duration: `${hh}:${mm}:${ss}`,
      distanceKm: Number(s.distance.toFixed(1)),
      calories: Math.round(s.calories),
      performance,
    },
    system: {
      connection: "CONNECTED",
      sensorsActive: 14,
      sensorsTotal: 14,
      battery: Math.round(s.battery),
      network: "SECURE",
      lastSync: clock(0),
    },
    trends: s.trends,
  };
}

export function createMockTelemetrySource(intervalMs = 2000): TelemetrySource {
  const state = initialState();
  let listeners: ((s: TelemetrySnapshot) => void)[] = [];
  let timer: ReturnType<typeof setInterval> | null = null;

  const tick = () => {
    state.heartRate = drift(state.heartRate, 5, 58, 118);
    state.bodyTemp = drift(state.bodyTemp, 0.14, 36.0, 38.2);
    state.spo2 = drift(state.spo2, 0.9, 92, 100);
    state.respiration = drift(state.respiration, 1.4, 11, 26);
    state.stress = drift(state.stress, 6, 5, 85);
    state.hydration = drift(state.hydration, 2.5, 45, 98);
    state.fatigue = clamp(state.fatigue + Math.random() * 0.5 - 0.15, 5, 92);
    state.motion = drift(state.motion, 18, 0, 100);
    state.battery = clamp(state.battery - 0.01, 5, 100);
    state.distance += 0.005;
    state.calories += 0.6;

    state.histories.heartRate = pushHistory(state.histories.heartRate, state.heartRate);
    state.histories.bodyTemp = pushHistory(state.histories.bodyTemp, state.bodyTemp);
    state.histories.spo2 = pushHistory(state.histories.spo2, state.spo2);
    state.histories.respiration = pushHistory(state.histories.respiration, state.respiration);
    state.histories.stress = pushHistory(state.histories.stress, state.stress);
    state.histories.hydration = pushHistory(state.histories.hydration, state.hydration);
    state.histories.fatigue = pushHistory(state.histories.fatigue, state.fatigue);
    state.histories.motion = pushHistory(state.histories.motion, state.motion);

    const label = new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
    const map: Record<string, number | undefined> = {
      heartRate: state.heartRate,
      coreTemp: state.bodyTemp,
      spo2: state.spo2,
      respiration: state.respiration,
    };
    state.trends = state.trends.map((series) => ({
      ...series,
      points: [...series.points, { t: label, v: Number((map[series.key] ?? 0).toFixed(1)) }].slice(-60),
    }));

    // Alert engine — derived from thresholds, never hard-coded in the UI.
    const candidates: { key: string; severity: Status; message: string }[] = [];
    if (state.bodyTemp > 37.8) candidates.push({ key: "temp", severity: "warn", message: "Core temperature rising" });
    if (state.heartRate > 110) candidates.push({ key: "hr", severity: "crit", message: "Heart rate critically high" });
    if (state.spo2 < 94) candidates.push({ key: "spo2", severity: "crit", message: "Blood oxygen below threshold" });
    if (state.fatigue > 75) candidates.push({ key: "fatigue", severity: "warn", message: "High fatigue detected" });
    if (state.hydration < 55) candidates.push({ key: "hyd", severity: "warn", message: "Hydration level dropping" });
    if (state.battery < 20) candidates.push({ key: "bat", severity: "warn", message: "Power pack battery low" });

    for (const c of candidates) {
      const recent = state.alerts.find((a) => a.id.startsWith(c.key));
      if (!recent || Date.now() - Number(recent.id.split("-")[1] ?? 0) > 30_000) {
        state.alerts = [
          { id: `${c.key}-${Date.now()}`, time: clock(0), severity: c.severity, message: c.message },
          ...state.alerts,
        ].slice(0, 12);
      }
    }

    const snapshot = buildSnapshot(state);
    listeners.forEach((l) => l(snapshot));
  };

  return {
    getSnapshot: () => buildSnapshot(state),
    subscribe(listener) {
      listeners.push(listener);
      if (!timer) timer = setInterval(tick, intervalMs);
      return () => {
        listeners = listeners.filter((l) => l !== listener);
        if (listeners.length === 0 && timer) {
          clearInterval(timer);
          timer = null;
        }
      };
    },
  };
}

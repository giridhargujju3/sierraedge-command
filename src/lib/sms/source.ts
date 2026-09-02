import type {
  AlertItem,
  SensorKey,
  SensorReading,
  Status,
  TelemetrySnapshot,
  TrendSeries,
} from "./types";
import { MANNEQUINS, type MannequinConfig } from "./fleet";
import {
  ESP32_CHANNELS,
  ESP32_SENSOR_TOTAL,
  channelAlertCandidates,
  channelStatus,
  deriveRigVitals,
  formatChannelDisplay,
  rigEquipment,
  rigZones,
  type ChannelValues,
} from "./esp32";

/**
 * Telemetry source contract. The dashboard only ever talks to this interface,
 * so the demo simulator below can be swapped for the live ESP32 poller
 * (see esp32Source.ts) without touching a single UI component.
 */
export interface TelemetrySource {
  getSnapshot(): TelemetrySnapshot;
  subscribe(listener: (snapshot: TelemetrySnapshot) => void): () => void;
}

/**
 * Deterministic seeded PRNG + fixed base epoch: the very first snapshot must be
 * byte-identical on the server and on the client, otherwise SSR hydration
 * mismatches. Live drift after mount uses real time and Math.random.
 */
const BASE_TIME = 1767225600000; // 2026-01-01T00:00:00Z
let seed = 0x5ee1;
const setSeed = (v: number) => (seed = v);
const rnd = () => {
  seed = (seed * 1664525 + 1013904223) % 4294967296;
  return seed / 4294967296;
};

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));
const drift = (v: number, amount: number, min: number, max: number) =>
  clamp(v + (Math.random() - 0.5) * amount, min, max);

const seedHistory = (base: number, spread: number, n = 24) =>
  Array.from(
    { length: n },
    (_, i) => base + Math.sin(i / 2.4) * spread * 0.6 + (rnd() - 0.5) * spread,
  );

const liveClock = () => new Date().toLocaleTimeString("en-GB", { hour12: false });

const clock = (offsetSeconds = 0) => {
  const d = new Date(BASE_TIME - offsetSeconds * 1000);
  return d.toLocaleTimeString("en-GB", { hour12: false });
};

const pushHistory = (list: number[], v: number) => {
  const next = [...list, v];
  return next.length > 40 ? next.slice(next.length - 40) : next;
};

const trendPoints = (base: number, spread: number, n = 40) => {
  const now = BASE_TIME;
  return Array.from({ length: n }, (_, i) => ({
    t: new Date(now - (n - i) * 60_000).toLocaleTimeString("en-GB", {
      hour: "2-digit",
      minute: "2-digit",
    }),
    v: Number((base + Math.sin(i / 3) * spread + (rnd() - 0.5) * spread).toFixed(1)),
  }));
};

/**
 * Demo simulator for the Phase-1 rig — the SAME channels, names, units, zone
 * placement and thresholds as the real ESP32 feed (the ESP32_CHANNELS registry),
 * so the dashboard looks identical in DEMO and LIVE mode.
 */
interface MutableState {
  values: ChannelValues;
  histories: Partial<Record<SensorKey, number[]>>;
  meanTempHistory: number[];
  headLatchUntil: number;
  chestLatchUntil: number;
  battery: number;
  distance: number;
  calories: number;
  startedAt: number;
  live: boolean;
  gps: { lat: number; lng: number; alt: number };
  gpsUpdatedAt: string;
  trail: [number, number][];
  alerts: AlertItem[];
  trends: TrendSeries[];
}

/** Per-mannequin bias so the M1–M5 demo profiles differ (ok / warn / crit / offline). */
function channelBases(config: MannequinConfig): ChannelValues {
  const tempBias = config.state === "crit" ? 1.5 : config.state === "warn" ? 0.9 : 0;
  const gasBias = config.state === "crit" ? 320 : config.state === "warn" ? 160 : 0;
  return {
    soundLeft: 44,
    soundRight: 41,
    gasAir: 430 + gasBias,
    impactHead: 0,
    impactChest: 0,
    tempForehead: 36.6 + tempBias * 0.8,
    tempChest: 36.8 + tempBias,
    tempLeftArm: 36.4 + tempBias * 0.6,
    tempRightArm: 36.5 + tempBias * 0.6,
  };
}

const HISTORY_SPREADS: Record<string, number> = {
  soundLeft: 5,
  soundRight: 4,
  gasAir: 45,
  impactHead: 0,
  impactChest: 0,
  tempForehead: 0.2,
  tempChest: 0.25,
  tempLeftArm: 0.3,
  tempRightArm: 0.3,
};

function initialState(config: MannequinConfig): MutableState {
  setSeed(config.seed);
  const offline = config.state === "offline";
  const bases = channelBases(config);
  const histories: Partial<Record<SensorKey, number[]>> = {};
  if (!offline) {
    for (const [key, base] of Object.entries(bases)) {
      histories[key as SensorKey] = seedHistory(base as number, HISTORY_SPREADS[key] ?? 1);
    }
  }

  const tempBias = config.state === "crit" ? 1.5 : config.state === "warn" ? 0.9 : 0;
  const gasBias = config.state === "crit" ? 320 : config.state === "warn" ? 160 : 0;

  return {
    values: offline ? {} : bases,
    histories,
    meanTempHistory: offline ? [] : seedHistory(36.7 + tempBias, 0.25),
    headLatchUntil: 0,
    chestLatchUntil: 0,
    battery: config.battery,
    distance: 18.7,
    calories: 2450,
    startedAt: BASE_TIME - 4 * 3600_000 - 35 * 60_000,
    live: false,
    gps: { lat: config.lat, lng: config.lng, alt: config.alt },
    gpsUpdatedAt: clock(0),
    trail: [[config.lat, config.lng]],
    alerts: offline
      ? []
      : [
          {
            id: "a1",
            time: clock(120),
            severity: "ok",
            message: "Rig self-check complete — 9/9 sensors responding",
          },
          {
            id: "a2",
            time: clock(320),
            severity: "ok",
            message: "MQ-135 baseline captured in clean air",
          },
          {
            id: "a3",
            time: clock(640),
            severity: "ok",
            message: "All DS18B20 probes detected on the OneWire bus",
          },
          {
            id: "a4",
            time: clock(1200),
            severity: "ok",
            message: "MAX9814 gain stages calibrated",
          },
        ],
    trends: offline
      ? []
      : [
          {
            key: "tempChest",
            label: "Chest Temp (DS18B20)",
            unit: "°C",
            color: "var(--hud)",
            points: trendPoints(36.8 + tempBias, 0.3),
          },
          {
            key: "gasAir",
            label: "Air Quality (MQ-135)",
            unit: "ppm",
            color: "var(--warn)",
            points: trendPoints(430 + gasBias, 45),
          },
          {
            key: "soundLeft",
            label: "Acoustic L (MAX9814)",
            unit: "dB",
            color: "var(--ok)",
            points: trendPoints(44, 5),
          },
          {
            key: "soundRight",
            label: "Acoustic R (MAX9814)",
            unit: "dB",
            color: "var(--hud-dim)",
            points: trendPoints(41, 4),
          },
        ],
  };
}

function buildSnapshot(s: MutableState, config: MannequinConfig): TelemetrySnapshot {
  const offline = config.state === "offline";
  const values: ChannelValues = offline ? {} : s.values;

  const sensors: SensorReading[] = ESP32_CHANNELS.map((spec) => {
    const v = values[spec.key] ?? null;
    return {
      key: spec.key,
      sensorId: spec.sensorId,
      label: spec.label,
      value: v ?? 0,
      unit: spec.unit,
      display: v == null ? "--" : formatChannelDisplay(spec, v),
      status: v == null ? "off" : channelStatus(spec, v),
      history: offline ? [] : (s.histories[spec.key] ?? []),
      zone: spec.zone,
      position: spec.position,
    };
  });

  const vitals = deriveRigVitals(values, {
    bodyTemp: offline ? [] : s.meanTempHistory,
    airQuality: offline ? [] : (s.histories.gasAir ?? []),
    acoustic: offline ? [] : (s.histories.soundLeft ?? []),
    impact: offline ? [] : (s.histories.impactChest ?? []),
  });

  const zones = rigZones(sensors);

  const statuses: Partial<Record<SensorKey, Status>> = {};
  for (const sensor of sensors) statuses[sensor.key] = sensor.status;

  const equipment = rigEquipment(statuses, {
    connected: !offline,
    batteryPct: Math.round(s.battery),
  });

  const warnCount = sensors.filter((x) => x.status === "warn").length;
  const critCount = sensors.filter((x) => x.status === "crit").length;
  const performance = offline ? 0 : Math.round(clamp(100 - warnCount * 8 - critCount * 20, 40, 99));

  const elapsed =
    (s.live ? Date.now() : BASE_TIME) -
    (s.live ? s.startedAt : BASE_TIME - 4 * 3600_000 - 35 * 60_000);
  const hh = String(Math.floor(elapsed / 3600_000)).padStart(2, "0");
  const mm = String(Math.floor((elapsed % 3600_000) / 60_000)).padStart(2, "0");
  const ss = String(Math.floor((elapsed % 60_000) / 1000)).padStart(2, "0");

  const activeChannels = sensors.filter((x) => x.status !== "off").length;

  return {
    mannequinId: config.id,
    mannequinLabel: config.label,
    gps: {
      lat: s.gps.lat,
      lng: s.gps.lng,
      alt: s.gps.alt,
      updatedAt: s.gpsUpdatedAt,
      connected: !offline,
    },
    trail: s.trail,
    soldier: {
      id: config.label,
      name: config.name,
      rank: config.rank,
      unit: config.unit,
      mission: config.mission,
      status: offline ? "OFFLINE" : "ACTIVE",
      avatarUrl: "",
    },
    vitals,
    sensors,
    zones,
    equipment,
    alerts: s.alerts,
    location: {
      location: config.sector,
      latitude: `${s.gps.lat.toFixed(4)}° N`,
      longitude: `${s.gps.lng.toFixed(4)}° E`,
      altitude: `${Math.round(s.gps.alt).toLocaleString("en-US")} m`,
      ambientTemp: "-5 °C",
      humidity: "38 %",
      weather: "Clear",
      condition: "Cold / High Altitude",
    },
    mission: {
      name: config.mission,
      duration: `${hh}:${mm}:${ss}`,
      distanceKm: Number(s.distance.toFixed(1)),
      calories: Math.round(s.calories),
      performance,
    },
    system: {
      connection: offline ? "OFFLINE" : config.state === "crit" ? "WARNING" : "CONNECTED",
      sensorsActive: offline ? 0 : activeChannels,
      sensorsTotal: ESP32_SENSOR_TOTAL,
      battery: Math.round(s.battery),
      network: offline ? "LOST" : config.state === "crit" ? "DEGRADED" : "SECURE",
      lastSync: offline ? s.gpsUpdatedAt : s.live ? liveClock() : clock(0),
    },
    trends: s.trends,
  };
}

export function createMockTelemetrySource(
  config: MannequinConfig = MANNEQUINS[0]!,
  intervalMs = 2000,
): TelemetrySource {
  const state = initialState(config);
  const offline = config.state === "offline";
  let listeners: ((s: TelemetrySnapshot) => void)[] = [];
  let timer: ReturnType<typeof setInterval> | null = null;

  const tick = () => {
    state.live = true;
    if (offline) {
      listeners.forEach((l) => l(buildSnapshot(state, config)));
      return;
    }

    // GPS drift — small steps so markers animate instead of teleporting.
    state.gps.lat += (Math.random() - 0.5) * 0.00035;
    state.gps.lng += (Math.random() - 0.5) * 0.00035;
    state.gps.alt = clamp(
      state.gps.alt + (Math.random() - 0.5) * 3,
      config.alt - 60,
      config.alt + 60,
    );
    state.gpsUpdatedAt = liveClock();
    state.trail = [...state.trail, [state.gps.lat, state.gps.lng] as [number, number]].slice(-25);

    // Phase-1 rig channels — the same registry the live ESP32 source parses.
    const v = state.values;
    v.soundLeft = drift(v.soundLeft ?? 44, 6, 30, 105);
    v.soundRight = drift(v.soundRight ?? 41, 6, 30, 105);
    v.gasAir = drift(v.gasAir ?? 430, 40, 350, 1150);
    v.tempForehead = drift(v.tempForehead ?? 36.6, 0.15, 35.2, 39.0);
    v.tempChest = drift(v.tempChest ?? 36.8, 0.15, 35.2, 39.0);
    v.tempLeftArm = drift(v.tempLeftArm ?? 36.4, 0.2, 35.2, 39.0);
    v.tempRightArm = drift(v.tempRightArm ?? 36.5, 0.2, 35.2, 39.0);
    if (Math.random() < 0.03) state.headLatchUntil = Date.now() + 4000;
    if (Math.random() < 0.03) state.chestLatchUntil = Date.now() + 4000;
    v.impactHead = Date.now() < state.headLatchUntil ? 1 : 0;
    v.impactChest = Date.now() < state.chestLatchUntil ? 1 : 0;

    state.histories.soundLeft = pushHistory(state.histories.soundLeft ?? [], v.soundLeft!);
    state.histories.soundRight = pushHistory(state.histories.soundRight ?? [], v.soundRight!);
    state.histories.gasAir = pushHistory(state.histories.gasAir ?? [], v.gasAir!);
    state.histories.tempForehead = pushHistory(state.histories.tempForehead ?? [], v.tempForehead!);
    state.histories.tempChest = pushHistory(state.histories.tempChest ?? [], v.tempChest!);
    state.histories.tempLeftArm = pushHistory(state.histories.tempLeftArm ?? [], v.tempLeftArm!);
    state.histories.tempRightArm = pushHistory(state.histories.tempRightArm ?? [], v.tempRightArm!);
    state.histories.impactHead = pushHistory(state.histories.impactHead ?? [], v.impactHead!);
    state.histories.impactChest = pushHistory(state.histories.impactChest ?? [], v.impactChest!);

    const temps = [v.tempForehead, v.tempChest, v.tempLeftArm, v.tempRightArm].filter(
      (n): n is number => n != null,
    );
    if (temps.length) {
      state.meanTempHistory = pushHistory(
        state.meanTempHistory,
        temps.reduce((a, b) => a + b, 0) / temps.length,
      );
    }

    const label = new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
    const trendMap: Record<string, number> = {
      tempChest: v.tempChest ?? 0,
      gasAir: v.gasAir ?? 0,
      soundLeft: v.soundLeft ?? 0,
      soundRight: v.soundRight ?? 0,
    };
    state.trends = state.trends.map((series) => ({
      ...series,
      points: [
        ...series.points,
        { t: label, v: Number((trendMap[series.key] ?? 0).toFixed(1)) },
      ].slice(-60),
    }));

    // Alert engine — shared threshold logic with the live ESP32 source.
    for (const c of channelAlertCandidates(v)) {
      const recent = state.alerts.find((a) => a.id.startsWith(`${c.key}-`));
      if (!recent || Date.now() - Number(recent.id.split("-")[1] ?? 0) > 30_000) {
        state.alerts = [
          {
            id: `${c.key}-${Date.now()}`,
            time: liveClock(),
            severity: c.severity,
            message: c.message,
          },
          ...state.alerts,
        ].slice(0, 12);
      }
    }

    state.battery = clamp(state.battery - 0.01, 5, 100);
    state.distance += 0.005;
    state.calories += 0.6;

    listeners.forEach((l) => l(buildSnapshot(state, config)));
  };

  return {
    getSnapshot: () => buildSnapshot(state, config),
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

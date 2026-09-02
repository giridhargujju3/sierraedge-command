import type {
  AlertItem,
  GpsFix,
  LocationInfo,
  MissionInfo,
  SensorKey,
  SensorReading,
  Status,
  SystemInfo,
  TelemetrySnapshot,
  TrendSeries,
} from "./types";
import type { MannequinConfig } from "./fleet";
import {
  ESP32_CHANNELS,
  ESP32_SENSOR_TOTAL,
  channelAlertCandidates,
  channelStatus,
  deriveRigVitals,
  esp32DataEndpoint,
  extractChannelValues,
  formatChannelDisplay,
  rigEquipment,
  rigZones,
  type ChannelValues,
  type Esp32Packet,
} from "./esp32";
import type { TelemetrySource } from "./source";

/** Connection health surfaced to the settings page and live panels. */
export interface Esp32Diagnostics {
  endpoint: string;
  deviceId: string | null;
  connected: boolean;
  everConnected: boolean;
  awaitingFirstPacket: boolean;
  rxPackets: number;
  failedPolls: number;
  lastError: string | null;
  lastPacketAt: number | null;
  lastSeqNo: number | null;
  rssi: number | null;
  uptimeS: number | null;
  batteryPct: number | null;
  avgLatencyMs: number | null;
  stale: boolean;
}

export interface Esp32TelemetrySource extends TelemetrySource {
  getDiagnostics(): Esp32Diagnostics;
  destroy(): void;
}

interface Point {
  t: string;
  v: number;
}

const MAX_TREND_POINTS = 60;
const MAX_ALERTS = 12;
const FETCH_TIMEOUT_MS = 3500;
const ALERT_DEDUPE_MS = 30_000;
const LATENCY_WINDOW = 10;

const clockNow = () => new Date().toLocaleTimeString("en-GB", { hour12: false });
const clockOf = (ts: number) => new Date(ts).toLocaleTimeString("en-GB", { hour12: false });

const formatUptime = (s: number) => {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return `${String(h).padStart(2, "0")}H ${String(m).padStart(2, "0")}M`;
};

/**
 * Live TelemetrySource backed by the ESP32 rig's HTTP endpoint
 * (`GET http://<ip>/data`, polled on an interval — the kineta-watch process).
 */
export function createEsp32TelemetrySource(opts: {
  ip: string;
  config: MannequinConfig;
  pollMs?: number;
}): Esp32TelemetrySource {
  const endpoint = esp32DataEndpoint(opts.ip);
  const pollMs = Math.min(60_000, Math.max(1_000, Math.round(opts.pollMs ?? 2_000)));
  const staleAfterMs = Math.max(3 * pollMs, 10_000);
  const startedAt = Date.now();

  let listeners: ((s: TelemetrySnapshot) => void)[] = [];
  let timer: ReturnType<typeof setInterval> | null = null;
  let inFlight = false;
  let destroyed = false;

  const points = new Map<string, Point[]>();
  let lastValues: ChannelValues = {};
  const meta = {
    deviceId: null as string | null,
    seqNo: null as number | null,
    rssi: null as number | null,
    uptimeS: null as number | null,
    batteryPct: null as number | null,
  };
  let lastPacketAt: number | null = null;
  let lastSeqSeen: number | null = null;
  let connected = false;
  let everConnected = false;
  let awaiting = true;
  let rxPackets = 0;
  let failedPolls = 0;
  let lastError: string | null = null;
  const latencies: number[] = [];
  let alerts: AlertItem[] = [];
  let staleFlagged = false;

  const pushPoint = (key: string, v: number) => {
    const list = points.get(key) ?? [];
    list.push({ t: clockNow(), v });
    if (list.length > MAX_TREND_POINTS) list.splice(0, list.length - MAX_TREND_POINTS);
    points.set(key, list);
  };

  const pushAlert = (key: string, severity: Status, message: string) => {
    const now = Date.now();
    const recent = alerts.find((a) => a.id.startsWith(`${key}-`));
    if (recent && now - Number(recent.id.split("-")[1] ?? 0) < ALERT_DEDUPE_MS) return;
    alerts = [{ id: `${key}-${now}`, time: clockNow(), severity, message }, ...alerts].slice(
      0,
      MAX_ALERTS,
    );
  };

  const evaluateAlerts = (values: ChannelValues) => {
    for (const c of channelAlertCandidates(values)) {
      pushAlert(c.key, c.severity, c.message);
    }
  };

  const record = (values: ChannelValues) => {
    for (const spec of ESP32_CHANNELS) {
      const v = values[spec.key];
      if (v != null) pushPoint(spec.key, v);
    }
    // Synthetic body-temp channel = mean of every DS18B20 reporting this packet.
    const temps = ESP32_CHANNELS.filter((c) => c.unit === "°C")
      .map((c) => values[c.key])
      .filter((n): n is number => n != null);
    if (temps.length) pushPoint("meanTemp", temps.reduce((a, b) => a + b, 0) / temps.length);
    lastValues = values;
  };

  const isStale = () =>
    everConnected && lastPacketAt != null && Date.now() - lastPacketAt > staleAfterMs;

  const emit = () => {
    const snap = buildSnapshot();
    for (const l of listeners) l(snap);
  };

  const poll = async () => {
    if (inFlight || destroyed) return;
    inFlight = true;
    const started = Date.now();
    try {
      const res = await fetch(endpoint, {
        cache: "no-store",
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = (await res.json()) as Esp32Packet | null;
      if (destroyed) return;
      latencies.push(Date.now() - started);
      if (latencies.length > LATENCY_WINDOW) latencies.shift();
      connected = true;
      everConnected = true;
      lastError = null;

      // Firmware can answer "no data yet" while sensors warm up — stay in loading state.
      if (
        json &&
        typeof json === "object" &&
        (json as { status?: unknown }).status === "no_data_yet"
      ) {
        awaiting = true;
        emit();
        return;
      }

      const packet: Esp32Packet = json ?? {};
      if (typeof packet.device_id === "string") meta.deviceId = packet.device_id;
      if (typeof packet.rssi === "number") meta.rssi = packet.rssi;
      if (typeof packet.uptime_s === "number") meta.uptimeS = packet.uptime_s;
      if (typeof packet.battery_pct === "number") meta.batteryPct = packet.battery_pct;

      const values = extractChannelValues(packet);
      const seq = typeof packet.seq_no === "number" ? packet.seq_no : null;
      if (seq != null) meta.seqNo = seq;

      if (Object.keys(values).length > 0) {
        const wasAwaiting = awaiting;
        awaiting = false;
        const seqChanged = seq == null || seq !== lastSeqSeen;
        if (seq != null) lastSeqSeen = seq;
        lastPacketAt = Date.now();
        rxPackets += 1;
        staleFlagged = false;
        record(values);
        if (wasAwaiting)
          pushAlert("link", "ok", `ESP32 link established — ${meta.deviceId ?? endpoint}`);
        if (seqChanged) evaluateAlerts(values);
      }
      emit();
    } catch (err) {
      if (destroyed) return;
      failedPolls += 1;
      connected = false;
      lastError = err instanceof Error ? err.message : String(err);
      pushAlert("link", "crit", `ESP32 unreachable — ${lastError}`);
      emit();
    } finally {
      inFlight = false;
    }
  };

  const buildSnapshot = (): TelemetrySnapshot => {
    const config = opts.config;
    const stale = isStale();
    const live = connected && !awaiting && !stale;
    const meanSeries = points.get("meanTemp");
    const meanTemp = meanSeries?.length ? meanSeries[meanSeries.length - 1]!.v : null;

    let activeChannels = 0;
    for (const spec of ESP32_CHANNELS) if (lastValues[spec.key] != null) activeChannels += 1;

    const sensors: SensorReading[] = ESP32_CHANNELS.map((spec) => {
      const v = lastValues[spec.key] ?? null;
      return {
        key: spec.key,
        sensorId: spec.sensorId,
        label: spec.label,
        value: v ?? 0,
        unit: spec.unit,
        display: v == null ? "--" : formatChannelDisplay(spec, v),
        status: v == null ? "off" : channelStatus(spec, v),
        history: (points.get(spec.key) ?? []).map((p) => p.v),
        zone: spec.zone,
        position: spec.position,
      };
    });

    const vitals = deriveRigVitals(lastValues, {
      bodyTemp: (meanSeries ?? []).map((p) => p.v),
      airQuality: (points.get("gasAir") ?? []).map((p) => p.v),
      acoustic: (points.get("soundLeft") ?? []).map((p) => p.v),
      impact: (points.get("impactHead") ?? []).map((p) => p.v),
    });

    const zones = rigZones(sensors);

    const statuses: Partial<Record<SensorKey, Status>> = {};
    for (const sensor of sensors) statuses[sensor.key] = sensor.status;

    const equipment = rigEquipment(statuses, {
      connected: live,
      degraded: everConnected,
      batteryPct: Math.round(meta.batteryPct ?? 0),
    });

    const gps: GpsFix = {
      lat: config.lat,
      lng: config.lng,
      alt: config.alt,
      updatedAt: clockNow(),
      connected: live,
    };

    const location: LocationInfo = {
      location: `${config.sector} — Mannequin Bay`,
      latitude: config.lat.toFixed(4),
      longitude: config.lng.toFixed(4),
      altitude: `${config.alt} m`,
      ambientTemp: meanTemp != null ? `${meanTemp.toFixed(1)} °C` : "--",
      humidity: "--",
      weather: "RIG FEED",
      condition: live ? "STREAMING" : awaiting ? "AWAITING DATA" : "LINK DOWN",
    };

    const mission: MissionInfo = {
      name: "ESP32 Live Sensor Feed",
      duration: formatUptime(Math.floor((Date.now() - startedAt) / 1000)),
      distanceKm: 0,
      calories: 0,
      performance: live ? 100 : 0,
    };

    const system: SystemInfo = {
      connection: live ? "CONNECTED" : everConnected ? "WARNING" : "OFFLINE",
      sensorsActive: live ? activeChannels : 0,
      sensorsTotal: ESP32_SENSOR_TOTAL,
      battery: Math.round(meta.batteryPct ?? 0),
      network: live ? ((meta.rssi ?? -100) > -75 ? "SECURE" : "DEGRADED") : "LOST",
      lastSync: lastPacketAt != null ? clockOf(lastPacketAt) : clockNow(),
    };

    const trendSpecs = [
      { key: "tempChest", label: "Chest Temp (DS18B20)", unit: "°C", color: "var(--hud)" },
      { key: "gasAir", label: "Air Quality (MQ-135)", unit: "ppm", color: "var(--warn)" },
      { key: "soundLeft", label: "Acoustic L (MAX9814)", unit: "dB", color: "var(--ok)" },
      { key: "soundRight", label: "Acoustic R (MAX9814)", unit: "dB", color: "var(--hud-dim)" },
    ] as const;

    const trends: TrendSeries[] = trendSpecs.map((t) => ({
      key: t.key,
      label: t.label,
      unit: t.unit,
      color: t.color,
      points: (points.get(t.key) ?? []).slice(-MAX_TREND_POINTS),
    }));

    return {
      mannequinId: config.id,
      mannequinLabel: config.label,
      gps,
      trail: [[config.lat, config.lng]],
      soldier: {
        id: config.id,
        name: config.name,
        rank: config.rank,
        unit: config.unit,
        mission: config.mission,
        status: live ? "LIVE FEED" : awaiting ? "STANDBY" : "LINK DOWN",
        avatarUrl: "",
      },
      vitals,
      sensors,
      zones,
      equipment,
      alerts,
      location,
      mission,
      system,
      trends,
    };
  };

  const source: Esp32TelemetrySource = {
    getSnapshot: buildSnapshot,
    subscribe(listener) {
      listeners.push(listener);
      if (!timer && !destroyed) {
        timer = setInterval(() => void poll(), pollMs);
        void poll();
      }
      return () => {
        listeners = listeners.filter((l) => l !== listener);
        if (listeners.length === 0 && timer) {
          clearInterval(timer);
          timer = null;
        }
      };
    },
    getDiagnostics: (): Esp32Diagnostics => ({
      endpoint,
      deviceId: meta.deviceId,
      connected,
      everConnected,
      awaitingFirstPacket: awaiting,
      rxPackets,
      failedPolls,
      lastError,
      lastPacketAt,
      lastSeqNo: meta.seqNo,
      rssi: meta.rssi,
      uptimeS: meta.uptimeS,
      batteryPct: meta.batteryPct,
      avgLatencyMs: latencies.length
        ? Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length)
        : null,
      stale: isStale(),
    }),
    destroy() {
      destroyed = true;
      if (timer) {
        clearInterval(timer);
        timer = null;
      }
      listeners = [];
    },
  };

  return source;
}

import type {
  BodyZone,
  BodyZoneId,
  Equipment,
  SensorKey,
  SensorReading,
  Status,
  Vital,
} from "./types";

/**
 * ESP32 live-link protocol — mirrors the firmware in `firmware/sierraedge_mannequin.ino`.
 *
 * The rig hosts a tiny HTTP server; the dashboard polls `GET http://<device-ip>/data`
 * (same process proven in the kineta-watch ESP32 implementation). Every sensor on the
 * Phase-1 mannequin maps to one channel below.
 */
export interface Esp32Packet {
  device_id?: string;
  seq_no?: number;
  uptime_s?: number;
  /** WiFi signal in dBm (negative). */
  rssi?: number;
  interval_ms?: number;
  free_heap?: number;
  /** 0–100, optional — only present when the rig wires a battery divider. */
  battery_pct?: number;

  /* --- sensor channels (Phase-1 hardware) --- */
  /** MAX9814 left ear, dB SPL estimate. */
  sound_left_db?: number;
  /** MAX9814 right ear, dB SPL estimate. */
  sound_right_db?: number;
  /** MQ-135 nose sensor, ppm estimate. */
  gas_ppm?: number;
  /** SW-420 forehead — 1 while impact latched, else 0. */
  impact_forehead?: number;
  /** SW-420 chest — 1 while impact latched, else 0. */
  impact_chest?: number;
  /** DS18B20 °C readings. */
  temp_forehead_c?: number;
  temp_chest_c?: number;
  temp_left_arm_c?: number;
  temp_right_arm_c?: number;

  [key: string]: unknown;
}

export interface ChannelThresholds {
  warn: [number, number];
  crit: [number, number];
}

export interface ChannelSpec {
  /** Dashboard sensor key (drives icons, zones, 3D placement). */
  key: SensorKey;
  /** JSON field inside the `/data` packet. */
  field: string;
  /** Rig channel id shown in the UI, e.g. "S1". */
  sensorId: string;
  label: string;
  unit: string;
  /** "impact" channels are boolean latches, "analog" are continuous values. */
  kind: "analog" | "impact";
  decimals: number;
  zone: BodyZoneId;
  /** 3D anchor on the mannequin, metres, model space. */
  position: [number, number, number];
  /** warn/crit window; undefined ⇒ always ok (impact channels use kind instead). */
  thresholds?: ChannelThresholds;
}

/** The 9 physical sensors of the Phase-1 rig (2 mic + 1 gas + 2 impact + 4 temp). */
export const ESP32_CHANNELS: ChannelSpec[] = [
  {
    key: "soundLeft",
    field: "sound_left_db",
    sensorId: "S1",
    label: "MAX9814 Acoustic — Left Ear",
    unit: " dB",
    kind: "analog",
    decimals: 0,
    zone: "head",
    position: [-0.13, 1.62, 0.02],
    thresholds: { warn: [0, 80], crit: [0, 100] },
  },
  {
    key: "soundRight",
    field: "sound_right_db",
    sensorId: "S2",
    label: "MAX9814 Acoustic — Right Ear",
    unit: " dB",
    kind: "analog",
    decimals: 0,
    zone: "head",
    position: [0.13, 1.62, 0.02],
    thresholds: { warn: [0, 80], crit: [0, 100] },
  },
  {
    key: "gasAir",
    field: "gas_ppm",
    sensorId: "S3",
    label: "MQ-135 Gas — Nose Area",
    unit: " ppm",
    kind: "analog",
    decimals: 0,
    zone: "head",
    position: [0, 1.66, 0.13],
    thresholds: { warn: [0, 500], crit: [0, 1000] },
  },
  {
    key: "impactHead",
    field: "impact_forehead",
    sensorId: "S4",
    label: "SW-420 Impact — Forehead",
    unit: "",
    kind: "impact",
    decimals: 0,
    zone: "head",
    position: [0, 1.71, 0.05],
  },
  {
    key: "impactChest",
    field: "impact_chest",
    sensorId: "S5",
    label: "SW-420 Impact — Chest",
    unit: "",
    kind: "impact",
    decimals: 0,
    zone: "upperBody",
    position: [0, 1.36, 0.16],
  },
  {
    key: "tempForehead",
    field: "temp_forehead_c",
    sensorId: "S6",
    label: "DS18B20 Temp — Forehead",
    unit: "°C",
    kind: "analog",
    decimals: 1,
    zone: "head",
    position: [0, 1.7, 0.1],
    thresholds: { warn: [36.1, 37.5], crit: [35.0, 38.5] },
  },
  {
    key: "tempChest",
    field: "temp_chest_c",
    sensorId: "S7",
    label: "DS18B20 Temp — Chest",
    unit: "°C",
    kind: "analog",
    decimals: 1,
    zone: "upperBody",
    position: [0.04, 1.29, 0.17],
    thresholds: { warn: [36.1, 37.5], crit: [35.0, 38.5] },
  },
  {
    key: "tempLeftArm",
    field: "temp_left_arm_c",
    sensorId: "S8",
    label: "DS18B20 Temp — Left Arm",
    unit: "°C",
    kind: "analog",
    decimals: 1,
    zone: "arms",
    position: [-0.45, 1.03, 0.06],
    thresholds: { warn: [36.1, 37.5], crit: [35.0, 38.5] },
  },
  {
    key: "tempRightArm",
    field: "temp_right_arm_c",
    sensorId: "S9",
    label: "DS18B20 Temp — Right Arm",
    unit: "°C",
    kind: "analog",
    decimals: 1,
    zone: "arms",
    position: [0.45, 1.03, 0.06],
    thresholds: { warn: [36.1, 37.5], crit: [35.0, 38.5] },
  },
];

export const ESP32_SENSOR_TOTAL = ESP32_CHANNELS.length;

/** Zone layout for the rig — used to build snapshot zones in live mode. */
export const ESP32_ZONES: {
  id: BodyZoneId;
  label: string;
  metrics: string[];
  sensors: SensorKey[];
  position: [number, number, number];
}[] = [
  {
    id: "head",
    label: "HEAD",
    metrics: ["Acoustic (MAX9814)", "Gas (MQ-135)", "Impact (SW-420)", "Temp (DS18B20)"],
    sensors: ["soundLeft", "soundRight", "gasAir", "impactHead", "tempForehead"],
    position: [0, 1.63, 0.11],
  },
  {
    id: "upperBody",
    label: "UPPER BODY",
    metrics: ["Impact (SW-420)", "Temp (DS18B20)"],
    sensors: ["impactChest", "tempChest"],
    position: [0, 1.36, 0.15],
  },
  {
    id: "arms",
    label: "ARMS",
    metrics: ["Temp (DS18B20) — L/R"],
    sensors: ["tempLeftArm", "tempRightArm"],
    position: [-0.46, 1.02, 0.05],
  },
];

/** Example payload shown in the settings panel — must match the firmware output. */
export const ESP32_DATA_CONTRACT_EXAMPLE = `GET http://<esp32-ip>/data
{
  "device_id": "SE-M1",
  "seq_no": 132,
  "uptime_s": 845,
  "rssi": -58,
  "battery_pct": 87,
  "sound_left_db": 42.5,
  "sound_right_db": 41.0,
  "gas_ppm": 420,
  "impact_forehead": 0,
  "impact_chest": 0,
  "temp_forehead_c": 36.6,
  "temp_chest_c": 36.8,
  "temp_left_arm_c": 36.4,
  "temp_right_arm_c": 36.5
}`;

/** Normalizes operator input ("192.168.4.1", "http://…", trailing "/data") to a base URL. */
export function normalizeEsp32Host(input: string): string {
  let v = input.trim();
  if (!v) return "";
  if (!/^https?:\/\//i.test(v)) v = `http://${v}`;
  v = v.replace(/\/+$/, "");
  return v.replace(/\/data$/i, "");
}

export function esp32DataEndpoint(input: string): string {
  return `${normalizeEsp32Host(input)}/data`;
}

export function isValidEsp32Host(input: string): boolean {
  const base = normalizeEsp32Host(input);
  if (!base) return false;
  try {
    const url = new URL(base);
    return (url.protocol === "http:" || url.protocol === "https:") && url.hostname.length > 0;
  } catch {
    return false;
  }
}

export type ChannelValues = Partial<Record<SensorKey, number>>;

/** Picks the finite numeric channel values out of a raw packet. */
export function extractChannelValues(packet: Esp32Packet): ChannelValues {
  const out: ChannelValues = {};
  const record = packet as Record<string, unknown>;
  for (const spec of ESP32_CHANNELS) {
    const raw = record[spec.field];
    if (typeof raw === "number" && Number.isFinite(raw)) out[spec.key] = raw;
  }
  return out;
}

export function rangeStatus(v: number, warn: [number, number], crit: [number, number]): Status {
  if (v < crit[0] || v > crit[1]) return "crit";
  if (v < warn[0] || v > warn[1]) return "warn";
  return "ok";
}

export function channelStatus(spec: ChannelSpec, v: number): Status {
  if (spec.kind === "impact") return v >= 1 ? "warn" : "ok";
  if (!spec.thresholds) return "ok";
  return rangeStatus(v, spec.thresholds.warn, spec.thresholds.crit);
}

/** UI display string, e.g. "36.8°C", "87 dB", "DETECTED". */
export function formatChannelDisplay(spec: ChannelSpec, v: number): string {
  if (spec.kind === "impact") return v >= 1 ? "DETECTED" : "CLEAR";
  return `${v.toFixed(spec.decimals)}${spec.unit}`;
}

/** Severity rank — "off" is ignored by worstStatus. */
const severityRank = (s: Status) => (s === "crit" ? 3 : s === "warn" ? 2 : s === "ok" ? 1 : 0);

/** Worst non-off status of a list, or undefined when everything is off/missing. */
export function worstStatus(list: (Status | undefined)[]): Status | undefined {
  let worst: Status | undefined;
  for (const s of list) {
    if (!s || s === "off") continue;
    if (!worst || severityRank(s) > severityRank(worst)) worst = s;
  }
  return worst;
}

/** Zone layout resolved against sensor statuses — shared by demo + ESP32 sources. */
export function rigZones(sensors: SensorReading[]): BodyZone[] {
  return ESP32_ZONES.map((z) => {
    const status = worstStatus(z.sensors.map((k) => sensors.find((s) => s.key === k)?.status));
    return {
      id: z.id,
      label: z.label,
      metrics: z.metrics,
      sensors: [...z.sensors],
      status: status ?? "off",
      position: [...z.position] as [number, number, number],
    };
  });
}

export interface AlertCandidate {
  key: string;
  severity: Status;
  message: string;
}

/** Threshold breaches in a packet — the single alert engine for demo + live sources. */
export function channelAlertCandidates(values: ChannelValues): AlertCandidate[] {
  const out: AlertCandidate[] = [];
  for (const spec of ESP32_CHANNELS) {
    const v = values[spec.key];
    if (v == null) continue;
    const severity = channelStatus(spec, v);
    if (severity === "ok") continue;
    if (spec.kind === "impact") {
      out.push({ key: spec.key, severity: "crit", message: `${spec.label}: DETECTED` });
    } else {
      out.push({
        key: spec.key,
        severity,
        message: `${spec.label}: ${formatChannelDisplay(spec, v)}`,
      });
    }
  }
  return out;
}

/** The four vitals derived from real rig channels — no phantom HR/SpO2 hardware. */
export function deriveRigVitals(
  values: ChannelValues,
  histories: {
    bodyTemp?: number[];
    airQuality?: number[];
    acoustic?: number[];
    impact?: number[];
  } = {},
): Vital[] {
  const tempSpec = ESP32_CHANNELS.find((c) => c.key === "tempChest")!;
  const soundSpec = ESP32_CHANNELS.find((c) => c.key === "soundLeft")!;
  const gasSpec = ESP32_CHANNELS.find((c) => c.key === "gasAir")!;

  const temps = ["tempForehead", "tempChest", "tempLeftArm", "tempRightArm"]
    .map((k) => values[k as SensorKey])
    .filter((n): n is number => n != null);
  const meanTemp = temps.length ? temps.reduce((a, b) => a + b, 0) / temps.length : null;

  const sounds = [values.soundLeft, values.soundRight].filter((n): n is number => n != null);
  const acoustic = sounds.length ? Math.max(...sounds) : null;

  const impacts = [values.impactHead, values.impactChest].filter((n): n is number => n != null);
  const impact = impacts.length ? (impacts.some((n) => n >= 1) ? 1 : 0) : null;

  const gas = values.gasAir ?? null;

  return [
    {
      key: "bodyTemp",
      label: "Body Temp (DS18B20 ×4)",
      value: meanTemp == null ? 0 : Number(meanTemp.toFixed(1)),
      unit: "°C",
      status: meanTemp == null ? "off" : channelStatus(tempSpec, meanTemp),
      history: histories.bodyTemp ?? [],
    },
    {
      key: "airQuality",
      label: "Air Quality (MQ-135)",
      value: gas == null ? 0 : Math.round(gas),
      unit: "ppm",
      status: gas == null ? "off" : channelStatus(gasSpec, gas),
      history: histories.airQuality ?? [],
    },
    {
      key: "acoustic",
      label: "Acoustic (MAX9814)",
      value: acoustic == null ? 0 : Math.round(acoustic),
      unit: "dB",
      status: acoustic == null ? "off" : channelStatus(soundSpec, acoustic),
      history: histories.acoustic ?? [],
    },
    {
      key: "impact",
      label: "Impact (SW-420 ×2)",
      value: impact ?? 0,
      unit: "",
      status: impact == null ? "off" : impact >= 1 ? "warn" : "ok",
      history: histories.impact ?? [],
    },
  ];
}

/**
 * Equipment list mirroring the Phase-1 requirement sheet: one row per monitoring
 * group (Acoustic / Gas / Impact / Body Temp) plus the controller and links.
 */
export function rigEquipment(
  statuses: Partial<Record<SensorKey, Status>>,
  opts: { connected?: boolean; degraded?: boolean; batteryPct?: number } = {},
): Equipment[] {
  const { connected = true, degraded = false, batteryPct } = opts;
  const linkState: "OK" | "WARNING" | "FAILED" = connected ? "OK" : degraded ? "WARNING" : "FAILED";
  const hasBattery = typeof batteryPct === "number" && batteryPct > 0;

  const groupState = (keys: SensorKey[]): "OK" | "WARNING" | "FAILED" => {
    const worst = worstStatus(keys.map((k) => statuses[k]));
    if (!worst) return connected ? "WARNING" : "FAILED";
    return worst === "crit" ? "FAILED" : worst === "warn" ? "WARNING" : "OK";
  };

  return [
    {
      id: "acoustic",
      label: "Acoustic — MAX9814 ×2",
      state: groupState(["soundLeft", "soundRight"]),
    },
    { id: "gas", label: "Gas Exposure — MQ-135", state: groupState(["gasAir"]) },
    { id: "impact", label: "Impact — SW-420 ×2", state: groupState(["impactHead", "impactChest"]) },
    {
      id: "temp",
      label: "Body Temp — DS18B20 ×4",
      state: groupState(["tempForehead", "tempChest", "tempLeftArm", "tempRightArm"]),
    },
    {
      id: "esp32",
      label: "ESP32 DevKit V1",
      state: linkState,
      ...(hasBattery ? { battery: batteryPct } : {}),
    },
    { id: "wifi", label: "WiFi Link", state: linkState },
    {
      id: "power",
      label: "Power Pack",
      state: !connected ? "FAILED" : hasBattery && batteryPct < 25 ? "WARNING" : "OK",
      ...(hasBattery ? { battery: batteryPct } : {}),
    },
  ];
}

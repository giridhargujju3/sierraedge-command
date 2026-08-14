export type Status = "ok" | "warn" | "crit";

export interface Soldier {
  id: string;
  name: string;
  rank: string;
  unit: string;
  mission: string;
  status: string;
  avatarUrl: string;
}

export interface Vital {
  key: "heartRate" | "bodyTemp" | "spo2" | "respiration";
  label: string;
  value: number;
  unit: string;
  status: Status;
  history: number[];
}

export type SensorKey =
  | "coreTemp"
  | "heartRate"
  | "respiration"
  | "spo2"
  | "stress"
  | "hydration"
  | "fatigue"
  | "motion";

export interface SensorReading {
  key: SensorKey;
  label: string;
  value: number;
  unit: string;
  display: string;
  status: Status;
  history: number[];
  zone: BodyZoneId;
}

export type BodyZoneId = "head" | "upperBody" | "arms" | "core" | "legs";

export interface BodyZone {
  id: BodyZoneId;
  label: string;
  metrics: string[];
  sensors: SensorKey[];
  status: Status;
  /** 3D anchor position in metres, model space */
  position: [number, number, number];
}

export interface Equipment {
  id: string;
  label: string;
  state: "OK" | "WARNING" | "FAILED";
  battery?: number;
}

export interface AlertItem {
  id: string;
  time: string;
  severity: Status;
  message: string;
}

export interface LocationInfo {
  location: string;
  latitude: string;
  longitude: string;
  altitude: string;
  ambientTemp: string;
  humidity: string;
  weather: string;
  condition: string;
}

export interface MissionInfo {
  name: string;
  duration: string;
  distanceKm: number;
  calories: number;
  performance: number;
}

export interface SystemInfo {
  connection: "CONNECTED" | "WARNING" | "OFFLINE";
  sensorsActive: number;
  sensorsTotal: number;
  battery: number;
  network: "SECURE" | "DEGRADED" | "LOST";
  lastSync: string;
}

export interface TrendSeries {
  key: string;
  label: string;
  unit: string;
  color: string;
  points: { t: string; v: number }[];
}

export interface TelemetrySnapshot {
  soldier: Soldier;
  vitals: Vital[];
  sensors: SensorReading[];
  zones: BodyZone[];
  equipment: Equipment[];
  alerts: AlertItem[];
  location: LocationInfo;
  mission: MissionInfo;
  system: SystemInfo;
  trends: TrendSeries[];
}

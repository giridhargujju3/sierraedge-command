/**
 * Fleet registry — the single source of truth for every mannequin in the system.
 * Adding a sixth unit is one entry here; no UI component needs to change.
 */
export interface MannequinConfig {
  id: string;
  code: string;
  label: string;
  name: string;
  rank: string;
  unit: string;
  mission: string;
  sector: string;
  /** Mock GPS origin — replaced by live LoRa/MQTT GPS later. */
  lat: number;
  lng: number;
  alt: number;
  battery: number;
  /** Health bias used by the mock generator. */
  state: "ok" | "warn" | "crit" | "offline";
  seed: number;
}

export const MANNEQUINS: MannequinConfig[] = [
  {
    id: "M1",
    code: "M1",
    label: "M1 — Mannequin 01",
    name: "Arjun Verma",
    rank: "Captain",
    unit: "21 PARA (SF)",
    mission: "Border Patrol",
    sector: "Northern Sector",
    lat: 34.4522,
    lng: 77.5946,
    alt: 2850,
    battery: 87,
    state: "ok",
    seed: 0x5ee1,
  },
  {
    id: "M2",
    code: "M2",
    label: "M2 — Mannequin 02",
    name: "Rohit Nair",
    rank: "Havildar",
    unit: "9 PARA (SF)",
    mission: "Ridge Recon",
    sector: "Ridge Line East",
    lat: 34.51,
    lng: 77.62,
    alt: 2900,
    battery: 74,
    state: "ok",
    seed: 0x1a37,
  },
  {
    id: "M3",
    code: "M3",
    label: "M3 — Mannequin 03",
    name: "Vikram Singh",
    rank: "Naib Subedar",
    unit: "4 GRENADIERS",
    mission: "Forward Observation",
    sector: "Valley Post 3",
    lat: 34.43,
    lng: 77.57,
    alt: 2750,
    battery: 83,
    state: "warn",
    seed: 0x2c91,
  },
  {
    id: "M4",
    code: "M4",
    label: "M4 — Mannequin 04",
    name: "Imran Sheikh",
    rank: "Lance Naik",
    unit: "11 GORKHA RIFLES",
    mission: "Supply Escort",
    sector: "Pass Corridor",
    lat: 34.47,
    lng: 77.66,
    alt: 3020,
    battery: 41,
    state: "crit",
    seed: 0x77af,
  },
  {
    id: "M5",
    code: "M5",
    label: "M5 — Mannequin 05",
    name: "Karan Bhatia",
    rank: "Sepoy",
    unit: "21 PARA (SF)",
    mission: "Standby / Base",
    sector: "Base Camp Alpha",
    lat: 34.395,
    lng: 77.53,
    alt: 2610,
    battery: 12,
    state: "offline",
    seed: 0x4b0d,
  },
];

export const getMannequin = (id: string) => MANNEQUINS.find((m) => m.id === id) ?? MANNEQUINS[0]!;

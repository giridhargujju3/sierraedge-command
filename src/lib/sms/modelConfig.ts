import standingAsset from "@/assets/sierraedge-mannequin.glb.asset.json";
import walkAsset from "@/assets/sierraedge-standard-walk.glb.asset.json";
import runAsset from "@/assets/sierraedge-standard-run.glb.asset.json";
import sitAsset from "@/assets/sierraedge-standard-sit.glb.asset.json";
import type { PoseType } from "./style";
import type { SensorKey } from "./types";

export interface PoseModelConfig {
  url: string;
  clip: string | null;
  rigged: boolean;
}

export const STANDARD_POSES: Record<PoseType, PoseModelConfig> = {
  standing: { url: standingAsset.url, clip: null, rigged: false },
  walk: { url: walkAsset.url, clip: "walk", rigged: true },
  run: { url: runAsset.url, clip: "run", rigged: true },
  sit: { url: sitAsset.url, clip: "sit", rigged: true },
};

export const SENSOR_ANCHORS: Record<SensorKey, string | null> = {
  stress: "sensor_forehead",
  coreTemp: "sensor_forehead",
  heartRate: "sensor_chest",
  respiration: "sensor_chest",
  spo2: "sensor_right_arm",
  hydration: "sensor_left_arm",
  fatigue: "sensor_chest",
  motion: "sensor_right_arm",
};

export const UNIFORM_MODEL_AVAILABLE = false;

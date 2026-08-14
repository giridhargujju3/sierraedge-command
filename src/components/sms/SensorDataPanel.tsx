import {
  Activity,
  Brain,
  Droplet,
  Droplets,
  Gauge,
  HeartPulse,
  PersonStanding,
  Thermometer,
  Wind,
} from "lucide-react";
import type { ComponentType } from "react";
import { HudPanel } from "./HudPanel";
import { Sparkline } from "./Sparkline";
import { useTelemetry } from "@/lib/sms/TelemetryProvider";
import { statusText } from "@/lib/sms/status";
import type { SensorKey, SensorReading } from "@/lib/sms/types";
import { cn } from "@/lib/utils";

export const SENSOR_ICONS: Record<SensorKey, ComponentType<{ className?: string }>> = {
  coreTemp: Thermometer,
  heartRate: HeartPulse,
  respiration: Wind,
  spo2: Droplets,
  stress: Brain,
  hydration: Droplet,
  fatigue: Gauge,
  motion: PersonStanding,
};

export function SensorRow({
  sensor,
  onSelect,
  active,
}: {
  sensor: SensorReading;
  onSelect?: ((key: SensorKey) => void) | undefined;
  active?: boolean | undefined;
}) {
  const Icon = SENSOR_ICONS[sensor.key] ?? Activity;
  return (
    <button
      type="button"
      onClick={() => onSelect?.(sensor.key)}
      className={cn(
        "flex w-full items-center gap-2.5 rounded-md border border-panel-edge/60 bg-secondary/35 px-2.5 py-2 text-left transition-all hover:border-primary/60 hover:bg-secondary/70",
        active && "border-primary bg-secondary/80",
      )}
    >
      <Icon className={cn("size-4 shrink-0", statusText[sensor.status])} />
      <div className="min-w-0 flex-1">
        <div className="hud-micro truncate">{sensor.label}</div>
        <div className={cn("hud-value text-base", statusText[sensor.status])}>{sensor.display}</div>
      </div>
      <Sparkline data={sensor.history} status={sensor.status} width={58} height={22} />
    </button>
  );
}

export function SensorDataPanel({
  onSelect,
  activeKey,
}: {
  onSelect?: ((key: SensorKey) => void) | undefined;
  activeKey?: SensorKey | null | undefined;
}) {
  const { sensors } = useTelemetry();
  return (
    <HudPanel title="Sensor Data" bodyClassName="p-2 space-y-1.5">
      {sensors.map((s) => (
        <SensorRow key={s.key} sensor={s} onSelect={onSelect} active={activeKey === s.key} />
      ))}
    </HudPanel>
  );
}

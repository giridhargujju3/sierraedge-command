import { Activity, Droplets, HeartPulse, Thermometer, Wind } from "lucide-react";
import type { ComponentType } from "react";
import { HudPanel } from "./HudPanel";
import { Sparkline } from "./Sparkline";
import { useTelemetry } from "@/lib/sms/TelemetryProvider";
import { statusLabel, statusText } from "@/lib/sms/status";
import type { Vital } from "@/lib/sms/types";
import { cn } from "@/lib/utils";

const ICONS: Record<Vital["key"], ComponentType<{ className?: string }>> = {
  heartRate: HeartPulse,
  bodyTemp: Thermometer,
  spo2: Droplets,
  respiration: Wind,
};

function VitalCard({ vital }: { vital: Vital }) {
  const Icon = ICONS[vital.key] ?? Activity;
  return (
    <div className="group rounded-md border border-panel-edge/70 bg-secondary/40 p-2.5 transition-colors hover:border-primary/50 hover:bg-secondary/70">
      <div className="flex items-center gap-2">
        <Icon className={cn("size-4", statusText[vital.status])} />
        <span className="hud-micro">{vital.label}</span>
      </div>
      <div className="mt-1.5 flex items-end justify-between gap-2">
        <div className="flex items-baseline gap-1">
          <span className={cn("hud-value text-2xl", statusText[vital.status])}>{vital.value}</span>
          <span className="hud-micro">{vital.unit}</span>
        </div>
        <Sparkline data={vital.history} status={vital.status} width={64} height={22} />
      </div>
      <div className={cn("hud-micro mt-1", statusText[vital.status])}>{statusLabel[vital.status]}</div>
    </div>
  );
}

export function VitalSigns() {
  const { vitals } = useTelemetry();
  return (
    <HudPanel title="Vital Signs">
      <div className="grid grid-cols-2 gap-2">
        {vitals.map((v) => (
          <VitalCard key={v.key} vital={v} />
        ))}
      </div>
    </HudPanel>
  );
}

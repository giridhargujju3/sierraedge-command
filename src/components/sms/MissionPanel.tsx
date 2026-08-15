import { ClientTime } from "./ClientTime";
import { HudPanel, KeyValue } from "./HudPanel";
import { useTelemetry } from "@/lib/sms/TelemetryProvider";

function Gauge({ value }: { value: number }) {
  const r = 26;
  const c = 2 * Math.PI * r;
  const tone = value >= 80 ? "var(--ok)" : value >= 60 ? "var(--warn)" : "var(--crit)";
  return (
    <div className="relative size-[68px] shrink-0">
      <svg viewBox="0 0 64 64" className="size-full -rotate-90">
        <circle cx="32" cy="32" r={r} fill="none" stroke="var(--secondary)" strokeWidth="5" />
        <circle
          cx="32"
          cy="32"
          r={r}
          fill="none"
          stroke={tone}
          strokeWidth="5"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c - (c * value) / 100}
          style={{ transition: "stroke-dashoffset 700ms ease" }}
        />
      </svg>
      <span className="hud-value absolute inset-0 grid place-items-center text-sm">{value}%</span>
    </div>
  );
}

export function MissionPanel() {
  const { mission } = useTelemetry();
  return (
    <HudPanel title="Mission & Performance">
      <div className="flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <KeyValue label="Mission" value={mission.name} />
          <KeyValue label="Duration" value={<ClientTime value={mission.duration} />} />
          <KeyValue label="Distance Covered" value={`${mission.distanceKm} km`} />
          <KeyValue label="Energy Burned" value={`${mission.calories} kcal`} />
          <KeyValue label="Performance Score" value={`${mission.performance}%`} tone="text-ok" />
        </div>
        <Gauge value={mission.performance} />
      </div>
    </HudPanel>
  );
}

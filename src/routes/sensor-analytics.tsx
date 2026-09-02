import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { HudPanel } from "@/components/sms/HudPanel";
import { SensorRow } from "@/components/sms/SensorDataPanel";
import { Sparkline } from "@/components/sms/Sparkline";
import { TrendsPanel } from "@/components/sms/TrendsPanel";
import { useTelemetry } from "@/lib/sms/TelemetryProvider";
import { statusLabel, statusText } from "@/lib/sms/status";
import type { SensorKey } from "@/lib/sms/types";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/sensor-analytics")({
  head: () => ({
    meta: [
      { title: "Sensor Analytics — SierraEdge Smart Mannequin System" },
      {
        name: "description",
        content:
          "Per-sensor analytics, thresholds and distribution for the smart mannequin sensor mesh.",
      },
      { property: "og:title", content: "Sensor Analytics — SierraEdge SMS" },
      {
        property: "og:description",
        content: "Per-sensor analytics and thresholds for the smart mannequin sensor mesh.",
      },
    ],
  }),
  component: SensorAnalytics,
});

function SensorAnalytics() {
  const { sensors } = useTelemetry();
  const [active, setActive] = useState<SensorKey>("tempChest");
  const sensor = sensors.find((s) => s.key === active) ?? sensors[0]!;
  const values = sensor.history;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const avg = values.reduce((a, b) => a + b, 0) / values.length;

  return (
    <div className="grid gap-3 lg:grid-cols-[20rem_minmax(0,1fr)]">
      <HudPanel title="Sensor Mesh" bodyClassName="p-2 space-y-1.5">
        {sensors.map((s) => (
          <SensorRow key={s.key} sensor={s} onSelect={setActive} active={s.key === active} />
        ))}
      </HudPanel>

      <div className="space-y-3">
        <HudPanel title={`${sensor.label} — Analysis`}>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { l: "Current", v: sensor.display },
              { l: "Average", v: `${avg.toFixed(1)} ${sensor.unit}` },
              { l: "Minimum", v: `${min.toFixed(1)} ${sensor.unit}` },
              { l: "Maximum", v: `${max.toFixed(1)} ${sensor.unit}` },
            ].map((m) => (
              <div
                key={m.l}
                className="rounded-md border border-panel-edge/70 bg-secondary/40 p-2.5"
              >
                <div className="hud-micro">{m.l}</div>
                <div className="hud-value mt-1 text-xl">{m.v}</div>
              </div>
            ))}
          </div>
          <div className="mt-3 flex items-center justify-between overflow-hidden rounded-md border border-panel-edge/70 bg-secondary/30 p-3">
            <span className="hud-micro">Live waveform</span>
            <Sparkline data={sensor.history} status={sensor.status} width={420} height={54} />
            <span className={cn("hud-label", statusText[sensor.status])}>
              {statusLabel[sensor.status]}
            </span>
          </div>
        </HudPanel>
        <TrendsPanel columns={2} height={130} />
      </div>
    </div>
  );
}

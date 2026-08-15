import { createFileRoute } from "@tanstack/react-router";
import { Download, FileText } from "lucide-react";
import { HudPanel, KeyValue } from "@/components/sms/HudPanel";
import { MissionPanel } from "@/components/sms/MissionPanel";
import { EquipmentPanel } from "@/components/sms/EquipmentPanel";
import { useTelemetry } from "@/lib/sms/TelemetryProvider";
import { statusLabel, statusText } from "@/lib/sms/status";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/reports")({
  head: () => ({
    meta: [
      { title: "Reports — SierraEdge Smart Mannequin System" },
      { name: "description", content: "Generated mission readiness and physiological summary reports for the operator session." },
      { property: "og:title", content: "Reports — SierraEdge SMS" },
      { property: "og:description", content: "Mission readiness and physiological summary reports." },
    ],
  }),
  component: ReportsPage,
});

function ReportsPage() {
  const { soldier, vitals, mission, sensors } = useTelemetry();
  const flagged = sensors.filter((s) => s.status !== "ok");

  return (
    <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_22rem]">
      <HudPanel
        title="Mission Readiness Report"
        action={
          <button
            type="button"
            className="hud-micro flex items-center gap-1 rounded border border-panel-edge px-2 py-1 transition-colors hover:text-primary"
            onClick={() => window.print()}
          >
            <Download className="size-3" /> EXPORT
          </button>
        }
      >
        <div className="mb-3 flex items-center gap-2 text-primary">
          <FileText className="size-4" />
          <span className="hud-label">
            {soldier.rank} {soldier.name} · {soldier.unit}
          </span>
        </div>
        <div className="grid gap-x-6 sm:grid-cols-2">
          <KeyValue label="Operator ID" value={soldier.id} />
          <KeyValue label="Mission" value={mission.name} />
          <KeyValue label="Duration" value={mission.duration} />
          <KeyValue label="Distance" value={`${mission.distanceKm} km`} />
          <KeyValue label="Energy" value={`${mission.calories} kcal`} />
          <KeyValue label="Performance" value={`${mission.performance}%`} tone="text-ok" />
        </div>

        <h3 className="hud-label mt-4">Physiological Summary</h3>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          {vitals.map((v) => (
            <div key={v.key} className="rounded-md border border-panel-edge/70 bg-secondary/35 p-2.5">
              <div className="hud-micro">{v.label}</div>
              <div className="flex items-baseline justify-between">
                <span className={cn("hud-value text-xl", statusText[v.status])}>
                  {v.value} {v.unit}
                </span>
                <span className={cn("hud-micro", statusText[v.status])}>{statusLabel[v.status]}</span>
              </div>
            </div>
          ))}
        </div>

        <h3 className="hud-label mt-4">Flagged Sensors</h3>
        <div className="mt-2 space-y-1">
          {flagged.length === 0 ? (
            <p className="hud-micro text-ok">No sensor outside nominal range for this session.</p>
          ) : (
            flagged.map((s) => (
              <KeyValue key={s.key} label={s.label} value={`${s.display} · ${statusLabel[s.status]}`} tone={statusText[s.status]} />
            ))
          )}
        </div>
      </HudPanel>

      <div className="space-y-3">
        <MissionPanel />
        <EquipmentPanel />
      </div>
    </div>
  );
}

import { createFileRoute } from "@tanstack/react-router";
import { HudPanel, StatusDot } from "@/components/sms/HudPanel";
import { TrendsPanel } from "@/components/sms/TrendsPanel";
import { useTelemetry } from "@/lib/sms/TelemetryProvider";
import { statusLabel, statusText } from "@/lib/sms/status";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/history")({
  head: () => ({
    meta: [
      { title: "History — SierraEdge Smart Mannequin System" },
      { name: "description", content: "Historical vitals, event log and mission timeline for the smart mannequin session." },
      { property: "og:title", content: "History — SierraEdge SMS" },
      { property: "og:description", content: "Historical vitals, event log and mission timeline." },
    ],
  }),
  component: HistoryPage,
});

function HistoryPage() {
  const { alerts, mission } = useTelemetry();
  return (
    <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_22rem]">
      <TrendsPanel columns={2} height={150} />
      <HudPanel title="Event Log" bodyClassName="p-2 space-y-1.5 max-h-[70vh] overflow-y-auto scroll-thin">
        <div className="hud-micro px-1 pb-1">
          SESSION {mission.name} · {mission.duration}
        </div>
        {alerts.map((a) => (
          <div key={a.id} className="flex items-start gap-2 rounded-md border border-panel-edge/60 px-2.5 py-1.5">
            <StatusDot tone={a.severity} className="mt-1.5" />
            <div className="min-w-0 flex-1">
              <p className="text-[0.78rem]">{a.message}</p>
              <div className="flex gap-2">
                <span className="hud-micro">{a.time}</span>
                <span className={cn("hud-micro", statusText[a.severity])}>{statusLabel[a.severity]}</span>
              </div>
            </div>
          </div>
        ))}
      </HudPanel>
    </div>
  );
}

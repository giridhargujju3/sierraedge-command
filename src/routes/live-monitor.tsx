import { createFileRoute } from "@tanstack/react-router";
import { MannequinStage } from "@/components/sms/MannequinStage";
import { VitalSigns } from "@/components/sms/VitalSigns";
import { AlertsPanel } from "@/components/sms/AlertsPanel";
import { SystemStatus } from "@/components/sms/SystemStatus";
import { TrendsPanel } from "@/components/sms/TrendsPanel";
import { Esp32LiveDataPanel } from "@/components/sms/Esp32LiveDataPanel";

export const Route = createFileRoute("/live-monitor")({
  head: () => ({
    meta: [
      { title: "Live Monitor — SierraEdge Smart Mannequin System" },
      {
        name: "description",
        content:
          "Live vital-sign monitoring and holographic body tracking for the active operator.",
      },
      { property: "og:title", content: "Live Monitor — SierraEdge SMS" },
      {
        property: "og:description",
        content: "Live vital-sign monitoring and holographic body tracking.",
      },
    ],
  }),
  component: LiveMonitor,
});

function LiveMonitor() {
  return (
    <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_21rem]">
      <div className="flex min-h-[560px] flex-col gap-3">
        <MannequinStage />
        <TrendsPanel columns={2} height={110} />
      </div>
      <div className="space-y-3">
        <Esp32LiveDataPanel />
        <VitalSigns />
        <AlertsPanel max={8} />
        <SystemStatus />
      </div>
    </div>
  );
}

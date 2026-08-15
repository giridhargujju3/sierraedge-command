import { createFileRoute } from "@tanstack/react-router";
import { SoldierOverview } from "@/components/sms/SoldierOverview";
import { VitalSigns } from "@/components/sms/VitalSigns";
import { LocationPanel } from "@/components/sms/LocationPanel";
import { SystemStatus } from "@/components/sms/SystemStatus";
import { MannequinStage } from "@/components/sms/MannequinStage";
import { SensorDataPanel } from "@/components/sms/SensorDataPanel";
import { MissionPanel } from "@/components/sms/MissionPanel";
import { AlertsPanel } from "@/components/sms/AlertsPanel";
import { EquipmentPanel } from "@/components/sms/EquipmentPanel";
import { TrendsPanel } from "@/components/sms/TrendsPanel";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "SierraEdge SMS — Smart Mannequin Command Dashboard" },
      {
        name: "description",
        content:
          "Real-time SierraEdge Smart Mannequin System dashboard: holographic 3D digital twin, vitals, sensors, alerts and mission telemetry.",
      },
      { property: "og:title", content: "SierraEdge SMS — Smart Mannequin Command Dashboard" },
      {
        property: "og:description",
        content: "Holographic 3D digital twin with live vitals, sensor zones, alerts and mission telemetry.",
      },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  return (
    <div className="grid gap-3 xl:grid-cols-[19rem_minmax(0,1fr)_20rem]">
      <div className="space-y-3">
        <SoldierOverview />
        <VitalSigns />
        <LocationPanel />
        <SystemStatus />
      </div>

      <div className="flex min-h-[520px] flex-col gap-3">
        <MannequinStage />
      </div>

      <div className="space-y-3">
        <SensorDataPanel />
        <MissionPanel />
        <AlertsPanel />
        <EquipmentPanel />
        <TrendsPanel keys={["heartRate", "coreTemp"]} />
      </div>
    </div>
  );
}

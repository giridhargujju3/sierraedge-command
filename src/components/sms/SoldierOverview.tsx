import { HudPanel, KeyValue } from "./HudPanel";
import { useTelemetry } from "@/lib/sms/TelemetryProvider";

/** Identity card — only ID + STATUS, always for the selected mannequin
 * (the snapshot is per-mannequin, so the panel follows the active unit). */
export function SoldierOverview() {
  const { soldier } = useTelemetry();
  return (
    <HudPanel title="Soldier Overview">
      <KeyValue label="ID" value={soldier.id} />
      <KeyValue label="Status" value={soldier.status} tone="text-ok" />
    </HudPanel>
  );
}

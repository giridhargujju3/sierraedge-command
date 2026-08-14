import { HudPanel, KeyValue } from "./HudPanel";
import { useTelemetry } from "@/lib/sms/TelemetryProvider";
import avatar from "@/assets/operator-avatar.jpg";

export function SoldierOverview() {
  const { soldier } = useTelemetry();
  return (
    <HudPanel title="Soldier Overview">
      <div className="flex gap-3">
        <img
          src={soldier.avatarUrl || avatar}
          alt={`Portrait of ${soldier.rank} ${soldier.name}`}
          className="size-20 shrink-0 rounded-md border border-panel-edge object-cover"
          loading="lazy"
        />
        <div className="min-w-0 flex-1">
          <KeyValue label="ID" value={soldier.id} />
          <KeyValue label="Rank" value={soldier.rank} />
          <KeyValue label="Name" value={soldier.name} />
          <KeyValue label="Unit" value={soldier.unit} />
          <KeyValue label="Mission" value={soldier.mission} />
          <KeyValue label="Status" value={soldier.status} tone="text-ok" />
        </div>
      </div>
    </HudPanel>
  );
}

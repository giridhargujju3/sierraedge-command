import { ClientTime } from "./ClientTime";
import { HudPanel, KeyValue, StatusDot } from "./HudPanel";
import { useTelemetry } from "@/lib/sms/TelemetryProvider";

export function SystemStatus() {
  const { system } = useTelemetry();
  const batteryTone = system.battery > 40 ? "ok" : system.battery > 18 ? "warn" : "crit";
  const batteryColor =
    batteryTone === "ok" ? "bg-ok" : batteryTone === "warn" ? "bg-warn" : "bg-crit";

  return (
    <HudPanel title="System Status">
      <KeyValue
        label="Smart Mannequin"
        value={
          <span className="inline-flex items-center gap-1.5 text-ok">
            <StatusDot tone="ok" />
            {system.connection}
          </span>
        }
      />
      <KeyValue label="Sensors" value={`${system.sensorsActive} / ${system.sensorsTotal} Active`} />
      <div className="py-[3px]">
        <div className="flex items-center justify-between">
          <span className="text-[0.72rem] text-muted-foreground">Battery</span>
          <span className="font-mono text-[0.76rem]">{system.battery}%</span>
        </div>
        <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-secondary">
          <div
            className={`h-full rounded-full transition-[width] duration-700 ${batteryColor}`}
            style={{ width: `${system.battery}%` }}
          />
        </div>
      </div>
      <KeyValue label="Network" value={system.network} tone="text-ok" />
      <KeyValue label="Last Sync" value={<ClientTime value={system.lastSync} />} />
    </HudPanel>
  );
}

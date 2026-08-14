import { HudPanel } from "./HudPanel";
import { useTelemetry } from "@/lib/sms/TelemetryProvider";
import { cn } from "@/lib/utils";

export function EquipmentPanel() {
  const { equipment } = useTelemetry();
  return (
    <HudPanel title="Equipment Status" bodyClassName="p-3 space-y-1.5">
      {equipment.map((e) => {
        const tone =
          e.state === "OK" ? "text-ok" : e.state === "WARNING" ? "text-warn" : "text-crit";
        const bar = e.state === "OK" ? "bg-ok" : e.state === "WARNING" ? "bg-warn" : "bg-crit";
        return (
          <div key={e.id}>
            <div className="flex items-center justify-between">
              <span className="text-[0.74rem] text-muted-foreground">{e.label}</span>
              <span className={cn("hud-micro", tone)}>● {e.state}</span>
            </div>
            {typeof e.battery === "number" ? (
              <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-secondary">
                <div
                  className={cn("h-full rounded-full transition-[width] duration-700", bar)}
                  style={{ width: `${e.battery}%` }}
                />
              </div>
            ) : null}
          </div>
        );
      })}
    </HudPanel>
  );
}

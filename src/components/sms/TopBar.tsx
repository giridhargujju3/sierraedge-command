import { Radio, ShieldCheck } from "lucide-react";
import { ClientTime } from "./ClientTime";
import { StatusDot } from "./HudPanel";
import { useEsp32Link, useTelemetry } from "@/lib/sms/TelemetryProvider";
import { cn } from "@/lib/utils";

export function TopBar() {
  const { system, alerts } = useTelemetry();
  const esp32 = useEsp32Link();
  const critical = alerts.some((a) => a.severity === "crit");
  const tone = system.connection === "OFFLINE" ? "crit" : critical ? "warn" : "ok";
  const label =
    system.connection === "OFFLINE" ? "OFFLINE" : critical ? "WARNING" : "ONLINE / CONNECTED";

  return (
    <header className="hud-panel mx-2 mt-2 flex flex-wrap items-center justify-between gap-3 px-4 py-2.5">
      <div className="flex items-baseline gap-3">
        <h1 className="font-display text-2xl font-bold tracking-[0.14em] text-primary">
          SIERRAEDGE
        </h1>
        <span className="hud-label hidden text-muted-foreground sm:inline">
          Smart Mannequin System
        </span>
      </div>
      <div className="flex flex-wrap items-center gap-4">
        <span
          className={cn(
            "hud-micro flex items-center gap-1.5",
            esp32.active
              ? esp32.diagnostics?.connected
                ? "text-ok"
                : "text-warn"
              : "text-muted-foreground",
          )}
        >
          <StatusDot tone={esp32.active ? (esp32.diagnostics?.connected ? "ok" : "warn") : "off"} />
          {esp32.active ? "LIVE · ESP32 RIG" : "DEMO TELEMETRY"}
        </span>
        <span
          className={cn(
            "hud-micro flex items-center gap-1.5",
            tone === "ok" ? "text-ok" : tone === "warn" ? "text-warn" : "text-crit",
          )}
        >
          <Radio className="size-3.5" /> {label}
        </span>
        <span className="hud-micro flex items-center gap-1.5" suppressHydrationWarning>
          <ShieldCheck className="size-3.5 text-primary" /> LAST SYNC{" "}
          <ClientTime value={system.lastSync} />
        </span>
      </div>
    </header>
  );
}

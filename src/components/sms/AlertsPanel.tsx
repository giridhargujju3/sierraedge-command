import { AlertTriangle, CheckCircle2, ShieldAlert } from "lucide-react";
import { ClientTime } from "./ClientTime";
import { HudPanel, StatusDot } from "./HudPanel";
import { useTelemetry } from "@/lib/sms/TelemetryProvider";
import { statusLabel, statusText } from "@/lib/sms/status";
import { cn } from "@/lib/utils";

const ICON = {
  ok: CheckCircle2,
  warn: AlertTriangle,
  crit: ShieldAlert,
};

export function AlertsPanel({ max = 6 }: { max?: number }) {
  const { alerts } = useTelemetry();
  const critical = alerts.filter((a) => a.severity === "crit").length;

  return (
    <HudPanel
      title="Alerts & Notifications"
      action={
        <span className={cn("hud-micro", critical ? "text-crit" : "text-ok")}>
          {critical ? `${critical} CRITICAL` : "ALL CLEAR"}
        </span>
      }
      bodyClassName="p-2 space-y-1.5 max-h-64 overflow-y-auto scroll-thin"
    >
      {alerts.slice(0, max).map((a) => {
        const Icon = ICON[a.severity];
        return (
          <div
            key={a.id}
            className={cn(
              "flex items-start gap-2 rounded-md border px-2.5 py-1.5 transition-colors",
              a.severity === "crit"
                ? "border-crit/60 bg-crit/10"
                : a.severity === "warn"
                  ? "border-warn/40 bg-warn/5"
                  : "border-panel-edge/60 bg-secondary/30",
            )}
          >
            <Icon className={cn("mt-[2px] size-3.5 shrink-0", statusText[a.severity])} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-[0.78rem] text-foreground">{a.message}</p>
              <div className="flex items-center gap-2">
                <span className="hud-micro" suppressHydrationWarning><ClientTime value={a.time} /></span>
                <span className={cn("hud-micro", statusText[a.severity])}>{statusLabel[a.severity]}</span>
              </div>
            </div>
            <StatusDot tone={a.severity} className="mt-1.5" />
          </div>
        );
      })}
    </HudPanel>
  );
}

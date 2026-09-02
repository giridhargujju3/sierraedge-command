import { HudPanel, KeyValue, StatusDot } from "./HudPanel";
import { Sparkline } from "./Sparkline";
import { useEsp32Link, useTelemetry } from "@/lib/sms/TelemetryProvider";
import { statusText } from "@/lib/sms/status";
import { cn } from "@/lib/utils";

/**
 * Live rig feed — per-channel tiles with sparklines plus link diagnostics.
 * In demo mode it renders a hint pointing at Settings → ESP32 Configuration.
 */
export function Esp32LiveDataPanel() {
  const link = useEsp32Link();
  const { sensors } = useTelemetry();
  const diag = link.diagnostics;

  if (!link.active) {
    return (
      <HudPanel title="ESP32 Live Link">
        <div className="flex items-start gap-2 text-muted-foreground">
          <StatusDot tone="off" className="mt-1" />
          <span className="hud-micro normal-case tracking-normal">
            Demo telemetry active. Connect the physical rig under Settings → ESP32 Configuration —
            enter the ESP32 IP, hit save, and every panel switches to the live mannequin feed.
          </span>
        </div>
      </HudPanel>
    );
  }

  const age = diag?.lastPacketAt
    ? `${Math.max(0, Math.round((Date.now() - diag.lastPacketAt) / 1000))}s ago`
    : diag?.awaitingFirstPacket
      ? "waiting"
      : "--";

  return (
    <HudPanel
      title="ESP32 Live Link"
      action={
        <span
          className={cn(
            "hud-micro flex items-center gap-1.5",
            diag?.connected ? "text-ok" : "text-warn",
          )}
        >
          <StatusDot tone={diag?.connected ? "ok" : "warn"} />
          {diag?.connected
            ? diag.awaitingFirstPacket
              ? "AWAITING DATA"
              : "STREAMING"
            : "RECONNECTING"}
        </span>
      }
      bodyClassName="p-2 space-y-1.5"
    >
      {sensors.map((s) => (
        <div
          key={s.key}
          className="flex items-center gap-2.5 rounded-md border border-panel-edge/60 bg-secondary/35 px-2.5 py-2"
        >
          <span className="hud-micro w-5 shrink-0 text-muted-foreground">{s.sensorId}</span>
          <div className="min-w-0 flex-1">
            <div className="hud-micro truncate">{s.label}</div>
            <div className={cn("hud-value text-base", statusText[s.status])}>{s.display}</div>
          </div>
          <Sparkline data={s.history} status={s.status} width={58} height={22} />
        </div>
      ))}
      <div className="grid grid-cols-2 gap-x-4 border-t border-panel-edge/50 pt-2">
        <KeyValue label="Packets RX" value={diag?.rxPackets ?? 0} />
        <KeyValue label="Failed polls" value={diag?.failedPolls ?? 0} />
        <KeyValue label="Last packet" value={age} />
        <KeyValue
          label="Latency"
          value={diag?.avgLatencyMs != null ? `${diag.avgLatencyMs} ms` : "--"}
        />
        <KeyValue label="Seq" value={diag?.lastSeqNo ?? "--"} />
        <KeyValue label="RSSI" value={diag?.rssi != null ? `${diag.rssi} dBm` : "--"} />
      </div>
    </HudPanel>
  );
}

import { useEffect, useState } from "react";
import { Check, PlugZap, Save } from "lucide-react";
import { HudPanel, KeyValue } from "./HudPanel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { ESP32_DATA_CONTRACT_EXAMPLE, esp32DataEndpoint, isValidEsp32Host } from "@/lib/sms/esp32";
import { useEsp32Link } from "@/lib/sms/TelemetryProvider";
import { cn } from "@/lib/utils";

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-panel-edge/40 py-2.5 last:border-0">
      <span className="text-[0.8rem] text-muted-foreground">{label}</span>
      {children}
    </div>
  );
}

/**
 * ESP32 Configuration — enter the rig's IP (printed on the Arduino serial monitor),
 * hit SAVE, and the whole dashboard switches from mock data to the live mannequin feed.
 */
export function Esp32ConfigPanel() {
  const link = useEsp32Link();
  const [draft, setDraft] = useState(link.ip);
  const [savedFlash, setSavedFlash] = useState(false);
  const [testing, setTesting] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; msg: string } | null>(null);

  // Keep the field in sync if the saved IP changes elsewhere.
  useEffect(() => setDraft(link.ip), [link.ip]);

  const target = draft.trim();

  const save = () => {
    if (!isValidEsp32Host(target)) {
      setResult({ ok: false, msg: "Invalid address — example: 192.168.1.50" });
      return;
    }
    link.setIp(target);
    // Saving the IP is all it takes — engage live telemetry immediately.
    if (!link.liveMode) link.setLiveMode(true);
    setSavedFlash(true);
    setResult({ ok: true, msg: `Saved — polling ${esp32DataEndpoint(target)}` });
    window.setTimeout(() => setSavedFlash(false), 2500);
  };

  const test = async () => {
    const t = isValidEsp32Host(target) ? target : link.ip;
    if (!isValidEsp32Host(t)) {
      setResult({ ok: false, msg: "Enter a valid IP or host first" });
      return;
    }
    setTesting(true);
    setResult(null);
    const started = performance.now();
    try {
      const res = await fetch(esp32DataEndpoint(t), {
        cache: "no-store",
        signal: AbortSignal.timeout(4000),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = (await res.json().catch(() => null)) as {
        device_id?: string;
        seq_no?: number;
      } | null;
      const ms = Math.round(performance.now() - started);
      const device = json?.device_id ? ` · ${json.device_id}` : "";
      setResult({ ok: true, msg: `Connected in ${ms} ms${device}` });
    } catch (err) {
      const reason = err instanceof Error ? err.message : "failed";
      setResult({
        ok: false,
        msg: `No response (${reason}). Check the IP, make sure this PC and the ESP32 share the same WiFi, and open this dashboard over http://`,
      });
    } finally {
      setTesting(false);
    }
  };

  const diag = link.diagnostics;
  const age = diag?.lastPacketAt
    ? `${Math.max(0, Math.round((Date.now() - diag.lastPacketAt) / 1000))}s ago`
    : diag?.awaitingFirstPacket
      ? "waiting"
      : "--";

  return (
    <HudPanel
      title="ESP32 Configuration"
      action={
        <span
          className={cn(
            "hud-micro flex items-center gap-1.5",
            link.active ? (diag?.connected ? "text-ok" : "text-warn") : "text-muted-foreground",
          )}
        >
          {link.active ? (diag?.connected ? "● LIVE" : "● LINKING") : "○ DEMO"}
        </span>
      }
    >
      <div className="flex flex-col gap-2 sm:flex-row">
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && save()}
          placeholder="ESP32 IP address — e.g. 192.168.1.50"
          className="font-mono text-sm"
          spellCheck={false}
        />
        <div className="flex gap-2">
          <Button
            type="button"
            size="sm"
            onClick={save}
            disabled={target === link.ip}
            className="gap-1.5"
          >
            {savedFlash ? <Check className="size-3.5" /> : <Save className="size-3.5" />}
            {savedFlash ? "SAVED" : "SAVE"}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={test}
            disabled={testing}
            className="gap-1.5"
          >
            <PlugZap className="size-3.5" /> {testing ? "TESTING…" : "TEST"}
          </Button>
        </div>
      </div>

      {result ? (
        <p
          className={cn(
            "hud-micro mt-2 normal-case tracking-normal",
            result.ok ? "text-ok" : "text-crit",
          )}
        >
          {result.ok ? "✓ " : "✗ "}
          {result.msg}
        </p>
      ) : null}

      <div className="mt-1">
        <Row label="Live telemetry from rig">
          <Switch
            checked={link.liveMode}
            onCheckedChange={(v) => {
              if (v && !link.ready) {
                setResult({ ok: false, msg: "Save a valid ESP32 IP first" });
                return;
              }
              link.setLiveMode(v);
            }}
          />
        </Row>
        <Row label="Mode">
          <span className={cn("font-mono text-[0.76rem]", link.active ? "text-ok" : "text-warn")}>
            {link.active ? "LIVE · ESP32" : "MOCK / DEMO"}
          </span>
        </Row>
        <KeyValue
          label="Endpoint"
          value={link.ready ? esp32DataEndpoint(link.ip) : "not configured"}
        />
        <KeyValue label="Poll interval" value={`${link.pollMs} ms`} />
        <KeyValue label="Packets RX" value={diag?.rxPackets ?? 0} />
        <KeyValue label="Failed polls" value={diag?.failedPolls ?? 0} />
        <KeyValue label="Last packet" value={age} />
        <KeyValue label="Device" value={diag?.deviceId ?? "--"} />
        <KeyValue
          label="Seq / RSSI"
          value={diag?.lastSeqNo != null ? `${diag.lastSeqNo} · ${diag.rssi ?? "?"} dBm` : "--"}
        />
        <KeyValue
          label="Firmware uptime"
          value={diag?.uptimeS != null ? `${diag.uptimeS}s` : "--"}
        />
        {diag?.lastError ? (
          <KeyValue label="Last error" value={diag.lastError} tone="text-crit" />
        ) : null}
      </div>

      <details className="mt-2">
        <summary className="hud-micro cursor-pointer text-muted-foreground hover:text-primary">
          Expected /data JSON contract (for the firmware)
        </summary>
        <pre className="mt-2 overflow-x-auto rounded border border-panel-edge/50 bg-secondary/40 p-2 font-mono text-[0.62rem] leading-relaxed text-muted-foreground">
          {ESP32_DATA_CONTRACT_EXAMPLE}
        </pre>
      </details>
    </HudPanel>
  );
}

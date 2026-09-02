import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { HudPanel, KeyValue } from "@/components/sms/HudPanel";
import { Esp32ConfigPanel } from "@/components/sms/Esp32ConfigPanel";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { useEsp32Link, useTelemetry } from "@/lib/sms/TelemetryProvider";

export const Route = createFileRoute("/settings")({
  head: () => ({
    meta: [
      { title: "Settings — SierraEdge Smart Mannequin System" },
      {
        name: "description",
        content:
          "Configure telemetry source, alert thresholds and display options for the SMS console.",
      },
      { property: "og:title", content: "Settings — SierraEdge SMS" },
      {
        property: "og:description",
        content: "Configure telemetry source, alert thresholds and display options.",
      },
    ],
  }),
  component: SettingsPage,
});

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-panel-edge/40 py-2.5 last:border-0">
      <span className="text-[0.8rem] text-muted-foreground">{label}</span>
      {children}
    </div>
  );
}

function SettingsPage() {
  const { system, soldier } = useTelemetry();
  const esp32 = useEsp32Link();
  const [audio, setAudio] = useState(true);
  const [autoRotate, setAutoRotate] = useState(false);
  const [hrLimit, setHrLimit] = useState([110]);
  const [tempLimit, setTempLimit] = useState([37.8]);

  return (
    <div className="grid gap-3 lg:grid-cols-2">
      <div className="lg:col-span-2">
        <Esp32ConfigPanel />
      </div>

      <HudPanel title="Alert Thresholds">
        <Row label="Audible alarm on critical">
          <Switch checked={audio} onCheckedChange={setAudio} />
        </Row>
        <div className="py-2.5">
          <div className="flex justify-between">
            <span className="text-[0.8rem] text-muted-foreground">Heart rate critical (BPM)</span>
            <span className="hud-value text-sm">{hrLimit[0]}</span>
          </div>
          <Slider
            className="mt-2"
            min={90}
            max={180}
            step={1}
            value={hrLimit}
            onValueChange={setHrLimit}
          />
        </div>
        <div className="py-2.5">
          <div className="flex justify-between">
            <span className="text-[0.8rem] text-muted-foreground">Core temp warning (°C)</span>
            <span className="hud-value text-sm">{tempLimit[0]?.toFixed(1)}</span>
          </div>
          <Slider
            className="mt-2"
            min={37}
            max={40}
            step={0.1}
            value={tempLimit}
            onValueChange={setTempLimit}
          />
        </div>
      </HudPanel>

      <HudPanel title="Display & Digital Twin">
        <Row label="Auto-rotate holographic body">
          <Switch checked={autoRotate} onCheckedChange={setAutoRotate} />
        </Row>
        <Row label="Sensor point glow">
          <Switch defaultChecked />
        </Row>
        <Row label="Show zone callouts">
          <Switch defaultChecked />
        </Row>
      </HudPanel>

      <HudPanel title="Telemetry Source">
        <KeyValue
          label="Mode"
          value={esp32.active ? "LIVE · ESP32" : "MOCK / DEMO"}
          tone={esp32.active ? "text-ok" : "text-warn"}
        />
        <KeyValue label="Update interval" value={`${esp32.pollMs} ms`} />
        <KeyValue
          label="Endpoint"
          value={esp32.ready ? `http://${esp32.ip}/data` : "not configured"}
        />
        <p className="hud-micro mt-2 normal-case tracking-normal">
          {esp32.active
            ? `Streaming from the rig — ${esp32.diagnostics?.rxPackets ?? 0} packets received. Every panel reads the live feed.`
            : "The dashboard reads from a single telemetry source interface. Save the rig's IP above to switch every panel to live telemetry."}
        </p>
      </HudPanel>

      <HudPanel title="Device & Operator">
        <KeyValue label="Operator" value={`${soldier.rank} ${soldier.name}`} />
        <KeyValue label="Mannequin link" value={system.connection} tone="text-ok" />
        <KeyValue label="Sensors" value={`${system.sensorsActive}/${system.sensorsTotal}`} />
        <KeyValue label="Battery" value={`${system.battery}%`} />
        <KeyValue label="Network" value={system.network} />
      </HudPanel>
    </div>
  );
}

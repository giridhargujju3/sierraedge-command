import { Suspense, lazy, useEffect, useState } from "react";
import { HudPanel, KeyValue } from "./HudPanel";
import { ClientTime } from "./ClientTime";
import { useFleet, useTelemetry } from "@/lib/sms/TelemetryProvider";
import { cn } from "@/lib/utils";

// Leaflet touches window on import — load it only in the browser.
const FleetMap = lazy(() => import("./map/FleetMap"));

export function LocationPanel() {
  const { location, gps, mannequinLabel } = useTelemetry();
  const { selectedId } = useFleet();
  const [mounted, setMounted] = useState(false);
  const [showTrack, setShowTrack] = useState(true);

  useEffect(() => setMounted(true), []);

  return (
    <HudPanel
      title="Location & Environment"
      action={
        <button
          type="button"
          onClick={() => setShowTrack((v) => !v)}
          className={cn(
            "hud-micro rounded border border-panel-edge px-1.5 py-0.5 transition-colors hover:text-primary",
            showTrack && "border-primary text-primary",
          )}
        >
          {showTrack ? "✓ " : ""}SHOW TRACK
        </button>
      }
    >
      <div className="relative mb-2.5 h-40 overflow-hidden rounded-md border border-panel-edge/70 bg-secondary/50">
        {mounted ? (
          <Suspense fallback={<div className="hud-micro p-2">LOADING MAP…</div>}>
            <FleetMap showTrack={showTrack} />
          </Suspense>
        ) : null}
      </div>

      <KeyValue label="Selected" value={mannequinLabel} />
      <KeyValue label="Location" value={location.location} />
      <KeyValue label="Latitude" value={location.latitude} />
      <KeyValue label="Longitude" value={location.longitude} />
      <KeyValue label="Altitude" value={location.altitude} />
      <KeyValue
        label="GPS"
        value={gps.connected ? "CONNECTED" : "NO FIX"}
        tone={gps.connected ? "text-ok" : "text-muted-foreground"}
      />
      <KeyValue label="Last GPS Update" value={<ClientTime value={gps.updatedAt} />} />
      <KeyValue label="Ambient Temp" value={location.ambientTemp} />
      <KeyValue label="Humidity" value={location.humidity} />
      <KeyValue label="Weather" value={location.weather} />
      <KeyValue label="Condition" value={`${location.condition} · ${selectedId}`} />
    </HudPanel>
  );
}

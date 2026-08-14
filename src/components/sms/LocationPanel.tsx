import { MapPin } from "lucide-react";
import { HudPanel, KeyValue } from "./HudPanel";
import { useTelemetry } from "@/lib/sms/TelemetryProvider";

export function LocationPanel() {
  const { location } = useTelemetry();
  return (
    <HudPanel title="Location & Environment">
      {/* Map placeholder — swap for a real map API layer later. */}
      <div className="relative mb-2.5 h-28 overflow-hidden rounded-md border border-panel-edge/70 bg-secondary/50">
        <svg viewBox="0 0 300 120" className="size-full opacity-70" aria-hidden>
          <defs>
            <linearGradient id="terrain" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--hud)" stopOpacity="0.25" />
              <stop offset="100%" stopColor="var(--hud)" stopOpacity="0.02" />
            </linearGradient>
          </defs>
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <path
              key={i}
              d={`M0 ${118 - i * 16} Q 60 ${96 - i * 16} 110 ${112 - i * 16} T 210 ${100 - i * 16} T 300 ${110 - i * 16}`}
              fill="none"
              stroke="var(--hud)"
              strokeOpacity={0.22 + i * 0.05}
              strokeWidth="1"
            />
          ))}
          <rect width="300" height="120" fill="url(#terrain)" />
          {Array.from({ length: 7 }).map((_, i) => (
            <line key={i} x1={i * 50} y1="0" x2={i * 50} y2="120" stroke="var(--hud)" strokeOpacity="0.08" />
          ))}
        </svg>
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-center">
          <MapPin className="mx-auto size-5 text-primary drop-shadow" />
          <span className="hud-micro">{location.location}</span>
        </div>
      </div>
      <KeyValue label="Latitude" value={location.latitude} />
      <KeyValue label="Longitude" value={location.longitude} />
      <KeyValue label="Altitude" value={location.altitude} />
      <KeyValue label="Ambient Temp" value={location.ambientTemp} />
      <KeyValue label="Humidity" value={location.humidity} />
      <KeyValue label="Weather" value={location.weather} />
      <KeyValue label="Condition" value={location.condition} />
    </HudPanel>
  );
}

import { useEffect, useMemo } from "react";
import { CircleMarker, MapContainer, Polyline, Popup, TileLayer, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { useFleet } from "@/lib/sms/TelemetryProvider";
import { statusHex } from "@/lib/sms/status";
import type { Status } from "@/lib/sms/types";

/** Keeps the map centred on the active unit, animating instead of teleporting. */
function Recenter({ lat, lng }: { lat: number; lng: number }) {
  const map = useMap();
  useEffect(() => {
    map.panTo([lat, lng], { animate: true, duration: 0.8 });
  }, [map, lat, lng]);
  return null;
}

export default function FleetMap({ showTrack }: { showTrack: boolean }) {
  const { mannequins, snapshots, selectedId, selectMannequin } = useFleet();
  const active = snapshots[selectedId];

  const markers = useMemo(
    () =>
      mannequins
        .map((m) => ({ config: m, snap: snapshots[m.id] }))
        .filter((x) => x.snap)
        .map((x) => {
          const snap = x.snap!;
          const worst: Status = snap.zones.some((z) => z.status === "crit")
            ? "crit"
            : snap.zones.some((z) => z.status === "warn")
              ? "warn"
              : snap.gps.connected
                ? "ok"
                : "off";
          return { config: x.config, snap, worst };
        }),
    [mannequins, snapshots],
  );

  if (!active) return null;

  return (
    <MapContainer
      center={[active.gps.lat, active.gps.lng]}
      zoom={12}
      scrollWheelZoom
      className="size-full"
      attributionControl={false}
    >
      <TileLayer
        url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
        maxZoom={19}
        attribution="&copy; OpenStreetMap &copy; CARTO"
      />

      {showTrack && active.trail.length > 1 ? (
        <Polyline
          positions={active.trail}
          pathOptions={{ color: statusHex.ok, weight: 2, opacity: 0.6, dashArray: "4 6" }}
        />
      ) : null}

      {markers.map(({ config, snap, worst }) => {
        const selected = config.id === selectedId;
        const color = statusHex[worst];
        return (
          <CircleMarker
            key={config.id}
            center={[snap.gps.lat, snap.gps.lng]}
            radius={selected ? 11 : 6}
            pathOptions={{
              color,
              weight: selected ? 3 : 1.5,
              fillColor: color,
              fillOpacity: selected ? 0.55 : 0.3,
              className: selected ? "fleet-marker-active" : undefined,
            }}
            eventHandlers={{ click: () => selectMannequin(config.id) }}
          >
            <Popup>
              <div className="min-w-[11rem] space-y-0.5 font-mono text-[0.72rem]">
                <div className="text-[0.8rem] font-semibold uppercase">{config.label}</div>
                <div>Status: {snap.system.connection}</div>
                <div>Battery: {snap.system.battery}%</div>
                <div>Location: {snap.location.location}</div>
                <div>Latitude: {snap.location.latitude}</div>
                <div>Longitude: {snap.location.longitude}</div>
                <div>Last Sync: {snap.gps.updatedAt}</div>
                {selected ? (
                  <div className="pt-1 font-semibold uppercase text-[color:var(--hud)]">Selected</div>
                ) : (
                  <button
                    type="button"
                    onClick={() => selectMannequin(config.id)}
                    className="mt-1 w-full rounded border border-current px-2 py-1 text-[0.68rem] font-semibold uppercase"
                  >
                    Select Mannequin
                  </button>
                )}
              </div>
            </Popup>
          </CircleMarker>
        );
      })}

      <Recenter lat={active.gps.lat} lng={active.gps.lng} />
    </MapContainer>
  );
}

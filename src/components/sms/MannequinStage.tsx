import { Suspense, lazy, useEffect, useMemo, useState, Component, type ErrorInfo, type ReactNode } from "react";
import { Maximize2, Orbit, RotateCcw } from "lucide-react";
import { useFleet, useTelemetry } from "@/lib/sms/TelemetryProvider";
import { statusLabel, statusText } from "@/lib/sms/status";
import type { BodyZoneId } from "@/lib/sms/types";
import { Sparkline } from "./Sparkline";
import { cn } from "@/lib/utils";

const HoloMannequin = lazy(() => import("./mannequin/HoloMannequin"));

class ThreeErrorBoundary extends Component<
  { children: ReactNode; fallback: ReactNode },
  { hasError: boolean }
> {
  override state = { hasError: false };
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  override componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("3D scene error:", error, info.componentStack);
  }
  override render() {
    return this.state.hasError ? this.props.fallback : this.props.children;
  }
}

const CALLOUTS: { id: BodyZoneId; side: "left" | "right"; top: string }[] = [
  { id: "head", side: "right", top: "6%" },
  { id: "upperBody", side: "right", top: "26%" },
  { id: "arms", side: "right", top: "48%" },
  { id: "core", side: "left", top: "52%" },
  { id: "legs", side: "left", top: "74%" },
];

export function MannequinStage() {
  const { zones, sensors } = useTelemetry();
  const { mannequins, selectedId, selectMannequin, selectedSensor, setSelectedSensor, snapshots } = useFleet();
  const [mounted, setMounted] = useState(false);
  const [autoRotate, setAutoRotate] = useState(false);
  const [resetKey, setResetKey] = useState(0);

  useEffect(() => setMounted(true), []);

  const activeSensor = sensors.find((s) => s.key === selectedSensor) ?? null;
  const selectedZoneId: BodyZoneId | null = activeSensor?.zone ?? null;
  const zone = zones.find((z) => z.id === selectedZoneId) ?? null;
  const zoneSensors = useMemo(
    () => (zone ? sensors.filter((s) => zone.sensors.includes(s.key)) : []),
    [zone, sensors],
  );

  const selectZone = (id: BodyZoneId | null) => {
    if (!id) return setSelectedSensor(null);
    const first = sensors.find((s) => s.zone === id);
    setSelectedSensor(first ? first.key : null);
  };

  return (
    <div className="hud-panel scan-line relative min-h-[420px] flex-1 overflow-hidden lg:min-h-0">
      <div className="absolute left-3 top-3 z-20 flex items-center gap-2">
        <span className="hud-micro hidden sm:inline">DIGITAL TWIN</span>
        <select
          value={selectedId}
          onChange={(e) => selectMannequin(e.target.value)}
          aria-label="Select mannequin"
          className="hud-micro rounded border border-primary/50 bg-popover/85 px-2 py-1 text-foreground outline-none backdrop-blur transition-colors hover:border-primary"
        >
          {mannequins.map((m) => (
            <option key={m.id} value={m.id} className="bg-popover">
              {m.label} · {snapshots[m.id]?.system.connection ?? "—"}
            </option>
          ))}
        </select>
      </div>

      <div className="absolute right-3 top-3 z-20 flex gap-1">
        <button
          type="button"
          onClick={() => setAutoRotate((v) => !v)}
          className={cn(
            "hud-micro rounded border border-panel-edge px-2 py-1 transition-colors hover:text-primary",
            autoRotate && "border-primary text-primary",
          )}
        >
          <Orbit className="inline size-3" /> AUTO
        </button>
        <button
          type="button"
          onClick={() => {
            setSelectedSensor(null);
            setResetKey((k) => k + 1);
          }}
          className="hud-micro rounded border border-panel-edge px-2 py-1 transition-colors hover:text-primary"
        >
          <RotateCcw className="inline size-3" /> RESET
        </button>
        <span className="hud-micro hidden rounded border border-panel-edge px-2 py-1 sm:inline">
          <Maximize2 className="inline size-3" /> DRAG / SCROLL
        </span>
      </div>

      <div className="absolute inset-0">
        {mounted ? (
          <ThreeErrorBoundary
            fallback={
              <div className="flex h-full items-center justify-center text-muted-foreground hud-micro">
                3D model unavailable
              </div>
            }
          >
            <Suspense fallback={null}>
              <HoloMannequin
                key={selectedId}
                zones={zones}
                sensors={sensors}
                selected={selectedZoneId}
                selectedSensor={selectedSensor}
                onSelectSensor={setSelectedSensor}
                autoRotate={autoRotate}
                resetKey={resetKey}
              />
            </Suspense>
          </ThreeErrorBoundary>
        ) : null}
      </div>

      {/* Zone callouts */}
      {CALLOUTS.map((c) => {
        const z = zones.find((x) => x.id === c.id);
        if (!z) return null;
        const active = selectedZoneId === z.id;
        return (
          <button
            key={c.id}
            type="button"
            onClick={() => selectZone(active ? null : z.id)}
            style={{ top: c.top }}
            className={cn(
              "absolute z-10 hidden w-36 rounded-md border bg-popover/70 px-2 py-1.5 text-left backdrop-blur transition-all md:block",
              c.side === "left" ? "left-3" : "right-3",
              active ? "border-primary shadow-[var(--glow-hud)]" : "border-panel-edge/80 hover:border-primary/60",
            )}
          >
            <div className={cn("hud-label text-[0.63rem]", statusText[z.status])}>{z.label}</div>
            <ul className="mt-0.5 space-y-0.5">
              {z.metrics.map((m) => (
                <li key={m} className="hud-micro normal-case tracking-normal">
                  • {m}
                </li>
              ))}
            </ul>
          </button>
        );
      })}

      {/* Detail panel for selected zone */}
      {zone ? (
        <div className="absolute bottom-3 left-1/2 z-20 w-[min(92%,26rem)] -translate-x-1/2 rounded-md border border-primary/50 bg-popover/90 p-3 shadow-[var(--glow-hud)] backdrop-blur animate-in fade-in slide-in-from-bottom-2">
          <div className="mb-2 flex items-center justify-between">
            <span className="hud-label">{zone.label} — ZONE DETAIL</span>
            <span className={cn("hud-micro", statusText[zone.status])}>{statusLabel[zone.status]}</span>
          </div>
          <div className="space-y-1.5">
            {zoneSensors.map((s) => (
              <button
                key={s.key}
                type="button"
                onClick={() => setSelectedSensor(s.key)}
                className={cn(
                  "flex w-full items-center gap-2 rounded border px-2 py-1 text-left transition-colors",
                  s.key === selectedSensor ? "border-primary/70 bg-secondary/60" : "border-panel-edge/60",
                )}
              >
                <div className="min-w-0 flex-1">
                  <div className="hud-micro truncate">
                    {s.label} · {selectedId}-{s.sensorId}
                  </div>
                  <div className={cn("hud-value text-sm", statusText[s.status])}>{s.display}</div>
                </div>
                <Sparkline data={s.history} status={s.status} width={70} height={20} />
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

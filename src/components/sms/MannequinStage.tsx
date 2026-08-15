import { Suspense, lazy, useEffect, useState } from "react";
import { Maximize2, RotateCcw } from "lucide-react";
import { useTelemetry } from "@/lib/sms/TelemetryProvider";
import { statusLabel, statusText } from "@/lib/sms/status";
import type { BodyZoneId } from "@/lib/sms/types";
import { Sparkline } from "./Sparkline";
import { cn } from "@/lib/utils";

const HoloMannequin = lazy(() => import("./mannequin/HoloMannequin"));

const CALLOUTS: { id: BodyZoneId; side: "left" | "right"; top: string }[] = [
  { id: "head", side: "right", top: "6%" },
  { id: "upperBody", side: "right", top: "26%" },
  { id: "arms", side: "right", top: "48%" },
  { id: "core", side: "left", top: "52%" },
  { id: "legs", side: "left", top: "74%" },
];

export function MannequinStage() {
  const { zones, sensors } = useTelemetry();
  const [mounted, setMounted] = useState(false);
  const [selected, setSelected] = useState<BodyZoneId | null>(null);

  useEffect(() => setMounted(true), []);

  const zone = zones.find((z) => z.id === selected) ?? null;
  const zoneSensors = zone ? sensors.filter((s) => zone.sensors.includes(s.key)) : [];

  return (
    <div className="hud-panel scan-line relative min-h-[420px] flex-1 overflow-hidden lg:min-h-0">
      <div className="pointer-events-none absolute left-3 top-3 z-10">
        <span className="hud-micro">DIGITAL TWIN / HOLOGRAPHIC MANNEQUIN</span>
      </div>
      <div className="absolute right-3 top-3 z-10 flex gap-1">
        <button
          type="button"
          onClick={() => setSelected(null)}
          className="hud-micro rounded border border-panel-edge px-2 py-1 transition-colors hover:text-primary"
        >
          <RotateCcw className="inline size-3" /> RESET
        </button>
        <span className="hud-micro rounded border border-panel-edge px-2 py-1">
          <Maximize2 className="inline size-3" /> DRAG / SCROLL
        </span>
      </div>

      <div className="absolute inset-0">
        {mounted ? (
          <Suspense fallback={null}>
            <HoloMannequin
              zones={zones}
              selected={selected}
              onSelectZone={(id) => setSelected(id && zones.some((z) => z.id === id) ? id : null)}
            />
          </Suspense>
        ) : null}
      </div>

      {/* Zone callouts */}
      {CALLOUTS.map((c) => {
        const z = zones.find((x) => x.id === c.id);
        if (!z) return null;
        const active = selected === z.id;
        return (
          <button
            key={c.id}
            type="button"
            onClick={() => setSelected(active ? null : z.id)}
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
              <div key={s.key} className="flex items-center gap-2 rounded border border-panel-edge/60 px-2 py-1">
                <div className="min-w-0 flex-1">
                  <div className="hud-micro truncate">{s.label}</div>
                  <div className={cn("hud-value text-sm", statusText[s.status])}>{s.display}</div>
                </div>
                <Sparkline data={s.history} status={s.status} width={70} height={20} />
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

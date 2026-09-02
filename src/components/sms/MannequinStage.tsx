import {
  Suspense,
  lazy,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  Component,
  type ErrorInfo,
  type ReactNode,
} from "react";
import {
  Check,
  ChevronDown,
  ChevronUp,
  Eye,
  EyeOff,
  Maximize2,
  Orbit,
  RotateCcw,
  Save,
} from "lucide-react";
import { useFleet, useTelemetry } from "@/lib/sms/TelemetryProvider";
import { statusHex, statusLabel, statusText } from "@/lib/sms/status";
import type { BodyZoneId, SensorKey } from "@/lib/sms/types";
import { Sparkline } from "./Sparkline";
import { cn } from "@/lib/utils";
import type { CameraView, MannequinControls, ProjectFn } from "./mannequin/HoloMannequin";

/* Vertical pan limits — must mirror the values in HoloMannequin (kept local so the
 * lazy-loaded three.js chunk is not pulled into the main bundle). */
const TARGET_MIN_Y = 0.25;
const TARGET_MAX_Y = 1.9;
const PAN_STEP = 0.14;
const PAN_SPEED = 0.55; // target heights per second while the button is held

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

/* ------------------------------------------------------------- hud overlay */
/* One databox PER SENSOR NODE (image-2 style rig). Boxes pin to the stage edge
 * matching their node's body side (model-space +x → right edge); centre-line
 * nodes alternate L/R so both stacks stay balanced. Width is measured live. */
const CALLOUT_X_SPLIT = 0.04; // model-space |x| beyond which a node locks to an edge
const EDGE_INSET = 14;
const BEND_X = 30; // horizontal elbow run before slanting down/up to the node
const GAP_Y = 10; // min vertical gap while collision-stacking boxes
const INSET_TOP = 56; // keep clear of the DIGITAL TWIN / AUTO / RESET chrome
const INSET_BOTTOM = 88; // keep clear of the zoomed-in zone detail card

type Anchor = { x: number; y: number; front: boolean };

/** Persisted preference for the DATA callout overlay. */
const OVERLAY_KEY = "sierraedge.stage.dataOverlay";

const readOverlayPref = (): boolean => {
  try {
    return localStorage.getItem(OVERLAY_KEY) !== "0";
  } catch {
    return true;
  }
};

const writeOverlayPref = (v: boolean): void => {
  try {
    localStorage.setItem(OVERLAY_KEY, v ? "1" : "0");
  } catch {
    /* storage unavailable — session-only toggle */
  }
};

/** Persisted 3D camera view (SAVE VIEW button) — camera position + orbit target. */
const CAMERA_VIEW_KEY = "sierraedge.stage.cameraView";

const readSavedCameraView = (): CameraView | null => {
  try {
    const raw = localStorage.getItem(CAMERA_VIEW_KEY);
    if (!raw) return null;
    const v = JSON.parse(raw) as { p?: unknown; t?: unknown };
    const ok = (a: unknown): a is [number, number, number] =>
      Array.isArray(a) &&
      a.length === 3 &&
      a.every((n) => typeof n === "number" && Number.isFinite(n));
    if (!ok(v.p) || !ok(v.t)) return null;
    return { p: v.p, t: v.t };
  } catch {
    return null;
  }
};

const writeSavedCameraView = (v: CameraView): void => {
  try {
    localStorage.setItem(CAMERA_VIEW_KEY, JSON.stringify(v));
  } catch {
    /* storage unavailable — session-only view */
  }
};

/** Splits a sensor label "MAX9814 Acoustic — Right Ear" into name + location. */
const labelParts = (label: string): { head: string; tail?: string } => {
  const [head, tail] = label.split("—").map((p) => p.trim());
  return tail ? { head: head ?? label, tail } : { head: head ?? label };
};

export function MannequinStage() {
  const { zones, sensors } = useTelemetry();
  const { mannequins, selectedId, selectMannequin, selectedSensor, setSelectedSensor, snapshots } =
    useFleet();
  const [mounted, setMounted] = useState(false);
  const [autoRotate, setAutoRotate] = useState(false);
  const [resetKey, setResetKey] = useState(0);

  /* DATA callout overlay — image-2-style edge databoxes wired to the sensor
   * nodes with elbow connectors. Toggleable, persisted across sessions. */
  const [dataOverlay, setDataOverlay] = useState<boolean>(readOverlayPref);
  const toggleDataOverlay = useCallback((v: boolean) => {
    setDataOverlay(v);
    writeOverlayPref(v);
  }, []);

  /* Screen-space anchor positions written every frame by <AnchorProjector>
   * inside the Canvas. Kept in a ref so 60 fps orbiting never re-renders. */
  const anchorsRef = useRef<Record<string, Anchor>>({});
  const onAnchors = useCallback<ProjectFn>((id, x, y, front) => {
    anchorsRef.current[id] = { x, y, front };
  }, []);

  /* Vertical pan — slides the camera view up/down the body while zoomed
   * (drag top/bottom) so the head or feet come into frame. */
  const controlsRef = useRef<MannequinControls | null>(null);
  const holdRef = useRef<number | null>(null);

  /* Saved 3D camera view — SAVE VIEW persists zoom/rotation/pan, restored on
   * mount (incl. after navigating to another tab/page and back). */
  const [savedView] = useState<CameraView | null>(readSavedCameraView);
  const [viewSaved, setViewSaved] = useState(false);
  const saveView = useCallback(() => {
    const c = controlsRef.current;
    if (!c) return;
    writeSavedCameraView({
      p: [c.object.position.x, c.object.position.y, c.object.position.z],
      t: [c.target.x, c.target.y, c.target.z],
    });
    setViewSaved(true);
    window.setTimeout(() => setViewSaved(false), 1600);
  }, []);

  const panY = useCallback((dir: 1 | -1, amount = PAN_STEP) => {
    const c = controlsRef.current;
    if (!c) return;
    let delta = dir * amount;
    const nextY = c.target.y + delta;
    if (nextY < TARGET_MIN_Y || nextY > TARGET_MAX_Y) {
      delta = Math.min(TARGET_MAX_Y, Math.max(TARGET_MIN_Y, nextY)) - c.target.y;
    }
    if (delta === 0) return;
    // Slide target and camera together — screen-space vertical pan (see three's panUp).
    c.target.y += delta;
    c.object.position.y += delta;
    c.update();
  }, []);

  const stopPan = useCallback(() => {
    if (holdRef.current != null) {
      cancelAnimationFrame(holdRef.current);
      holdRef.current = null;
    }
  }, []);

  const startPan = useCallback(
    (dir: 1 | -1) => {
      panY(dir); // a tap moves a full notch; holding keeps sliding
      if (holdRef.current != null) return;
      let last = performance.now();
      const step = (now: number) => {
        const dt = Math.min(0.05, (now - last) / 1000);
        last = now;
        panY(dir, PAN_SPEED * dt);
        holdRef.current = requestAnimationFrame(step);
      };
      holdRef.current = requestAnimationFrame(step);
    },
    [panY],
  );

  useEffect(() => stopPan, [stopPan]);

  useEffect(() => setMounted(true), []);

  /* ------------------------------------------------------------- hud rig --
   * rAF layout loop: keeps each per-node databox glued to its sensor node
   * (vertical tracking), collision-stacks both edge stacks, and draws elbow
   * SVG connectors to every node with live status colouring. Writes DOM
   * directly — zero React renders per frame. */
  const stageRef = useRef<HTMLDivElement>(null);
  const boxRefs = useRef(new Map<SensorKey, HTMLDivElement>());
  const pathRefs = useRef(new Map<SensorKey, SVGPathElement>());
  const dotRefs = useRef(new Map<SensorKey, SVGCircleElement>());
  const sensorsRef = useRef(sensors);
  sensorsRef.current = sensors;

  /* Edge assignment per NODE — bilateral sensors follow their own body side
   * so connector lines stay short; centre-line sensors alternate L/R evenly. */
  const sensorSide = useMemo(() => {
    const m = new Map<SensorKey, "left" | "right">();
    let alt = false;
    for (const s of sensors) {
      const x = s.position[0];
      if (Math.abs(x) > CALLOUT_X_SPLIT) {
        m.set(s.key, x > 0 ? "right" : "left");
      } else {
        m.set(s.key, alt ? "left" : "right");
        alt = !alt;
      }
    }
    return m;
  }, [sensors]);
  const sensorSideRef = useRef(sensorSide);
  sensorSideRef.current = sensorSide;

  const activeSensor = sensors.find((s) => s.key === selectedSensor) ?? null;
  const selectedZoneId: BodyZoneId | null = activeSensor?.zone ?? null;
  const activeSensorRef = useRef(selectedSensor);
  activeSensorRef.current = selectedSensor;

  useEffect(() => {
    if (!dataOverlay) return;
    let raf = 0;

    const tick = () => {
      raf = requestAnimationFrame(tick);
      const root = stageRef.current;
      if (!root) return;
      const w = root.clientWidth;
      const h = root.clientHeight;
      if (!w || !h) return;

      const A = anchorsRef.current;
      const sList = sensorsRef.current;
      const sides = sensorSideRef.current;

      interface Placed {
        top: number;
        width: number;
        height: number;
        bright: boolean;
      }
      const placed = new Map<SensorKey, Placed>();

      /* ---- pass 1: position + collision-stack the per-node databoxes ------- */
      for (const side of ["left", "right"] as const) {
        const items = sList
          .filter((s) => sides.get(s.key) === side)
          .map((s) => {
            const el = boxRefs.current.get(s.key);
            const a = A[`sensor:${s.key}`];
            if (!el || !a) return null;
            return {
              id: s.key,
              y: a.y,
              height: el.offsetHeight,
              width: el.offsetWidth,
              el,
              bright: a.front,
            };
          })
          .filter((it): it is NonNullable<typeof it> => it !== null)
          .sort((a, b) => a.y - b.y);

        if (items.length === 0) continue;

        const stack = items.map((it) => ({ ...it, top: it.y - it.height / 2 }));
        let prevBottom = -Infinity;
        for (const it of stack) {
          it.top = Math.max(it.top, prevBottom + GAP_Y, INSET_TOP);
          prevBottom = it.top + it.height;
        }
        /* overflow past the bottom inset → cascade the stack back upward */
        let nextTop = Infinity;
        for (const it of [...stack].reverse()) {
          const limit = Math.min(h - INSET_BOTTOM, nextTop - GAP_Y);
          if (it.top + it.height > limit) {
            it.top = Math.max(INSET_TOP, limit - it.height);
          }
          nextTop = it.top;
        }

        for (const it of stack) {
          it.el.style.transform = `translate3d(0, ${it.top}px, 0)`;
          it.el.style.opacity = it.bright ? "1" : "0.22";
          placed.set(it.id, {
            top: it.top,
            width: it.width,
            height: it.height,
            bright: it.bright,
          });
        }
      }

      /* ---- pass 2: elbow connectors box-edge → bend → sensor node --------- */
      for (const s of sList) {
        const p = pathRefs.current.get(s.key);
        const dot = dotRefs.current.get(s.key);
        if (!p || !dot) continue;
        const nA = A[`sensor:${s.key}`];
        const box = placed.get(s.key);
        if (!nA || !box) {
          p.setAttribute("d", "");
          dot.setAttribute("r", "0");
          continue;
        }
        const side = sides.get(s.key) ?? "left";
        const ex = side === "left" ? EDGE_INSET + box.width : w - EDGE_INSET - box.width;
        const ey = box.top + box.height / 2;
        const bx = ex + (side === "left" ? BEND_X : -BEND_X);
        const midY = (ey + nA.y) / 2;
        const nx = Math.round(nA.x * 10) / 10;
        const ny = Math.round(nA.y * 10) / 10;
        p.setAttribute("d", `M ${ex} ${Math.round(ey)} L ${bx} ${Math.round(midY)} L ${nx} ${ny}`);

        const color = statusHex[s.status];
        const active = activeSensorRef.current === s.key;
        p.setAttribute("stroke", color);
        p.setAttribute("stroke-width", active ? "2" : "1.25");
        p.setAttribute("opacity", active ? "0.95" : nA.front && box.bright ? "0.55" : "0.14");
        p.setAttribute("style", `color:${color};filter:drop-shadow(0 0 4px ${color})`);

        dot.setAttribute("cx", String(nx));
        dot.setAttribute("cy", String(ny));
        dot.setAttribute("r", active ? "5" : "3");
        dot.setAttribute("fill", color);
        dot.setAttribute("opacity", nA.front ? "1" : "0.25");
      }
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [dataOverlay]);

  const zone = zones.find((z) => z.id === selectedZoneId) ?? null;
  const zoneSensors = useMemo(
    () => (zone ? sensors.filter((s) => zone.sensors.includes(s.key)) : []),
    [zone, sensors],
  );

  return (
    <div
      ref={stageRef}
      className="hud-panel scan-line relative min-h-[420px] flex-1 overflow-hidden lg:min-h-0"
    >
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
        <button
          type="button"
          onClick={saveView}
          title="Save the current 3D view — restored when you return to the dashboard"
          className={cn(
            "hud-micro rounded border px-2 py-1 transition-colors",
            viewSaved ? "border-ok text-ok" : "border-panel-edge hover:text-primary",
          )}
        >
          {viewSaved ? <Check className="inline size-3" /> : <Save className="inline size-3" />}
          {viewSaved ? " SAVED" : " SAVE VIEW"}
        </button>
        <button
          type="button"
          onClick={() => toggleDataOverlay(!dataOverlay)}
          aria-pressed={dataOverlay}
          title={dataOverlay ? "Hide sensor callout boxes" : "Show sensor callout boxes"}
          className={cn(
            "hud-micro rounded border px-2 py-1 transition-colors",
            dataOverlay ? "border-primary text-primary" : "border-panel-edge hover:text-primary",
          )}
        >
          {dataOverlay ? <Eye className="inline size-3" /> : <EyeOff className="inline size-3" />}{" "}
          DATA
        </button>
        <span className="hud-micro hidden rounded border border-panel-edge px-2 py-1 sm:inline">
          <Maximize2 className="inline size-3" /> DRAG · SCROLL · ▲▼ PAN
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
                controlsRef={controlsRef}
                onAnchors={onAnchors}
                savedView={savedView ?? undefined}
              />
            </Suspense>
          </ThreeErrorBoundary>
        ) : null}
      </div>

      {/* Vertical pan — drag up/down while zoomed; docked bottom-right inside the stage */}
      <div className="absolute right-3 bottom-3 z-20 flex touch-none flex-col gap-1">
        {([-1, 1] as const).map((dir) => (
          <button
            key={dir}
            type="button"
            aria-label={dir === -1 ? "Pan view up" : "Pan view down"}
            onPointerDown={(e) => {
              e.preventDefault();
              startPan(dir);
            }}
            onPointerUp={stopPan}
            onPointerLeave={stopPan}
            onPointerCancel={stopPan}
            className="hud-micro rounded border border-panel-edge bg-popover/85 px-1.5 py-1.5 backdrop-blur transition-colors hover:border-primary hover:text-primary active:border-primary active:text-primary"
          >
            {dir === -1 ? (
              <ChevronUp className="block size-3.5" />
            ) : (
              <ChevronDown className="block size-3.5" />
            )}
          </button>
        ))}
      </div>

      {/* HUD rig — elbow connectors + edge databoxes wired to the sensor nodes */}
      {dataOverlay ? (
        <div className="pointer-events-none absolute inset-0 z-10">
          {/* connector layer */}
          <svg className="absolute inset-0 h-full w-full" aria-hidden="true">
            {sensors.map((s) => (
              <g key={s.key}>
                <path
                  ref={(el) => {
                    const m = pathRefs.current;
                    if (el) m.set(s.key, el);
                    else m.delete(s.key);
                  }}
                  d=""
                  fill="none"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  opacity="0"
                />
                <circle
                  ref={(el) => {
                    const m = dotRefs.current;
                    if (el) m.set(s.key, el);
                    else m.delete(s.key);
                  }}
                  r="0"
                  stroke="#04121c"
                  strokeWidth="1.5"
                  opacity="0"
                />
              </g>
            ))}
          </svg>

          {/* per-node databox layer — positioned every frame by the layout loop */}
          {sensors.map((s) => {
            const hex = statusHex[s.status];
            const active = selectedSensor === s.key;
            const { head, tail } = labelParts(s.label);
            return (
              <div
                key={s.key}
                ref={(el) => {
                  const m = boxRefs.current;
                  if (el) m.set(s.key, el);
                  else m.delete(s.key);
                }}
                style={
                  (sensorSide.get(s.key) ?? "left") === "left"
                    ? { left: EDGE_INSET }
                    : { right: EDGE_INSET }
                }
                onClick={() => setSelectedSensor(active ? null : s.key)}
                className={cn(
                  "pointer-events-auto absolute top-0 w-[168px] cursor-pointer rounded-md border bg-popover/85 px-2 py-1.5 text-left backdrop-blur sm:w-[200px]",
                  "opacity-0 transition-[transform,opacity,border-color] duration-150 ease-out will-change-transform",
                  active
                    ? "border-primary shadow-[var(--glow-hud)]"
                    : "border-panel-edge/80 hover:border-primary/60",
                )}
              >
                <div className="flex items-center justify-between gap-1">
                  <span className="flex min-w-0 items-center gap-1">
                    <span
                      className="size-1.5 shrink-0 rounded-full"
                      style={{ background: hex, boxShadow: `0 0 4px ${hex}` }}
                    />
                    <span className="hud-label truncate text-[0.63rem]">{head}</span>
                  </span>
                  <span className={cn("hud-micro shrink-0", statusText[s.status])}>
                    {statusLabel[s.status]}
                  </span>
                </div>
                <div className="mt-0.5 flex items-end justify-between gap-2">
                  {tail ? (
                    <span className="hud-micro min-w-0 truncate normal-case tracking-normal text-muted-foreground">
                      {tail}
                    </span>
                  ) : (
                    <span className="flex-1" />
                  )}
                  <span className={cn("hud-value shrink-0 text-[0.72rem]", statusText[s.status])}>
                    {s.display}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      ) : null}

      {/* Detail panel for selected zone */}
      {zone ? (
        <div className="absolute bottom-3 left-1/2 z-20 w-[min(92%,26rem)] -translate-x-1/2 rounded-md border border-primary/50 bg-popover/90 p-3 shadow-[var(--glow-hud)] backdrop-blur animate-in fade-in slide-in-from-bottom-2">
          <div className="mb-2 flex items-center justify-between">
            <span className="hud-label">{zone.label} — ZONE DETAIL</span>
            <span className={cn("hud-micro", statusText[zone.status])}>
              {statusLabel[zone.status]}
            </span>
          </div>
          <div className="space-y-1.5">
            {zoneSensors.map((s) => (
              <button
                key={s.key}
                type="button"
                onClick={() => setSelectedSensor(s.key)}
                className={cn(
                  "flex w-full items-center gap-2 rounded border px-2 py-1 text-left transition-colors",
                  s.key === selectedSensor
                    ? "border-primary/70 bg-secondary/60"
                    : "border-panel-edge/60",
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

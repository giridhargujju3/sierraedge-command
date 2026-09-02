import { useCallback, useRef, type KeyboardEvent, type PointerEvent, type RefObject } from "react";
import { SIDEBAR_MAX_W, SIDEBAR_MIN_W, clampW } from "@/lib/sms/sidebarWidths";
import { cn } from "@/lib/utils";

type HandleProps = {
  side: "left" | "right";
  width: number;
  defaultWidth: number;
  cssVar: string;
  containerRef: RefObject<HTMLDivElement | null>;
  onCommit: (side: "left" | "right", width: number) => void;
};

/**
 * Drag strip pinned over the grid gap between a sidebar column and the stage.
 * Dragging writes the grid-template CSS variable straight onto the container
 * (zero React renders per move → 60 fps) and commits the final width on
 * release. Double-click resets; ←/→ arrows nudge when focused.
 */
export function SidebarResizeHandle({
  side,
  width,
  defaultWidth,
  cssVar,
  containerRef,
  onCommit,
}: HandleProps) {
  const drag = useRef<{ startX: number; startW: number; last: number } | null>(null);

  const setVar = useCallback(
    (px: number) => {
      const el = containerRef.current;
      if (el) el.style.setProperty(cssVar, `${px}px`);
    },
    [containerRef, cssVar],
  );

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    e.currentTarget.dataset["dragging"] = "true";
    drag.current = { startX: e.clientX, startW: width, last: width };
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  };

  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d) return;
    const delta = e.clientX - d.startX;
    const next = side === "left" ? d.startW + delta : d.startW - delta;
    d.last = clampW(next);
    setVar(d.last);
  };

  const endDrag = (e: PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d) return;
    drag.current = null;
    e.currentTarget.dataset["dragging"] = "false";
    document.body.style.cursor = "";
    document.body.style.userSelect = "";
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
    onCommit(side, d.last);
  };

  const reset = useCallback(() => {
    setVar(defaultWidth);
    onCommit(side, defaultWidth);
  }, [defaultWidth, onCommit, setVar, side]);

  const nudge = (e: KeyboardEvent<HTMLDivElement>) => {
    const step = e.shiftKey ? 48 : 16;
    let next: number;
    switch (e.key) {
      case "ArrowLeft":
        next = side === "left" ? width - step : width + step;
        break;
      case "ArrowRight":
        next = side === "left" ? width + step : width - step;
        break;
      case "Home":
        next = SIDEBAR_MIN_W;
        break;
      case "End":
        next = SIDEBAR_MAX_W;
        break;
      case "Enter":
      case " ":
        e.preventDefault();
        reset();
        return;
      default:
        return;
    }
    e.preventDefault();
    const clamped = clampW(next);
    setVar(clamped);
    onCommit(side, clamped);
  };

  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label={side === "left" ? "Resize left sidebar" : "Resize right sidebar"}
      aria-valuenow={width}
      aria-valuemin={SIDEBAR_MIN_W}
      aria-valuemax={SIDEBAR_MAX_W}
      tabIndex={0}
      title="Drag to resize · double-click resets"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      onDoubleClick={reset}
      onKeyDown={nudge}
      style={
        side === "left"
          ? { left: "calc(var(--lw) + 0.375rem)", transform: "translateX(-50%)" }
          : { right: "calc(var(--rw) + 0.375rem)", transform: "translateX(50%)" }
      }
      className={cn(
        "group absolute top-0 bottom-0 z-30 hidden w-3 cursor-col-resize touch-none select-none xl:block",
        "rounded outline-none focus-visible:ring-1 focus-visible:ring-primary/70",
      )}
    >
      {/* full-height whisper line on hover so the boundary is discoverable */}
      <span className="absolute top-0 bottom-0 left-1/2 w-px -translate-x-1/2 bg-transparent transition-colors group-hover:bg-primary/30 group-data-[dragging=true]:bg-primary/40" />
      {/* centre grip */}
      <span className="absolute top-1/2 left-1/2 h-16 w-1 -translate-x-1/2 -translate-y-1/2 rounded-full bg-secondary transition-colors group-hover:bg-primary/70 group-focus-visible:bg-primary/80 group-data-[dragging=true]:bg-primary" />
    </div>
  );
}

import { useCallback, useRef, useState, type CSSProperties } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { MannequinStage } from "@/components/sms/MannequinStage";
import { VitalSigns } from "@/components/sms/VitalSigns";
import { AlertsPanel } from "@/components/sms/AlertsPanel";
import { SystemStatus } from "@/components/sms/SystemStatus";
import { TrendsPanel } from "@/components/sms/TrendsPanel";
import { Esp32LiveDataPanel } from "@/components/sms/Esp32LiveDataPanel";
import { SidebarResizeHandle } from "@/components/sms/SidebarResizeHandle";
import {
  SIDEBAR_DEFAULTS,
  readSidebarWidths,
  writeSidebarWidths,
  type SidebarWidths,
} from "@/lib/sms/sidebarWidths";

export const Route = createFileRoute("/live-monitor")({
  head: () => ({
    meta: [
      { title: "Live Monitor — SierraEdge Smart Mannequin System" },
      {
        name: "description",
        content:
          "Live vital-sign monitoring and holographic body tracking for the active operator.",
      },
      { property: "og:title", content: "Live Monitor — SierraEdge SMS" },
      {
        property: "og:description",
        content: "Live vital-sign monitoring and holographic body tracking.",
      },
    ],
  }),
  component: LiveMonitor,
});

function LiveMonitor() {
  const [widths, setWidths] = useState<SidebarWidths>(readSidebarWidths);
  const gridRef = useRef<HTMLDivElement>(null);

  const commitWidth = useCallback((side: "left" | "right", w: number) => {
    setWidths((prev) => {
      const next = { ...prev, [side]: w };
      writeSidebarWidths(next);
      return next;
    });
  }, []);

  return (
    <div
      ref={gridRef}
      style={{ "--rw": `${widths.right}px` } as CSSProperties}
      className="relative grid h-full min-h-0 gap-3 xl:grid-cols-[minmax(0,1fr)_var(--rw)]"
    >
      {/* Left: 3D digital twin + historical trends pinned to the bottom */}
      <div className="flex min-h-0 flex-col gap-3">
        <div className="flex min-h-[420px] flex-1 flex-col">
          <MannequinStage />
        </div>
        <div className="shrink-0">
          <TrendsPanel columns={2} height={110} />
        </div>
      </div>

      {/* Right rail: same stack as the dashboard — scrolls internally when short */}
      <div className="min-h-0 space-y-3 overflow-y-auto pr-1 scroll-thin">
        <Esp32LiveDataPanel />
        <VitalSigns />
        <AlertsPanel max={8} />
        <SystemStatus />
      </div>

      <SidebarResizeHandle
        side="right"
        width={widths.right}
        defaultWidth={SIDEBAR_DEFAULTS.right}
        cssVar="--rw"
        containerRef={gridRef}
        onCommit={commitWidth}
      />
    </div>
  );
}

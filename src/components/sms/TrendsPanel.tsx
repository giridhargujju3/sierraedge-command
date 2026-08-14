import { useState } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { HudPanel } from "./HudPanel";
import { useTelemetry } from "@/lib/sms/TelemetryProvider";
import type { TrendSeries } from "@/lib/sms/types";
import { cn } from "@/lib/utils";

const RANGES = [
  { id: "15m", label: "15M", points: 15 },
  { id: "30m", label: "30M", points: 30 },
  { id: "60m", label: "60M", points: 60 },
] as const;

function TrendChart({ series, points, height }: { series: TrendSeries; points: number; height: number }) {
  const data = series.points.slice(-points);
  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between">
        <span className="hud-micro">
          {series.label} ({series.unit})
        </span>
        <span className="hud-value text-sm" style={{ color: series.color }}>
          {data[data.length - 1]?.v ?? "--"}
        </span>
      </div>
      <div style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 4, right: 4, left: -22, bottom: 0 }}>
            <defs>
              <linearGradient id={`grad-${series.key}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={series.color} stopOpacity={0.4} />
                <stop offset="100%" stopColor={series.color} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="var(--border)" strokeDasharray="2 4" vertical={false} />
            <XAxis dataKey="t" tick={{ fontSize: 9, fill: "var(--muted-foreground)" }} tickLine={false} axisLine={false} minTickGap={28} />
            <YAxis
              domain={["auto", "auto"]}
              tick={{ fontSize: 9, fill: "var(--muted-foreground)" }}
              tickLine={false}
              axisLine={false}
              width={38}
            />
            <Tooltip
              contentStyle={{
                background: "var(--popover)",
                border: "1px solid var(--panel-edge)",
                borderRadius: 8,
                fontSize: 12,
              }}
              labelStyle={{ color: "var(--muted-foreground)" }}
            />
            <Area
              type="monotone"
              dataKey="v"
              stroke={series.color}
              strokeWidth={1.6}
              fill={`url(#grad-${series.key})`}
              isAnimationActive
              animationDuration={500}
              dot={false}
              name={series.label}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export function TrendsPanel({
  columns = 1,
  height = 92,
  keys,
}: {
  columns?: number;
  height?: number;
  keys?: string[];
}) {
  const { trends } = useTelemetry();
  const [range, setRange] = useState<(typeof RANGES)[number]>(RANGES[1]);
  const visible = keys ? trends.filter((t) => keys.includes(t.key)) : trends;

  return (
    <HudPanel
      title="Historical Trends"
      action={
        <div className="flex gap-1">
          {RANGES.map((r) => (
            <button
              key={r.id}
              type="button"
              onClick={() => setRange(r)}
              className={cn(
                "hud-micro rounded border border-panel-edge/70 px-1.5 py-0.5 transition-colors hover:text-primary",
                range.id === r.id && "border-primary/70 text-primary",
              )}
            >
              {r.label}
            </button>
          ))}
        </div>
      }
      bodyClassName={cn("p-3 gap-3 grid", columns === 2 ? "md:grid-cols-2" : "grid-cols-1")}
    >
      {visible.map((s) => (
        <TrendChart key={s.key} series={s} points={range.points} height={height} />
      ))}
    </HudPanel>
  );
}

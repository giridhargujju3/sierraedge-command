import { useId } from "react";
import type { Status } from "@/lib/sms/types";
import { statusVar } from "@/lib/sms/status";

export function Sparkline({
  data,
  status = "ok",
  width = 90,
  height = 26,
  filled = true,
}: {
  data: number[];
  status?: Status;
  width?: number;
  height?: number;
  filled?: boolean;
}) {
  const id = useId();
  const points = data.slice(-24);
  if (points.length < 2) return <svg width={width} height={height} />;

  const min = Math.min(...points);
  const max = Math.max(...points);
  const span = max - min || 1;
  const step = width / (points.length - 1);
  const coords = points.map((v, i) => [i * step, height - ((v - min) / span) * (height - 4) - 2] as const);
  const line = coords.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const area = `${line} L${width},${height} L0,${height} Z`;
  const color = statusVar[status];

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="overflow-visible">
      <defs>
        <linearGradient id={`spark-${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.35" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      {filled ? <path d={area} fill={`url(#spark-${id})`} /> : null}
      <path
        d={line}
        fill="none"
        stroke={color}
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{ transition: "d 400ms ease" }}
      />
      <circle cx={coords[coords.length - 1]![0]} cy={coords[coords.length - 1]![1]} r="1.8" fill={color} />
    </svg>
  );
}

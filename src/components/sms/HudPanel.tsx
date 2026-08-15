import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function HudPanel({
  title,
  action,
  children,
  className,
  bodyClassName,
}: {
  title?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <section className={cn("hud-panel overflow-hidden", className)}>
      {title ? (
        <header className="flex items-center justify-between gap-2 border-b border-panel-edge/70 px-3 py-2">
          <h2 className="hud-label">{title}</h2>
          {action}
        </header>
      ) : null}
      <div className={cn("p-3", bodyClassName)}>{children}</div>
    </section>
  );
}

export function StatusDot({ tone, className }: { tone: "ok" | "warn" | "crit"; className?: string }) {
  const bg = tone === "ok" ? "bg-ok" : tone === "warn" ? "bg-warn" : "bg-crit";
  const glow = tone === "ok" ? "text-ok" : tone === "warn" ? "text-warn" : "text-crit";
  return <span className={cn("inline-block size-2 rounded-full pulse-dot", bg, glow, className)} />;
}

export function KeyValue({ label, value, tone }: { label: string; value: ReactNode; tone?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-[3px]">
      <span className="text-[0.72rem] text-muted-foreground">{label}</span>
      <span className={cn("font-mono text-[0.76rem] text-foreground", tone)} suppressHydrationWarning>
        {value}
      </span>

    </div>
  );
}

import { Link } from "@tanstack/react-router";
import { BarChart3, FileText, Gauge, History, LayoutDashboard, Settings } from "lucide-react";

const ITEMS = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard },
  { to: "/live-monitor", label: "Live Monitor", icon: Gauge },
  { to: "/sensor-analytics", label: "Sensor Analytics", icon: BarChart3 },
  { to: "/history", label: "History", icon: History },
  { to: "/reports", label: "Reports", icon: FileText },
  { to: "/settings", label: "Settings", icon: Settings },
] as const;

export function BottomNav() {
  return (
    <nav className="hud-panel sticky bottom-2 z-30 mx-2 mt-3 flex items-center justify-between gap-1 overflow-x-auto px-2 py-1.5 scroll-thin">
      {ITEMS.map(({ to, label, icon: Icon }) => (
        <Link
          key={to}
          to={to}
          activeOptions={{ exact: to === "/" }}
          className="group flex flex-1 shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-md px-3 py-2 text-muted-foreground transition-colors hover:text-primary data-[status=active]:bg-primary/10 data-[status=active]:text-primary"
        >
          <Icon className="size-4" />
          <span className="hud-label text-[0.68rem] text-current">{label}</span>
        </Link>
      ))}
    </nav>
  );
}

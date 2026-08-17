import type { Status } from "./types";

export const statusText: Record<Status, string> = {
  ok: "text-ok",
  warn: "text-warn",
  crit: "text-crit",
  off: "text-muted-foreground",
};

export const statusBg: Record<Status, string> = {
  ok: "bg-ok",
  warn: "bg-warn",
  crit: "bg-crit",
  off: "bg-muted",
};

export const statusBorder: Record<Status, string> = {
  ok: "border-ok/40",
  warn: "border-warn/50",
  crit: "border-crit/60",
  off: "border-muted",
};

export const statusVar: Record<Status, string> = {
  ok: "var(--ok)",
  warn: "var(--warn)",
  crit: "var(--crit)",
  off: "var(--muted-foreground)",
};

export const statusLabel: Record<Status, string> = {
  ok: "NOMINAL",
  warn: "WARNING",
  crit: "CRITICAL",
  off: "OFFLINE",
};

export const statusHex: Record<Status, string> = {
  ok: "#3ddc84",
  warn: "#ffb020",
  crit: "#ff4d4d",
  off: "#7b8794",
};

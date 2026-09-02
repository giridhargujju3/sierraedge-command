/* Sidebar width bounds (px) shared by both edges of the dashboard. */
export const SIDEBAR_MIN_W = 240;
export const SIDEBAR_MAX_W = 560;
export const SIDEBAR_DEFAULTS = { left: 304, right: 320 } as const;

export type SidebarWidths = { left: number; right: number };

const STORAGE_KEY = "sierraedge.dashboard.sidebarWidths";

export const clampW = (v: number): number =>
  Math.min(SIDEBAR_MAX_W, Math.max(SIDEBAR_MIN_W, Math.round(v)));

/** Restores persisted sidebar widths, clamped to the current bounds. */
export function readSidebarWidths(): SidebarWidths {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...SIDEBAR_DEFAULTS };
    const parsed = JSON.parse(raw) as Partial<SidebarWidths>;
    return {
      left:
        typeof parsed.left === "number" && Number.isFinite(parsed.left)
          ? clampW(parsed.left)
          : SIDEBAR_DEFAULTS.left,
      right:
        typeof parsed.right === "number" && Number.isFinite(parsed.right)
          ? clampW(parsed.right)
          : SIDEBAR_DEFAULTS.right,
    };
  } catch {
    return { ...SIDEBAR_DEFAULTS };
  }
}

export function writeSidebarWidths(w: SidebarWidths): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(w));
  } catch {
    /* storage unavailable — session-only widths */
  }
}

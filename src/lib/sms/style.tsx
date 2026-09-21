import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { MANNEQUINS } from "./fleet";

export type BodyType = "standard" | "uniform";
export type PoseType = "standing" | "walk" | "run" | "sit";
export type PlaybackState = "playing" | "paused" | "stopped";

export interface MannequinStyle {
  bodyType: BodyType;
  pose: PoseType;
  speed: number;
  loop: boolean;
  playback: PlaybackState;
  saved: boolean;
}

type StyleMap = Record<string, MannequinStyle>;

interface StyleContextValue {
  styles: StyleMap;
  savedStyles: StyleMap;
  updateStyle: (id: string, patch: Partial<MannequinStyle>) => void;
  saveStyle: (id: string) => void;
  resetStyle: (id: string) => void;
}

const DEFAULT_STYLE: MannequinStyle = {
  bodyType: "standard",
  pose: "standing",
  speed: 1,
  loop: true,
  playback: "playing",
  saved: false,
};

const STORAGE_KEY = "sierraedge-mannequin-styles-v1";
const StyleContext = createContext<StyleContextValue | null>(null);

function defaultMap(): StyleMap {
  return Object.fromEntries(MANNEQUINS.map((m) => [m.id, { ...DEFAULT_STYLE }]));
}

function validSavedMap(value: unknown): StyleMap | null {
  if (!value || typeof value !== "object") return null;
  const candidate = value as StyleMap;
  const next = defaultMap();
  for (const mannequin of MANNEQUINS) {
    const item = candidate[mannequin.id];
    if (!item) continue;
    if (!["standard", "uniform"].includes(item.bodyType)) continue;
    if (!["standing", "walk", "run", "sit"].includes(item.pose)) continue;
    next[mannequin.id] = {
      ...DEFAULT_STYLE,
      ...item,
      speed: [0.5, 1, 1.5, 2].includes(item.speed) ? item.speed : 1,
      bodyType: item.bodyType === "uniform" ? "standard" : item.bodyType,
      saved: true,
      playback: "playing",
    };
  }
  return next;
}

export function MannequinStyleProvider({ children }: { children: ReactNode }) {
  const [styles, setStyles] = useState<StyleMap>(defaultMap);
  const [savedStyles, setSavedStyles] = useState<StyleMap>(defaultMap);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (!stored) return;
      const parsed = validSavedMap(JSON.parse(stored));
      if (parsed) {
        setStyles(parsed);
        setSavedStyles(parsed);
      }
    } catch {
      // Corrupt browser storage is ignored; safe defaults remain active.
    }
  }, []);

  const updateStyle = useCallback((id: string, patch: Partial<MannequinStyle>) => {
    setStyles((previous) => ({
      ...previous,
      [id]: { ...(previous[id] ?? DEFAULT_STYLE), ...patch, saved: false },
    }));
  }, []);

  const saveStyle = useCallback((id: string) => {
    setStyles((previous) => {
      const saved = { ...(previous[id] ?? DEFAULT_STYLE), saved: true };
      setSavedStyles((oldSaved) => {
        const nextSaved = { ...oldSaved, [id]: saved };
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(nextSaved));
        return nextSaved;
      });
      return { ...previous, [id]: saved };
    });
  }, []);

  const resetStyle = useCallback((id: string) => {
    setStyles((previous) => ({
      ...previous,
      [id]: { ...(savedStyles[id] ?? DEFAULT_STYLE), playback: "playing" },
    }));
  }, [savedStyles]);

  const value = useMemo(
    () => ({ styles, savedStyles, updateStyle, saveStyle, resetStyle }),
    [styles, savedStyles, updateStyle, saveStyle, resetStyle],
  );

  return <StyleContext.Provider value={value}>{children}</StyleContext.Provider>;
}

export function useMannequinStyles() {
  const context = useContext(StyleContext);
  if (!context) throw new Error("useMannequinStyles must be used inside MannequinStyleProvider");
  return context;
}

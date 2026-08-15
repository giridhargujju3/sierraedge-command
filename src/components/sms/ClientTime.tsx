import { useEffect, useState } from "react";

/**
 * Time strings are generated at render time from the live telemetry clock, so the
 * server HTML can never match the first client render. Render a stable placeholder
 * until hydration completes.
 */
export function ClientTime({ value, placeholder = "--:--:--" }: { value: string; placeholder?: string }) {
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => setHydrated(true), []);
  return <>{hydrated ? value : placeholder}</>;
}

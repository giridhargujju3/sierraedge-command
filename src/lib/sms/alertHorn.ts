/**
 * Critical-alert SIREN — civil-defense / air-raid wail synthesized with the
 * Web Audio API: the classic "nuclear meltdown" warning sound (a loud, slow
 * rising-and-falling siren). No audio assets needed.
 *
 * Optional real recording: drop a siren file at `public/sounds/crit-siren.mp3`
 * (.wav / .ogg also supported) and it is played INSTEAD of the synth
 * automatically — see `public/sounds/README.md`.
 *
 * Browsers only allow audio after a user gesture, so `primeAudioOnGesture()`
 * arms the context on the first click/keypress.
 */

const MUTE_KEY = "sierraedge.alerts.sirenMuted";
const COOLDOWN_MS = 9_000;

export function readSirenMuted(): boolean {
  try {
    return localStorage.getItem(MUTE_KEY) === "1";
  } catch {
    return false;
  }
}

export function writeSirenMuted(muted: boolean): void {
  try {
    localStorage.setItem(MUTE_KEY, muted ? "1" : "0");
  } catch {
    /* storage unavailable — session-only */
  }
}

let ctx: AudioContext | null = null;

function ensureCtx(): AudioContext | null {
  try {
    if (!ctx) {
      const AC =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
    }
    if (ctx.state === "suspended") void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

let primed = false;

/** Arms the AudioContext on the first user gesture (autoplay policy). */
export function primeAudioOnGesture(): void {
  if (primed || typeof window === "undefined") return;
  primed = true;
  const handler = () => {
    ensureCtx();
  };
  window.addEventListener("pointerdown", handler, { once: true, capture: true });
  window.addEventListener("keydown", handler, { once: true, capture: true });
}

/* ------------------------------------------------- real recording override */

const FILE_CANDIDATES = [
  "/sounds/crit-siren.mp3",
  "/sounds/crit-siren.wav",
  "/sounds/crit-siren.ogg",
];
let fileProbe: Promise<string | null> | null = null;

function probeSirenFile(): Promise<string | null> {
  if (!fileProbe) {
    fileProbe = (async () => {
      for (const src of FILE_CANDIDATES) {
        try {
          const res = await fetch(src, { method: "HEAD" });
          if (res.ok) return src;
        } catch {
          /* offline / no file — keep probing the rest */
        }
      }
      return null;
    })();
  }
  return fileProbe;
}

async function playFileSiren(volume: number): Promise<boolean> {
  const src = await probeSirenFile();
  if (!src) return false;
  return new Promise((resolve) => {
    const audio = new Audio(src);
    audio.volume = Math.min(1, Math.max(0, volume));
    audio.onplaying = () => resolve(true);
    audio.onerror = () => resolve(false);
    void audio.play().catch(() => resolve(false));
  });
}

/* ------------------------------------------------------ synthesized wail */

/** Each wail = slow exponential rise low→high, then fall back (air-raid). */
const WAILS: { upS: number; downS: number; lowHz: number; highHz: number }[] = [
  { upS: 2.0, downS: 2.0, lowHz: 170, highHz: 720 },
  { upS: 2.0, downS: 0, lowHz: 170, highHz: 720 }, // final rise, cut at the top
];

let lastPlayedAt = 0;

/**
 * Fires the synthesized air-raid wail (~6 s, LOUD): sawtooth fundamental with
 * a detuned beating voice, sub-square body and octave shimmer, swept
 * low→high→low→high through a lowpass and compressor.
 */
export function playCritSiren(volume = 0.9): boolean {
  const ac = ensureCtx();
  if (!ac || ac.state === "closed") return false;
  lastPlayedAt = Date.now();

  /* Chain: voices → per-voice gain → lowpass → compressor → master → out */
  const master = ac.createGain();
  master.gain.setValueAtTime(0.0001, ac.currentTime);
  master.gain.exponentialRampToValueAtTime(volume, ac.currentTime + 0.25);
  master.gain.setValueAtTime(volume, ac.currentTime + 5.6);
  master.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + 6.1);
  const comp = ac.createDynamicsCompressor();
  comp.threshold.value = -14;
  comp.knee.value = 10;
  comp.ratio.value = 8;
  comp.attack.value = 0.003;
  comp.release.value = 0.25;
  const lp = ac.createBiquadFilter();
  lp.type = "lowpass";
  lp.frequency.value = 2600;
  lp.Q.value = 0.7;
  lp.connect(comp);
  comp.connect(master);
  master.connect(ac.destination);

  const voices: [OscillatorType, number, number][] = [
    ["sawtooth", 1, 0.5], // fundamental
    ["sawtooth", 1.012, 0.3], // slow beating — real siren "wobble"
    ["square", 0.5, 0.25], // sub body
    ["sawtooth", 2, 0.12], // octave shimmer
  ];

  /* Schedule the rise/fall sweep on every voice. */
  let t = ac.currentTime + 0.05;
  for (const cycle of WAILS) {
    const segEnd = t + cycle.upS + cycle.downS;
    for (const [type, mult, level] of voices) {
      const osc = ac.createOscillator();
      osc.type = type;
      osc.frequency.setValueAtTime(cycle.lowHz * mult, t);
      osc.frequency.exponentialRampToValueAtTime(cycle.highHz * mult, t + cycle.upS);
      if (cycle.downS > 0) {
        osc.frequency.exponentialRampToValueAtTime(cycle.lowHz * mult, t + cycle.upS + cycle.downS);
      }
      const vg = ac.createGain();
      vg.gain.value = level;
      osc.connect(vg);
      vg.connect(lp);
      osc.start(t);
      osc.stop(segEnd + 0.15);
    }
    t = segEnd;
  }
  return true;
}

/**
 * Plays the critical siren — a real recording from `public/sounds/` if one is
 * provided, otherwise the synthesized wail. Rate-limited so overlapping crits
 * don't stack into noise. Resolves true when a siren actually started.
 */
export async function playCritSirenWithFallback(volume = 0.9): Promise<boolean> {
  const now = Date.now();
  if (now - lastPlayedAt < COOLDOWN_MS) return false;
  const played = await playFileSiren(volume);
  if (played) {
    lastPlayedAt = now;
    return true;
  }
  return playCritSiren(volume);
}

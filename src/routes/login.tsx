import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import {
  Activity,
  ArrowRight,
  BarChart3,
  Box,
  Building2,
  Check,
  Crosshair,
  Eye,
  EyeOff,
  LockKeyhole,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Secure Command Access | Smart Mannequin System" },
      {
        name: "description",
        content:
          "Secure access to the Smart Mannequin System mission-control workspace.",
      },
      { property: "og:title", content: "Secure Command Access | Smart Mannequin System" },
      {
        property: "og:description",
        content:
          "Secure access to the Smart Mannequin System mission-control workspace.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: LoginPage,
});

function SierraMark({ compact = false }: { compact?: boolean }) {
  return (
    <svg className={compact ? "h-8 w-9" : "h-13 w-15"} viewBox="0 0 64 56" aria-hidden="true">
      <path className="fill-primary" d="M32 2 61 54H43L32 34 21 54H3L32 2Z" />
      <path className="fill-background" d="m32 18 10 20H22l10-20Z" />
    </svg>
  );
}

function TopHeader() {
  return (
    <header className="hud-header relative z-30 grid h-15 grid-cols-[minmax(0,1fr)] items-center px-5 lg:px-12">
      <div className="flex min-w-0 items-center gap-4">
        <SierraMark compact />
        <strong className="font-display truncate text-primary">
          SIERRAEDGE
        </strong>
        <span className="hidden h-7 w-px bg-primary/45 sm:block" />
        <span className="hidden font-mono text-muted-foreground md:block">
          SMART MANNEQUIN SYSTEM
        </span>
      </div>
    </header>
  );
}

function WorldMap() {
  const dots = Array.from({ length: 72 }, (_, i) => ({
    x: 8 + ((i * 37) % 84),
    y: 12 + ((i * 53) % 68),
    r: i % 9 === 0 ? 1.8 : 0.8,
  }));
  return (
    <svg className="world-map" viewBox="0 0 900 520" aria-hidden="true">
      <g className="map-lines">
        <path d="M56 141 112 92l91-25 52 32 47 8 30 53-34 47-69 6-32 75-83-32-31-61Z" />
        <path d="m287 287 51 37 22 81-42 82-38-56 7-64-31-39Z" />
        <path d="m432 109 68-42 75 13 39 43 91-14 91 48-45 42-92-6-33 45-59-12-55 37-47-51-61-18Z" />
        <path d="m545 274 59 6 57 47-29 112-60-19-32-69Z" />
        <path d="m748 348 70-24 47 35-26 57-72 3Z" />
        <path d="M132 168q212 151 474 13t221 173M111 264q225-147 433 8t271-84M298 405Q493 186 742 369" />
      </g>
      {dots.map((dot, i) => (
        <circle
          key={i}
          className={i % 11 === 0 ? "map-node map-node-active" : "map-node"}
          cx={`${dot.x}%`}
          cy={`${dot.y}%`}
          r={dot.r}
        />
      ))}
    </svg>
  );
}

function Radar() {
  return (
    <div className="radar" aria-hidden="true">
      {[16, 30, 44, 58, 72, 88].map((size) => (
        <i key={size} className="radar-ring" style={{ width: `${size}%`, height: `${size}%` }} />
      ))}
      <i className="radar-axis radar-axis-x" />
      <i className="radar-axis radar-axis-y" />
      <i className="radar-scan" />
      <i className="radar-core" />
      <i className="radar-blip blip-a" />
      <i className="radar-blip blip-b" />
      <i className="radar-blip blip-c" />
    </div>
  );
}

function Terrain() {
  return (
    <svg className="terrain" viewBox="0 0 1250 190" preserveAspectRatio="none" aria-hidden="true">
      <defs>
        <linearGradient id="terrainFade" x1="0" x2="1">
          <stop stopColor="currentColor" stopOpacity=".75" />
          <stop offset="1" stopColor="currentColor" stopOpacity=".15" />
        </linearGradient>
      </defs>
      <g fill="none" stroke="url(#terrainFade)" strokeWidth="1">
        <path d="M0 138 75 98l55 32 83-77 67 73 79-37 66 51 71-95 73 87 77-54 65 54 83-70 68 62 72-42 63 48 90-76 83 82 80-36" />
        <path d="M0 138 75 190m0-92 55 92m0-60 83 60m0-137 67 137m0-64 79 64m0-101 66 101m0-50 71 50m0-145 73 145m0-58 77 58m0-112 65 112m0-58 83 58m0-128 68 128m0-66 72 66m0-108 63 108m0-60 90 60m0-136 83 136m0-54 80 54" />
        <path d="M0 165h1250M0 179h1250" opacity=".5" />
        <path
          d="M0 138 130 130 280 126 425 140 569 132 714 124 859 130 994 136 1167 136"
          opacity=".5"
        />
      </g>
      {[75, 213, 359, 496, 646, 782, 930, 1084].map((x, i) => (
        <circle
          key={x}
          className={`terrain-point tp-${i}`}
          cx={x}
          cy={[98, 53, 89, 45, 78, 62, 82, 54][i]}
          r="2.8"
        />
      ))}
    </svg>
  );
}

function CommandLayer() {
  return (
    <div className="command-layer" aria-hidden="true">
      <WorldMap />
      <Radar />
      <Terrain />
      <div className="coord coord-a">
        34.0522° N<br />
        118.2437° W
      </div>
      <div className="coord coord-b">
        1.3521° N<br />
        103.8198° E
      </div>
      <svg className="network" viewBox="0 0 1100 600">
        <g fill="none">
          <path d="M60 286Q250 180 430 305T790 210 1040 320" />
          <path d="M145 440 342 232 574 414 805 180 1014 265" />
        </g>
        {[
          "60,286",
          "145,440",
          "342,232",
          "430,305",
          "574,414",
          "790,210",
          "805,180",
          "1014,265",
          "1040,320",
        ].map((point) => {
          const [cx, cy] = point.split(",");
          return <circle key={point} cx={cx} cy={cy} r="3" />;
        })}
      </svg>
    </div>
  );
}

function MissionContent() {
  return (
    <section className="mission-content relative z-10" aria-labelledby="mission-title">
      <div className="mission-ready">
        <span>MISSION READY</span>
        <i />
      </div>
      <h1 id="mission-title">
        SMART
        <br />
        MANNEQUIN
        <br />
        SYSTEM
      </h1>
      <i className="title-rule" />
      <h2>
        REAL-TIME
        <br />
        SOLDIER
        <br />
        MONITORING
      </h2>
      <p>
        Secure, intelligent, and real-time monitoring
        <br className="hidden sm:block" /> for training, research, and operational readiness
        <br className="hidden sm:block" /> through a unified digital platform.
      </p>
      <i className="title-rule" />
      <div className="mission-tag">
        REAL PEOPLE
        <br />
        SAFER MISSIONS
        <br />A MORE SECURE TOMORROW
      </div>
    </section>
  );
}

function LoginConsole() {
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(true);
  const [status, setStatus] = useState<"idle" | "loading" | "error" | "success">("idle");
  const [message, setMessage] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const email = String(data.get("email") ?? "").trim();
    const password = String(data.get("password") ?? "");
    setStatus("loading");
    setMessage("");
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ username: email, password, remember }),
      });
      const payload = (await res.json().catch(() => null)) ?? {};
      if (!res.ok || !payload.ok) {
        setStatus("error");
        setMessage("AUTHENTICATION FAILED");
        return;
      }
      setStatus("success");
      setMessage("AUTHENTICATION VERIFIED — SYSTEM ACCESS GRANTED");
      window.location.replace("/");
    } catch {
      setStatus("error");
      setMessage("AUTHENTICATION FAILED");
    }
  }

  return (
    <section className="login-console relative z-20" aria-labelledby="login-heading">
      <i className="corner corner-tl" />
      <i className="corner corner-tr" />
      <i className="corner corner-bl" />
      <i className="corner corner-br" />
      <div className="login-brand">
        <SierraMark />
        <strong>SIERRAEDGE</strong>
        <span>SMART MANNEQUIN SYSTEM</span>
      </div>
      <div className="welcome">
        <h2 id="login-heading">WELCOME BACK</h2>
        <p>
          Secure access to your
          <br />
          mannequin monitoring workspace.
        </p>
      </div>
      <form onSubmit={handleSubmit} className="login-form">
        <label className="sr-only" htmlFor="email">
          Email or Username
        </label>
        <div className="field">
          <UserRound />
          <input
            id="email"
            name="email"
            type="text"
            autoComplete="username"
            required
            placeholder="Email or username"
          />
        </div>
        <label className="sr-only" htmlFor="password">
          Password
        </label>
        <div className="field">
          <LockKeyhole />
          <input
            id="password"
            name="password"
            type={showPassword ? "text" : "password"}
            autoComplete="current-password"
            required
            placeholder="Password"
          />
          <button
            type="button"
            className="eye-button"
            onClick={() => setShowPassword((value) => !value)}
            aria-label={showPassword ? "Hide password" : "Show password"}
          >
            {showPassword ? <EyeOff /> : <Eye />}
          </button>
        </div>
        <div className="form-options">
          <label className="remember">
            <input
              type="checkbox"
              checked={remember}
              onChange={(e) => setRemember(e.target.checked)}
            />
            <span>
              <Check />
            </span>
            Remember me
          </label>
          <button
            type="button"
            className="text-link"
            disabled
            title="Password recovery is not configured"
          >
            Forgot password?
          </button>
        </div>
        <Button
          variant="hud"
          size="hud"
          type="submit"
          disabled={status === "loading" || status === "success"}
        >
          <span>
            {status === "loading"
              ? "AUTHENTICATING..."
              : status === "success"
                ? "VERIFIED"
                : "Login"}
          </span>
          <ArrowRight className="login-arrow" />
        </Button>

        <div className={`auth-message ${status}`} role="status">
          {message}
        </div>
        <div className="or-divider">
          <i />
          <span>OR</span>
          <i />
        </div>
        <Button
          variant="hudOutline"
          size="hud"
          type="button"
          disabled
          title="SSO is not configured"
        >
          <Building2 /> Sign in with SSO
        </Button>
      </form>
      <div className="security-block">
        <ShieldCheck />
        <div>
          <strong>SECURE CONNECTION</strong>
          <span>ENCRYPTED | AUTHORIZED ACCESS | LIVE SYSTEM</span>
        </div>
      </div>
    </section>
  );
}

const footerItems = [
  { icon: Activity, lines: ["REAL-TIME", "SENSOR DATA"] },
  { icon: Box, lines: ["DIGITAL", "TWIN"] },
  { icon: Crosshair, lines: ["MISSION", "MONITORING"] },
  { icon: BarChart3, lines: ["SYSTEM", "STATUS"] },
];

function BottomStatusBar() {
  return (
    <footer className="bottom-status relative z-30">
      {footerItems.map(({ icon: Icon, lines }) => (
        <div className="status-item" key={lines[0]}>
          <Icon />
          <span>
            {lines[0]}
            <br />
            {lines[1]}
          </span>
        </div>
      ))}
      <div className="safer">BUILT FOR A SAFER TOMORROW</div>
    </footer>
  );
}

function LoginPage() {
  useEffect(() => {
    document.body.classList.add("command-page");
    document.body.style.overflow = "hidden";
    return () => {
      document.body.classList.remove("command-page");
      document.body.style.overflow = "";
    };
  }, []);
  return (
    <div className="fixed inset-0 z-50">
      <main className="command-shell">
        <TopHeader />
        <CommandLayer />
        <div className="main-stage">
          <MissionContent />
          <LoginConsole />
        </div>
        <BottomStatusBar />
      </main>
    </div>
  );
}

export default Route;

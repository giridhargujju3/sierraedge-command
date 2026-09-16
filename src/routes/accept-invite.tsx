import { createFileRoute, useNavigate, useSearch } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/accept-invite")({
  component: AcceptInvitePage,
});

function AcceptInvitePage() {
  const navigate = useNavigate();
  const search = useSearch({ from: "/accept-invite" });
  const [status, setStatus] = useState<"idle" | "loading" | "error" | "success">("idle");
  const [message, setMessage] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const token = typeof search?.token === "string" ? search.token : "";

    if (!token) {
      setStatus("error");
      setMessage("Missing invitation token.");
      return;
    }

    setStatus("loading");
    setMessage("");

    try {
      const res = await fetch("/api/auth/accept-invite", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token }),
      });
      const payload = (await res.json().catch(() => null)) as { ok?: boolean; error?: string } | null;

      if (!res.ok || !payload?.ok) {
        setStatus("error");
        setMessage(payload?.error ?? "Unable to accept invitation.");
        return;
      }

      setStatus("success");
      setMessage("Invitation accepted — redirecting to the workspace.");
      setTimeout(() => {
        void navigate({ to: "/", replace: true });
      }, 1000);
    } catch {
      setStatus("error");
      setMessage("Unable to accept invitation.");
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="hud-panel w-full max-w-md space-y-5 p-6">
        <div>
          <p className="text-[0.7rem] uppercase tracking-[0.22em] text-primary">SierraEdge</p>
          <h1 className="mt-2 text-2xl font-semibold tracking-[0.12em] text-primary">Accept Invitation</h1>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <p className="text-sm text-muted-foreground">
            You are signing in with a trusted Gmail address. There is no shared password to set up.
          </p>

          <Button type="submit" className="w-full" disabled={status === "loading" || status === "success"}>
            {status === "loading" ? "VERIFIING ACCESS..." : "Continue to workspace"}
          </Button>

          {message ? (
            <p
              className={
                status === "success"
                  ? "text-sm text-ok"
                  : status === "error"
                    ? "text-sm text-destructive"
                    : "text-sm text-muted-foreground"
              }
            >
              {message}
            </p>
          ) : null}
        </form>
      </div>
    </main>
  );
}

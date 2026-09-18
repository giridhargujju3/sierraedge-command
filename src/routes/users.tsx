import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth";

interface UserRecord {
  id: string;
  username: string;
  email?: string;
  name: string;
  role: "admin" | "user";
  enabled: boolean;
  status?: "invited" | "active" | "disabled" | "deleted";
  createdAt?: number;
}

export const Route = createFileRoute("/users")({
  component: UsersPage,
});

function UsersPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    role: "user" as "admin" | "user",
  });
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!user || user.role !== "admin") {
      void navigate({ to: "/", replace: true });
      return;
    }

    const loadUsers = async () => {
      try {
        const res = await fetch("/api/auth/users", { credentials: "same-origin" });
        const payload = (await res.json().catch(() => null)) as { ok?: boolean; users?: UserRecord[]; error?: string } | null;
        if (!res.ok || !payload?.ok) {
          setError(payload?.error ?? "Unable to load users");
          return;
        }
        setUsers(payload.users ?? []);
      } catch {
        setError("Unable to load users");
      }
    };

    void loadUsers();
  }, [navigate, user]);

  async function refreshUsers() {
    const nextRes = await fetch("/api/auth/users", { credentials: "same-origin" });
    const nextPayload = (await nextRes.json().catch(() => null)) as { ok?: boolean; users?: UserRecord[] } | null;
    if (nextRes.ok && nextPayload?.ok) {
      setUsers(nextPayload.users ?? []);
    }
  }

  async function createUser(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMessage("");

    const payload = {
      action: "invite",
      name: form.name,
      email: form.email,
      password: form.password,
      role: form.role,
    };

    try {
      const res = await fetch("/api/auth/users", {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify(payload),
      });
      const data = (await res.json().catch(() => null)) as { ok?: boolean; error?: string; user?: UserRecord } | null;
      if (!res.ok || !data?.ok) {
        setError(data?.error ?? "Unable to create user");
        return;
      }
      setForm({ name: "", email: "", password: "", role: "user" });
      setMessage(`Invitation sent to ${data.user?.email ?? data.user?.username ?? "the user"}`);
      await refreshUsers();
    } catch {
      setError("Unable to create user");
    }
  }

  async function toggleUserStatus(entry: UserRecord) {
    const nextStatus = entry.status === "active" || entry.enabled ? "disabled" : "active";
    try {
      const res = await fetch("/api/auth/users", {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ action: "update", id: entry.id, status: nextStatus }),
      });
      const data = (await res.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
      if (!res.ok || !data?.ok) {
        setError(data?.error ?? "Unable to update user status");
        return;
      }
      setMessage(`${entry.name} is now ${nextStatus === "active" ? "active" : "disabled"}.`);
      await refreshUsers();
    } catch {
      setError("Unable to update user status");
    }
  }

  async function deleteUser(entry: UserRecord) {
    try {
      const res = await fetch("/api/auth/users", {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ action: "delete", id: entry.id }),
      });
      const data = (await res.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
      if (!res.ok || !data?.ok) {
        setError(data?.error ?? "Unable to delete user");
        return;
      }
      setMessage(`${entry.name} was deleted.`);
      await refreshUsers();
    } catch {
      setError("Unable to delete user");
    }
  }

  if (!user || user.role !== "admin") {
    return null;
  }

  return (
    <div className="space-y-4">
      <div className="hud-panel p-4">
        <h1 className="text-2xl font-semibold tracking-[0.14em] text-primary">USER MANAGEMENT</h1>
        <p className="mt-2 text-sm text-muted-foreground">Admin-only access for creating and viewing users.</p>
      </div>

      <div className="grid gap-4 lg:grid-cols-[380px_minmax(0,1fr)]">
        <form onSubmit={createUser} className="hud-panel space-y-4 p-4">
          <h2 className="text-lg font-semibold uppercase tracking-[0.12em] text-primary">Add user</h2>

          <div>
            <label className="mb-1 block text-[0.7rem] uppercase tracking-[0.14em] text-muted-foreground">Name</label>
            <input
              value={form.name}
              onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
              className="w-full rounded-md border border-primary/40 bg-background/40 px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
            />
          </div>

          <div>
            <label className="mb-1 block text-[0.7rem] uppercase tracking-[0.14em] text-muted-foreground">Gmail address</label>
            <input
              type="email"
              value={form.email}
              onChange={(event) => setForm((prev) => ({ ...prev, email: event.target.value }))}
              className="w-full rounded-md border border-primary/40 bg-background/40 px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
            />
          </div>

          <div>
            <label className="mb-1 block text-[0.7rem] uppercase tracking-[0.14em] text-muted-foreground">Access password</label>
            <input
              type="text"
              required
              value={form.password}
              onChange={(event) => setForm((prev) => ({ ...prev, password: event.target.value }))}
              placeholder="Required — shared login password"
              className="w-full rounded-md border border-primary/40 bg-background/40 px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
            />
          </div>

          <div>
            <label className="mb-1 block text-[0.7rem] uppercase tracking-[0.14em] text-muted-foreground">Role</label>
            <select
              value={form.role}
              onChange={(event) => setForm((prev) => ({ ...prev, role: event.target.value as "admin" | "user" }))}
              className="w-full rounded-md border border-primary/40 bg-background/40 px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
            >
              <option value="user">User</option>
              <option value="admin">Admin</option>
            </select>
          </div>

          <button type="submit" className="w-full rounded-md bg-gradient-to-r from-emerald-400 via-cyan-400 to-primary px-4 py-2 font-medium text-slate-950 shadow-lg shadow-cyan-500/20 transition hover:brightness-110">
            Send invitation
          </button>

          {message ? <p className="text-sm text-ok">{message}</p> : null}
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
        </form>

        <div className="hud-panel p-4">
          <h2 className="text-lg font-semibold uppercase tracking-[0.12em] text-primary">User list</h2>
          <div className="mt-4 space-y-2">
            {users.length === 0 ? (
              <p className="text-sm text-muted-foreground">No users found.</p>
            ) : (
              users.map((entry) => {
                const isActive = entry.status === "active" || (entry.status == null && entry.enabled);
                return (
                  <div key={entry.id} className="rounded-md border border-panel-edge/70 bg-background/20 px-3 py-2">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="font-medium text-foreground">{entry.name}</div>
                        <div className="text-xs uppercase tracking-[0.12em] text-muted-foreground">{entry.email ?? entry.username} · {entry.role}</div>
                      </div>
                      <span className="rounded-full border border-primary/40 px-2 py-1 text-[0.6rem] uppercase tracking-[0.12em] text-primary">
                        {entry.status ?? (entry.enabled ? "ACTIVE" : "DISABLED")}
                      </span>
                    </div>
                    <div className="mt-3 flex gap-2">
                      <button
                        type="button"
                        onClick={() => toggleUserStatus(entry)}
                        className="rounded border border-primary/40 px-2 py-1 text-[0.65rem] uppercase tracking-[0.12em] text-primary hover:bg-primary/10"
                      >
                        {isActive ? "Disable" : "Enable"}
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteUser(entry)}
                        disabled={entry.id === user.id}
                        className="rounded border border-red-500/50 px-2 py-1 text-[0.65rem] uppercase tracking-[0.12em] text-red-400 hover:bg-red-500/10 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

import "./lib/error-capture";

import { createHmac, pbkdf2Sync, randomBytes } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import nodemailer from "nodemailer";
import { Client } from "pg";

import { consumeLastCapturedError } from "./lib/error-capture";
import { renderErrorPage } from "./lib/error-page";
import { createInviteUrl, getInviteDeliveryMessage, isValidEmail, normalizeEmail } from "./lib/invite";
import { normalizeEsp32Host } from "./lib/sms/esp32";

type ServerEntry = {
  fetch: (request: Request, env: unknown, ctx: unknown) => Promise<Response> | Response;
};

const DATA_PATH = join(process.cwd(), ".data", "users.json");
const DEFAULT_SECRET = "a5108f88f8057173a0ec723d682f7bd9d32a02bdd9468f653c743340b38486d1";

function getPostgresConfig() {
  const host = process.env.POSTGRES_HOST ?? "localhost";
  const port = Number(process.env.POSTGRES_PORT ?? "5432");
  const database = process.env.POSTGRES_DB ?? "postgres";
  const user = process.env.POSTGRES_USER ?? "postgres";
  const password = process.env.POSTGRES_PASSWORD ?? "";
  const enabled = Boolean(process.env.POSTGRES_HOST || process.env.POSTGRES_DB || process.env.POSTGRES_USER || process.env.POSTGRES_PASSWORD || process.env.POSTGRES_PORT);

  return {
    enabled,
    host,
    port,
    database,
    user,
    password,
  };
}

function base64UrlEncode(value: string) {
  return Buffer.from(value).toString("base64").replace(/=+$/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

function base64UrlDecode(value: string) {
  const pad = value.length % 4;
  const normalized = pad === 0 ? value : value + "=".repeat(4 - pad);
  return Buffer.from(normalized.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8");
}

function makeUniqueUsername(value: string) {
  const base = normalizeEmail(value).split("@")[0] || "user";
  return `${base}-${Math.random().toString(36).slice(2, 8)}`;
}

function jsonResponse(body: unknown, init?: ResponseInit) {
  return new Response(JSON.stringify(body), {
    ...init,
    headers: {
      "content-type": "application/json; charset=utf-8",
      ...(init?.headers ?? {}),
    },
  });
}

function getCookieValue(request: Request, name: string) {
  const cookieHeader = request.headers.get("cookie") ?? "";
  const match = cookieHeader
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${name}=`));
  if (!match) return null;
  return decodeURIComponent(match.slice(name.length + 1));
}

async function readLegacyUsersStore() {
  try {
    const raw = await readFile(DATA_PATH, "utf8");
    return JSON.parse(raw) as {
      secret?: string;
      users?: Array<Record<string, any>>;
    };
  } catch (error: any) {
    if (error?.code !== "ENOENT") throw error;

    const defaultStore = {
      version: 1,
      secret: DEFAULT_SECRET,
      users: [
        {
          id: "u_dc4c2ebdd3b15aad",
          username: "admin",
          email: "admin@sierrraedge.local",
          name: "Command Administrator",
          role: "admin",
          enabled: true,
          status: "active",
          createdAt: Date.now(),
          seed: true,
          salt: "a59d9fa6c01332bf202e512d55ca76ee",
          iterations: 100000,
          hash: "0626d9aa1577c6781faa9016837bf2aac1a255061071dc2897d15ade9403c4fe",
        },
      ],
    };

    await writeFile(DATA_PATH, `${JSON.stringify(defaultStore, null, 2)}\n`, "utf8");
    return defaultStore;
  }
}

async function writeLegacyUsersStore(store: any) {
  await writeFile(DATA_PATH, `${JSON.stringify(store, null, 2)}\n`, "utf8");
}

async function readUsersStore() {
  const pgConfig = getPostgresConfig();

  if (pgConfig.enabled) {
    const client = new Client({
      host: pgConfig.host,
      port: pgConfig.port,
      database: pgConfig.database,
      user: pgConfig.user,
      password: pgConfig.password,
      ssl: process.env.POSTGRES_SSL === "true" ? { rejectUnauthorized: false } : undefined,
    });

    try {
      await client.connect();
      await client.query(`
        CREATE TABLE IF NOT EXISTS app_meta (
          key TEXT PRIMARY KEY,
          value TEXT NOT NULL
        );
      `);
      await client.query(`
        CREATE TABLE IF NOT EXISTS app_users (
          id TEXT PRIMARY KEY,
          payload JSONB NOT NULL
        );
      `);

      const secretRow = await client.query("SELECT value FROM app_meta WHERE key = 'secret' LIMIT 1");
      const userRows = await client.query("SELECT payload FROM app_users ORDER BY id");
      const users = userRows.rows.map((row) => row.payload as Record<string, any>);
      const secret = String(secretRow.rows[0]?.value ?? DEFAULT_SECRET);

      if (!userRows.rowCount) {
        const legacyStore = await readLegacyUsersStore();
        await writeUsersStore(legacyStore);
        return legacyStore;
      }

      return { secret, users };
    } catch (error) {
      console.warn("PostgreSQL user store unavailable, falling back to JSON store:", error);
    } finally {
      await client.end().catch(() => undefined);
    }
  }

  return readLegacyUsersStore();
}

async function writeUsersStore(store: any) {
  const pgConfig = getPostgresConfig();

  if (pgConfig.enabled) {
    const client = new Client({
      host: pgConfig.host,
      port: pgConfig.port,
      database: pgConfig.database,
      user: pgConfig.user,
      password: pgConfig.password,
      ssl: process.env.POSTGRES_SSL === "true" ? { rejectUnauthorized: false } : undefined,
    });

    try {
      await client.connect();
      await client.query(`
        CREATE TABLE IF NOT EXISTS app_meta (
          key TEXT PRIMARY KEY,
          value TEXT NOT NULL
        );
      `);
      await client.query(`
        CREATE TABLE IF NOT EXISTS app_users (
          id TEXT PRIMARY KEY,
          payload JSONB NOT NULL
        );
      `);

      await client.query("BEGIN");
      await client.query("DELETE FROM app_users");
      for (const user of store.users ?? []) {
        await client.query("INSERT INTO app_users (id, payload) VALUES ($1, $2)", [user.id, JSON.stringify(user)]);
      }
      await client.query("INSERT INTO app_meta (key, value) VALUES ('secret', $1) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value", [String(store.secret ?? DEFAULT_SECRET)]);
      await client.query("COMMIT");
      return;
    } catch (error) {
      console.error("Unable to persist users in PostgreSQL. Falling back to JSON store.", error);
    } finally {
      await client.end().catch(() => undefined);
    }
  }

  await writeLegacyUsersStore(store);
}

function stripUser(user: any) {
  if (!user) return null;
  const { hash, salt, iterations, inviteToken, inviteTokenHash, ...safe } = user;
  return safe;
}

function hashPassword(password: string, saltHex: string) {
  return pbkdf2Sync(password, Buffer.from(saltHex, "hex"), 100000, 32, "sha256").toString("hex");
}

function createSaltHex() {
  return Buffer.from(
    Array.from({ length: 16 }, () => Math.floor(Math.random() * 256)),
  ).toString("hex");
}

function createInviteToken() {
  return randomBytes(20).toString("hex");
}

function escapeHtml(value: string) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\"/g, "&quot;").replace(/'/g, "&#039;");
}

async function sendInviteEmail(
  address: string,
  name: string,
  inviteUrl: string,
  subject = "SierraEdge invitation — accept access",
  password?: string,
) {
  const host = process.env.EMAIL_HOST;
  const port = Number(process.env.EMAIL_PORT ?? "587");
  const user = process.env.EMAIL_USER;
  const pass = process.env.EMAIL_PASS;
  const fromAddress = process.env.EMAIL_FROM ?? "SierraEdge Command <noreply@localhost>";

  if (!host || !user || !pass) {
    console.info(`[email] SMTP not configured; invite link for ${address}: ${inviteUrl}`);
    return { ok: true, delivered: false, reason: "SMTP not configured" };
  }

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  });

  try {
    const accessPasswordHtml = password
      ? `<p style="margin:0 0 16px;padding:12px 14px;border:1px solid #bae6fd;border-radius:8px;background:#f0f9ff;color:#0f172a;"><strong>Access password:</strong> ${escapeHtml(password)}</p>`
      : "";

    const result = await transporter.sendMail({
      from: fromAddress,
      to: address,
      subject,
      html: `
        <div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;padding:24px;border:1px solid #d9d9d9;border-radius:12px;">
          <h2 style="margin:0 0 12px;color:#0f172a;">Welcome to SierraEdge</h2>
          <p style="margin:0 0 12px;color:#334155;">Hello ${name || "Operator"},</p>
          <p style="margin:0 0 16px;color:#334155;">You have been invited to access the SierraEdge Smart Mannequin System. Please activate your access below, then sign in on the login page using your Gmail address and the access password shown here.</p>
          ${accessPasswordHtml}
          <p style="margin:0 0 20px;"><a href="${inviteUrl}" style="display:inline-block;padding:12px 20px;background:#0ea5e9;color:#fff;text-decoration:none;border-radius:8px;font-weight:bold;">Activate your access</a></p>
          <p style="margin:0;color:#475569;">If the button does not work, use this link: <a href="${inviteUrl}">${inviteUrl}</a></p>
        </div>
      `,
    });

    return { ok: true, delivered: Boolean(result.accepted?.length), messageId: result.messageId };
  } catch (error) {
    const message = error instanceof Error ? error.message : "SMTP send failed";
    console.error(`[email] SMTP failure for ${address}: ${message}`);
    return { ok: false, delivered: false, reason: "SMTP send failed", error: message };
  }
}

async function getSessionUser(request: Request) {
  const store = await readUsersStore();
  const token = getCookieValue(request, "se_session");
  if (!token) return null;

  const [payloadPart, sig] = String(token).split(".");
  if (!payloadPart || !sig) return null;

  const expectedSig = createHmac("sha256", store.secret ?? "").update(payloadPart).digest("hex");
  if (expectedSig !== sig) return null;

  try {
    const payload = JSON.parse(base64UrlDecode(payloadPart)) as { uid?: string };
    if (!payload.uid) return null;
    return (store.users ?? []).find((user) => user.id === payload.uid) ?? null;
  } catch {
    return null;
  }
}

function isSecureRequest(request: Request) {
  const forwardedProto = request.headers.get("x-forwarded-proto") ?? "";
  const urlProtocol = new URL(request.url).protocol;
  return forwardedProto === "https" || urlProtocol === "https:";
}

function getAppOrigin(request: Request) {
  const configured = process.env.APP_BASE_URL?.trim();
  if (configured) {
    return new URL(configured).origin;
  }
  return new URL(request.url).origin;
}

// Private / link-local address check — keeps the device proxy from being abused
// as an SSRF gateway to arbitrary hosts on the internet.
function isPrivateDeviceHost(hostname: string) {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (!host) return false;
  if (host === "localhost") return true;

  const ipv4 = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (ipv4) {
    const a = Number(ipv4[1]);
    const b = Number(ipv4[2]);
    if (a === 10 || a === 127) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 169 && b === 254) return true;
    return false;
  }

  // mDNS names and bare LAN hostnames (e.g. "esp32.local", "mannequin").
  if (host.endsWith(".local")) return true;
  if (!host.includes(".")) return true;
  return false;
}

/**
 * Device proxy: the browser (on the https dashboard) asks this same-origin
 * endpoint, and the server — which sits on the rig's LAN — fetches
 * `GET http://<esp32-ip>/data` and relays the JSON. This sidesteps the browser's
 * mixed-content block while preserving the proven polling contract.
 */
async function handleDeviceApi(request: Request) {
  const url = new URL(request.url);
  if (url.pathname !== "/api/device/data") return null;

  if (request.method !== "GET") {
    return jsonResponse({ ok: false, error: "Method not allowed" }, { status: 405 });
  }

  const currentUser = await getSessionUser(request);
  if (!currentUser) {
    return jsonResponse({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  let target: URL;
  try {
    target = new URL(normalizeEsp32Host(url.searchParams.get("ip") ?? ""));
  } catch {
    return jsonResponse({ ok: false, error: "Invalid device address" }, { status: 400 });
  }

  if (target.protocol !== "http:") {
    return jsonResponse({ ok: false, error: "Device address must use http" }, { status: 400 });
  }
  if (!isPrivateDeviceHost(target.hostname)) {
    return jsonResponse({ ok: false, error: "Device address must be on the local network" }, { status: 400 });
  }

  target.pathname = "/data";
  target.search = "";

  try {
    const deviceResponse = await fetch(target.toString(), {
      cache: "no-store",
      signal: AbortSignal.timeout(4000),
    });
    const body = await deviceResponse.text();
    return new Response(body, {
      status: deviceResponse.status,
      headers: {
        "content-type": deviceResponse.headers.get("content-type") ?? "application/json; charset=utf-8",
        "cache-control": "no-store",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Device unreachable";
    return jsonResponse({ ok: false, error: message }, { status: 504 });
  }
}

function appendSetCookieHeader(response: Response, name: string, value: string, options: Record<string, string | number | boolean>) {
  const segments = [`${name}=${value}`, "Path=/", "HttpOnly", "SameSite=Lax"];

  if (options.maxAge !== undefined) segments.push(`Max-Age=${Number(options.maxAge)}`);
  if (options.expires) segments.push(`Expires=${options.expires}`);
  if (options.secure) segments.push("Secure");

  response.headers.append("Set-Cookie", segments.join("; "));
  return response;
}

async function handleAuthApi(request: Request) {
  const url = new URL(request.url);
  const pathname = url.pathname;
  if (!pathname.startsWith("/api/auth/")) {
    return null;
  }

  const action = pathname.replace(/^\/api\/auth\//, "").split("/")[0] || "";
  const isJson = request.headers.get("content-type")?.includes("application/json") ?? false;
  const body = isJson ? await request.json().catch(() => ({})) : {};

  if (action === "login") {
    if (request.method !== "POST") {
      return jsonResponse({ ok: false, error: "Method not allowed" }, { status: 405 });
    }

    const loginValue = String(body.username ?? body.email ?? "").trim();
    const password = String(body.password ?? "");
    const remember = Boolean(body.remember);

    if (!loginValue || !password) {
      return jsonResponse({ ok: false, error: "Missing credentials" }, { status: 400 });
    }

    const store = await readUsersStore();
    const normalizedLogin = normalizeEmail(loginValue);
    const user = (store.users ?? []).find((candidate) => {
      const usernameMatch = (candidate.username || "").toLowerCase() === loginValue.toLowerCase();
      const emailMatch = normalizeEmail(String(candidate.email ?? "")) === normalizedLogin;
      return usernameMatch || emailMatch;
    });

    if (!user) {
      return jsonResponse({ ok: false, error: "User not found" }, { status: 404 });
    }

    if (user.status && ["disabled", "deleted", "invited"].includes(user.status)) {
      return jsonResponse(
        {
          ok: false,
          error:
            user.status === "deleted"
              ? "This account has been deleted and cannot access the system."
              : user.status === "invited"
                ? "This account is waiting for invitation approval."
                : "This account is currently disabled and cannot access the system.",
        },
        { status: 403 },
      );
    }

    if (!user.enabled) {
      return jsonResponse({ ok: false, error: "This account is currently disabled and cannot access the system." }, { status: 403 });
    }

    const salt = Buffer.from(String(user.salt ?? ""), "hex");
    const iterations = Number(user.iterations ?? 100000);
    const keylen = Number((String(user.hash ?? "").length / 2) || 32);
    const derived = pbkdf2Sync(password, salt, iterations, keylen, "sha256").toString("hex");

    if (derived !== String(user.hash ?? "")) {
      return jsonResponse({ ok: false, error: "Invalid email or password" }, { status: 401 });
    }

    const payload = { uid: user.id, iat: Date.now() };
    const payloadStr = JSON.stringify(payload);
    const payloadPart = base64UrlEncode(payloadStr);
    const sig = createHmac("sha256", store.secret ?? "").update(payloadPart).digest("hex");
    const token = `${payloadPart}.${sig}`;

    const response = jsonResponse({
      ok: true,
      user: { id: user.id, username: user.username, email: user.email, name: user.name, role: user.role },
    });
    appendSetCookieHeader(response, "se_session", token, {
      maxAge: remember ? 60 * 60 * 24 * 30 : 60 * 60 * 8,
      secure: isSecureRequest(request),
    });
    return response;
  }

  if (action === "request-magic-link") {
    if (request.method !== "POST") {
      return jsonResponse({ ok: false, error: "Method not allowed" }, { status: 405 });
    }

    const email = normalizeEmail(String(body.email ?? ""));
    if (!email || !isValidEmail(email)) {
      return jsonResponse({ ok: false, error: "A valid Gmail address is required" }, { status: 400 });
    }

    const store = await readUsersStore();
    const target = (store.users ?? []).find((candidate) => normalizeEmail(String(candidate.email ?? "")) === email);
    if (!target) {
      return jsonResponse({ ok: false, error: "This Gmail is not on the approved access list" }, { status: 404 });
    }

    if (!target.enabled && target.status !== "invited") {
      return jsonResponse({ ok: false, error: "This account is not active yet" }, { status: 403 });
    }

    const inviteToken = createInviteToken();
    target.inviteToken = inviteToken;
    target.inviteTokenHash = createHmac("sha256", store.secret ?? "").update(inviteToken).digest("hex");
    target.inviteExpiresAt = Date.now() + 1000 * 60 * 60 * 24;

    await writeUsersStore(store);

    const inviteUrl = createInviteUrl(getAppOrigin(request), inviteToken);
    const emailRes = await sendInviteEmail(
      email,
      target.name || "Operator",
      inviteUrl,
      "SierraEdge sign-in — continue to the workspace",
    );

    if (!emailRes.ok || !emailRes.delivered) {
      return jsonResponse(
        {
          ok: false,
          error: getInviteDeliveryMessage(emailRes),
          email: emailRes,
          inviteUrl,
        },
        { status: 502 },
      );
    }

    return jsonResponse({ ok: true, email: emailRes, inviteUrl });
  }

  if (action === "accept-invite") {
    if (request.method !== "POST") {
      return jsonResponse({ ok: false, error: "Method not allowed" }, { status: 405 });
    }

    const token = String(body.token ?? "").trim();
    const password = String(body.password ?? "");
    if (!token) {
      return jsonResponse({ ok: false, error: "Invitation token is required" }, { status: 400 });
    }

    const store = await readUsersStore();
    const target = (store.users ?? []).find((candidate) => {
      if (!candidate.inviteTokenHash || !candidate.inviteToken) return false;
      const expectedHash = createHmac("sha256", store.secret ?? "").update(String(candidate.inviteToken)).digest("hex");
      return expectedHash === candidate.inviteTokenHash && expectedHash === createHmac("sha256", store.secret ?? "").update(token).digest("hex");
    });

    if (!target) {
      return jsonResponse({ ok: false, error: "Invitation token is invalid or expired" }, { status: 400 });
    }

    if (!target.inviteToken || Number(target.inviteExpiresAt ?? 0) <= Date.now()) {
      return jsonResponse({ ok: false, error: "Invitation token is invalid or expired" }, { status: 400 });
    }

    if (password) {
      const salt = createSaltHex();
      target.salt = salt;
      target.hash = hashPassword(password, salt);
    }

    target.enabled = true;
    target.status = "active";
    target.acceptedAt = Date.now();
    delete target.inviteToken;
    delete target.inviteTokenHash;
    delete target.inviteExpiresAt;

    await writeUsersStore(store);

    // Activate the account but do NOT create a session here. Invitees are sent
    // to the login screen and must authenticate with their email and the access
    // password from the invitation email.
    return jsonResponse({ ok: true, user: stripUser(target), requiresLogin: true });
  }

  if (action === "me") {
    if (request.method !== "GET") {
      return jsonResponse({ ok: false, error: "Method not allowed" }, { status: 405 });
    }

    const user = await getSessionUser(request);
    if (!user) {
      return jsonResponse({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    return jsonResponse({ ok: true, user: { id: user.id, username: user.username, name: user.name, role: user.role } });
  }

  if (action === "logout") {
    if (request.method !== "POST") {
      return jsonResponse({ ok: false, error: "Method not allowed" }, { status: 405 });
    }
    const response = jsonResponse({ ok: true });
    appendSetCookieHeader(response, "se_session", "", { maxAge: 0, secure: isSecureRequest(request) });
    return response;
  }

  if (action === "users") {
    const store = await readUsersStore();
    const currentUser = await getSessionUser(request);

    if (request.method === "GET") {
      if (!currentUser || currentUser.role !== "admin") {
        return jsonResponse({ ok: false, error: "Forbidden" }, { status: 403 });
      }
      return jsonResponse({ ok: true, users: (store.users ?? []).map((user) => stripUser(user)) });
    }

    if (request.method !== "POST") {
      return jsonResponse({ ok: false, error: "Method not allowed" }, { status: 405 });
    }

    const actionName = String(body.action ?? "profile");

    if (actionName === "profile") {
      if (!currentUser) {
        return jsonResponse({ ok: false, error: "Unauthorized" }, { status: 401 });
      }

      const username = String(body.username ?? currentUser.username).trim();
      const name = String(body.name ?? currentUser.name).trim();
      const password = body.password ? String(body.password) : "";

      if (!username || !name) {
        return jsonResponse({ ok: false, error: "Username and full name are required" }, { status: 400 });
      }

      const targetUser = (store.users ?? []).find((user) => user.id === currentUser.id);
      if (!targetUser) {
        return jsonResponse({ ok: false, error: "User not found" }, { status: 404 });
      }

      targetUser.username = username;
      targetUser.name = name;
      if (password) {
        targetUser.salt = createSaltHex();
        targetUser.hash = hashPassword(password, targetUser.salt);
      }

      await writeUsersStore(store);
      return jsonResponse({ ok: true, user: stripUser(targetUser) });
    }

    if (actionName === "create") {
      if (!currentUser || currentUser.role !== "admin") {
        return jsonResponse({ ok: false, error: "Forbidden" }, { status: 403 });
      }

      const username = String(body.username ?? "").trim();
      const name = String(body.name ?? "").trim();
      const email = normalizeEmail(String(body.email ?? ""));
      const role = body.role === "admin" ? "admin" : "user";
      const password = String(body.password ?? "");

      if (!name || !email || !password) {
        return jsonResponse({ ok: false, error: "Name, email and password are required" }, { status: 400 });
      }

      if (!isValidEmail(email)) {
        return jsonResponse({ ok: false, error: "A valid email address is required" }, { status: 400 });
      }

      const collidingUsername = String(username || makeUniqueUsername(email));
      if ((store.users ?? []).some((user) => (user.email ? normalizeEmail(user.email) : "") === email || (user.username || "").toLowerCase() === collidingUsername.toLowerCase())) {
        return jsonResponse({ ok: false, error: "User already exists" }, { status: 409 });
      }

      const salt = createSaltHex();
      const newUser = {
        id: `u_${Math.random().toString(36).slice(2, 10)}`,
        username: collidingUsername,
        email,
        name,
        role,
        enabled: true,
        status: "active",
        createdAt: Date.now(),
        salt,
        iterations: 100000,
        hash: hashPassword(password, salt),
      };

      store.users = [...(store.users ?? []), newUser];
      await writeUsersStore(store);
      return jsonResponse({ ok: true, user: stripUser(newUser) });
    }

    if (actionName === "invite") {
      if (!currentUser || currentUser.role !== "admin") {
        return jsonResponse({ ok: false, error: "Forbidden" }, { status: 403 });
      }

      const email = normalizeEmail(String(body.email ?? ""));
      const name = String(body.name ?? "").trim();
      const role = body.role === "admin" ? "admin" : "user";
      const password = String(body.password ?? "").trim();

      if (!email || !name || !password) {
        return jsonResponse(
          { ok: false, error: "Name, a valid Gmail address and an access password are required" },
          { status: 400 },
        );
      }

      if (!isValidEmail(email)) {
        return jsonResponse({ ok: false, error: "A valid email address is required" }, { status: 400 });
      }

      if ((store.users ?? []).some((user) => normalizeEmail(String(user.email ?? "")) === email)) {
        return jsonResponse({ ok: false, error: "This email is already invited or active" }, { status: 409 });
      }

      const username = makeUniqueUsername(email);
      const inviteToken = createInviteToken();
      const salt = password ? createSaltHex() : undefined;
      const inviteUser = {
        id: `u_${Math.random().toString(36).slice(2, 10)}`,
        username,
        email,
        name,
        role,
        enabled: false,
        status: "invited",
        invitedBy: currentUser.id,
        invitedAt: Date.now(),
        inviteToken,
        inviteTokenHash: createHmac("sha256", store.secret ?? "").update(inviteToken).digest("hex"),
        inviteExpiresAt: Date.now() + 1000 * 60 * 60 * 24 * 7,
        createdAt: Date.now(),
        ...(salt
          ? {
              salt,
              iterations: 100000,
              hash: hashPassword(password, salt),
            }
          : {}),
      };

      store.users = [...(store.users ?? []), inviteUser];
      await writeUsersStore(store);

      const inviteUrl = `${getAppOrigin(request)}/accept-invite?token=${encodeURIComponent(inviteToken)}`;
      const emailRes = await sendInviteEmail(email, name, inviteUrl, "SierraEdge invitation — accept access", password || undefined);

      if (!emailRes.ok || !emailRes.delivered) {
        return jsonResponse(
          {
            ok: false,
            error: getInviteDeliveryMessage(emailRes),
            user: stripUser(inviteUser),
            email: emailRes,
            inviteUrl,
          },
          { status: 502 },
        );
      }

      return jsonResponse({
        ok: true,
        user: stripUser(inviteUser),
        email: emailRes,
        inviteUrl,
      });
    }

    if (actionName === "update") {
      if (!currentUser || currentUser.role !== "admin") {
        return jsonResponse({ ok: false, error: "Forbidden" }, { status: 403 });
      }

      const targetId = String(body.id ?? "");
      const targetUser = (store.users ?? []).find((user) => user.id === targetId);
      if (!targetUser) {
        return jsonResponse({ ok: false, error: "User not found" }, { status: 404 });
      }

      if (body.username) targetUser.username = String(body.username).trim();
      if (body.name) targetUser.name = String(body.name).trim();
      if (body.role) targetUser.role = body.role === "admin" ? "admin" : "user";
      if (typeof body.password === "string" && body.password.trim()) {
        targetUser.salt = createSaltHex();
        targetUser.hash = hashPassword(String(body.password).trim(), targetUser.salt);
      }
      if (typeof body.status === "string") {
        const normalizedStatus = body.status.toLowerCase();
        if (["active", "disabled", "deleted", "invited"].includes(normalizedStatus)) {
          targetUser.status = normalizedStatus;
          targetUser.enabled = normalizedStatus === "active";
        }
      }
      if (typeof body.enabled === "boolean") {
        targetUser.enabled = Boolean(body.enabled);
        targetUser.status = targetUser.enabled ? (targetUser.status === "deleted" ? "disabled" : "active") : "disabled";
      }

      await writeUsersStore(store);
      return jsonResponse({ ok: true, user: stripUser(targetUser) });
    }

    if (actionName === "delete") {
      if (!currentUser || currentUser.role !== "admin") {
        return jsonResponse({ ok: false, error: "Forbidden" }, { status: 403 });
      }

      const targetId = String(body.id ?? "");
      const targetUser = (store.users ?? []).find((user) => user.id === targetId);
      if (!targetUser) {
        return jsonResponse({ ok: false, error: "User not found" }, { status: 404 });
      }

      if (targetUser.id === currentUser.id) {
        return jsonResponse({ ok: false, error: "You cannot delete your own account." }, { status: 400 });
      }

      const remainingAdmins = (store.users ?? []).filter(
        (user) =>
          user.id !== targetUser.id &&
          user.role === "admin" &&
          user.status !== "deleted" &&
          user.enabled !== false,
      );
      if (targetUser.role === "admin" && remainingAdmins.length === 0) {
        return jsonResponse({ ok: false, error: "At least one admin must remain." }, { status: 400 });
      }

      store.users = (store.users ?? []).filter((user) => user.id !== targetUser.id);
      await writeUsersStore(store);
      return jsonResponse({ ok: true, user: stripUser(targetUser) });
    }

    return jsonResponse({ ok: false, error: "Unsupported action" }, { status: 400 });
  }

  return jsonResponse({ ok: false, error: "Not found" }, { status: 404 });
}

let serverEntryPromise: Promise<ServerEntry> | undefined;

async function getServerEntry(): Promise<ServerEntry> {
  if (!serverEntryPromise) {
    serverEntryPromise = import("@tanstack/react-start/server-entry").then(
      (m) => (m.default ?? m) as ServerEntry,
    );
  }
  return serverEntryPromise;
}

// h3 swallows in-handler throws into a normal 500 Response with body
// {"unhandled":true,"message":"HTTPError"} — try/catch alone never fires for those.
async function normalizeCatastrophicSsrResponse(response: Response): Promise<Response> {
  if (response.status < 500) return response;
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) return response;

  const body = await response.clone().text();
  if (!isH3SwallowedErrorBody(body)) return response;

  console.error(consumeLastCapturedError() ?? new Error(`h3 swallowed SSR error: ${body}`));
  return new Response(renderErrorPage(), {
    status: 500,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

function isH3SwallowedErrorBody(body: string): boolean {
  try {
    const payload = JSON.parse(body) as { unhandled?: unknown; message?: unknown };
    return payload.unhandled === true && payload.message === "HTTPError";
  } catch {
    return false;
  }
}

export default {
  async fetch(request: Request, env: unknown, ctx: unknown) {
    try {
      const deviceResponse = await handleDeviceApi(request);
      if (deviceResponse) {
        return deviceResponse;
      }

      const authResponse = await handleAuthApi(request);
      if (authResponse) {
        return authResponse;
      }

      const handler = await getServerEntry();
      const response = await handler.fetch(request, env, ctx);
      return await normalizeCatastrophicSsrResponse(response);
    } catch (error) {
      console.error(error);
      return new Response(renderErrorPage(), {
        status: 500,
        headers: { "content-type": "text/html; charset=utf-8" },
      });
    }
  },
};

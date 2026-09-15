import "./lib/error-capture";

import { createHmac, pbkdf2Sync } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { consumeLastCapturedError } from "./lib/error-capture";
import { renderErrorPage } from "./lib/error-page";

type ServerEntry = {
  fetch: (request: Request, env: unknown, ctx: unknown) => Promise<Response> | Response;
};

const DATA_PATH = join(process.cwd(), ".data", "users.json");

function base64UrlEncode(value: string) {
  return Buffer.from(value).toString("base64").replace(/=+$/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

function base64UrlDecode(value: string) {
  const pad = value.length % 4;
  const normalized = pad === 0 ? value : value + "=".repeat(4 - pad);
  return Buffer.from(normalized.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8");
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

async function readUsersStore() {
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
      secret: "a5108f88f8057173a0ec723d682f7bd9d32a02bdd9468f653c743340b38486d1",
      users: [
        {
          id: "u_dc4c2ebdd3b15aad",
          username: "admin",
          name: "Command Administrator",
          role: "admin",
          enabled: true,
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

async function writeUsersStore(store: any) {
  await writeFile(DATA_PATH, `${JSON.stringify(store, null, 2)}\n`, "utf8");
}

function stripUser(user: any) {
  if (!user) return null;
  const { hash, salt, iterations, ...safe } = user;
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

    const username = String(body.username ?? "").trim();
    const password = String(body.password ?? "");
    const remember = Boolean(body.remember);

    if (!username || !password) {
      return jsonResponse({ ok: false, error: "Missing credentials" }, { status: 400 });
    }

    const store = await readUsersStore();
    const user = (store.users ?? []).find(
      (candidate) => (candidate.username || "").toLowerCase() === username.toLowerCase(),
    );

    if (!user || !user.enabled) {
      return jsonResponse({ ok: false, error: "Invalid username or password" }, { status: 401 });
    }

    const salt = Buffer.from(String(user.salt ?? ""), "hex");
    const iterations = Number(user.iterations ?? 100000);
    const keylen = Number((String(user.hash ?? "").length / 2) || 32);
    const derived = pbkdf2Sync(password, salt, iterations, keylen, "sha256").toString("hex");

    if (derived !== String(user.hash ?? "")) {
      return jsonResponse({ ok: false, error: "Invalid username or password" }, { status: 401 });
    }

    const payload = { uid: user.id, iat: Date.now() };
    const payloadStr = JSON.stringify(payload);
    const payloadPart = base64UrlEncode(payloadStr);
    const sig = createHmac("sha256", store.secret ?? "").update(payloadPart).digest("hex");
    const token = `${payloadPart}.${sig}`;

    const response = jsonResponse({ ok: true, user: { id: user.id, username: user.username, name: user.name, role: user.role } });
    appendSetCookieHeader(response, "se_session", token, {
      maxAge: remember ? 60 * 60 * 24 * 30 : 60 * 60 * 8,
      secure: isSecureRequest(request),
    });
    return response;
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
      const role = body.role === "admin" ? "admin" : "user";
      const password = String(body.password ?? "");

      if (!username || !name || !password) {
        return jsonResponse({ ok: false, error: "Username, name and password are required" }, { status: 400 });
      }

      if ((store.users ?? []).some((user) => (user.username || "").toLowerCase() === username.toLowerCase())) {
        return jsonResponse({ ok: false, error: "Username already exists" }, { status: 409 });
      }

      const salt = createSaltHex();
      const newUser = {
        id: `u_${Math.random().toString(36).slice(2, 10)}`,
        username,
        name,
        role,
        enabled: true,
        createdAt: Date.now(),
        salt,
        iterations: 100000,
        hash: hashPassword(password, salt),
      };

      store.users = [...(store.users ?? []), newUser];
      await writeUsersStore(store);
      return jsonResponse({ ok: true, user: stripUser(newUser) });
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
      if (body.password) {
        targetUser.salt = createSaltHex();
        targetUser.hash = hashPassword(String(body.password), targetUser.salt);
      }

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

import { getCookie, readBody, setCookie } from "h3";
import { createHmac, pbkdf2Sync } from "crypto";
import { promises as fs } from "fs";
import { join } from "path";

const DATA_PATH = join(process.cwd(), ".data", "users.json");

function base64UrlEncode(value: string) {
  return Buffer.from(value).toString("base64").replace(/=+$/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

function base64UrlDecode(value: string) {
  const pad = value.length % 4;
  const normalized = pad === 0 ? value : value + "=".repeat(4 - pad);
  return Buffer.from(normalized.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8");
}

async function readUsersStore() {
  const raw = await fs.readFile(DATA_PATH, "utf8");
  return JSON.parse(raw) as { secret?: string; users?: Array<Record<string, any>> };
}

async function writeUsersStore(store: any) {
  await fs.writeFile(DATA_PATH, JSON.stringify(store, null, 2) + "\n", "utf8");
}

function stripUser(user: any) {
  if (!user) return null;
  const { hash, salt, iterations, ...safe } = user;
  return safe;
}

function hashPassword(password: string, saltHex: string) {
  const salt = Buffer.from(saltHex, "hex");
  return pbkdf2Sync(password, salt, 100000, 32, "sha256").toString("hex");
}

function createSaltHex() {
  return Buffer.from(Array.from({ length: 16 }, () => Math.floor(Math.random() * 256))).toString("hex");
}

function getRequestUser(event: any) {
  const token = getCookie(event, "se_session");
  if (!token) return null;
  return token;
}

async function getSessionUser(event: any) {
  const token = getRequestUser(event);
  if (!token) return null;
  const store = await readUsersStore();
  const [payloadPart, sig] = String(token).split(".");
  if (!payloadPart || !sig) return null;
  const expectedSig = createHmac("sha256", store.secret ?? "").update(payloadPart).digest("hex");
  if (expectedSig !== sig) return null;

  try {
    const payload = JSON.parse(base64UrlDecode(payloadPart)) as { uid?: string };
    if (!payload.uid) return null;
    return (store.users ?? []).find((u) => u.id === payload.uid) ?? null;
  } catch {
    return null;
  }
}

async function ensureAdmin(event: any) {
  const user = await getSessionUser(event);
  if (!user || user.role !== "admin") {
    return null;
  }
  return user;
}

export default async function (event: any) {
  const method = event.method ?? "GET";
  const body = await readBody(event).catch(() => ({}));
  const currentUser = await getSessionUser(event);
  const store = await readUsersStore();

  if (method === "GET") {
    const admin = await ensureAdmin(event);
    if (!admin) {
      return { ok: false, error: "Forbidden" };
    }
    return {
      ok: true,
      users: (store.users ?? []).map((u) => stripUser(u)),
    };
  }

  if (method !== "POST") {
    return { ok: false, error: "Unsupported method" };
  }

  const action = body.action ?? "profile";

  if (action === "profile") {
    if (!currentUser) {
      return { ok: false, error: "Unauthorized" };
    }

    const username = String(body.username ?? currentUser.username).trim();
    const name = String(body.name ?? currentUser.name).trim();
    const password = body.password ? String(body.password) : "";

    if (!username || !name) {
      return { ok: false, error: "Username and full name are required" };
    }

    const targetUser = (store.users ?? []).find((u) => u.id === currentUser.id);
    if (!targetUser) {
      return { ok: false, error: "User not found" };
    }

    targetUser.username = username;
    targetUser.name = name;
    if (password) {
      targetUser.salt = createSaltHex();
      targetUser.hash = hashPassword(password, targetUser.salt);
    }

    await writeUsersStore(store);
    return { ok: true, user: stripUser(targetUser) };
  }

  if (action === "create") {
    const admin = await ensureAdmin(event);
    if (!admin) {
      return { ok: false, error: "Forbidden" };
    }

    const username = String(body.username ?? "").trim();
    const name = String(body.name ?? "").trim();
    const role = body.role === "admin" ? "admin" : "user";
    const password = String(body.password ?? "");

    if (!username || !name || !password) {
      return { ok: false, error: "Username, name and password are required" };
    }

    if ((store.users ?? []).some((u) => (u.username || "").toLowerCase() === username.toLowerCase())) {
      return { ok: false, error: "Username already exists" };
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
    return { ok: true, user: stripUser(newUser) };
  }

  if (action === "update") {
    const admin = await ensureAdmin(event);
    if (!admin) {
      return { ok: false, error: "Forbidden" };
    }

    const targetId = String(body.id ?? "");
    const targetUser = (store.users ?? []).find((u) => u.id === targetId);
    if (!targetUser) {
      return { ok: false, error: "User not found" };
    }

    if (body.username) targetUser.username = String(body.username).trim();
    if (body.name) targetUser.name = String(body.name).trim();
    if (body.role) targetUser.role = body.role === "admin" ? "admin" : "user";
    if (body.password) {
      targetUser.salt = createSaltHex();
      targetUser.hash = hashPassword(String(body.password), targetUser.salt);
    }

    await writeUsersStore(store);
    return { ok: true, user: stripUser(targetUser) };
  }

  return { ok: false, error: "Unsupported action" };
}

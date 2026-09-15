import { readBody, setCookie } from "h3";
import { pbkdf2Sync, createHmac } from "crypto";
import { promises as fs } from "fs";
import { join } from "path";

function base64url(input: string) {
  return Buffer.from(input).toString("base64").replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

export default async function (event: any) {
  const body = await readBody(event).catch(() => ({}));
  const { username, password, remember } = body ?? {};

  if (!username || !password) {
    return { ok: false, error: "Missing credentials" };
  }

  const dataPath = join(process.cwd(), ".data", "users.json");
  let storeRaw: string;
  try {
    storeRaw = await fs.readFile(dataPath, "utf8");
  } catch (err) {
    return { ok: false, error: "Auth store unavailable" };
  }

  let store: any;
  try {
    store = JSON.parse(storeRaw);
  } catch (err) {
    return { ok: false, error: "Malformed auth store" };
  }

  const user = (store.users || []).find((u: any) => (u.username || "").toLowerCase() === String(username).toLowerCase());
  if (!user || !user.enabled) {
    return { ok: false, error: "Invalid username or password" };
  }

  const salt = Buffer.from(user.salt, "hex");
  const iterations = user.iterations || 100000;
  const keylen = (user.hash || "").length / 2 || 32;

  const derived = pbkdf2Sync(String(password), salt, iterations, keylen, "sha256").toString("hex");
  if (!derived || derived !== user.hash) {
    return { ok: false, error: "Invalid username or password" };
  }

  // create a simple signed session token
  const payload = { uid: user.id, iat: Date.now() };
  const payloadStr = JSON.stringify(payload);
  const payloadPart = base64url(payloadStr);
  const secret = store.secret || "";
  const sig = createHmac("sha256", secret).update(payloadPart).digest("hex");
  const token = `${payloadPart}.${sig}`;

  // set cookie
  const isSecure = (event.node?.req.headers["x-forwarded-proto"] ?? "http") === "https";
  setCookie(event, "se_session", token, {
    httpOnly: true,
    secure: isSecure,
    sameSite: "lax",
    path: "/",
    maxAge: remember ? 60 * 60 * 24 * 30 : 60 * 60 * 8,
  });

  return { ok: true, user: { id: user.id, username: user.username, name: user.name, role: user.role } };
}

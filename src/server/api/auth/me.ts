import { getCookie } from "h3";
import { createHmac } from "crypto";
import { promises as fs } from "fs";
import { join } from "path";

function base64UrlDecode(value: string) {
  const pad = value.length % 4;
  const normalized = pad === 0 ? value : value + "=".repeat(4 - pad);
  return Buffer.from(normalized.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8");
}

async function readUsersStore() {
  const dataPath = join(process.cwd(), ".data", "users.json");
  const raw = await fs.readFile(dataPath, "utf8");
  return JSON.parse(raw) as { secret?: string; users?: Array<Record<string, any>> };
}

async function getSessionUser(event: any) {
  const store = await readUsersStore();
  const token = getCookie(event, "se_session");
  if (!token) return null;
  const [payloadPart, sig] = String(token).split(".");
  if (!payloadPart || !sig) return null;
  const expectedSig = createHmac("sha256", store.secret ?? "").update(payloadPart).digest("hex");
  if (expectedSig !== sig) return null;

  try {
    const payload = JSON.parse(base64UrlDecode(payloadPart)) as { uid?: string };
    return (store.users ?? []).find((u) => u.id === payload.uid) ?? null;
  } catch {
    return null;
  }
}

export default async function (event: any) {
  try {
    const user = await getSessionUser(event);
    if (!user) {
      return { ok: false, error: "Unauthorized" };
    }
    return {
      ok: true,
      user: {
        id: user.id,
        username: user.username,
        name: user.name,
        role: user.role,
      },
    };
  } catch {
    return { ok: false, error: "Unauthorized" };
  }
}

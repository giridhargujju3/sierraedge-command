import { setCookie } from "h3";

export default async function (event: any) {
  const isSecure = (event.node?.req.headers["x-forwarded-proto"] ?? "http") === "https";
  setCookie(event, "se_session", "", {
    httpOnly: true,
    secure: isSecure,
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });

  return { ok: true };
}

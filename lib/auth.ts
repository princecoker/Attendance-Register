import { createHmac, timingSafeEqual, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
export const cookieName = "attendance_session";
export function configured() {
  return Boolean(
    process.env.ADMIN_PASSWORD &&
    process.env.SESSION_SECRET &&
    process.env.SESSION_SECRET.length >= 32,
  );
}
export function equals(a: string, b: string) {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}
export function token() {
  const payload = `${Date.now() + 8 * 60 * 60 * 1000}.${randomBytes(16).toString("hex")}`;
  return (
    payload +
    "." +
    createHmac("sha256", process.env.SESSION_SECRET!)
      .update(payload)
      .digest("hex")
  );
}
export async function authenticated() {
  if (!configured()) return false;
  const value = (await cookies()).get(cookieName)?.value;
  if (!value) return false;
  const [expires, nonce, sig] = value.split(".");
  if (!expires || !nonce || !sig || Number(expires) <= Date.now()) return false;
  return equals(
    sig,
    createHmac("sha256", process.env.SESSION_SECRET!)
      .update(`${expires}.${nonce}`)
      .digest("hex"),
  );
}
export function sameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) return false;
  try {
    const parsed = new URL(origin);
    return (
      ["http:", "https:"].includes(parsed.protocol) &&
      parsed.origin === origin &&
      parsed.host === request.headers.get("host")
    );
  } catch {
    return false;
  }
}

import { createHash, createHmac, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";
import { apiJson } from "@/lib/api";

const COOKIE = "saffron_staff";
const TTL_MS = 12 * 60 * 60 * 1000;
const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const LOGIN_LIMIT = 8;

const loginAttempts = new Map<string, { count: number; reset: number }>();

function secret() {
  return process.env.ADMIN_SECRET ?? "";
}

export function adminIsConfigured() {
  return secret().length > 0;
}

export function passwordMatches(input: string, expected: string) {
  const left = createHash("sha256").update(input).digest();
  const right = createHash("sha256").update(expected).digest();
  return timingSafeEqual(left, right);
}

export function loginIsLimited(ip: string) {
  const entry = loginAttempts.get(ip);
  if (!entry || entry.reset < Date.now()) return false;
  return entry.count >= LOGIN_LIMIT;
}

export function recordLoginFailure(ip: string) {
  const now = Date.now();
  const entry = loginAttempts.get(ip);
  if (!entry || entry.reset < now) {
    loginAttempts.set(ip, { count: 1, reset: now + LOGIN_WINDOW_MS });
    return;
  }
  entry.count += 1;
}

export function clearLoginFailures(ip: string) {
  loginAttempts.delete(ip);
}

export function signAdminToken() {
  const key = secret();
  if (!key) throw new Error("ADMIN_SECRET is not set");
  const body = Buffer.from(JSON.stringify({ exp: Date.now() + TTL_MS }), "utf8").toString("base64url");
  const sig = createHmac("sha256", key).update(body).digest("base64url");
  return `${body}.${sig}`;
}

export function verifyAdminToken(token: string | undefined) {
  const key = secret();
  if (!token || !key) return false;
  const [body, sig] = token.split(".");
  if (!body || !sig) return false;
  const expected = createHmac("sha256", key).update(body).digest("base64url");
  const actualBuffer = Buffer.from(sig);
  const expectedBuffer = Buffer.from(expected);
  if (actualBuffer.length !== expectedBuffer.length || !timingSafeEqual(actualBuffer, expectedBuffer)) {
    return false;
  }
  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as { exp?: unknown };
    return typeof payload.exp === "number" && payload.exp > Date.now();
  } catch {
    return false;
  }
}

export async function setAdminCookie(token: string) {
  const jar = await cookies();
  jar.set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: TTL_MS / 1000,
  });
}

export async function clearAdminCookie() {
  const jar = await cookies();
  jar.delete(COOKIE);
}

export async function hasAdminSession() {
  const jar = await cookies();
  return verifyAdminToken(jar.get(COOKIE)?.value);
}

export async function requireAdmin() {
  if (!adminIsConfigured()) {
    return apiJson({ error: "Staff access is not configured." }, 503);
  }
  if (!(await hasAdminSession())) {
    return apiJson({ error: "Sign in required." }, 401);
  }
  return null;
}

export function hashIp(ip: string) {
  const salt = process.env.IP_HASH_SALT || secret() || "saffron-feedback";
  return createHash("sha256").update(`${salt}:${ip}`).digest("hex");
}

import { apiJson, clientIp } from "@/lib/api";
import {
  adminIsConfigured,
  clearLoginFailures,
  loginIsLimited,
  passwordMatches,
  recordLoginFailure,
  setAdminCookie,
  signAdminToken,
} from "@/lib/admin-session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    if (!adminIsConfigured()) {
      return apiJson({ error: "Staff access is not configured." }, 503);
    }

    const ip = clientIp(req);
    if (loginIsLimited(ip)) {
      return apiJson({ error: "Too many sign-in attempts. Try again later." }, 429);
    }

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return apiJson({ error: "Invalid request." }, 400);
    }

    const password =
      body && typeof body === "object" && "password" in body && typeof body.password === "string"
        ? body.password
        : "";

    if (!password) return apiJson({ error: "Enter the staff password." }, 400);

    if (!passwordMatches(password, process.env.ADMIN_SECRET ?? "")) {
      recordLoginFailure(ip);
      return apiJson({ error: "That password is not correct." }, 401);
    }

    clearLoginFailures(ip);
    await setAdminCookie(signAdminToken());
    return apiJson({ ok: true });
  } catch (err) {
    console.error(err);
    return apiJson({ error: "Sign in failed." }, 500);
  }
}

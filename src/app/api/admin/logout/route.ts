import { apiJson } from "@/lib/api";
import { clearAdminCookie } from "@/lib/admin-session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  try {
    await clearAdminCookie();
    return apiJson({ ok: true });
  } catch (err) {
    console.error(err);
    return apiJson({ error: "Sign out failed." }, 500);
  }
}

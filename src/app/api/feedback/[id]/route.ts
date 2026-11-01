import { apiJson } from "@/lib/api";
import { requireAdmin } from "@/lib/admin-session";
import { isFeedbackStatus, MAX_NOTE_LENGTH } from "@/lib/feedback";
import { updateFeedbackStatus } from "@/lib/feedback-store";
import { supabaseConfigured } from "@/lib/supabase-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const denied = await requireAdmin();
    if (denied) return denied;

    if (!supabaseConfigured()) {
      return apiJson({ error: "Database is not configured." }, 503);
    }

    const { id: rawId } = await params;
    const id = Number(rawId);
    if (!Number.isInteger(id) || id <= 0) return apiJson({ error: "Invalid feedback id." }, 400);

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return apiJson({ error: "Invalid request." }, 400);
    }
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return apiJson({ error: "Invalid request." }, 400);
    }

    const record = body as Record<string, unknown>;
    if (typeof record.status !== "string" || !isFeedbackStatus(record.status)) {
      return apiJson({ error: "Status must be open or resolved." }, 400);
    }

    let resolutionNote: string | null = null;
    if (record.resolutionNote != null && record.resolutionNote !== "") {
      if (typeof record.resolutionNote !== "string") {
        return apiJson({ error: "Resolution note must be text." }, 400);
      }
      resolutionNote = record.resolutionNote.replace(/\u0000/g, "").trim().slice(0, MAX_NOTE_LENGTH);
    }

    if (record.status === "resolved" && (!resolutionNote || resolutionNote.length < 3)) {
      return apiJson({ error: "Add a short note about how this was handled." }, 400);
    }

    const updated = await updateFeedbackStatus(id, record.status, resolutionNote);
    if (!updated) return apiJson({ error: "Feedback was not found." }, 404);
    return apiJson(updated);
  } catch (err) {
    console.error(err);
    return apiJson({ error: "Could not update feedback." }, 500);
  }
}

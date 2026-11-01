import { apiJson, clientIp } from "@/lib/api";
import { hashIp, requireAdmin } from "@/lib/admin-session";
import {
  isFeedbackSentiment,
  isFeedbackStatus,
  PAGE_SIZE,
  parseFeedbackBody,
  RATE_WINDOW_MS,
  sentimentForRating,
  submissionTimingError,
} from "@/lib/feedback";
import {
  hasRecentDuplicate,
  insertFeedback,
  listFeedback,
} from "@/lib/feedback-store";
import { isFeedbackLocation } from "@/lib/site";
import { supabaseConfigured } from "@/lib/supabase-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function storageUnavailable() {
  return !supabaseConfigured();
}

function isMissingTable(err: unknown) {
  if (typeof err !== "object" || err === null || !("code" in err)) return false;
  const code = (err as { code?: string }).code;
  return code === "42P01" || code === "PGRST205";
}

function karachiDay(isoDate: string, end: boolean) {
  const suffix = end ? "T23:59:59.999+05:00" : "T00:00:00.000+05:00";
  const date = new Date(`${isoDate}${suffix}`);
  return Number.isNaN(date.getTime()) ? null : date;
}

export async function POST(req: Request) {
  try {
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return apiJson({ error: "Invalid request." }, 400);
    }

    const parsed = parseFeedbackBody(body);
    if (!parsed.ok) return apiJson({ error: parsed.error, field: parsed.field }, 400);
    if (parsed.value.honeypot) return apiJson({ error: "We couldn't submit that. Please try again." }, 400);

    const timingError = submissionTimingError(parsed.value.formStartedAt, Date.now(), Boolean(parsed.value.choice));
    if (timingError) return apiJson({ error: timingError }, 400);

    if (storageUnavailable()) {
      return apiJson({ error: "Feedback is temporarily unavailable. Please tell a staff member." }, 503);
    }

    const ipHash = hashIp(clientIp(req));
    const since = new Date(Date.now() - RATE_WINDOW_MS);
    if (!parsed.value.choice && (await hasRecentDuplicate(ipHash, parsed.value.comment, since))) {
      return apiJson({ error: "This feedback was already received." }, 429);
    }

    const saved = await insertFeedback({
      rating: parsed.value.rating,
      comment: parsed.value.comment,
      customerName: parsed.value.customerName,
      location: parsed.value.location,
      sentiment: sentimentForRating(parsed.value.rating),
      ipHash,
    });

    return apiJson(
      {
        id: saved.id,
        rating: saved.rating,
        customerName: saved.customerName,
        sentiment: saved.sentiment,
      },
      201,
    );
  } catch (err) {
    console.error(err);
    if (isMissingTable(err)) {
      return apiJson({ error: "Feedback is temporarily unavailable. Please tell a staff member." }, 503);
    }
    return apiJson({ error: "We couldn't save your feedback. Please try again." }, 500);
  }
}

export async function GET(req: Request) {
  try {
    const denied = await requireAdmin();
    if (denied) return denied;

    const url = new URL(req.url);
    const ratingParam = url.searchParams.get("rating");
    const locationParam = url.searchParams.get("location");
    const sentimentParam = url.searchParams.get("sentiment");
    const statusParam = url.searchParams.get("status");
    const fromParam = url.searchParams.get("from");
    const toParam = url.searchParams.get("to");
    const pageParam = Number(url.searchParams.get("page") ?? "1");

    let rating: number | undefined;
    if (ratingParam) {
      rating = Number(ratingParam);
      if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
        return apiJson({ error: "Rating filter must be from 1 to 5." }, 400);
      }
    }

    if (locationParam && !isFeedbackLocation(locationParam)) {
      return apiJson({ error: "Unknown location." }, 400);
    }
    if (sentimentParam && !isFeedbackSentiment(sentimentParam)) {
      return apiJson({ error: "Unknown sentiment." }, 400);
    }
    if (statusParam && !isFeedbackStatus(statusParam)) {
      return apiJson({ error: "Unknown status." }, 400);
    }

    const from = fromParam ? karachiDay(fromParam, false) : undefined;
    const to = toParam ? karachiDay(toParam, true) : undefined;
    if (fromParam && !from) return apiJson({ error: "Start date is invalid." }, 400);
    if (toParam && !to) return apiJson({ error: "End date is invalid." }, 400);
    if (from && to && from > to) return apiJson({ error: "Start date must be before the end date." }, 400);

    const page = Number.isInteger(pageParam) && pageParam > 0 ? pageParam : 1;
    if (page > 10000) return apiJson({ error: "Page is out of range." }, 400);

    if (storageUnavailable()) {
      return apiJson({ error: "Database is not configured." }, 503);
    }

    const result = await listFeedback({
      rating,
      location: locationParam ?? undefined,
      sentiment: sentimentParam && isFeedbackSentiment(sentimentParam) ? sentimentParam : undefined,
      status: statusParam && isFeedbackStatus(statusParam) ? statusParam : undefined,
      from: from ?? undefined,
      to: to ?? undefined,
      page,
    });

    return apiJson({ ...result, pageSize: PAGE_SIZE });
  } catch (err) {
    console.error(err);
    if (isMissingTable(err)) {
      return apiJson({ error: "The feedback table is not in the database yet." }, 503);
    }
    return apiJson({ error: "Could not load feedback." }, 500);
  }
}

import {
  defaultFeedbackLocation,
  feedbackLocations,
  isFeedbackLocation,
  type FeedbackLocationId,
} from "@/lib/site";

export const MIN_SUBMIT_MS = 1500;
export const MAX_FORM_AGE_MS = 6 * 60 * 60 * 1000;
export const RATE_WINDOW_MS = 30 * 60 * 1000;
export const MIN_COMMENT_LENGTH = 4;
export const MAX_COMMENT_LENGTH = 2000;
export const MAX_NAME_LENGTH = 80;
export const MAX_NOTE_LENGTH = 1000;
export const PAGE_SIZE = 20;

export type FeedbackSentiment = "positive" | "neutral" | "negative";
export type FeedbackStatus = "open" | "resolved";

export type FeedbackRecord = {
  id: number;
  rating: number;
  comment: string;
  customerName: string | null;
  location: string;
  locationLabel: string;
  sentiment: FeedbackSentiment;
  status: FeedbackStatus;
  resolutionNote: string | null;
  createdAt: string;
  updatedAt: string;
  resolvedAt: string | null;
};

export type FeedbackAnalytics = {
  total: number;
  positive: number;
  neutral: number;
  negative: number;
  averageRating: number | null;
  openComplaints: number;
  resolvedComplaints: number;
};

export type FeedbackFilters = {
  rating?: number;
  location?: string;
  sentiment?: FeedbackSentiment;
  status?: FeedbackStatus;
  from?: Date;
  to?: Date;
  page: number;
};

export type FeedbackChoice = "yes" | "no" | "google";

export type ParsedFeedback = {
  rating: number;
  comment: string;
  customerName: string | null;
  location: FeedbackLocationId;
  honeypot: string;
  formStartedAt: number;
  choice: FeedbackChoice | null;
};

export function sentimentForRating(rating: number): FeedbackSentiment {
  if (rating >= 4) return "positive";
  if (rating === 3) return "neutral";
  return "negative";
}

export function isFeedbackStatus(value: string): value is FeedbackStatus {
  return value === "open" || value === "resolved";
}

export function isFeedbackSentiment(value: string): value is FeedbackSentiment {
  return value === "positive" || value === "neutral" || value === "negative";
}

function cleanComment(value: string) {
  return value.replace(/\u0000/g, "").replace(/\r\n/g, "\n").trim();
}

export function parseFeedbackBody(
  body: unknown,
): { ok: true; value: ParsedFeedback } | { ok: false; error: string; field?: string } {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return { ok: false, error: "Invalid request." };
  }

  const record = body as Record<string, unknown>;
  if (record.choice === "yes" || record.choice === "no" || record.choice === "google") {
    const placed = readLocation(record.location);
    if (!placed.ok) return placed;
    const started = readStartedAt(record.formStartedAt);
    if (!started.ok) return started;
    const choice = record.choice;
    const comment =
      choice === "yes" ? "Clicked Yes" : choice === "no" ? "Clicked No" : "Opened Google review";
    return {
      ok: true,
      value: {
        rating: choice === "no" ? 1 : 5,
        comment,
        customerName: null,
        location: placed.location,
        honeypot: readHoneypot(record.saffron_hp),
        formStartedAt: started.formStartedAt,
        choice,
      },
    };
  }

  const ratingValue = record.rating;
  const rating =
    typeof ratingValue === "number"
      ? ratingValue
      : typeof ratingValue === "string" && /^[1-5]$/.test(ratingValue)
        ? Number(ratingValue)
        : NaN;

  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    return { ok: false, error: "Choose a star rating from 1 to 5.", field: "rating" };
  }

  if (typeof record.comment !== "string") {
    return { ok: false, error: "Tell us about your experience.", field: "comment" };
  }

  const comment = cleanComment(record.comment);
  if (comment.length < MIN_COMMENT_LENGTH) {
    return {
      ok: false,
      error: "Tell us a little more about your experience.",
      field: "comment",
    };
  }
  if (comment.length > MAX_COMMENT_LENGTH) {
    return { ok: false, error: "Please keep your comment under 2,000 characters.", field: "comment" };
  }

  const links = comment.match(/https?:\/\//gi);
  if (links && links.length > 2) {
    return { ok: false, error: "Please remove extra links from your comment.", field: "comment" };
  }

  let customerName: string | null = null;
  if (record.customerName != null && record.customerName !== "") {
    if (typeof record.customerName !== "string") {
      return { ok: false, error: "Name must be text.", field: "customerName" };
    }
    customerName = record.customerName.replace(/[<>]/g, "").replace(/\s+/g, " ").trim().slice(0, MAX_NAME_LENGTH);
    if (!customerName) customerName = null;
  }

  let location: FeedbackLocationId = defaultFeedbackLocation;
  if (typeof record.location === "string" && record.location.trim()) {
    if (!isFeedbackLocation(record.location)) {
      return { ok: false, error: "This feedback code is not recognized.", field: "location" };
    }
    location = record.location;
  }

  if (typeof record.formStartedAt !== "number" || !Number.isFinite(record.formStartedAt)) {
    return { ok: false, error: "Refresh the page and try again.", field: "form" };
  }

  const honeypot = typeof record.saffron_hp === "string" ? record.saffron_hp.trim() : "";

  return {
    ok: true,
    value: {
      rating,
      comment,
      customerName,
      location,
      honeypot,
      formStartedAt: record.formStartedAt,
      choice: null,
    },
  };
}

function readHoneypot(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function readStartedAt(
  value: unknown,
): { ok: true; formStartedAt: number } | { ok: false; error: string; field: string } {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return { ok: false, error: "Refresh the page and try again.", field: "form" };
  }
  return { ok: true, formStartedAt: value };
}

function readLocation(
  value: unknown,
): { ok: true; location: FeedbackLocationId } | { ok: false; error: string; field: string } {
  if (typeof value !== "string" || !value.trim()) return { ok: true, location: defaultFeedbackLocation };
  if (!isFeedbackLocation(value)) {
    return { ok: false, error: "This feedback code is not recognized.", field: "location" };
  }
  return { ok: true, location: value };
}

export function submissionTimingError(formStartedAt: number, now = Date.now(), skipMinimum = false) {
  if (formStartedAt > now + 60_000) return "Refresh the page and try again.";
  if (!skipMinimum && now - formStartedAt < MIN_SUBMIT_MS) {
    return "Please take a moment to review your feedback before submitting.";
  }
  if (now - formStartedAt > MAX_FORM_AGE_MS) return "This form expired. Refresh the page and try again.";
  return null;
}

export function locationIds() {
  return feedbackLocations.map((location) => location.id);
}

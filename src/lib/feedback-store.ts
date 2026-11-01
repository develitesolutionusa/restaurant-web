import {
  PAGE_SIZE,
  type FeedbackAnalytics,
  type FeedbackFilters,
  type FeedbackRecord,
  type FeedbackSentiment,
  type FeedbackStatus,
} from "@/lib/feedback";
import { feedbackLocationLabel } from "@/lib/site";

const columns =
  "id,rating,comment,customer_name,location,sentiment,status,resolution_note,created_at,updated_at,resolved_at";

type FeedbackRow = {
  id: number;
  rating: number;
  comment: string;
  customer_name: string | null;
  location: string;
  sentiment: string;
  status: string;
  resolution_note: string | null;
  created_at: string;
  updated_at: string;
  resolved_at: string | null;
};

type QueryError = { code?: string; message?: string };

function raise(error: QueryError): never {
  const err = new Error(error.message || "Database request failed") as Error & { code?: string };
  err.code = error.code;
  throw err;
}

function iso(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toISOString();
}

function serialize(row: FeedbackRow): FeedbackRecord {
  return {
    id: row.id,
    rating: row.rating,
    comment: row.comment,
    customerName: row.customer_name,
    location: row.location,
    locationLabel: feedbackLocationLabel(row.location),
    sentiment: row.sentiment as FeedbackSentiment,
    status: row.status as FeedbackStatus,
    resolutionNote: row.resolution_note,
    createdAt: iso(row.created_at),
    updatedAt: iso(row.updated_at),
    resolvedAt: row.resolved_at ? iso(row.resolved_at) : null,
  };
}

function eqFilter(value: string | number) {
  if (typeof value === "number") return `eq.${value}`;
  return `eq."${value.replace(/"/g, '""')}"`;
}

function filterQuery(filters: Omit<FeedbackFilters, "page">) {
  const params = new URLSearchParams();
  if (filters.rating) params.append("rating", eqFilter(filters.rating));
  if (filters.location) params.append("location", eqFilter(filters.location));
  if (filters.sentiment) params.append("sentiment", eqFilter(filters.sentiment));
  if (filters.status) params.append("status", eqFilter(filters.status));
  if (filters.from) params.append("created_at", `gte.${filters.from.toISOString()}`);
  if (filters.to) params.append("created_at", `lte.${filters.to.toISOString()}`);
  return params;
}

async function rest(path: string, init: RequestInit = {}) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) throw new Error("Supabase is not configured");

  const headers = new Headers(init.headers);
  headers.set("apikey", key);
  headers.set("Authorization", `Bearer ${key}`);
  if (!headers.has("Content-Type") && init.body) headers.set("Content-Type", "application/json");

  const response = await fetch(`${url}/rest/v1/${path}`, { ...init, headers, cache: "no-store" });
  const text = await response.text();
  let body: unknown = null;
  if (text) {
    try {
      body = JSON.parse(text) as unknown;
    } catch {
      body = text;
    }
  }

  if (!response.ok) {
    const range = response.headers.get("content-range") ?? "";
    if (response.status === 416 && range.endsWith("/0")) {
      return { response, body };
    }
    const record = body && typeof body === "object" ? (body as QueryError) : {};
    raise({ code: record.code, message: record.message || response.statusText });
  }

  return { response, body };
}

async function countRows(filters: URLSearchParams) {
  const params = new URLSearchParams(filters);
  params.set("select", "id");
  const { response } = await rest(`feedback?${params.toString()}`, {
    method: "GET",
    headers: { Prefer: "count=exact", Range: "0-0" },
  });
  const range = response.headers.get("content-range") ?? "";
  const total = Number(range.split("/")[1]);
  if (!Number.isFinite(total)) throw new Error("Could not read feedback count");
  return total;
}

export async function hasRecentDuplicate(ipHash: string, comment: string, since: Date) {
  const params = new URLSearchParams();
  params.set("ip_hash", `eq.${ipHash}`);
  params.set("comment", `eq.${comment}`);
  params.set("created_at", `gte.${since.toISOString()}`);
  return (await countRows(params)) > 0;
}

export async function insertFeedback(values: {
  rating: number;
  comment: string;
  customerName: string | null;
  location: string;
  sentiment: FeedbackSentiment;
  ipHash: string;
}) {
  const { body } = await rest("feedback", {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({
      rating: values.rating,
      comment: values.comment,
      customer_name: values.customerName,
      location: values.location,
      sentiment: values.sentiment,
      status: "open",
      ip_hash: values.ipHash,
    }),
  });

  const row = Array.isArray(body) ? body[0] : body;
  if (!row || typeof row !== "object") throw new Error("Feedback insert returned no row");
  return serialize(row as FeedbackRow);
}

export async function listFeedback(filters: FeedbackFilters) {
  const base = filterQuery(filters);
  const positive = new URLSearchParams(base);
  positive.append("rating", "gte.4");
  const neutral = new URLSearchParams(base);
  neutral.append("rating", "eq.3");
  const negative = new URLSearchParams(base);
  negative.append("rating", "lte.2");
  const openComplaints = new URLSearchParams(base);
  openComplaints.append("rating", "lte.3");
  openComplaints.append("status", "eq.open");
  const resolvedComplaints = new URLSearchParams(base);
  resolvedComplaints.append("rating", "lte.3");
  resolvedComplaints.append("status", "eq.resolved");

  const listParams = new URLSearchParams(base);
  listParams.set("select", columns);
  listParams.set("order", "created_at.desc");

  const ratingParams = new URLSearchParams(base);
  ratingParams.set("select", "rating");
  ratingParams.set("limit", "5000");

  const [total, positiveCount, neutralCount, negativeCount, openCount, resolvedCount, ratingsBody, listBody] =
    await Promise.all([
      countRows(base),
      countRows(positive),
      countRows(neutral),
      countRows(negative),
      countRows(openComplaints),
      countRows(resolvedComplaints),
      rest(`feedback?${ratingParams.toString()}`).then((result) => result.body),
      rest(`feedback?${listParams.toString()}`, {
        headers: {
          Range: `${(filters.page - 1) * PAGE_SIZE}-${filters.page * PAGE_SIZE - 1}`,
        },
      }).then((result) => result.body),
    ]);

  const ratings = Array.isArray(ratingsBody) ? (ratingsBody as { rating: number }[]) : [];
  const averageRating = ratings.length
    ? Math.round((ratings.reduce((sum, row) => sum + row.rating, 0) / ratings.length) * 10) / 10
    : null;

  const analytics: FeedbackAnalytics = {
    total,
    positive: positiveCount,
    neutral: neutralCount,
    negative: negativeCount,
    averageRating,
    openComplaints: openCount,
    resolvedComplaints: resolvedCount,
  };

  const rows = Array.isArray(listBody) ? (listBody as FeedbackRow[]) : [];
  return {
    items: rows.map(serialize),
    analytics,
    page: filters.page,
    pageSize: PAGE_SIZE,
    total,
  };
}

export async function updateFeedbackStatus(id: number, status: FeedbackStatus, resolutionNote: string | null) {
  const params = new URLSearchParams();
  params.set("id", `eq.${id}`);
  params.set("select", columns);
  const { body } = await rest(`feedback?${params.toString()}`, {
    method: "PATCH",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({
      status,
      resolution_note: resolutionNote,
      resolved_at: status === "resolved" ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    }),
  });

  const row = Array.isArray(body) ? body[0] : null;
  return row ? serialize(row as FeedbackRow) : null;
}

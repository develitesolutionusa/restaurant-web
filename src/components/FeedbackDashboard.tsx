"use client";

import { useEffect, useState } from "react";
import { Loader2, Printer, QrCode } from "lucide-react";
import { StarRatingDisplay } from "@/components/StarRating";
import { PAGE_SIZE, type FeedbackAnalytics, type FeedbackRecord } from "@/lib/feedback";
import { feedbackLocations, type FeedbackLocationId } from "@/lib/site";

type ListResponse = {
  items: FeedbackRecord[];
  analytics: FeedbackAnalytics;
  page: number;
  total: number;
  error?: string;
};

type QrCard = {
  id: FeedbackLocationId;
  label: string;
  detail: string;
  url: string;
  dataUrl: string;
};

const fieldClass =
  "w-full rounded-xl border border-border bg-zinc-900 px-3 py-2.5 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30";

const emptyAnalytics: FeedbackAnalytics = {
  total: 0,
  positive: 0,
  neutral: 0,
  negative: 0,
  averageRating: null,
  openComplaints: 0,
  resolvedComplaints: 0,
};

function formatWhen(iso: string) {
  return new Intl.DateTimeFormat("en-PK", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Karachi",
  }).format(new Date(iso));
}

export default function FeedbackDashboard() {
  const [session, setSession] = useState<"checking" | "guest" | "staff">("checking");
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [signingIn, setSigningIn] = useState(false);
  const [rating, setRating] = useState("");
  const [location, setLocation] = useState("");
  const [sentiment, setSentiment] = useState("");
  const [status, setStatus] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<ListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notes, setNotes] = useState<Record<number, string>>({});
  const [savingId, setSavingId] = useState<number | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [codes, setCodes] = useState<QrCard[]>([]);

  useEffect(() => {
    const onBefore = () => document.body.classList.add("printing-feedback");
    const onAfter = () => document.body.classList.remove("printing-feedback");
    window.addEventListener("beforeprint", onBefore);
    window.addEventListener("afterprint", onAfter);
    return () => {
      window.removeEventListener("beforeprint", onBefore);
      window.removeEventListener("afterprint", onAfter);
      document.body.classList.remove("printing-feedback");
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function loadCodes() {
      const QRCode = (await import("qrcode")).default;
      const origin = window.location.origin;
      const next = await Promise.all(
        feedbackLocations.map(async (item) => {
          const url = `${origin}/feedback?location=${item.id}`;
          const dataUrl = await QRCode.toDataURL(url, {
            width: 320,
            margin: 2,
            errorCorrectionLevel: "M",
            color: { dark: "#1a1a1a", light: "#ffffff" },
          });
          return { ...item, url, dataUrl };
        }),
      );
      if (!cancelled) setCodes(next);
    }
    loadCodes().catch(() => {
      if (!cancelled) setError("QR codes could not be created in this browser.");
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (session === "guest") return;
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError("");
      const params = new URLSearchParams();
      if (rating) params.set("rating", rating);
      if (location) params.set("location", location);
      if (sentiment) params.set("sentiment", sentiment);
      if (status) params.set("status", status);
      if (from) params.set("from", from);
      if (to) params.set("to", to);
      params.set("page", String(page));

      try {
        const response = await fetch(`/api/feedback?${params.toString()}`, { cache: "no-store" });
        const body = (await response.json()) as ListResponse;
        if (cancelled) return;
        if (response.status === 401) {
          setSession("guest");
          setData(null);
          return;
        }
        if (!response.ok) throw new Error(body.error || "Could not load feedback.");
        setSession("staff");
        setData(body);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Could not load feedback.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [session, rating, location, sentiment, status, from, to, page, refreshKey]);

  const signIn = async (event: React.FormEvent) => {
    event.preventDefault();
    setSigningIn(true);
    setLoginError("");
    try {
      const response = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const body = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(body.error || "Sign in failed.");
      setPassword("");
      setSession("staff");
    } catch (err) {
      setLoginError(err instanceof Error ? err.message : "Sign in failed.");
    } finally {
      setSigningIn(false);
    }
  };

  const signOut = async () => {
    await fetch("/api/admin/logout", { method: "POST" });
    setSession("guest");
    setData(null);
  };

  const updateStatus = async (id: number, nextStatus: "open" | "resolved") => {
    const note = notes[id]?.trim() ?? "";
    if (nextStatus === "resolved" && note.length < 3) {
      setError("Add a short note about how this was handled.");
      return;
    }
    setSavingId(id);
    setError("");
    try {
      const response = await fetch(`/api/feedback/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus, resolutionNote: note }),
      });
      const body = (await response.json()) as FeedbackRecord & { error?: string };
      if (!response.ok) throw new Error(body.error || "Could not update feedback.");
      setRefreshKey((current) => current + 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update feedback.");
    } finally {
      setSavingId(null);
    }
  };

  const analytics = data?.analytics ?? emptyAnalytics;
  const pageCount = Math.max(1, Math.ceil((data?.total ?? 0) / PAGE_SIZE));

  if (session === "guest") {
    return (
      <div className="mx-auto max-w-md rounded-2xl border border-border bg-card p-6 sm:p-8">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-primary">Staff</p>
        <h1 className="mt-3 text-3xl font-bold text-accent">Feedback desk</h1>
        <p className="mt-2 text-sm text-muted">Sign in to read guest comments and resolve complaints.</p>
        <form onSubmit={signIn} className="mt-6 space-y-4">
          <div>
            <label htmlFor="staff-password" className="mb-1.5 block text-sm font-medium text-accent">
              Staff password
            </label>
            <input
              id="staff-password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className={fieldClass}
              required
            />
          </div>
          {loginError ? (
            <p role="alert" className="text-sm text-red-400">
              {loginError}
            </p>
          ) : null}
          <button
            type="submit"
            disabled={signingIn}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-white disabled:opacity-60"
          >
            {signingIn ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Sign in
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="no-print flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-primary">Staff</p>
          <h1 className="mt-2 text-3xl font-bold text-accent sm:text-4xl">Feedback desk</h1>
          <p className="mt-2 text-sm text-muted">
            {analytics.total} responses
            {analytics.averageRating != null ? ` · average ${analytics.averageRating}` : ""}
          </p>
        </div>
        {session === "staff" ? (
          <button type="button" onClick={signOut} className="text-sm text-muted hover:text-accent">
            Sign out
          </button>
        ) : null}
      </div>

      <div className="no-print grid grid-cols-2 gap-3 lg:grid-cols-4">
        {(
          [
            ["positive", "Positive", analytics.positive, "4–5 stars"],
            ["neutral", "Neutral", analytics.neutral, "3 stars"],
            ["negative", "Negative", analytics.negative, "1–2 stars"],
            ["complaints", "Open complaints", analytics.openComplaints, "1–3 stars, unresolved"],
          ] as const
        ).map(([key, label, value, hint]) => {
          const active = key === "complaints" ? status === "open" && !sentiment : sentiment === key;
          return (
            <button
              key={key}
              type="button"
              onClick={() => {
                setPage(1);
                setRating("");
                if (key === "complaints") {
                  setSentiment("");
                  setStatus((current) => (current === "open" ? "" : "open"));
                } else {
                  setStatus("");
                  setSentiment((current) => (current === key ? "" : key));
                }
              }}
              className={`rounded-2xl border bg-card p-4 text-left transition ${
                active ? "border-primary" : "border-border hover:border-primary/40"
              }`}
            >
              <p className="text-xs uppercase tracking-wider text-muted">{label}</p>
              <p className="mt-2 text-3xl font-bold text-accent">{value}</p>
              <p className="mt-1 text-xs text-muted">{hint}</p>
            </button>
          );
        })}
      </div>

      <form className="no-print grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <label className="text-sm text-muted">
          Rating
          <select
            value={rating}
            onChange={(event) => {
              setRating(event.target.value);
              setSentiment("");
              setPage(1);
            }}
            className={`${fieldClass} mt-1.5`}
          >
            <option value="">All ratings</option>
            <option value="5">5 — Excellent</option>
            <option value="4">4 — Good</option>
            <option value="3">3 — Okay</option>
            <option value="2">2 — Poor</option>
            <option value="1">1 — Very poor</option>
          </select>
        </label>
        <label className="text-sm text-muted">
          Location
          <select
            value={location}
            onChange={(event) => {
              setLocation(event.target.value);
              setPage(1);
            }}
            className={`${fieldClass} mt-1.5`}
          >
            <option value="">All locations</option>
            {feedbackLocations.map((item) => (
              <option key={item.id} value={item.id}>
                {item.label}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm text-muted">
          From
          <input
            type="date"
            value={from}
            onChange={(event) => {
              setFrom(event.target.value);
              setPage(1);
            }}
            className={`${fieldClass} mt-1.5`}
          />
        </label>
        <label className="text-sm text-muted">
          To
          <input
            type="date"
            value={to}
            onChange={(event) => {
              setTo(event.target.value);
              setPage(1);
            }}
            className={`${fieldClass} mt-1.5`}
          />
        </label>
        <label className="text-sm text-muted">
          Complaint status
          <select
            value={status}
            onChange={(event) => {
              setStatus(event.target.value);
              setPage(1);
            }}
            className={`${fieldClass} mt-1.5`}
          >
            <option value="">All statuses</option>
            <option value="open">Open</option>
            <option value="resolved">Resolved</option>
          </select>
        </label>
      </form>

      {error ? (
        <p role="alert" className="no-print text-sm text-red-400">
          {error}
        </p>
      ) : null}

      {loading && !data ? (
        <div className="no-print flex items-center gap-2 text-sm text-muted">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading feedback
        </div>
      ) : null}

      <div className="no-print space-y-4">
        {data && data.items.length === 0 ? (
          <div className="rounded-2xl border border-border bg-card p-8 text-center text-sm text-muted">
            No feedback matches these filters.
          </div>
        ) : null}
        {data?.items.map((item) => {
          const complaint = item.rating <= 3;
          return (
            <article
              key={item.id}
              className={`rounded-2xl border border-border bg-card p-5 ${
                complaint && item.status === "open" ? "border-l-2 border-l-red-400" : ""
              }`}
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <StarRatingDisplay value={item.rating} />
                  <p className="mt-2 text-sm text-muted">
                    {formatWhen(item.createdAt)} · {item.locationLabel}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2 text-xs">
                  <span className="rounded-full bg-white/5 px-2.5 py-1 capitalize text-accent">{item.sentiment}</span>
                  <span className="rounded-full bg-white/5 px-2.5 py-1 capitalize text-muted">{item.status}</span>
                </div>
              </div>
              <h2 className="mt-4 text-base font-semibold text-accent">{item.customerName || "Anonymous guest"}</h2>
              <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-foreground/90">{item.comment}</p>

              {item.status === "resolved" && item.resolutionNote ? (
                <p className="mt-4 rounded-xl bg-white/5 p-3 text-sm text-muted">
                  <span className="font-medium text-accent">Resolution: </span>
                  {item.resolutionNote}
                </p>
              ) : null}

              {item.status === "open" ? (
                <div className="mt-4 space-y-3">
                  <label htmlFor={`note-${item.id}`} className="block text-sm text-muted">
                    {complaint ? "How was this complaint handled?" : "Review note"}
                  </label>
                  <textarea
                    id={`note-${item.id}`}
                    rows={3}
                    value={notes[item.id] ?? ""}
                    onChange={(event) => setNotes((current) => ({ ...current, [item.id]: event.target.value }))}
                    className={`${fieldClass} resize-none`}
                  />
                  <button
                    type="button"
                    disabled={savingId === item.id}
                    onClick={() => updateStatus(item.id, "resolved")}
                    className="rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
                  >
                    {savingId === item.id ? "Saving..." : complaint ? "Resolve complaint" : "Mark reviewed"}
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  disabled={savingId === item.id}
                  onClick={() => updateStatus(item.id, "open")}
                  className="mt-4 text-sm text-muted hover:text-accent"
                >
                  Reopen
                </button>
              )}
            </article>
          );
        })}
      </div>

      {data && data.total > PAGE_SIZE ? (
        <div className="no-print flex items-center justify-between text-sm">
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => setPage((current) => Math.max(1, current - 1))}
            className="text-muted disabled:opacity-40"
          >
            Previous
          </button>
          <span className="text-muted">
            Page {page} of {pageCount}
          </span>
          <button
            type="button"
            disabled={page >= pageCount}
            onClick={() => setPage((current) => current + 1)}
            className="text-muted disabled:opacity-40"
          >
            Next
          </button>
        </div>
      ) : null}

      <section className="print-sheet rounded-2xl border border-border bg-card p-5 sm:p-6">
        <div className="no-print mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2 text-accent">
              <QrCode className="h-5 w-5 text-primary" />
              <h2 className="text-xl font-bold">Table QR codes</h2>
            </div>
            <p className="mt-1 text-sm text-muted">
              Print one code for each service point. Scanning opens the feedback form for that location.
            </p>
          </div>
          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-border px-4 py-2.5 text-sm font-semibold text-accent hover:border-primary"
          >
            <Printer className="h-4 w-4" />
            Print codes
          </button>
        </div>
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
          {codes.map((code) => (
            <div key={code.id} className="rounded-2xl bg-white p-4 text-center text-zinc-900">
              <img src={code.dataUrl} alt={`QR code for ${code.label}`} className="mx-auto h-52 w-52" />
              <p className="mt-3 text-sm font-bold">Saffron Karachi Grill</p>
              <p className="text-sm">{code.label}</p>
              <p className="mt-1 break-all text-[11px] text-zinc-500">{code.url}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

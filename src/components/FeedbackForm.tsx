"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { Star, X } from "lucide-react";
import { defaultFeedbackLocation, googleReviewUrl, isFeedbackLocation } from "@/lib/site";

type Choice = "yes" | "no";

export default function FeedbackForm() {
  const searchParams = useSearchParams();
  const locationParam = searchParams.get("location");
  const location =
    !locationParam ? defaultFeedbackLocation : isFeedbackLocation(locationParam) ? locationParam : null;
  const [formStartedAt] = useState(() => Date.now());
  const [choice, setChoice] = useState<Choice | null>(null);

  const saveClick = (next: Choice | "google") => {
    if (!location) return;
    void fetch("/api/feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        choice: next,
        location,
        formStartedAt,
        saffron_hp: "",
      }),
    });
  };

  useEffect(() => {
    if (!choice) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setChoice(null);
    };
    document.addEventListener("keydown", onKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [choice]);

  if (!location) {
    return (
      <div className="rounded-2xl border border-border bg-card p-6 text-center sm:p-8">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-primary">Saffron</p>
        <h1 className="mt-3 text-2xl font-bold text-accent">This QR code is not recognized</h1>
        <p className="mt-3 text-sm leading-relaxed text-muted">
          Ask a team member for the code at your table. Feedback still uses the dining room, family section, or takeaway counter codes.
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="rounded-2xl border border-border bg-card p-6 text-center sm:p-8">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-primary">Saffron Karachi Grill</p>
        <h1 className="mt-3 text-3xl font-bold text-accent">Leave us a Google review</h1>
        <div className="mt-8 grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => {
              setChoice("yes");
              saveClick("yes");
            }}
            className="rounded-xl bg-primary px-6 py-3.5 font-semibold text-white shadow-lg shadow-primary/20 transition hover:bg-primary-dark"
          >
            Yes
          </button>
          <button
            type="button"
            onClick={() => {
              setChoice("no");
              saveClick("no");
            }}
            className="rounded-xl border border-border px-6 py-3.5 font-semibold text-accent transition hover:border-primary hover:text-primary"
          >
            No
          </button>
        </div>
      </div>

      <AnimatePresence>
        {choice ? (
          <motion.div
            className="fixed inset-0 z-[60] flex items-center justify-center px-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <button
              type="button"
              className="absolute inset-0 bg-black/70"
              aria-label="Close"
              onClick={() => setChoice(null)}
            />
            <motion.div
              role="dialog"
              aria-modal="true"
              aria-labelledby="feedback-choice-title"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 16 }}
              className="relative z-10 w-full max-w-md rounded-2xl border border-border bg-card p-6 text-center sm:p-8"
            >
              <button
                type="button"
                onClick={() => setChoice(null)}
                className="absolute right-4 top-4 rounded-lg p-1 text-muted transition hover:text-accent"
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
              {choice === "yes" ? (
                <>
                  <h2 id="feedback-choice-title" className="pr-8 text-2xl font-bold text-accent">
                    Leave us a Google review
                  </h2>
                  <a
                    href={googleReviewUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => saveClick("google")}
                    className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-5 py-3.5 text-sm font-semibold text-white shadow-lg shadow-primary/20 transition hover:bg-primary-dark"
                  >
                    <Star className="h-4 w-4 fill-white" aria-hidden="true" />
                    Write a Google Review
                  </a>
                </>
              ) : (
                <h2 id="feedback-choice-title" className="pr-8 text-2xl font-bold leading-snug text-accent">
                  Sorry about that, please tell the manager directly so we can make it right
                </h2>
              )}
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </>
  );
}

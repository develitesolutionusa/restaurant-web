"use client";

import { Star } from "lucide-react";

const labels = ["", "Very poor", "Poor", "Okay", "Good", "Excellent"];

export function ratingLabel(value: number) {
  return labels[value] ?? "";
}

export function StarRatingDisplay({ value }: { value: number }) {
  return (
    <div className="flex gap-0.5" aria-label={`${value} out of 5 stars`}>
      {Array.from({ length: 5 }, (_, index) => (
        <Star
          key={index}
          className={`h-4 w-4 ${index < value ? "fill-primary text-primary" : "text-zinc-600"}`}
          aria-hidden="true"
        />
      ))}
    </div>
  );
}

export default function StarRatingInput({
  value,
  onChange,
}: {
  value: number;
  onChange: (value: number) => void;
}) {
  const active = value;

  return (
    <div
      role="radiogroup"
      aria-label="Overall rating"
      aria-required="true"
      className="flex flex-wrap items-center gap-1"
      onKeyDown={(event) => {
        if (event.key === "ArrowRight" || event.key === "ArrowUp") {
          event.preventDefault();
          onChange(Math.min(5, (value || 0) + 1));
        }
        if (event.key === "ArrowLeft" || event.key === "ArrowDown") {
          event.preventDefault();
          onChange(Math.max(1, (value || 1) - 1));
        }
      }}
    >
      {Array.from({ length: 5 }, (_, index) => {
        const star = index + 1;
        const selected = star <= active;
        return (
          <button
            key={star}
            type="button"
            role="radio"
            aria-checked={value === star}
            aria-label={`${star} star${star === 1 ? "" : "s"}`}
            onClick={() => onChange(star)}
            className="flex h-12 w-12 items-center justify-center rounded-xl transition hover:bg-white/5 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            <Star className={`h-8 w-8 ${selected ? "fill-primary text-primary" : "text-zinc-600"}`} />
          </button>
        );
      })}
      <span className="min-w-20 pl-2 text-sm text-muted" aria-live="polite">
        {value ? ratingLabel(value) : "Required"}
      </span>
    </div>
  );
}

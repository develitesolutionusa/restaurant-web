import { Star } from "lucide-react";
import { googleReviewUrl } from "@/lib/site";

export default function GoogleReviewInvite() {
  return (
    <div className="rounded-2xl border border-border bg-zinc-900/70 p-4 text-center" data-review-invite="google">
      <p className="mb-3 text-sm text-muted">Optional — share your experience on Google.</p>
      <a
        href={googleReviewUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-5 py-3.5 text-sm font-semibold text-white shadow-lg shadow-primary/20 transition hover:bg-primary-dark"
      >
        <Star className="h-4 w-4 fill-white" aria-hidden="true" />
        Write a Google Review
      </a>
    </div>
  );
}

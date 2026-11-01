"use client";

import { Suspense } from "react";
import FeedbackForm from "@/components/FeedbackForm";

export default function FeedbackPage() {
  return (
    <div className="px-4 pb-20 pt-28 sm:pt-32">
      <div className="mx-auto w-full max-w-lg">
        <Suspense fallback={<div className="h-96 animate-pulse rounded-2xl bg-card" />}>
          <FeedbackForm />
        </Suspense>
      </div>
    </div>
  );
}

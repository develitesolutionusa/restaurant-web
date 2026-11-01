import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Share your feedback | Saffron Karachi Grill",
  description: "Rate your visit to Saffron Karachi Grill and tell us about the experience.",
};

export default function FeedbackLayout({ children }: { children: React.ReactNode }) {
  return children;
}

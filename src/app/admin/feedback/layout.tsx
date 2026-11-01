import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Feedback desk | Saffron Karachi Grill",
  robots: { index: false, follow: false },
};

export default function AdminFeedbackLayout({ children }: { children: React.ReactNode }) {
  return children;
}

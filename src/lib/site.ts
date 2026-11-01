export const feedbackLocations = [
  {
    id: "clifton-dining",
    label: "Clifton — Dining Room",
    detail: "Main dining room, Boat Basin",
  },
  {
    id: "clifton-family",
    label: "Clifton — Family Section",
    detail: "Family seating, Boat Basin",
  },
  {
    id: "clifton-takeaway",
    label: "Clifton — Takeaway Counter",
    detail: "Pickup counter, Boat Basin",
  },
] as const;

export type FeedbackLocationId = (typeof feedbackLocations)[number]["id"];

export const defaultFeedbackLocation: FeedbackLocationId = "clifton-dining";

export function isFeedbackLocation(value: string): value is FeedbackLocationId {
  return feedbackLocations.some((location) => location.id === value);
}

export function feedbackLocationLabel(id: string) {
  return feedbackLocations.find((location) => location.id === id)?.label ?? "Clifton";
}

export const managerContact = {
  phoneDisplay: "021 3586 2200",
  phoneHref: "tel:+922135862200",
};

/** Google Business Profile review link. Override with NEXT_PUBLIC_GOOGLE_REVIEW_URL. */
export const googleReviewUrl =
  process.env.NEXT_PUBLIC_GOOGLE_REVIEW_URL?.trim() ||
  "https://www.google.com/maps/search/?api=1&query=Saffron+Karachi+Grill+Boat+Basin+Clifton+Karachi";

export const positiveThanksLead = "Thank You!";
export const positiveThanksBody =
  "We're delighted you enjoyed your experience. Your support means a lot to us!";
export const negativeThanks =
  "We're sorry about your experience. Your feedback matters to us. Please speak directly with our manager so we can make things right.";

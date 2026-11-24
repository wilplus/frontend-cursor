import { bffFetch } from "@/lib/api/bffFetch";

export type HumanCoachOffer = {
  project_id: string | null;
  take_session_id: string | null;
  book: boolean;
  send: boolean;
};

export function humanCoachOffer(value: unknown): HumanCoachOffer | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Record<string, unknown>;
  const project = typeof row.project_id === "string" && row.project_id ? row.project_id : null;
  const take = typeof row.take_session_id === "string" && row.take_session_id ? row.take_session_id : null;
  const book = row.book === true;
  const send = row.send === true && Boolean(project && take);
  return book || send ? { project_id: project, take_session_id: take, book, send } : null;
}

export type CoachCalendar = {
  duration_min: number;
  timezone: string;
  price_cents: number;
  currency: string;
  needs_name: boolean;
  needs_email: boolean;
  slots: string[];
};

export type ReviewPreview = {
  project_title: string;
  take_index: number | null;
  duration_seconds: number | null;
  sent: boolean;
};

export type ReviewStatus = {
  id: string;
  take_session_id: string;
  requested_at: string;
  email_sent_at: string | null;
  feedback: string | null;
  feedback_at: string | null;
};

export type PrivateReview = {
  project_title: string;
  take_index: number | null;
  note: string;
  audio_url: string | null;
  ideal_text: {
    sections: { text: string; slide_index: number | null }[];
    slide_titles: string[];
    presentation_ref: string | null;
  };
  walk: {
    id: string;
    role: "user" | "bot";
    body: string;
    clip: { src?: string; start_ms?: number; duration_ms?: number } | null;
  }[];
  feedback: string | null;
};

export class HumanCoachError extends Error {
  constructor(readonly code: string, message: string) {
    super(message);
  }
}

const root = "/api/v2/human-coach";
const projectReviews = (project: string) => "/projects/" + encodeURIComponent(project) + "/reviews";
const reviewPath = (project: string, take: string) => projectReviews(project) + "/" + encodeURIComponent(take);
const inboxPath = (review: string) => "/inbox/" + encodeURIComponent(review);

async function call<T>(path: string, body?: object): Promise<T> {
  const result = await bffFetch(root + path, {
    cache: "no-store",
    timeoutMs: 30_000,
    ...(body ? { method: "POST", json: body } : {}),
  });
  if (result.kind === "response" && result.ok) return result.body as T;
  if (result.kind === "unauthenticated" || (result.kind === "response" && result.status === 401)) {
    throw new HumanCoachError("UNAUTHORIZED", "Sign in to continue.");
  }
  const error = result.kind === "response" ? result.body as { code?: string; error?: string } | null : null;
  throw new HumanCoachError(error?.code ?? "HANDOFF_UNAVAILABLE", error?.error ?? "Please try again.");
}

export const readCoachCalendar = () => call<CoachCalendar>("/calendar");
export const bookCoachCall = (body: {
  project_id: string | null;
  start: string;
  price_cents: number;
  duration_min: number;
  currency: string;
  name: string;
  email: string;
}) => call<{ when: string }>("/calendar", body);

export const readCoachReviewPreview = (project: string, take: string) => call<ReviewPreview>(reviewPath(project, take));
export const sendCoachReview = (project: string, take: string, note: string) =>
  call<ReviewStatus>(reviewPath(project, take), { note });
export const readCoachReviewHistory = (project: string) => call<{ reviews: ReviewStatus[] }>(projectReviews(project));
export const readPrivateCoachReview = (review: string) => call<PrivateReview>(inboxPath(review));
export const sendPrivateCoachFeedback = (review: string, feedback: string) =>
  call<ReviewStatus>(inboxPath(review), { feedback });

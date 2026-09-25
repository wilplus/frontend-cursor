import { getAuthToken } from "@/lib/api/auth-client";
import type { FeedbackResponse } from "@/services/api/takeFeedback";

/* The two reads behind an answered bookmark (founder 2026-09-25, Q19 A).
 *
 * `fetchParagraphHistory`: how this Paragraph's Slide changed Take by Take,
 * which helper words were locked when, and which practised passages were
 * adopted into it (backend services/paragraph_history.py).
 *
 * `fetchOwnerAnswers`: the owner's own latest answer per feedback item on
 * their Take — a self-report, never a coach label or a machine read (L3).
 *
 * Words only. Nothing here carries a score, band or rank (AC-9). */

export interface ParagraphVersion {
  /** The Take whose words these are, when the version recorded it. */
  takeIndex: number | null;
  paragraphs: string[];
  at: string | null;
}

export interface HelperWordsSet {
  phrases: string[];
  at: string | null;
}

export interface PracticeAdoption {
  before: string | null;
  after: string | null;
  at: string | null;
}

export interface ParagraphHistory {
  slideIndex: number;
  versions: ParagraphVersion[];
  helperWords: HelperWordsSet[];
  practice: PracticeAdoption[];
}

export interface OwnerAnswer {
  feedbackId: string;
  response: FeedbackResponse | string;
}

function str(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}

function rows(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value)
    ? value.filter(
        (row): row is Record<string, unknown> =>
          !!row && typeof row === "object" && !Array.isArray(row),
      )
    : [];
}

function strings(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

function takeIndexOf(value: unknown): number | null {
  return typeof value === "number" && Number.isInteger(value) && value > 0
    ? value
    : null;
}

export function mapParagraphHistory(body: unknown): ParagraphHistory | null {
  if (!body || typeof body !== "object") return null;
  const row = body as Record<string, unknown>;
  if (typeof row.slide_index !== "number") return null;
  return {
    slideIndex: row.slide_index,
    versions: rows(row.versions).map((v) => ({
      takeIndex: takeIndexOf(v.take_index),
      paragraphs: strings(v.paragraphs),
      at: str(v.at),
    })),
    helperWords: rows(row.helper_words).map((h) => ({
      phrases: strings(h.phrases),
      at: str(h.at),
    })),
    practice: rows(row.practice).map((p) => ({
      before: str(p.before),
      after: str(p.after),
      at: str(p.at),
    })),
  };
}

export function mapOwnerAnswers(body: unknown): OwnerAnswer[] {
  const list =
    body && typeof body === "object"
      ? (body as Record<string, unknown>).answers
      : null;
  const out: OwnerAnswer[] = [];
  for (const row of rows(list)) {
    const feedbackId = str(row.feedback_id);
    const response = str(row.response);
    if (feedbackId && response) out.push({ feedbackId, response });
  }
  return out;
}

async function getJson(url: string): Promise<unknown | null> {
  const token = await getAuthToken();
  const headers: Record<string, string> = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  try {
    const response = await fetch(url, {
      headers,
      credentials: "include",
      cache: "no-store",
    });
    if (!response.ok) return null;
    return await response.json().catch(() => null);
  } catch {
    return null;
  }
}

/** null when the Slide cannot be proven or the read failed: the sheet then
 *  shows only what it already knows, never a guessed history. */
export async function fetchParagraphHistory(
  arcId: string,
  partId: string,
): Promise<ParagraphHistory | null> {
  const body = await getJson(
    `/api/v2/explore/arc/${encodeURIComponent(arcId)}/parts/${encodeURIComponent(partId)}/history`,
  );
  return mapParagraphHistory(body);
}

export async function fetchOwnerAnswers(
  takeSessionId: string,
): Promise<OwnerAnswer[]> {
  const body = await getJson(
    `/api/v2/user/takes/${encodeURIComponent(takeSessionId)}/feedback-responses`,
  );
  return mapOwnerAnswers(body);
}

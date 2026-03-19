import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import OpenAI from "openai";
import { requireAuth } from "@/lib/api/homework-mock";

export const dynamic = "force-dynamic";

const client = new OpenAI();

/** Filler words to count in the transcript. */
const FILLER_LIST = ["um", "uh", "er", "ah", "hmm", "like", "you know", "basically", "literally", "actually", "right", "okay", "so", "well", "I mean", "kind of", "sort of"];

export interface FillerWords {
  total: number;
  breakdown: Record<string, number>;
}

export interface CoachingReportResponse {
  insight: string;
  fillerWords?: FillerWords;
  transcript?: string;
}

interface CoachingReportBody {
  transcript?: string;
  taskLabel?: string;
  /** Live Coach performance score 0–100. */
  sniperOverallScore?: number;
  /** Rolling pause ratio 0–1 from the Live Coach session. */
  pauseRatio?: number;
  /** Syllable-onset WPM from the Live Coach session. Null during warm-up. */
  wpm?: number | null;
  /** @deprecated Legacy tier label — ignored. */
  sniperTier?: string;
  /** @deprecated Legacy 6-metric data — ignored if all zeros. */
  sniperMetrics?: Record<string, unknown>;
  /** When true, also return filler word counts from the transcript. */
  analyzeFillers?: boolean;
}

const TIER_LABELS: Record<string, string> = {
  executive_calibrated: "Executive Calibrated",
  stage_ready: "Stage Ready",
  structured: "Structured",
  developing_control: "Developing Control",
  unstable_delivery: "Unstable Delivery",
};

function buildPrompt(body: CoachingReportBody): string {
  const { transcript, taskLabel, sniperOverallScore, pauseRatio, wpm, analyzeFillers } = body;

  const task = (taskLabel ?? "").trim() || "a speaking exercise";

  const lines: string[] = [
    `You are a professional executive communication coach specialising in vocal delivery.`,
    `Analyse this student's speaking practice session and provide a complete assessment.`,
    ``,
    `Task they were practising: "${task}"`,
  ];

  if (sniperOverallScore != null) {
    lines.push(`Live coach performance score: ${sniperOverallScore}/100 (100 = perfect flow and pace, 0 = needs significant work)`);
  }

  const metricDetails: string[] = [];
  if (wpm != null && wpm > 0) {
    metricDetails.push(`Speaking pace: ${Math.round(wpm)} WPM (ideal 125–165 WPM)`);
  }
  if (pauseRatio != null) {
    const pausePct = Math.round(pauseRatio * 100);
    metricDetails.push(`Pause ratio: ${pausePct}% of recording was pauses (ideal 15–30% — enough breathing room without dragging)`);
  }
  if (metricDetails.length > 0) {
    lines.push(`\nReal-time measured values:`);
    metricDetails.forEach((d) => lines.push(`  ${d}`));
  }

  if (transcript && transcript.trim().length > 10) {
    const truncated = transcript.trim().slice(0, 3000);
    lines.push(`\nTranscript of their recording:\n"""\n${truncated}\n"""`);
  }

  lines.push(`\nCoaching instructions:`);
  lines.push(`- Write 3–5 sentences of coaching in continuous prose. Be specific to their numbers and what they actually said.`);
  lines.push(`- Identify their single biggest opportunity to improve and one genuine strength.`);
  lines.push(`- Do NOT use bullet points. Do NOT start with "Great job", "Fantastic", or any generic opener.`);
  lines.push(`- Speak directly to the student as "you". Be direct and warm.`);
  lines.push(`- Only reference metrics that were actually provided. Do not invent or assume values for metrics not listed above.`);

  if (analyzeFillers && transcript && transcript.trim().length > 10) {
    lines.push(`\nFiller word instructions:`);
    lines.push(`- Count every occurrence of these filler words in the transcript: ${FILLER_LIST.join(", ")}`);
    lines.push(`- Only count words that are clearly used as fillers (not meaningful use, e.g. "like" as a verb or adjective is NOT a filler).`);
    lines.push(`- Return the total count and a breakdown by word in the function call.`);
  }

  return lines.join("\n");
}

/** OpenAI function schema for structured analysis output. */
const ANALYSIS_FUNCTION: OpenAI.Chat.ChatCompletionTool = {
  type: "function",
  function: {
    name: "session_analysis",
    description: "Return the complete session analysis with coaching feedback and optional filler word counts.",
    parameters: {
      type: "object",
      properties: {
        coaching: {
          type: "string",
          description: "3–5 sentences of specific, actionable coaching in continuous prose. No bullets.",
        },
        fillers: {
          type: "object",
          description: "Filler word analysis. Only include when you have analyzed the transcript for fillers.",
          properties: {
            total: { type: "integer", description: "Total number of filler word occurrences" },
            breakdown: {
              type: "object",
              description: "Count per filler word (only include words with count > 0)",
              additionalProperties: { type: "integer" },
            },
          },
          required: ["total", "breakdown"],
        },
      },
      required: ["coaching"],
    },
  },
};

export async function POST(req: NextRequest) {
  const unauth = await requireAuth(req);
  if (unauth) return unauth;

  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json({ error: "OPENAI_API_KEY not configured" }, { status: 503 });
  }

  let body: CoachingReportBody;
  try {
    body = (await req.json()) as CoachingReportBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const hasData = body.transcript || body.sniperOverallScore != null;
  if (!hasData) {
    return NextResponse.json(
      { error: "Insufficient data — provide transcript or sniper metrics" },
      { status: 400 }
    );
  }

  try {
    const completion = await client.chat.completions.create({
      model: "gpt-4o-mini",
      max_tokens: 700,
      tools: [ANALYSIS_FUNCTION],
      tool_choice: { type: "function", function: { name: "session_analysis" } },
      messages: [{ role: "user", content: buildPrompt(body) }],
    });

    const toolCall = completion.choices[0]?.message?.tool_calls?.[0] as
      | { function: { name: string; arguments: string } }
      | undefined;
    if (!toolCall || toolCall.function.name !== "session_analysis") {
      return NextResponse.json({ error: "No structured output from model" }, { status: 502 });
    }

    const output = JSON.parse(toolCall.function.arguments) as {
      coaching: string;
      fillers?: { total: number; breakdown: Record<string, number> };
    };

    const response: CoachingReportResponse = {
      insight: output.coaching?.trim() ?? "",
    };

    if (output.fillers && typeof output.fillers.total === "number") {
      response.fillerWords = {
        total: output.fillers.total,
        breakdown: output.fillers.breakdown ?? {},
      };
    }

    return NextResponse.json(response);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "OpenAI API error";
    console.error("[ai/coaching-report] OpenAI error:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

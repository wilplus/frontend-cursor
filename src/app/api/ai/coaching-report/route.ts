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
  sniperOverallScore?: number;
  sniperTier?: string;
  sniperMetrics?: {
    paceWpm?: number;
    avgPauseMs?: number;
    dynamicRangeDb?: number;
    emphasisPerMin?: number;
    pitchRangeSt?: number | null;
    energyByThird?: { e1: number; e2: number; e3: number } | null;
  };
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
  const { transcript, taskLabel, sniperOverallScore, sniperTier, sniperMetrics, analyzeFillers } = body;

  const task = (taskLabel ?? "").trim() || "a speaking exercise";
  const tierLabel = sniperTier ? (TIER_LABELS[sniperTier] ?? sniperTier) : null;

  const lines: string[] = [
    `You are a professional executive communication coach specialising in vocal delivery.`,
    `Analyse this student's speaking practice session and provide a complete assessment.`,
    ``,
    `Task they were practising: "${task}"`,
  ];

  if (sniperOverallScore != null) {
    lines.push(`Voice alignment score: ${sniperOverallScore}/100${tierLabel ? ` — ${tierLabel}` : ""}`);
  }

  if (sniperMetrics) {
    const m = sniperMetrics;
    const metricDetails: string[] = [];
    if (m.paceWpm != null) metricDetails.push(`Pace: ${Math.round(m.paceWpm)} WPM (ideal 140–155)`);
    if (m.avgPauseMs != null) metricDetails.push(`Avg pause gap: ${Math.round(m.avgPauseMs)}ms (ideal 400–480ms)`);
    if (m.dynamicRangeDb != null) metricDetails.push(`Dynamic range: ${m.dynamicRangeDb.toFixed(1)}dB (ideal 12–16dB)`);
    if (m.emphasisPerMin != null) metricDetails.push(`Emphasis events: ${Math.round(m.emphasisPerMin)}/min (ideal 30–40)`);
    if (m.pitchRangeSt != null) metricDetails.push(`Pitch variety: ${m.pitchRangeSt.toFixed(1)} semitones (ideal 6–12st)`);
    if (m.energyByThird) {
      const { e1, e2, e3 } = m.energyByThird;
      const total = e1 + e2 + e3;
      if (total > 0) {
        const pct = (v: number) => Math.round((v / total) * 100);
        metricDetails.push(`Energy arc: start ${pct(e1)}% → mid ${pct(e2)}% → end ${pct(e3)}% (ideal: consistent or building)`);
      }
    }
    if (metricDetails.length > 0) {
      lines.push(`\nReal-time measured values:`);
      metricDetails.forEach((d) => lines.push(`  ${d}`));
    }
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

    const toolCall = completion.choices[0]?.message?.tool_calls?.[0];
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

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { requireAuth } from "@/lib/api/homework-mock";

export const dynamic = "force-dynamic";

const client = new Anthropic();

interface CoachingReportBody {
  transcript?: string;
  taskLabel?: string;
  sniperScores?: Record<string, number>;
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
}

const TIER_LABELS: Record<string, string> = {
  executive_calibrated: "Executive Calibrated",
  stage_ready: "Stage Ready",
  structured: "Structured",
  developing_control: "Developing Control",
  unstable_delivery: "Unstable Delivery",
};

function buildPrompt(body: CoachingReportBody): string {
  const {
    transcript,
    taskLabel,
    sniperScores,
    sniperOverallScore,
    sniperTier,
    sniperMetrics,
  } = body;

  const task = (taskLabel ?? "").trim() || "a speaking exercise";
  const tierLabel = sniperTier ? (TIER_LABELS[sniperTier] ?? sniperTier) : null;

  const lines: string[] = [
    `You are a professional executive communication coach specialising in vocal delivery.`,
    `Analyse this student's speaking practice and give direct, specific, actionable coaching.`,
    ``,
    `Task they were practising: "${task}"`,
  ];

  if (sniperOverallScore != null) {
    lines.push(
      `Voice alignment score: ${sniperOverallScore}/100${tierLabel ? ` — ${tierLabel}` : ""}`
    );
  }

  if (sniperScores && Object.keys(sniperScores).length > 0) {
    lines.push(`\nMetric scores (0–100, higher = closer to ideal):`);
    const labels: Record<string, string> = {
      pace: "Pace",
      pause: "Pause",
      dynamic: "Dynamic Range",
      emphasis: "Emphasis",
      energy: "Energy Arc",
      pitch: "Pitch Variety",
    };
    for (const [k, v] of Object.entries(sniperScores)) {
      lines.push(`  ${labels[k] ?? k}: ${v}/100`);
    }
  }

  if (sniperMetrics) {
    const m = sniperMetrics;
    const metricDetails: string[] = [];
    if (m.paceWpm != null) metricDetails.push(`Pace: ${Math.round(m.paceWpm)} WPM (ideal 140–155)`);
    if (m.avgPauseMs != null) metricDetails.push(`Avg pause: ${Math.round(m.avgPauseMs)}ms (ideal 400–480ms)`);
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
      lines.push(`\nMeasured values:`);
      metricDetails.forEach((d) => lines.push(`  ${d}`));
    }
  }

  if (transcript && transcript.trim().length > 10) {
    const truncated = transcript.trim().slice(0, 2500);
    lines.push(`\nTranscript of their recording:\n"""\n${truncated}\n"""`);
  }

  lines.push(
    ``,
    `Write 3–5 sentences of coaching feedback in continuous prose.`,
    `Be specific to their actual numbers and what they said (if transcript provided).`,
    `Identify their single biggest opportunity and one genuine strength.`,
    `Do NOT use bullet points. Do NOT start with "Great job", "Fantastic", "Great", or any generic opener.`,
    `Speak directly to the student as "you".`
  );

  return lines.join("\n");
}

export async function POST(req: NextRequest) {
  const unauth = await requireAuth(req);
  if (unauth) return unauth;

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { error: "ANTHROPIC_API_KEY not configured" },
      { status: 503 }
    );
  }

  let body: CoachingReportBody;
  try {
    body = (await req.json()) as CoachingReportBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const hasData =
    body.transcript || body.sniperScores || body.sniperOverallScore != null;
  if (!hasData) {
    return NextResponse.json(
      { error: "Insufficient data — provide transcript or sniper metrics" },
      { status: 400 }
    );
  }

  try {
    const message = await client.messages.create({
      model: "claude-3-5-haiku-20241022",
      max_tokens: 300,
      messages: [{ role: "user", content: buildPrompt(body) }],
    });

    const insight = message.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("")
      .trim();

    return NextResponse.json({ insight });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Claude API error";
    console.error("[ai/coaching-report] Claude error:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

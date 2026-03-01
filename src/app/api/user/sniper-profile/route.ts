import { NextRequest, NextResponse } from "next/server";
import { copyCookies } from "@/lib/api/bff";
import {
  MIN_STAGE_SCORE_FOR_BASELINE_UPDATE,
  MIN_VOICED_SEC_FOR_BASELINE_UPDATE,
  EMA_ALPHA,
} from "@/lib/sniper/constants";
import type { SniperSessionMeans } from "@/lib/sniper/types";
import { createServerClient, type CookieOptions } from "@supabase/ssr";

export const dynamic = "force-dynamic";

function createSupabase(req: NextRequest, cookieRes: NextResponse) {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return req.cookies.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          cookieRes.cookies.set({ name, value, ...options });
        },
        remove(name: string, options: CookieOptions) {
          cookieRes.cookies.set({ name, value: "", ...options });
        },
      },
    }
  );
}

/** GET: return current user's sniper profile or 404. */
export async function GET(req: NextRequest) {
  const cookieRes = NextResponse.next();
  const supabase = createSupabase(req, cookieRes);
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    const out = NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    copyCookies(cookieRes, out);
    return out;
  }

  const { data, error } = await supabase
    .from("user_sniper_profile")
    .select("*")
    .eq("user_id", user.id)
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      const out = NextResponse.json(null, { status: 404 });
      copyCookies(cookieRes, out);
      return out;
    }
    console.error("[sniper-profile GET]", error.message);
    const out = NextResponse.json({ error: "Failed to load profile" }, { status: 500 });
    copyCookies(cookieRes, out);
    return out;
  }

  const out = NextResponse.json(data);
  copyCookies(cookieRes, out);
  return out;
}

/** POST: update baseline from session end (EMA). Body: session_means, stage_score, voiced_duration_sec. */
export async function POST(req: NextRequest) {
  const cookieRes = NextResponse.next();
  const supabase = createSupabase(req, cookieRes);
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    const out = NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    copyCookies(cookieRes, out);
    return out;
  }

  let body: {
    session_means: SniperSessionMeans;
    stage_score: number;
    voiced_duration_sec: number;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const { session_means, stage_score, voiced_duration_sec } = body;
  if (
    session_means == null ||
    typeof stage_score !== "number" ||
    typeof voiced_duration_sec !== "number"
  ) {
    return NextResponse.json(
      { error: "session_means, stage_score, voiced_duration_sec required" },
      { status: 400 }
    );
  }

  const qualityOk =
    stage_score >= MIN_STAGE_SCORE_FOR_BASELINE_UPDATE &&
    voiced_duration_sec >= MIN_VOICED_SEC_FOR_BASELINE_UPDATE;

  const { data: existing } = await supabase
    .from("user_sniper_profile")
    .select("*")
    .eq("user_id", user.id)
    .single();

  const alpha = EMA_ALPHA;
  const oneMinusAlpha = 1 - alpha;

  const hadEnergy = session_means.energyRatio != null;

  if (!existing) {
    if (!qualityOk) {
      const out = NextResponse.json(
        { updated: false, message: "Session below quality threshold" },
        { status: 200 }
      );
      copyCookies(cookieRes, out);
      return out;
    }
    const { error: insertErr } = await supabase.from("user_sniper_profile").insert({
      user_id: user.id,
      session_count: 1,
      sessions_with_energy_count: hadEnergy ? 1 : 0,
      baseline_wpm: session_means.paceWpm,
      baseline_pause_ms: session_means.avgPauseMs,
      baseline_dynamic_db: session_means.dynamicRangeDb,
      baseline_emphasis_per_min: session_means.emphasisPerMin,
      baseline_energy_ratio: session_means.energyRatio ?? null,
    });
    if (insertErr) {
      console.error("[sniper-profile POST insert]", insertErr.message);
      const out = NextResponse.json({ error: "Failed to create profile" }, { status: 500 });
      copyCookies(cookieRes, out);
      return out;
    }
    const { data: created } = await supabase
      .from("user_sniper_profile")
      .select("*")
      .eq("user_id", user.id)
      .single();
    const out = NextResponse.json(created ?? { updated: true });
    copyCookies(cookieRes, out);
    return out;
  }

  if (!qualityOk) {
    const out = NextResponse.json(existing, { status: 200 });
    copyCookies(cookieRes, out);
    return out;
  }

  const prevWpm = existing.baseline_wpm ?? session_means.paceWpm;
  const prevPause = existing.baseline_pause_ms ?? session_means.avgPauseMs;
  const prevDynamic = existing.baseline_dynamic_db ?? session_means.dynamicRangeDb;
  const prevEmphasis = existing.baseline_emphasis_per_min ?? session_means.emphasisPerMin;
  const prevEnergy =
    existing.baseline_energy_ratio ?? session_means.energyRatio ?? 1;

  const newWpm = oneMinusAlpha * prevWpm + alpha * session_means.paceWpm;
  const newPause = oneMinusAlpha * prevPause + alpha * session_means.avgPauseMs;
  const newDynamic = oneMinusAlpha * prevDynamic + alpha * session_means.dynamicRangeDb;
  const newEmphasis =
    oneMinusAlpha * prevEmphasis + alpha * session_means.emphasisPerMin;
  const newEnergy =
    session_means.energyRatio != null
      ? oneMinusAlpha * prevEnergy + alpha * session_means.energyRatio
      : prevEnergy;

  const { error: updateErr } = await supabase
    .from("user_sniper_profile")
    .update({
      session_count: existing.session_count + 1,
      sessions_with_energy_count:
        existing.sessions_with_energy_count + (hadEnergy ? 1 : 0),
      baseline_wpm: newWpm,
      baseline_pause_ms: newPause,
      baseline_dynamic_db: newDynamic,
      baseline_emphasis_per_min: newEmphasis,
      baseline_energy_ratio: newEnergy,
    })
    .eq("user_id", user.id);

  if (updateErr) {
    console.error("[sniper-profile POST update]", updateErr.message);
    const out = NextResponse.json({ error: "Failed to update profile" }, { status: 500 });
    copyCookies(cookieRes, out);
    return out;
  }

  const { data: updated } = await supabase
    .from("user_sniper_profile")
    .select("*")
    .eq("user_id", user.id)
    .single();
  const out = NextResponse.json(updated ?? { updated: true });
  copyCookies(cookieRes, out);
  return out;
}

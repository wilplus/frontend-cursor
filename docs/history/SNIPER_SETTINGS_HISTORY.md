# Sniper (Strength/Pace Dartboard) — Settings History

Quick reference so we can identify which phase felt best and what changed when.

---

## Phase 1 — Original (before our session)

**Hook (`useRealtimeStrengthPace`):**
- **Model:** Reactive. Dual EMA (fast/slow) per axis, adaptive blend. Output = `strengthScore`, `paceScore`, `strengthDirection`, `paceDirection`.
- **Strength:** TARGET_DB -18, TOLERANCE_DB 5. `bandScore(dB, target, tolerance)` → 0–1. Asymmetric: quieter penalized more (×0.78), louder less (×0.45). Silence → center drift (alpha 0.04).
- **Pace:** TARGET_WPM 165, TOLERANCE_WPM 60. **Voiced ratio** (RMS > threshold over 3 s window) × 160 + 60 = “WPM” (not real syllables). `bandScore(wpm, target, tolerance)`.
- **Update:** 100 ms tick. VAD: voice on 2 frames, voice off 3 frames; on silence → callbacks `onVoiceDrop` / `onSilenceSettled` (dartboard ref).
- **Dartboard:** Received 4 props; `ballPosition(score, direction)` with SOFT_DEADZONE 0.1, MIN_DIRECTION_ERROR 0.12, TARGET_SCALE_EXP 1.4. **Spring** animation (stiffness 0.045, damping 0.86, max vel 1.5), rate-limited target (0.014 toward edge, 0.035 toward center). Coherent/authority/tension visuals.

**Feel:** Very reactive; ball could jump and lean (e.g. “always leaning weak”).

---

## Phase 2 — Drop-in (1€ + syllable rate)

**Hook:**
- **Model:** Reactive with smoothing. Output = `targetX`, `targetY` in [-1, 1]. Single 1€ filter per axis, then continuous deadzone.
- **Strength:** TARGET_DB -20, DB_TOLERANCE 8. Raw = (dB - target) / tolerance; 1€ → deadzone 0.06.
- **Pace:** Real **syllable-rate** detector (peak counting). TARGET_SYL 3.5, SYL_TOLERANCE 1.5. Same pipeline.
- **Audio:** HP 80 Hz, HS +3 dB at 2 kHz, FFT 4096, 50 ms tick. Silence: grace 600 ms, then fade over 2000 ms.
- **Dartboard:** Props = `targetX`, `targetY` only. Spring kept (or lerp 0.075 in spec). No ref. A2-style visuals later.

**Feel:** Smoother than Phase 1; less jumpy. Pace based on real syllables.

---

## Phase 3 — “Center on pause” + bright + less weak bias

**Hook:**
- TARGET_DB **-26**, DB_TOLERANCE **10**, **STRENGTH_QUIET_SOFTEN 0.5** (softer “too quiet”).
- SYL_TOLERANCE **2.0**. DEADZONE **0.14**. SILENCE_GRACE_MS **350**; silence blend to 0 (no long fade constant).
- **Dartboard:** A2-Light: rings orange/visible, ball orange #FF6A00, white stroke, gradient field.

**Feel:** Ball could reach center at normal volume; less “always weak”. Still reactive (instant error → smoothed target).

---

## Phase 4 — A2-Light Apple (lerp motion, no spring)

**Hook:**
- Same as Phase 3. Added: **silence = center lock** (force target 0,0 after 350 ms). **Micro drift kill:** if score > 0.94 → x,y = 0.
- **Dartboard:** **Spring removed.** Single **lerp** to target: `LERP = 0.075`. No tension/authority/coherent logic. Ball r=12, stroke 2.5, subtle highlight. Rings softer (0.06, 0.05, 0.04).

**Feel:** Calm, magnetic glide; no overshoot. Silence = grounded center.

---

## Phase 5 — “Gradual” (rate-limited target, long silence drop)

**Hook:**
- **Smooth target** (smoothTargetX/Y) **lerps toward raw error:** `TARGET_LERP = 0.04`. So target moves slowly toward current error (reactive but smoothed).
- **Long silence:** After **2500 ms** silence, targetY ramps to **-0.45** over **3500 ms** (ball drifts down). Before that, target = (0,0).
- Raw still from 1€ + deadzone; in-range snap (dist < 0.08 → 0).

**Feel:** Ball “starts” leaving center slowly; long pause = slow drop. Still “instantaneous deviation influences target every tick,” just slowly.

---

## Phase 6 — Behavioral accumulator (current)

**Hook:**
- **Model:** Accumulator. `driftX`, `driftY` in [-1, 1]. **Only integrate when outside healthy zone;** decay when in zone.
- **Healthy zones:** |strength| < **0.6**, pace **3.6–4.4 syl/s**, silence < **1.5 s**.
- **Drift (per second):** strength **0.25**, pace **0.20**, silence **0.15**. **Recovery:** `*= 0.85` per 50 ms tick when in zone.
- Strength/pace still from 1€-smoothed raw (for zone decisions only). No bandScore; no direct score→position.

**Dartboard:** Unchanged (lerp 0.075, A2-Light).

**Feel (reported):** Ball “only moves up and down,” “really slow,” not dynamic. X (strength) barely moves; overall too sluggish.

---

## Summary table

| Phase | Model           | Strength target/tol      | Pace source     | Motion           | Silence        | Notes                    |
|-------|-----------------|--------------------------|------------------|------------------|----------------|--------------------------|
| 1     | Reactive, dual EMA | -18 dB, ±5             | Voiced ratio WPM | Spring, rate-limited | Center drift   | Jumpy, leaned weak      |
| 2     | Reactive, 1€    | -20, ±8                  | Syllable rate    | Spring/lerp      | Grace + fade   | Smoother, real syllables |
| 3     | Same + soften   | -26, ±10, quiet×0.5      | Same             | Same             | Blend to 0     | Center reachable, bright |
| 4     | Same            | Same                     | Same             | **Lerp 0.075**   | **Center lock**| Calm, no spring          |
| 5     | Smooth target   | Same                     | Same             | Target lerp 0.04 | Long drop ramp | Gradual drift             |
| 6     | **Accumulator** | Healthy &lt; 0.6          | 3.6–4.4 syl/s    | Drift + decay    | &lt;1.5 s ok   | Only Y + slow (current)  |

---

## When it was “best”

- **Most responsive / dynamic:** Phase 1 or 2 (reactive, spring or strong smoothing).
- **Best “calm and centered” (Apple feel):** Phase 4 (lerp motion, center lock, no punishment visuals).
- **Best “sustained pattern” idea:** Phase 6 (accumulator), but current tuning (narrow healthy zone, low drift rate, strong decay) makes it mostly Y and slow.

---

## Next options

1. **Revert to Phase 4** — Keep lerp motion + center lock; drop accumulator; back to “smoothed error → target” (e.g. Phase 5 style but with faster TARGET_LERP so it’s more dynamic).
2. **Keep accumulator, retune** — Widen or rebalance healthy zones, **increase drift rates** (e.g. 0.5–0.6/s), **strengthen strength path** so X moves (e.g. tighter HEALTHY_STRENGTH or higher DRIFT_STRENGTH_PER_S), slightly slower recovery (e.g. 0.9) so drift is more visible.
3. **Hybrid** — Accumulator for “sustained” feel but with faster rates and both axes tuned so horizontal (strength) is as visible as vertical (pace).

# Mobile styling: evaluation vs screenshot

Evaluation of the proposed mobile changes against the **screenshot** (Step 3, Final task, dartboard, header). Goal: naturally adjusted layout, better spacing, bigger font, mobile app-like feel.

---

## Screenshot issues

| Issue | Cause | In original plan? |
|------|--------|-------------------|
| Logout / header cut off | Header has no horizontal padding or responsive layout | No – header was not in the plan |
| "nal task" and description cut off | No horizontal padding on flow container; text may not wrap | Partially – we had "element sizing" but not overflow/wrap |
| "Quiet" / "Loud" at edges | StrengthPaceDartboard uses max-w-[420px]; on narrow screens labels sit at edges | No – dartboard was not in the plan |
| Progress (1–5) tight | Possible; needs to sit inside padded area | Briefly mentioned |
| Overall "doesn't fit" | Root/flow container has little or no horizontal padding | Yes – but not as the main fix |

---

## Do the proposed changes meet your criteria?

| Criterion | Verdict |
|-----------|--------|
| Naturally adjusted on mobile | Partially – need one flow wrapper with horizontal padding + overflow/wrap rules |
| Better spaced | Yes – once we add horizontal padding to shell and header |
| Bigger font | Yes – 16px root, text-base for body/inputs |
| Mobile app-like feeling | Partially – add consistent horizontal padding and fix clipping |

**Conclusion:** The original plan is right in direction but **does not fully meet your criteria** until we add:

1. A **single mobile-safe layout wrapper** (horizontal padding + min-w-0 / overflow so text wraps).
2. **Header** responsive behavior and same padding so Logout is never cut off.
3. **Dartboard** smaller or narrower on mobile so "Quiet" and "Loud" stay inside the padded area.
4. **Text blocks** with normal wrapping (break-words, no fixed width that truncates).

---

## Refined plan (additions)

### 1. Mobile layout wrapper (fixes most cut-off)

- **Where:** Layout or page that wraps header + main content.
- **Change (mobile only):** Horizontal padding (e.g. px-4 or px-5). Main content column: min-w-0 in flex contexts so text wraps. Optional: safe-area insets for notched devices.
- **Result:** Header, progress, task text, dartboard sit inside padded area; nothing touches screen edges.

### 2. Header

- **Where:** Component that renders app name + email + Logout.
- **Change:** Same horizontal padding; responsive header (shorter email, smaller text, or wrap) so Logout stays visible. min-w-0 / overflow-hidden on the middle part so the right side is not clipped.
- **Result:** Willab, email, Logout all visible.

### 3. Text blocks

- **Where:** Homework flow blocks (Final task, warm-up, report).
- **Change:** Parent is the padded container. Use break-words; avoid fixed width; min-w-0 on flex children that contain text.
- **Result:** Titles and descriptions wrap; no horizontal clipping.

### 4. Strength/pace dartboard

- **Where:** StrengthPaceDartboard.tsx and AudioRecorder.
- **Change:** On mobile, smaller size (e.g. size={260}) or responsive max-width for the row (e.g. max-w-[min(420px,calc(100vw-2rem))]) so Quiet + SVG + Loud fit inside padded area.
- **Result:** Wheel and labels fit; "Loud" not cut off.

### 5. Progress bullets

- Ensure inside the same padded wrapper; reduce gap on mobile if needed so all five fit.

### 6. Rest (unchanged)

- 16px root on mobile; 16px inputs; scroll-margin on focus; unified background.

---

## Implementation order

1. Mobile layout wrapper (padding + min-w-0 / overflow).
2. Header (padding + responsive layout).
3. Dartboard (responsive size / max-width).
4. Text blocks (break-words, min-w-0).
5. Progress (confirm inside padded wrapper).
6. Typography and inputs (16px, scroll-margin).

---

## Summary

The **original plan** covered spacing, fonts, and inputs but did **not** address header, dartboard, or the root cause of cut-off (missing horizontal padding and overflow/wrap). The **refined plan** adds a mobile-safe layout wrapper, header responsiveness, dartboard sizing, and text wrapping. With that, the changes **do** meet your criteria.

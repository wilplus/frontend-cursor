# Mobile styling plan – evaluation vs screenshot

This doc evaluates the earlier proposed changes against the **actual screenshot** (Step 3 – Final task, dartboard, header) and refines the plan so it directly fixes: text cut-off, spacing, and a mobile app–like feel.

---

## Screenshot issues (what we see)

| Issue | Where it comes from | In original plan? |
|-------|--------------------|--------------------|
| **"Logout" and header cut off** | App header (brand + email + Logout) has no horizontal padding or responsive layout; content overflows. | ❌ Not mentioned – header was missing from the plan. |
| **"nal task" (Final task title cut off)** | Same: container has no padding / has overflow. | ⚠️ Partially – we had “element sizing” but not explicit overflow/wrap rules. |
| **Task description text cut off on the right** | Final task block (and similar blocks) may use fixed width or lack `min-w-0` in a flex context; text doesn’t wrap or container overflows. | ⚠️ Partially – need explicit overflow + word-wrap. |
| **"Quiet" / "Loud" at screen edges** | `StrengthPaceDartboard`: row is `max-w-[420px]` with two `w-16` labels; on narrow screens the row fills the width and labels sit at the edges and get clipped. | ❌ Not mentioned – dartboard wasn’t in the plan. |
| **Progress circles (1–5) possibly tight** | Step bullets might be too wide or have no side margin on very small viewports. | ✅ Mentioned briefly; needs concrete padding. |
| **Overall “doesn’t fit”** | Root/flow container likely has little or no horizontal padding, so everything touches or overflows the edges. | ✅ “Horizontal padding” was in the plan but not as the primary fix. |

---

## Do the proposed changes meet your criteria?

| Your criterion | Original plan | Verdict |
|----------------|--------------|--------|
| **Naturally adjusted on mobile** | Sizing and padding were generic. | ⚠️ **Partially** – we must add: (1) one main flow container with horizontal padding on mobile, (2) no overflow (body/container), (3) text that wraps. |
| **Better spaced** | Card padding, spacing, horizontal padding were mentioned. | ✅ **Yes** – once we explicitly add **horizontal padding to the main shell and header** and ensure the dartboard doesn’t hit the edges. |
| **Bigger (font)** | 16px root, `text-base` for body/inputs. | ✅ **Yes** – and we should keep 16px so inputs don’t zoom. |
| **Mobile app–like feeling** | Unified background, single column. | ⚠️ **Partially** – we should add: consistent horizontal padding (e.g. 16–20px), safe-area where useful, and ensure nothing is clipped so it feels like a contained app. |

**Conclusion:** The original plan is the right direction but **does not fully meet your criteria** until we add:

1. **Root cause of cut-off:** One wrapper for the whole app (or at least homework flow + header) with horizontal padding on mobile and `overflow-x: hidden` / `min-w-0` where needed so text wraps and nothing overflows.
2. **Header:** Responsive header (shorter email or icon, smaller “Logout”) and the same horizontal padding so “Logout” is never cut off.
3. **Dartboard:** On mobile, make the strength/pace wheel smaller or its container narrower so “Quiet” and “Loud” stay inside the padded area.
4. **Text blocks:** Ensure task and description blocks use normal wrapping and are inside the padded container (no fixed width that causes truncation).

---

## Refined plan (additions to meet the screenshot)

### 1. One mobile-safe layout wrapper (fixes most cut-off)

- **Where:** The layout or page that wraps the header + main content (e.g. dashboard layout or homework page wrapper).
- **Change:** On mobile (`max-width: 640px` or Tailwind `sm:`):
  - Add horizontal padding: `px-4` or `px-5` (16–20px).
  - Optionally use safe-area: `px-[max(1rem,env(safe-area-inset-left))]` for notched devices.
  - Ensure the main content column has `min-w-0` if it’s inside a flex container (so text can shrink and wrap instead of overflowing).
- **Result:** Header, progress, task text, and dartboard all sit inside the padded area; nothing touches or goes past the screen edges.

### 2. Header (fix “Logout” and “llab” cut-off)

- **Where:** The component that renders the app name (Willab) + user email + “Logout”.
- **Changes:**
  - Wrap header content in the same horizontal padding as above, or give the header itself `px-4` on mobile.
  - Make the header responsive so it doesn’t overflow:
    - e.g. shorten email to “a.will…@gmail.com” or hide on very small screens; or use a menu so “Logout” is in a dropdown.
    - Or: smaller text on mobile (`text-sm`), flex-wrap so “Logout” can move to a second line if needed, or icon + “Logout” with smaller padding.
  - Ensure the header bar has `min-w-0` and `overflow-hidden` on the middle (email) so the right side (“Logout”) stays visible.
- **Result:** “Willab”, email, and “Logout” are fully visible and not cut off.

### 3. Text blocks (fix “Final task” and description cut-off)

- **Where:** Homework flow steps that show titles and body text (e.g. “Final task”, warm-up task, report text).
- **Changes:**
  - Ensure the parent of these blocks is the padded container (so they don’t extend full viewport width with no margin).
  - Use `break-words` or `overflow-wrap: break-word` on long paragraphs so long words wrap instead of overflowing.
  - Avoid fixed widths on these blocks; use `min-w-0` on flex children that contain text.
- **Result:** “Final task” and the full description are visible and wrap; no horizontal clipping.

### 4. Strength/pace dartboard (fix “Quiet” / “Loud” at edges)

- **Where:** `StrengthPaceDartboard.tsx` and where it’s used (`AudioRecorder`).
- **Changes:**
  - On mobile, reduce the dartboard’s effective width so the whole row (Quiet + SVG + Loud) fits inside the padded content area:
    - Option A: Pass a smaller `size` from `AudioRecorder` on mobile (e.g. `size={260}` when viewport &lt; 640px).
    - Option B: In `StrengthPaceDartboard`, use a responsive max-width for the row, e.g. `max-w-[min(420px,calc(100vw-2rem))]` or `max-w-[85vw]` so the row never exceeds the padded area.
  - Optionally reduce label font size slightly on mobile so “Quiet” and “Loud” don’t need as much space.
- **Result:** The wheel and its labels fit within the screen with padding; “Loud” is not cut off.

### 5. Progress step bullets (1–5)

- **Where:** `ProgressStepBullets` / `StepFlowWrapper`.
- **Change:** Ensure the step indicator is inside the same padded wrapper; if needed, slightly reduce gap between circles on mobile (`gap-0` with smaller connector width) so all five fit without horizontal scroll.
- **Result:** Progress indicator fits and doesn’t cause overflow.

### 6. Globals and typography (unchanged from original plan)

- **Root font size:** 16px on mobile (remove 14px) for readability and to avoid iOS input zoom.
- **Inputs/textareas:** 16px on mobile + scroll-margin so focus doesn’t hide content.
- **Unified background:** `bg-background` on body/shell.

---

## Implementation order (revised)

1. **Mobile layout wrapper** – Add horizontal padding and `min-w-0` / overflow rules to the root content wrapper (and ensure header is inside it). This alone should fix most of the “cut off” appearance.
2. **Header** – Same padding + responsive layout so “Logout” and title are always visible.
3. **Dartboard** – Responsive size or max-width so “Quiet”/“Loud” stay inside the padded area.
4. **Text blocks** – `break-words` and `min-w-0` where needed.
5. **Progress** – Confirm it’s inside the padded wrapper; tighten if necessary.
6. **Typography and inputs** – 16px root, input font size, scroll-margin (as in the original plan).

---

## Summary

- **Original plan:** Good for spacing, fonts, and inputs, but **did not** explicitly address the header, the dartboard, or the root cause of text and UI cut-off (missing horizontal padding and overflow/wrap).
- **Refined plan:** Adds a **single mobile-safe layout wrapper** with horizontal padding, **header responsiveness**, **dartboard sizing**, and **text wrapping rules**. With that, the proposed changes **do** meet your criteria: naturally adjusted, better spaced, bigger font, and a more app-like mobile experience without content cut off.

If you want to proceed, implementation should start with the mobile layout wrapper and header, then dartboard and text blocks.

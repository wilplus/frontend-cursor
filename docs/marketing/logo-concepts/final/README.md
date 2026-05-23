# WillpowerLab — locked logo system

Final visual identity. Anything outside `final/` is exploration; this folder is the source of truth.

## What's locked

**Mark:** The Reticle — a crosshair circle with a center score-dot.
**Wordmark:** `WillpowerLab` in Inter Semibold (600), CamelCase, letter-spacing -0.025em.
**Primary color:** `#F97316` (orange). Reserved for the mark and the score-dot; never for body text.
**Wordmark color:** `#1A1714` (warm ink) on light surfaces; `#FBF8F4` (warm cream) on dark.

## Files

| File | Use |
|---|---|
| `reticle-mark.svg` | Primary mark, transparent background. Use on any cream / white surface. |
| `reticle-favicon.svg` | Simplified for ≤32px (ticks removed, thicker stroke). Browser tab, app shortcut, social avatar at small size. |
| `reticle-lockup-horizontal.svg` | Default lockup. Use everywhere by default: navbar, footer, decks, business cards. |
| `reticle-lockup-stacked.svg` | Vertical lockup. Use for square placements: social avatars, app store hero, conference signage. |
| `reticle-app-icon-light.svg` | Rounded-rect icon on warm cream — light mode app shortcut. |
| `reticle-app-icon-dark.svg` | Rounded-rect icon on warm ink — dark mode app shortcut, premium-feel social avatar. |

## Sizing rules

| Size | Variant | Why |
|---|---|---|
| ≥ 40px | Full Reticle (with ticks) | All four ticks read clearly; brand fully expressed. |
| 24–40px | Full Reticle (with ticks) | Acceptable but check legibility per surface. |
| ≤ 24px | `reticle-favicon.svg` (ring + dot only) | Ticks disappear at small sizes; use the simplified favicon. |

## Clear space

Minimum clear space around the mark and lockup = the diameter of the center dot, on all sides. Never crop tighter.

## Do

- Use the orange `#F97316` only for the mark, score-dots in product, primary CTAs.
- Keep the wordmark in CamelCase: `WillpowerLab`. Never `willpowerlab`, never `WILLPOWERLAB`, never `Willpower Lab` (with a space) outside of long-form prose.
- Pair with the warm-cream background (`#FBF8F4`) for marketing surfaces; pure white is acceptable but cooler.

## Don't

- Don't change the mark's color. The mark is orange; it never appears in any other hue.
- Don't add a gradient, drop shadow, glow, or stroke effect to the mark.
- Don't rotate the mark. The crosshair is axis-aligned.
- Don't replace any character of the wordmark with the mark (e.g. dot of `i`). The mark and wordmark are siblings, not substitutes.
- Don't put the mark inside a colored container other than `app-icon-light` / `app-icon-dark`.
- Don't reproduce the mark below 16px. Below that, use just the center dot.

## Refinement

These SVGs are production-ready as baseline. Open in Figma to refine:
- Optical tuning of tick lengths and gap between tick and ring.
- Letter-spacing on the wordmark for specific surfaces.
- Export PNG / PDF at the sizes you need.

Exploration history (the rejected concepts) lives in the parent `logo-concepts/` folder for reference.

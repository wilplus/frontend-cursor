/**
 * Single-slot chat UI primitives.
 *
 * Each slot is ONE actionable component for the chat's bottom toolbar.
 * They are mutually exclusive: at any moment the bottom shows exactly
 * one of these. The bot bubble immediately above the slot is the
 * question; the slot is the user's only way to answer.
 *
 * Visual contract — every slot:
 *   - Is the only interactive thing in the bottom region.
 *   - Has tap targets ≥ 44×44 px.
 *   - Uses `active:scale-*` for haptic feel.
 *   - Pulls valence from semantic tokens (success/danger/primary).
 *
 * Reuse map — what each slot is for:
 *   - MicButton        : voice answer (onboarding, post-snippet, lounge)
 *   - UploadDrop       : "send me your file" answer
 *   - TextComposer     : type-only answer (no mic, no upload)
 *   - RatePills        : 1–10 self-rating
 *   - CharismaStress   : binary snippet label
 *   - SignupCta        : single full-width primary CTA
 *   - YesNoPills       : every binary consent moment (mic/share/email/terms)
 */

export { MicButton, type MicButtonProps } from "./MicButton";
export { UploadDrop, type UploadDropProps } from "./UploadDrop";
export { TextComposer, type TextComposerProps } from "./TextComposer";
export { RatePills, type RatePillsProps } from "./RatePills";
export {
  CharismaStress,
  type CharismaStressProps,
  type CharismaStressValue,
} from "./CharismaStress";
export { SignupCta, type SignupCtaProps } from "./SignupCta";
export { YesNoPills, type YesNoPillsProps, type YesNoValue } from "./YesNoPills";

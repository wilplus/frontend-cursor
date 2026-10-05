import {
  aiGeneratedAttrs,
  aiGeneratedLabel,
  aiGeneratedJsonLdScript,
  type GeneratedKind,
} from "@/lib/willab/aiGeneratedMark";

/* -------------------------------------------------------------------------- */
/*  AiGeneratedNote — the visible half of the Article 50(2) mark.              */
/*                                                                            */
/*  One module, every mount, for the same reason IdealTextHeading is one:      */
/*  a copy is how two surfaces drift, and here a drift means one of them       */
/*  quietly stops saying the text was generated.                               */
/*                                                                            */
/*  It carries BOTH halves of the marking so they cannot be mounted apart —    */
/*  the sentence a person reads, and the JSON-LD a parser reads. The `data-*`  */
/*  attributes belong on the element wrapping the generated TEXT rather than   */
/*  on this note, so callers spread `aiGeneratedAttrs()` there as well; this   */
/*  component carries them too so that a note mounted on its own is still      */
/*  self-describing.                                                           */
/*                                                                            */
/*  AC-9: this states provenance. It is not a score, a rating, a band or a     */
/*  verdict. Its one number is the Take shown ("AI-generated text · Take N",  */
/*  founder 2026-10-05, N48.3 Q8 A), which names the text, never rates it.    */
/* -------------------------------------------------------------------------- */

export default function AiGeneratedNote({
  kind,
  name,
  take = null,
  className = "",
}: {
  kind: GeneratedKind;
  /** The Take whose text is shown; the Ideal Text caption names it. */
  take?: number | null;
  /** The project's own name, when the surface has one — it makes the JSON-LD
   *  identify WHICH document rather than the generic kind. Never rendered. */
  name?: string | null;
  className?: string;
}) {
  return (
    <>
      <p
        {...aiGeneratedAttrs(kind)}
        className={`text-[11px] leading-snug text-muted-foreground ${className}`}
      >
        {aiGeneratedLabel(kind, take)}
      </p>
      <script
        type="application/ld+json"
        // Our own constant, with `<` escaped by aiGeneratedJsonLdScript. This
        // is the documented way to inline JSON-LD in a React tree.
        dangerouslySetInnerHTML={{ __html: aiGeneratedJsonLdScript(kind, { name }) }}
      />
    </>
  );
}

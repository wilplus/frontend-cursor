import {
  AI_GENERATED_LABEL,
  aiGeneratedAttrs,
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
/*  verdict, and nothing numeric may ever be added to it.                      */
/* -------------------------------------------------------------------------- */

export default function AiGeneratedNote({
  kind,
  name,
  className = "",
}: {
  kind: GeneratedKind;
  /** The project's own name, when the surface has one — it makes the JSON-LD
   *  identify WHICH document rather than the generic kind. Never rendered. */
  name?: string | null;
  className?: string;
}) {
  return (
    <>
      <p
        {...aiGeneratedAttrs(kind)}
        className={`text-[12px] leading-snug text-muted-foreground ${className}`}
      >
        {AI_GENERATED_LABEL[kind]}
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

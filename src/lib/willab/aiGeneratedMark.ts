/* -------------------------------------------------------------------------- */
/*  Article 50(2) marking of AI-generated text                                 */
/*                                                                            */
/*  Regulation (EU) 2024/1689 Art. 50(2), in force since 2 August 2026:        */
/*  providers of AI systems generating synthetic text "shall ensure the        */
/*  outputs of the AI system are marked in a machine-readable format and       */
/*  detectable as artificially generated or manipulated".                      */
/*                                                                            */
/*  Two outputs are in scope, and the legal pack says why                      */
/*  (`legal/phase1-2026.1/03-article-50-assessment` §3): the Ideal Text,       */
/*  because it is a generated presentation document rather than a cleaned-up   */
/*  transcript, and Manager Feedback, because it is generated text in the      */
/*  same sense. TRANSCRIPTS ARE NOT: a transcript represents what the user     */
/*  actually said, so nothing here marks one. Neither is a coach's own         */
/*  writing — `origin: "coach"` is a human author and marking it would be a    */
/*  false claim, so callers pass only machine-origin text.                     */
/*                                                                            */
/*  WHAT THE MARK MEANS. The value is the ratified IPTC NewsCode               */
/*  `trainedAlgorithmicMedia` — "created purely by an algorithm not based on   */
/*  any sampled training content" in IPTC's own vocabulary, and the term       */
/*  C2PA carries for the same claim. Using the published vocabulary rather     */
/*  than a word we invented is the point: it is what makes the marking mean    */
/*  something to a reader that is not us.                                      */
/*                                                                            */
/*  WHAT IS NOT DONE, AND DELIBERATELY. Zero-width or otherwise invisible      */
/*  watermarking of user-facing text is rejected by name in the assessment     */
/*  and stays rejected: it is a covert mark on text the user believes is       */
/*  theirs, it corrupts the text for any downstream tool, and it survives      */
/*  paste precisely because nobody can see it. The plain-text clipboard        */
/*  flavour is therefore left EXACTLY as the user sees it — no appended        */
/*  attribution line, no hidden characters. A trailing sentence is not a       */
/*  machine-readable format, so it would cost the user something real and buy  */
/*  no compliance.                                                             */
/* -------------------------------------------------------------------------- */

/** IPTC NewsCodes `digitalsourcetype` term for wholly model-generated content.
 *  Ratified vocabulary, also the value C2PA assertions carry. */
export const IPTC_TRAINED_ALGORITHMIC_MEDIA =
  "http://cv.iptc.org/newscodes/digitalsourcetype/trainedAlgorithmicMedia";

/** Named in the mark so a reader can tell WHOSE system generated the text. */
export const AI_GENERATED_PRODUCER = "WillpowerLab";

/** The two generated artifacts Art. 50(2) attaches to. Not a general-purpose
 *  enum: adding a member is a statement that a new kind of synthetic content
 *  is surfaced, which `03-article-50-assessment` §7 lists as a re-assessment
 *  trigger. */
export type GeneratedKind = "ideal-text" | "manager-feedback";

const KIND_NAME: Record<GeneratedKind, string> = {
  "ideal-text": "Ideal Text",
  "manager-feedback": "Feedback",
};

/** The visible half of "detectable as artificially generated".
 *
 *  Wording tracks `copy/ai-notice-1.0.txt` on purpose — the notice the user
 *  accepted says "THE DOCUMENTS YOU GET BACK ARE WRITTEN BY AI" and "Both can
 *  be wrong", so the label at the surface uses the same words rather than a
 *  second vocabulary for the same fact. AC-9 holds: it is a statement of
 *  provenance, never a score, rating, band or verdict. */
export const AI_GENERATED_LABEL: Record<GeneratedKind, string> = {
  /* SHORTENED (founder 2026-09-22): "can you make it smaller text and shorter
     text; or maybe same font but shorter". It ran to a full line under the
     document and read as a disclaimer rather than a mark.

     What was cut is the advice — "from what you said", "so check it before you
     present" — and what stays is the claim: written by AI, it can be wrong.
     Those two are not decoration. They are the words `copy/ai-notice-1.0.txt`
     uses, which is the notice the user accepted, and a surface that says the
     same fact in different words is how a reader ends up thinking they are two
     different facts. It is also the visible half of Art. 50(2) detectability;
     the machine-readable half is untouched either way.

     Both kinds now carry the identical sentence, which is the same one the
     feedback surface always had. One wording, two surfaces. */
  "ideal-text": "Written by AI — it can be wrong.",
  "manager-feedback": "Written by AI — it can be wrong.",
};

/** Machine-readable marking as DOM attributes, for the element that wraps the
 *  generated text. Spread onto a JSX element; `data-*` needs no allow-list. */
export function aiGeneratedAttrs(kind: GeneratedKind): {
  "data-ai-generated": "true";
  "data-ai-generated-kind": GeneratedKind;
  "data-ai-generated-source-type": string;
  "data-ai-generated-producer": string;
} {
  return {
    "data-ai-generated": "true",
    "data-ai-generated-kind": kind,
    "data-ai-generated-source-type": IPTC_TRAINED_ALGORITHMIC_MEDIA,
    "data-ai-generated-producer": AI_GENERATED_PRODUCER,
  };
}

/** The same claim as JSON-LD, which is what a parser that is not looking for
 *  our `data-*` names will find. The context maps `digitalSourceType` to the
 *  IPTC scheme so the term is resolvable rather than a bare string. */
export function aiGeneratedJsonLd(
  kind: GeneratedKind,
  opts: { name?: string | null } = {},
): Record<string, unknown> {
  return {
    "@context": {
      schema: "https://schema.org/",
      digitalSourceType: {
        "@id": "http://cv.iptc.org/newscodes/digitalsourcetype/",
        "@type": "@id",
      },
    },
    "@type": "schema:CreativeWork",
    "schema:name": opts.name?.trim() || KIND_NAME[kind],
    "schema:creator": {
      "@type": "schema:SoftwareApplication",
      "schema:name": AI_GENERATED_PRODUCER,
    },
    digitalSourceType: IPTC_TRAINED_ALGORITHMIC_MEDIA,
  };
}

/** JSON-LD as a string safe to place inside a `<script>` element. `<` is
 *  escaped because an unescaped `</script>` inside a JSON string would close
 *  the element early — the standard hazard of inlining JSON in HTML. */
export function aiGeneratedJsonLdScript(
  kind: GeneratedKind,
  opts: { name?: string | null } = {},
): string {
  return JSON.stringify(aiGeneratedJsonLd(kind, opts)).replaceAll("<", "\\u003c");
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

/** The `text/html` clipboard flavour: the generated text inside an element
 *  carrying the marking.
 *
 *  This is the export path the product actually controls. The assessment's
 *  §3 open item was written about a user pressing Ctrl-C, where nothing we do
 *  survives; a COPY BUTTON WE SHIP is a different question, and the answer to
 *  it is that the marking travels with the text into any rich target (a word
 *  processor, a slide deck, an email) while the plain-text flavour stays
 *  byte-identical to what the user reads. */
export function aiGeneratedClipboardHtml(
  plain: string,
  kind: GeneratedKind,
  opts: { name?: string | null } = {},
): string {
  const attrs = aiGeneratedAttrs(kind);
  const attrText = Object.entries(attrs)
    .map(([k, v]) => `${k}="${escapeHtml(v)}"`)
    .join(" ");
  const body = plain
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean)
    .map((block) => `<p>${escapeHtml(block).replaceAll("\n", "<br />")}</p>`)
    .join("");
  return (
    `<div ${attrText}>${body}` +
    `<script type="application/ld+json">${aiGeneratedJsonLdScript(kind, opts)}</script>` +
    `</div>`
  );
}

/** The same assertion as an XMP packet, for the PDF export.
 *
 *  `Iptc4xmpExt:DigitalSourceType` is the IPTC Extension property C2PA and the
 *  IPTC's own guidance use to carry this claim, so a reader that understands
 *  AI-provenance at all understands this. `dc:` and `xmp:` carry the same fact
 *  for readers that only know Dublin Core.
 *
 *  Kept here rather than in the PDF module on purpose: the proposal in
 *  `docs/AI-CONTENT-MARKING-PROPOSAL.md` §4 asks for one shared assertion so
 *  that C2PA can be added BESIDE this later instead of replacing three
 *  separately-worded copies of it.
 */
export function aiGeneratedXmp(opts: { name?: string | null } = {}): string {
  const name = opts.name?.trim() || "Presentation notes";
  const xml = (value: string) =>
    value
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;");
  return `<?xpacket begin="" id="W5M0MpCehiHzreSzNTczkc9d"?>
<x:xmpmeta xmlns:x="adobe:ns:meta/">
 <rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">
  <rdf:Description rdf:about=""
    xmlns:dc="http://purl.org/dc/elements/1.1/"
    xmlns:xmp="http://ns.adobe.com/xap/1.0/"
    xmlns:Iptc4xmpExt="http://iptc.org/std/Iptc4xmpExt/2008-02-29/">
   <dc:title><rdf:Alt><rdf:li xml:lang="x-default">${xml(name)}</rdf:li></rdf:Alt></dc:title>
   <dc:creator><rdf:Seq><rdf:li>${xml(AI_GENERATED_PRODUCER)}</rdf:li></rdf:Seq></dc:creator>
   <dc:description><rdf:Alt><rdf:li xml:lang="x-default">${xml(aiGeneratedAssertion())}</rdf:li></rdf:Alt></dc:description>
   <xmp:CreatorTool>${xml(AI_GENERATED_PRODUCER)}</xmp:CreatorTool>
   <Iptc4xmpExt:DigitalSourceType rdf:resource="${IPTC_TRAINED_ALGORITHMIC_MEDIA}"/>
  </rdf:Description>
 </rdf:RDF>
</x:xmpmeta>
<?xpacket end="w"?>`;
}

/** The one sentence every format carries, so a person opening an exported file
 *  in any of them reads the same claim. */
export function aiGeneratedAssertion(): string {
  return (
    `Contains AI-generated text produced by ${AI_GENERATED_PRODUCER}. ` +
    `digitalSourceType: ${IPTC_TRAINED_ALGORITHMIC_MEDIA}`
  );
}

/** Copy generated text to the clipboard with the marking attached.
 *
 *  Resolves true when something reached the clipboard. Degrades the way the
 *  rest of the app's copy buttons do (`components/ceo/CeoTasks.tsx`): a
 *  browser that refuses rich clipboard data still gets the plain text, because
 *  a copy button that silently does nothing is worse than an unmarked paste.
 */
export async function copyAiGeneratedText(
  plain: string,
  kind: GeneratedKind,
  opts: { name?: string | null } = {},
): Promise<boolean> {
  if (typeof ClipboardItem !== "undefined" && navigator.clipboard?.write) {
    try {
      await navigator.clipboard.write([
        new ClipboardItem({
          "text/plain": new Blob([plain], { type: "text/plain" }),
          "text/html": new Blob([aiGeneratedClipboardHtml(plain, kind, opts)], {
            type: "text/html",
          }),
        }),
      ]);
      return true;
    } catch {
      /* fall through — plain text remains usable */
    }
  }
  // `navigator.clipboard?.writeText(plain)` would evaluate to `undefined`
  // where the API is absent — a non-secure context is the live case — and
  // `await undefined` resolves, so the old shape returned true having copied
  // nothing and the button drew its "Copied" tick over a no-op. Worse here
  // than elsewhere: this function's whole job is to attach the Art. 50(2)
  // marking, so a false success is a claim that a marked copy happened.
  if (!navigator.clipboard?.writeText) return false;
  try {
    await navigator.clipboard.writeText(plain);
    return true;
  } catch {
    return false;
  }
}

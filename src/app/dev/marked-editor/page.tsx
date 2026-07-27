"use client";

import { useState } from "react";
import MarkedEditor from "@/components/willab/MarkedEditor";

/* -------------------------------------------------------------------------- */
/*  A harness for MarkedEditor, so its contentEditable behaviour can be driven */
/*  in a REAL browser.                                                         */
/*                                                                            */
/*  The serialization is unit-tested against jsdom, but the things that break  */
/*  a hand-rolled editor are not serialization: they are caret position after  */
/*  an intercepted keystroke, IME composition, select-all-then-type, and what  */
/*  the browser leaves in the DOM afterwards. None of that is reachable        */
/*  without a real engine, and this editor sits on the product's deliverable.  */
/*                                                                            */
/*  DEV ONLY. Production renders nothing: this is a test fixture, not a        */
/*  surface, and it must not become one. `?doc=` seeds the editor so a spec    */
/*  can pin its own starting document.                                        */
/* -------------------------------------------------------------------------- */

const DEFAULT_DOC = "say it **louder** and {{orange:clearer}}";

export default function MarkedEditorHarness() {
  const seed =
    typeof window !== "undefined"
      ? new URLSearchParams(window.location.search).get("doc")
      : null;
  const [value, setValue] = useState(seed ?? DEFAULT_DOC);

  if (process.env.NODE_ENV === "production") return null;

  return (
    <main className="p-6">
      <h1 className="mb-4 text-lg font-semibold">MarkedEditor harness (dev)</h1>
      <div data-testid="editor-host">
        <MarkedEditor value={value} onChange={setValue} />
      </div>
      {/* What would be PUT to the user-edit route, live. */}
      <pre
        data-testid="serialized"
        className="mt-6 whitespace-pre-wrap rounded-lg border border-border bg-muted p-3 text-xs"
      >
        {value}
      </pre>
    </main>
  );
}

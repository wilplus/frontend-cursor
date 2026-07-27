import { describe, expect, it } from "vitest";
import {
  extensionForContentType,
  filenameFromDisposition,
} from "./life";

/* -------------------------------------------------------------------------- */
/*  FE-11 — HONOUR THE RESPONSE Content-Type, NEVER THE REQUESTED ONE.         */
/*                                                                            */
/*  The endpoint degrades to markdown with a 200 when a renderer is            */
/*  unavailable. Naming the file after what we ASKED for would then save       */
/*  markdown inside a .pdf — a file the reader refuses to open, with nothing   */
/*  anywhere to explain why.                                                   */
/* -------------------------------------------------------------------------- */

describe("extensionForContentType", () => {
  it("names the file after what the server actually sent", () => {
    expect(extensionForContentType("application/pdf")).toBe(".pdf");
    expect(
      extensionForContentType(
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
      )
    ).toBe(".docx");
    expect(extensionForContentType("application/json")).toBe(".json");
    expect(extensionForContentType("text/markdown")).toBe(".md");
  });

  it("degrades to .md — which is what the endpoint degrades to", () => {
    // A pdf was requested and markdown came back: the file must be named .md.
    expect(extensionForContentType("text/markdown; charset=utf-8")).toBe(".md");
    expect(extensionForContentType("text/plain")).toBe(".md");
    expect(extensionForContentType("")).toBe(".md");
  });

  it("ignores charset and case when matching", () => {
    expect(extensionForContentType("APPLICATION/PDF; charset=binary")).toBe(".pdf");
  });
});

describe("filenameFromDisposition", () => {
  it("prefers the server's own name for the file", () => {
    expect(
      filenameFromDisposition('attachment; filename="strategy-v3.pdf"')
    ).toBe("strategy-v3.pdf");
    expect(filenameFromDisposition("attachment; filename=strategy.md")).toBe(
      "strategy.md"
    );
  });

  it("reads the RFC 5987 form, which is the one carrying non-ASCII names", () => {
    expect(
      filenameFromDisposition(
        "attachment; filename=\"fallback.pdf\"; filename*=UTF-8''strat%C3%A9gie.pdf"
      )
    ).toBe("stratégie.pdf");
  });

  it("falls back to null so the caller derives a name instead", () => {
    expect(filenameFromDisposition(null)).toBeNull();
    expect(filenameFromDisposition("attachment")).toBeNull();
    expect(filenameFromDisposition("inline")).toBeNull();
  });

  it("does not fail a download over a malformed escape", () => {
    // Falls back to the plain filename when there is one…
    expect(
      filenameFromDisposition(
        "attachment; filename=\"plain.pdf\"; filename*=UTF-8''bad%ZZname.pdf"
      )
    ).toBe("plain.pdf");
    // …and to null when there is not, so the caller derives a clean name from
    // the Content-Type rather than saving a file called "bad%ZZname.pdf".
    expect(
      filenameFromDisposition("attachment; filename*=UTF-8''bad%ZZname.pdf")
    ).toBeNull();
  });
});

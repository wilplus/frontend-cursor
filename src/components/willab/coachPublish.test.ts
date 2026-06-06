import { describe, expect, it } from "vitest";
import {
  buildPublishPayload,
  publishGate,
  type SnippetAuthor,
} from "./coachPublish";

const A = (over: Partial<SnippetAuthor> = {}): SnippetAuthor => ({
  label: null,
  note: "",
  tag: null,
  when: "",
  examples: "",
  ...over,
});

describe("publishGate (§14 publish floor)", () => {
  it("needs every snippet labeled AND ≥1 note+tag", () => {
    const ids = ["a", "b"];
    expect(publishGate(ids, { a: A(), b: A() }).canPublish).toBe(false);
    expect(
      publishGate(ids, {
        a: A({ label: "threat" }),
        b: A({ label: "challenge" }),
      }).canPublish
    ).toBe(false); // all labeled, no note+tag
    const g = publishGate(ids, {
      a: A({ label: "threat", note: "nice", tag: "strong" }),
      b: A({ label: "challenge" }),
    });
    expect(g).toEqual({ allLabeled: true, hasNotePlusTag: true, canPublish: true });
  });

  it("a note without a tag (or vice versa, or whitespace) doesn't satisfy the floor", () => {
    const ids = ["a"];
    expect(publishGate(ids, { a: A({ label: "threat", note: "x" }) }).hasNotePlusTag).toBe(false);
    expect(publishGate(ids, { a: A({ label: "threat", tag: "strong" }) }).hasNotePlusTag).toBe(false);
    expect(
      publishGate(ids, { a: A({ label: "threat", note: "   ", tag: "strong" }) }).hasNotePlusTag
    ).toBe(false);
  });

  it("is false for an empty session", () => {
    expect(publishGate([], {}).canPublish).toBe(false);
  });
});

describe("buildPublishPayload (split-sink)", () => {
  it("labels EVERY snippet, notes ONLY the noted+tagged, trims, overall null when blank", () => {
    const ids = ["a", "b", "c"];
    const authors = {
      a: A({ label: "threat", note: "open strong", tag: "strong" }),
      b: A({ label: "challenge" }), // labeled, no note → label only
      c: A({ label: "ambiguous", note: " rushed ", tag: "to_work_on" }),
    };
    const p = buildPublishPayload(ids, authors, "   ");
    expect(p.labels.map((l) => l.snippet_id)).toEqual(["a", "b", "c"]);
    expect(p.labels.map((l) => l.value)).toEqual(["threat", "challenge", "ambiguous"]);
    expect(p.notes).toEqual([
      { snippet_id: "a", note: "open strong", tag: "strong", when: null, examples: [] },
      { snippet_id: "c", note: "rushed", tag: "to_work_on", when: null, examples: [] },
    ]);
    expect(p.overallMessage).toBeNull();
  });

  it("carries trimmed When + line-split examples on noted snippets", () => {
    const p = buildPublishPayload(
      ["a"],
      {
        a: A({
          label: "threat",
          note: "n",
          tag: "strong",
          when: "  reuse it under pressure  ",
          examples: "Why should you care?\n\n  Why us? \n",
        }),
      },
      ""
    );
    expect(p.notes[0]?.when).toBe("reuse it under pressure");
    expect(p.notes[0]?.examples).toEqual(["Why should you care?", "Why us?"]);
  });

  it("keeps a trimmed non-empty overall message", () => {
    const p = buildPublishPayload(["a"], { a: A({ label: "threat" }) }, "  great  ");
    expect(p.overallMessage).toBe("great");
  });
});

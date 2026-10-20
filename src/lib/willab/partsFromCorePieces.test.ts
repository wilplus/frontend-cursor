/*
STORY    As a speaker, I want locking a paragraph never to merge my slides into one block of text, so that my deck keeps its slides.
OUTCOME
  O1  Paragraphs built from the server's pieces keep the server's paragraph identities.
PROVES   O1 -> keeps the core's Paragraph identity
WHY      Reported from real use 2026-09-18: a lock merged the whole presentation into one text.
*/
import { describe, expect, it } from "vitest";

import {
  partsFromCorePieces,
} from "./documentParts";

const A = "11111111-1111-4111-8111-111111111111";
const B = "22222222-2222-4222-8222-222222222222";

describe("partsFromCorePieces", () => {
  it("keeps the core's Paragraph identity", () => {
    const parts = partsFromCorePieces([
      { partId: A, text: "First slide words." },
      { partId: B, text: "Second slide words." },
    ]);
    expect(parts?.map((p) => p.id)).toEqual([A, B]);
  });
});

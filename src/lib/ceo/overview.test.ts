import { describe, expect, it } from "vitest";
import { artifactDraft, linearMlEdges } from "@/lib/ceo/overview";

describe("CEO artifact drafts", () => {
  it("keeps only the Architecture editing contract", () => {
    const draft = artifactDraft("architecture", {
      flows: [{
        id: "flow-1",
        input: "Voice",
        measurement: "F0 variance",
        output: "Intervention",
        ignored: "outside the contract",
      }],
      risks: [{ id: "risk-1", text: "Sparse baseline" }],
      next_steps: [],
      invented: [{ text: "ignored" }],
    });

    expect(draft).toEqual({
      flows: [{
        id: "flow-1",
        input: "Voice",
        measurement: "F0 variance",
        output: "Intervention",
      }],
      risks: [{ id: "risk-1", text: "Sparse baseline" }],
      next_steps: [],
    });
  });

  it("starts an empty ML artifact as an editable linear map", () => {
    const draft = artifactDraft("ml", {});

    expect("nodes" in draft && draft.nodes.map((node) => node.label)).toEqual([
      "Data",
      "Training",
      "Application",
    ]);
    expect("edges" in draft && draft.edges).toHaveLength(2);
  });

  it("rebuilds the ML path when stages change", () => {
    const nodes = [
      { id: "a", label: "Capture", detail: "" },
      { id: "b", label: "Features", detail: "" },
      { id: "c", label: "Model", detail: "" },
    ];

    expect(linearMlEdges(nodes).map((edge) => [edge.from, edge.to])).toEqual([
      ["a", "b"],
      ["b", "c"],
    ]);
  });
});

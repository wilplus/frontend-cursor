import { describe, expect, it } from "vitest";
import {
  appendArchitectureColumn,
  appendArchitectureRow,
  artifactDraft,
  linearMlEdges,
  removeArchitectureColumn,
} from "@/lib/ceo/overview";

describe("CEO artifact drafts", () => {
  it("converts the legacy Architecture flow into the editable grid contract", () => {
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
      citations: [{
        id: "citation-1",
        source_id: "source-1",
        claim: "The source describes the flow.",
      }],
      invented: [{ text: "ignored" }],
    });

    expect(draft).toEqual({
      columns: [
        { id: "input", label: "Input" },
        { id: "measurement", label: "Measurement" },
        { id: "output", label: "Output" },
      ],
      rows: [{
        id: "flow-1",
        cells: [
          { column_id: "input", value: "Voice" },
          { column_id: "measurement", value: "F0 variance" },
          { column_id: "output", value: "Intervention" },
        ],
      }],
      risks: [{ id: "risk-1", text: "Sparse baseline" }],
      next_steps: [],
      citations: [{
        id: "citation-1",
        source_id: "source-1",
        claim: "The source describes the flow.",
      }],
    });
  });

  it("preserves a canonical Architecture grid and fills omitted cells", () => {
    const draft = artifactDraft("architecture", {
      columns: [
        { id: "signal", label: "Signal" },
        { id: "owner", label: "Owner" },
      ],
      rows: [{
        id: "row-1",
        cells: [{ column_id: "signal", value: "Pitch variance" }],
      }],
    });

    expect("rows" in draft && draft.rows[0].cells).toEqual([
      { column_id: "signal", value: "Pitch variance" },
      { column_id: "owner", value: "" },
    ]);
  });

  it("adds rows and columns independently and removes column cells", () => {
    const initial = artifactDraft("architecture", {});
    if (!("columns" in initial)) throw new Error("Expected Architecture content");

    const withRow = appendArchitectureRow(initial);
    const withColumn = appendArchitectureColumn(withRow);
    const addedColumn = withColumn.columns.at(-1);

    expect(withRow.rows).toHaveLength(1);
    expect(withRow.rows[0].cells).toHaveLength(3);
    expect(withColumn.columns).toHaveLength(4);
    expect(withColumn.rows[0].cells.at(-1)?.column_id).toBe(addedColumn?.id);
    expect(
      removeArchitectureColumn(withColumn, addedColumn?.id ?? "").rows[0].cells
    ).toHaveLength(3);
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

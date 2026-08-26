import { describe, expect, it } from "vitest";
import {
  appendArchitectureColumn,
  appendArchitectureRow,
  appendMlColumn,
  appendMlRow,
  artifactDraft,
  gridMlEdges,
  linearMlEdges,
  removeArchitectureColumn,
  removeMlColumn,
  removeMlRow,
  type CeoArchitectureContent,
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
    }) as CeoArchitectureContent;

    expect(draft.rows[0].cells).toEqual([
      { column_id: "signal", value: "Pitch variance" },
      { column_id: "owner", value: "" },
    ]);
  });

  it("adds rows and columns independently and removes column cells", () => {
    const initial = artifactDraft("architecture", {}) as CeoArchitectureContent;

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
    expect("nodes" in draft && draft.rows).toHaveLength(1);
    expect("nodes" in draft && draft.columns).toHaveLength(3);
    expect("nodes" in draft && draft.columns.map((column) => column.label))
      .toEqual(["Column 1", "Column 2", "Column 3"]);
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

  it("adds and removes ML rows and columns independently", () => {
    const initial = artifactDraft("ml", {});
    if (!("nodes" in initial)) throw new Error("Expected ML content");

    const withRow = appendMlRow(initial);
    const withColumn = appendMlColumn(withRow);
    const addedRow = withRow.rows.at(-1);
    const addedColumn = withColumn.columns.at(-1);

    expect(withRow.rows).toHaveLength(2);
    expect(withRow.nodes.some((node) => node.row_id === addedRow?.id)).toBe(true);
    expect(withColumn.columns).toHaveLength(4);
    expect(
      withColumn.nodes.some((node) => node.column_id === addedColumn?.id)
    ).toBe(true);
    expect(removeMlRow(withColumn, addedRow?.id ?? "").rows).toHaveLength(1);
    expect(
      removeMlColumn(withColumn, addedColumn?.id ?? "").columns
    ).toHaveLength(3);
  });

  it("preserves a sparse saved ML grid", () => {
    const draft = artifactDraft("ml", {
      rows: [{ id: "training" }, { id: "research" }],
      columns: [
        { id: "capture", label: "Evidence" },
        { id: "application", label: "Destination" },
      ],
      nodes: [{
        id: "audio",
        row_id: "training",
        column_id: "capture",
        label: "Audio",
        detail: "Raw voice",
      }],
      edges: [],
    });
    if (!("nodes" in draft)) throw new Error("Expected ML content");

    expect(draft.rows).toEqual([{ id: "training" }, { id: "research" }]);
    expect(draft.columns).toEqual([
      { id: "capture", label: "Evidence" },
      { id: "application", label: "Destination" },
    ]);
    expect(draft.nodes[0]).toMatchObject({
      row_id: "training",
      column_id: "capture",
      label: "Audio",
    });
  });

  it("builds ML edges within each row without joining separate lanes", () => {
    const rows = [{ id: "row-a" }, { id: "row-b" }];
    const columns = [
      { id: "col-a", label: "Input" },
      { id: "col-b", label: "Output" },
    ];
    const nodes = [
      {
        id: "a1", row_id: "row-a", column_id: "col-a",
        label: "Capture", detail: "",
      },
      {
        id: "a2", row_id: "row-a", column_id: "col-b",
        label: "Features", detail: "",
      },
      {
        id: "b1", row_id: "row-b", column_id: "col-a",
        label: "Research", detail: "",
      },
    ];

    expect(gridMlEdges(rows, columns, nodes).map((edge) => [edge.from, edge.to]))
      .toEqual([["a1", "a2"]]);
  });
});

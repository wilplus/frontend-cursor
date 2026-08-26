import type { CeoLens } from "@/lib/ceo/domain";

export interface CeoArchitectureColumn {
  id: string;
  label: string;
}

export interface CeoArchitectureCell {
  column_id: string;
  value: string;
}

export interface CeoArchitectureRow {
  id: string;
  cells: CeoArchitectureCell[];
}

export interface CeoTextRow {
  id: string;
  text: string;
}

export interface CeoMlNode {
  id: string;
  label: string;
  detail: string;
}

export interface CeoMlEdge {
  id: string;
  from: string;
  to: string;
  label: string;
}

export interface CeoCitation {
  id: string;
  source_id: string;
  claim: string;
}

export interface CeoArchitectureContent {
  columns: CeoArchitectureColumn[];
  rows: CeoArchitectureRow[];
  risks: CeoTextRow[];
  next_steps: CeoTextRow[];
  citations: CeoCitation[];
}

export interface CeoMlContent {
  nodes: CeoMlNode[];
  edges: CeoMlEdge[];
  risks: CeoTextRow[];
  next_steps: CeoTextRow[];
  citations: CeoCitation[];
}

export interface CeoVisionContent {
  document: string;
}

export type CeoArtifactContent =
  | CeoArchitectureContent
  | CeoMlContent
  | CeoVisionContent;

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function text(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function id(value: unknown): string {
  return text(value) || newCeoRowId();
}

function rows(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value) ? value.map(record) : [];
}

function textRows(value: unknown): CeoTextRow[] {
  return rows(value).map((row) => ({ id: id(row.id), text: text(row.text) }));
}

function citations(value: unknown): CeoCitation[] {
  return rows(value).map((row) => ({
    id: id(row.id),
    source_id: text(row.source_id),
    claim: text(row.claim),
  }));
}

function defaultArchitectureColumns(): CeoArchitectureColumn[] {
  return [
    { id: "input", label: "Input" },
    { id: "measurement", label: "Measurement" },
    { id: "output", label: "Output" },
  ];
}

function architectureColumns(value: unknown): CeoArchitectureColumn[] {
  const seen = new Set<string>();
  const saved = rows(value)
    .map((column) => ({ id: id(column.id), label: text(column.label) }))
    .filter((column) => {
      if (seen.has(column.id)) return false;
      seen.add(column.id);
      return true;
    });
  return saved.length ? saved : defaultArchitectureColumns();
}

function architectureRows(
  value: unknown,
  columns: CeoArchitectureColumn[]
): CeoArchitectureRow[] {
  const columnIds = new Set(columns.map((column) => column.id));
  return rows(value).map((row) => {
    const values = new Map<string, string>();
    for (const cell of rows(row.cells)) {
      const columnId = text(cell.column_id);
      if (columnIds.has(columnId)) values.set(columnId, text(cell.value));
    }
    return {
      id: id(row.id),
      cells: columns.map((column) => ({
        column_id: column.id,
        value: values.get(column.id) ?? "",
      })),
    };
  });
}

function legacyArchitectureRows(value: unknown): CeoArchitectureRow[] {
  return rows(value).map((row) => ({
    id: id(row.id),
    cells: [
      { column_id: "input", value: text(row.input) },
      { column_id: "measurement", value: text(row.measurement) },
      { column_id: "output", value: text(row.output) },
    ],
  }));
}

export function newCeoRowId(): string {
  return globalThis.crypto?.randomUUID?.() ??
    `ceo-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function artifactDraft(
  lens: CeoLens,
  value: Record<string, unknown> | null | undefined
): CeoArtifactContent {
  const content = record(value);
  if (lens === "architecture") {
    const columns = architectureColumns(content.columns);
    const savedRows = architectureRows(content.rows, columns);
    return {
      columns,
      rows: Array.isArray(content.rows)
        ? savedRows
        : legacyArchitectureRows(content.flows),
      risks: textRows(content.risks),
      next_steps: textRows(content.next_steps),
      citations: citations(content.citations),
    };
  }
  if (lens === "ml") {
    const savedNodes = rows(content.nodes).map((row) => ({
      id: id(row.id),
      label: text(row.label),
      detail: text(row.detail),
    }));
    const nodes = savedNodes.length
      ? savedNodes
      : ["Data", "Training", "Application"].map((label) => ({
          id: newCeoRowId(),
          label,
          detail: "",
        }));
    const savedEdges = rows(content.edges).map((row) => ({
      id: id(row.id),
      from: text(row.from),
      to: text(row.to),
      label: text(row.label),
    }));
    return {
      nodes,
      edges: savedEdges.length ? savedEdges : linearMlEdges(nodes),
      risks: textRows(content.risks),
      next_steps: textRows(content.next_steps),
      citations: citations(content.citations),
    };
  }
  return { document: text(content.document) };
}

export function appendArchitectureRow(
  content: CeoArchitectureContent
): CeoArchitectureContent {
  return {
    ...content,
    rows: [
      ...content.rows,
      {
        id: newCeoRowId(),
        cells: content.columns.map((column) => ({
          column_id: column.id,
          value: "",
        })),
      },
    ],
  };
}

export function appendArchitectureColumn(
  content: CeoArchitectureContent
): CeoArchitectureContent {
  const column = { id: newCeoRowId(), label: "New column" };
  return {
    ...content,
    columns: [...content.columns, column],
    rows: content.rows.map((row) => ({
      ...row,
      cells: [...row.cells, { column_id: column.id, value: "" }],
    })),
  };
}

export function removeArchitectureColumn(
  content: CeoArchitectureContent,
  columnId: string
): CeoArchitectureContent {
  if (content.columns.length <= 1) return content;
  return {
    ...content,
    columns: content.columns.filter((column) => column.id !== columnId),
    rows: content.rows.map((row) => ({
      ...row,
      cells: row.cells.filter((cell) => cell.column_id !== columnId),
    })),
  };
}

export function linearMlEdges(nodes: CeoMlNode[]): CeoMlEdge[] {
  return nodes.slice(0, -1).map((node, index) => ({
    id: newCeoRowId(),
    from: node.id,
    to: nodes[index + 1].id,
    label: "",
  }));
}

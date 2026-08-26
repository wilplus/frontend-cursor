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
  row_id: string;
  column_id: string;
  label: string;
  detail: string;
}

export interface CeoMlLayoutRow {
  id: string;
}

export interface CeoMlLayoutColumn {
  id: string;
  label: string;
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
  rows: CeoMlLayoutRow[];
  columns: CeoMlLayoutColumn[];
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

function mlAxes(value: unknown): { id: string }[] {
  const seen = new Set<string>();
  return rows(value)
    .map((axis) => ({ id: id(axis.id) }))
    .filter((axis) => {
      if (seen.has(axis.id)) return false;
      seen.add(axis.id);
      return true;
    });
}

function mlColumns(value: unknown): CeoMlLayoutColumn[] {
  const seen = new Set<string>();
  const saved = rows(value)
    .map((axis, index) => ({
      id: id(axis.id),
      label: text(axis.label) || `Column ${index + 1}`,
    }))
    .filter((axis) => {
      if (seen.has(axis.id)) return false;
      seen.add(axis.id);
      return true;
    });
  return saved.length
    ? saved
    : [{ id: newCeoRowId(), label: "Column 1" }];
}

function legacyMlGrid(value: unknown): Pick<
  CeoMlContent,
  "rows" | "columns" | "nodes"
> {
  const saved = rows(value).map((node) => ({
    id: id(node.id),
    label: text(node.label),
    detail: text(node.detail),
  }));
  const source = saved.length
    ? saved
    : ["Data", "Training", "Application"].map((label) => ({
        id: newCeoRowId(),
        label,
        detail: "",
      }));
  const row = { id: newCeoRowId() };
  const columns = source.map((_node, index) => ({
    id: newCeoRowId(),
    label: `Column ${index + 1}`,
  }));
  return {
    rows: [row],
    columns,
    nodes: source.map((node, index) => ({
      ...node,
      row_id: row.id,
      column_id: columns[index].id,
    })),
  };
}

function savedMlGrid(content: Record<string, unknown>): Pick<
  CeoMlContent,
  "rows" | "columns" | "nodes"
> {
  const savedRows = mlAxes(content.rows);
  const savedColumns = mlColumns(content.columns);
  const layoutRows = savedRows.length ? savedRows : [{ id: newCeoRowId() }];
  const columns = savedColumns;
  const rowIds = new Set(layoutRows.map((row) => row.id));
  const columnIds = new Set(columns.map((column) => column.id));
  const occupied = new Set<string>();
  const nodes = rows(content.nodes)
    .map((node) => ({
      id: id(node.id),
      row_id: text(node.row_id),
      column_id: text(node.column_id),
      label: text(node.label),
      detail: text(node.detail),
    }))
    .filter((node) => {
      const cell = `${node.row_id}:${node.column_id}`;
      if (
        !rowIds.has(node.row_id) ||
        !columnIds.has(node.column_id) ||
        occupied.has(cell)
      ) {
        return false;
      }
      occupied.add(cell);
      return true;
    });
  return { rows: layoutRows, columns, nodes };
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
    const grid = Array.isArray(content.rows) && Array.isArray(content.columns)
      ? savedMlGrid(content)
      : legacyMlGrid(content.nodes);
    const savedEdges = rows(content.edges).map((row) => ({
      id: id(row.id),
      from: text(row.from),
      to: text(row.to),
      label: text(row.label),
    }));
    return {
      ...grid,
      edges: savedEdges.length
        ? savedEdges
        : gridMlEdges(grid.rows, grid.columns, grid.nodes),
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

export function linearMlEdges(nodes: Pick<CeoMlNode, "id">[]): CeoMlEdge[] {
  return nodes.slice(0, -1).map((node, index) => ({
    id: newCeoRowId(),
    from: node.id,
    to: nodes[index + 1].id,
    label: "",
  }));
}

export function gridMlEdges(
  rows: CeoMlLayoutRow[],
  columns: CeoMlLayoutColumn[],
  nodes: CeoMlNode[]
): CeoMlEdge[] {
  return rows.flatMap((row) => {
    const ordered = columns
      .map((column) => nodes.find(
        (node) => node.row_id === row.id && node.column_id === column.id
      ))
      .filter((node): node is CeoMlNode => Boolean(node));
    return linearMlEdges(ordered);
  });
}

function withMlEdges(content: CeoMlContent): CeoMlContent {
  return {
    ...content,
    edges: gridMlEdges(content.rows, content.columns, content.nodes),
  };
}

export function appendMlRow(content: CeoMlContent): CeoMlContent {
  const row = { id: newCeoRowId() };
  const firstColumn = content.columns[0];
  return withMlEdges({
    ...content,
    rows: [...content.rows, row],
    nodes: firstColumn
      ? [...content.nodes, {
          id: newCeoRowId(),
          row_id: row.id,
          column_id: firstColumn.id,
          label: "New stage",
          detail: "",
        }]
      : content.nodes,
  });
}

export function appendMlColumn(content: CeoMlContent): CeoMlContent {
  const column = { id: newCeoRowId(), label: "New column" };
  const firstRow = content.rows[0];
  return withMlEdges({
    ...content,
    columns: [...content.columns, column],
    nodes: firstRow
      ? [...content.nodes, {
          id: newCeoRowId(),
          row_id: firstRow.id,
          column_id: column.id,
          label: "New stage",
          detail: "",
        }]
      : content.nodes,
  });
}

export function removeMlRow(
  content: CeoMlContent,
  rowId: string
): CeoMlContent {
  if (content.rows.length <= 1) return content;
  return withMlEdges({
    ...content,
    rows: content.rows.filter((row) => row.id !== rowId),
    nodes: content.nodes.filter((node) => node.row_id !== rowId),
  });
}

export function removeMlColumn(
  content: CeoMlContent,
  columnId: string
): CeoMlContent {
  if (content.columns.length <= 1) return content;
  return withMlEdges({
    ...content,
    columns: content.columns.filter((column) => column.id !== columnId),
    nodes: content.nodes.filter((node) => node.column_id !== columnId),
  });
}

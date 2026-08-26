import type { CeoLens } from "@/lib/ceo/domain";

export interface CeoFlowRow {
  id: string;
  input: string;
  measurement: string;
  output: string;
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
  flows: CeoFlowRow[];
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
    return {
      flows: rows(content.flows).map((row) => ({
        id: id(row.id),
        input: text(row.input),
        measurement: text(row.measurement),
        output: text(row.output),
      })),
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

export function linearMlEdges(nodes: CeoMlNode[]): CeoMlEdge[] {
  return nodes.slice(0, -1).map((node, index) => ({
    id: newCeoRowId(),
    from: node.id,
    to: nodes[index + 1].id,
    label: "",
  }));
}

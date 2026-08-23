// Tipos da trilha — espelham web/src/data/ohara/schema.json.
// ownership NÃO aparece aqui: é resolvido em runtime (só no modo local).

export type SourceType = 'free' | 'retail' | 'preview-embed';

export interface Source {
  sourceType: SourceType;
  provider?: string;
  url?: string;
  query?: string;
  note?: string;
}

/** Explicador = rampa de acesso (secundário), NÃO fonte primária nem nó do DAG. */
export type ExplainerKind = 'article' | 'video' | 'book' | 'course' | 'interactive';

export interface Explainer {
  label: string;
  author?: string;
  kind: ExplainerKind;
  sourceType: SourceType;
  provider?: string;
  url?: string;
  query?: string;
  note?: string;
}

export interface TrailNode {
  id: string;
  type: string;
  label: string;
  author?: string;
  year: number;
  tags?: string[];
  sources: Source[];
  explainers?: Explainer[];
}

export interface TrailEdge {
  from: string;
  to: string;
  reason?: string[];
  provenance?: string;
}

export interface Trail {
  trail: {
    id: string;
    title: string;
    roles?: string[];
    tags: string[];
    provenance?: string;
  };
  nodes: TrailNode[];
  edges: TrailEdge[];
}

/** Estado exibível derivado das fontes do nó (sem ownership, que é runtime/local). */
export type NodeState = 'free' | 'retail';

export function primaryState(node: TrailNode): NodeState {
  return node.sources.some((s) => s.sourceType === 'free') ? 'free' : 'retail';
}

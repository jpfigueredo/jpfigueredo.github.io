import type { Trail, TrailNode, NodeState } from '../types';
import { primaryState } from '../types';

export interface Positioned {
  node: TrailNode;
  x: number;
  y: number;
  layer: number;
  state: NodeState;
}

export interface Layout {
  nodes: Positioned[];
  edges: { from: string; to: string; reason?: string[] }[];
  width: number;
  height: number;
  pos: Map<string, { x: number; y: number }>;
}

/**
 * Layout em camadas (DAG). O grafo bruto pode ter ciclos aparentes; a regra
 * que os quebra é CRONOLOGIA (obra mais antiga não depende de mais nova):
 * mantemos só arestas com from.year <= to.year. Kahn dá a ordem topológica e
 * o longest-path define a camada — nós na mesma camada se espalham na horizontal,
 * então NÃO há sobreposição por construção.
 */
export function buildLayout(trail: Trail, opts?: { colGap?: number; rowGap?: number }): Layout {
  const colGap = opts?.colGap ?? 175;
  const rowGap = opts?.rowGap ?? 150;
  const byId = new Map(trail.nodes.map((n) => [n.id, n]));

  // 1. quebra de ciclo por cronologia
  const edges = trail.edges.filter((e) => {
    const a = byId.get(e.from);
    const b = byId.get(e.to);
    return !!a && !!b && a.year <= b.year;
  });

  // 2. Kahn + longest-path layering
  const indeg = new Map<string, number>();
  const adj = new Map<string, string[]>();
  trail.nodes.forEach((n) => {
    indeg.set(n.id, 0);
    adj.set(n.id, []);
  });
  edges.forEach((e) => {
    adj.get(e.from)?.push(e.to);
    indeg.set(e.to, (indeg.get(e.to) ?? 0) + 1);
  });

  const layer = new Map<string, number>();
  trail.nodes.forEach((n) => layer.set(n.id, 0));
  const queue: string[] = [];
  trail.nodes.forEach((n) => {
    if ((indeg.get(n.id) ?? 0) === 0) queue.push(n.id);
  });
  while (queue.length) {
    const id = queue.shift() as string;
    for (const to of adj.get(id) ?? []) {
      layer.set(to, Math.max(layer.get(to) ?? 0, (layer.get(id) ?? 0) + 1));
      indeg.set(to, (indeg.get(to) ?? 0) - 1);
      if ((indeg.get(to) ?? 0) === 0) queue.push(to);
    }
  }

  // 3. agrupar por camada (ordenado por ano) e posicionar
  const sorted = [...trail.nodes].sort(
    (a, b) => (layer.get(a.id) ?? 0) - (layer.get(b.id) ?? 0) || a.year - b.year,
  );
  const layers = new Map<number, TrailNode[]>();
  sorted.forEach((n) => {
    const l = layer.get(n.id) ?? 0;
    const bucket = layers.get(l) ?? [];
    bucket.push(n);
    layers.set(l, bucket);
  });

  const maxLayer = Math.max(0, ...layers.keys());
  const maxWidth = Math.max(1, ...[...layers.values()].map((a) => a.length));
  const width = maxWidth * colGap;
  const height = (maxLayer + 1) * rowGap;

  const nodes: Positioned[] = [];
  const pos = new Map<string, { x: number; y: number }>();
  layers.forEach((bucket, l) => {
    const count = bucket.length;
    bucket.forEach((n, i) => {
      const x = (width / (count + 1)) * (i + 1);
      const y = l * rowGap + rowGap / 2;
      nodes.push({ node: n, x, y, layer: l, state: primaryState(n) });
      pos.set(n.id, { x, y });
    });
  });

  return { nodes, edges, width, height, pos };
}

/** Conexões de um nó no DAG (from = pré-requisito, to = descendente). */
export function connections(nodeId: string, trail: Trail) {
  const references = trail.edges.filter((e) => e.to === nodeId).map((e) => e.from);
  const referencedBy = trail.edges.filter((e) => e.from === nodeId).map((e) => e.to);
  return { references, referencedBy };
}

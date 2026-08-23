import { describe, it, expect } from 'vitest';
import { loadTrail } from './data/loadTrail';
import { buildLayout, connections } from './domain/graph';
import { primaryState } from './types';

const trail = loadTrail();

describe('graph / buildLayout', () => {
  it('posiciona todos os nós, sem perder nenhum', () => {
    const layout = buildLayout(trail);
    expect(layout.nodes).toHaveLength(trail.nodes.length);
    for (const p of layout.nodes) {
      expect(Number.isFinite(p.x)).toBe(true);
      expect(Number.isFinite(p.y)).toBe(true);
    }
  });

  it('põe as raízes cronológicas na camada 0', () => {
    const layout = buildLayout(trail);
    const layer0 = layout.nodes.filter((p) => p.layer === 0).map((p) => p.node.id);
    expect(layer0).toContain('turing-1936');
    expect(layer0).toContain('codd-1970');
    expect(layer0).toContain('brooks-1975');
    expect(layer0).toContain('lamport-1978');
  });

  it('DAG sem back-edge: toda aresta respeita a cronologia', () => {
    const layout = buildLayout(trail);
    const byId = new Map(trail.nodes.map((n) => [n.id, n]));
    for (const e of layout.edges) {
      const a = byId.get(e.from);
      const b = byId.get(e.to);
      expect(a && b && a.year <= b.year).toBe(true);
    }
  });

  it('mapeia conexões (pré-requisito × descendente)', () => {
    const c = connections('kleppmann-2017', trail);
    expect(c.references.length).toBeGreaterThan(0);
  });
});

describe('contrato do dado', () => {
  it('toda fonte livre tem URL http (nunca inventada)', () => {
    const free = trail.nodes.flatMap((n) => n.sources).filter((s) => s.sourceType === 'free');
    expect(free.length).toBeGreaterThan(0);
    for (const s of free) {
      expect(typeof s.url === 'string' && s.url.startsWith('http')).toBe(true);
    }
  });

  it('mantém pelo menos uma raiz e uma fronteira', () => {
    expect(trail.nodes.some((n) => n.year <= 1945)).toBe(true);
    expect(trail.nodes.some((n) => n.year >= 2020)).toBe(true);
  });
});

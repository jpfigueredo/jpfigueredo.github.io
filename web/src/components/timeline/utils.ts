import dataset from '../../data/sw-timeline/seed.json';

export type TimelineNode = typeof dataset.nodes[number];

export function yearOf(date: string): number {
  const y = parseInt(date.slice(0, 4), 10);
  return Number.isFinite(y) ? y : 0;
}

export function uniqueSortedYears(nodes: TimelineNode[]): number[] {
  return Array.from(new Set(nodes.map(n => yearOf(n.date)).filter(Boolean))).sort((a, b) => a - b);
}



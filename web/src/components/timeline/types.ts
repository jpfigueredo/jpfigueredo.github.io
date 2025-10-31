import dataset from '../../data/sw-timeline/seed.json';

export type Node = typeof dataset.nodes[number];
export type Edge = typeof dataset.edges[number];
export type Transform = { offsetX: number; offsetY: number; scale: number };
export type LayoutPoint = { x: number; y: number; index: number };
export type Velocity = { vx: number; vy: number };


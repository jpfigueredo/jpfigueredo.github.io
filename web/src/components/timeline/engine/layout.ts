import { yearOf } from '../utils';
import type { Node } from '../types';

export type LayoutConfig = {
  canvasWidth: number;
  height: number;
  baselineY: number;
  branchSpacing: number;
  minYear: number;
  maxYear: number;
};

export function createLayoutConfig(
  nodes: Node[],
  canvasWidth: number,
  height: number,
  branchSpacing: number
): LayoutConfig {
  const years = nodes.map(n => yearOf(n.date)).filter(Boolean);
  const minYear = Math.min(...years);
  const maxYear = Math.max(...years);
  // Baseline em 80% da altura = 20% do fundo acima das barras de controle
  const baselineY = height * 0.8;
  return { canvasWidth, height, baselineY, branchSpacing, minYear, maxYear };
}

export function xScaleYear(year: number, config: LayoutConfig): number {
  const t = (year - config.minYear) / (config.maxYear - config.minYear || 1);
  return 40 + t * (config.canvasWidth - 80);
}

export function computeIndexToOffset(nodes: Node[], config: LayoutConfig): Map<number, number> {
  const yearToIndices = new Map<number, number[]>();
  nodes.forEach((n, i) => {
    const y = yearOf(n.date);
    if (!yearToIndices.has(y)) yearToIndices.set(y, []);
    yearToIndices.get(y)!.push(i);
  });

  const indexToOffset = new Map<number, number>();
  yearToIndices.forEach((indices) => {
    indices.sort((a, b) => a - b);
    indices.forEach((idx, k) => {
      const level = k + 1;
      indexToOffset.set(idx, -level * config.branchSpacing);
    });
  });
  return indexToOffset;
}


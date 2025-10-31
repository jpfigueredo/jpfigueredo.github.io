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
  // Baseline em 70% da altura = 30% do fundo acima das barras de controle (mais alto)
  const baselineY = height * 0.7;
  return { canvasWidth, height, baselineY, branchSpacing, minYear, maxYear };
}

export function xScaleYear(year: number, config: LayoutConfig): number {
  const t = (year - config.minYear) / (config.maxYear - config.minYear || 1);
  return 40 + t * (config.canvasWidth - 80);
}

// Constellation-like layout: organic positioning instead of linear stacking
export function computeIndexToOffset(nodes: Node[], config: LayoutConfig): Map<number, { x: number; y: number }> {
  const baselineY = config.baselineY;
  const indexToPos = new Map<number, { x: number; y: number }>();
  
  // Group nodes by year for temporal clustering
  const yearToIndices = new Map<number, number[]>();
  nodes.forEach((n, i) => {
    const y = yearOf(n.date);
    if (!yearToIndices.has(y)) yearToIndices.set(y, []);
    yearToIndices.get(y)!.push(i);
  });

  // Create tag-based clusters for thematic grouping
  const tagClusters = new Map<string, number[]>();
  nodes.forEach((n, i) => {
    const tags = n.tags || [];
    if (tags.length === 0) {
      // Untagged nodes go to a default cluster
      const defaultTag = 'untagged';
      if (!tagClusters.has(defaultTag)) tagClusters.set(defaultTag, []);
      tagClusters.get(defaultTag)!.push(i);
    } else {
      // Add to all relevant tag clusters
      tags.forEach(tag => {
        if (!tagClusters.has(tag)) tagClusters.set(tag, []);
        tagClusters.get(tag)!.push(i);
      });
    }
  });

  // Calculate constellation positions (organic, non-linear distribution)
  yearToIndices.forEach((indices, year) => {
    const baseX = xScaleYear(year, config);
    
    if (indices.length === 1) {
      // Single node: position with slight horizontal variation for organic feel
      const idx = indices[0];
      const seed = idx * 137.508;
      const organicX = Math.sin(seed) * config.branchSpacing * 0.2;
      indexToPos.set(idx, {
        x: baseX + organicX,
        y: baselineY - config.branchSpacing * 1.2
      });
    } else {
      // Multiple nodes: create organic constellation pattern
      // Use spiral/Fibonacci-like distribution for natural clustering
      indices.forEach((idx, k) => {
        // Golden angle spiral for organic distribution
        const goldenAngle = 2.399963229728653; // ~137.508° in radians
        const angle = k * goldenAngle;
        const spiralFactor = Math.sqrt(k + 1); // Spiral expansion
        const radius = config.branchSpacing * (1.0 + spiralFactor * 0.8);
        
        // More horizontal spread for constellation feel (not just vertical stacking)
        const offsetX = Math.cos(angle) * radius * 0.8; // Wider horizontal spread
        const offsetY = -radius * 1.1; // Always upward but varied
        
        // Add organic variation based on node properties (tags, index)
        const node = nodes[idx];
        const tagSeed = (node.tags?.join('') || '').split('').reduce((acc, char) => acc + char.charCodeAt(0), idx);
        const organicX = offsetX + Math.sin(tagSeed * 0.01) * radius * 0.25;
        const organicY = offsetY + Math.cos(tagSeed * 0.015) * radius * 0.2;
        
        indexToPos.set(idx, {
          x: baseX + organicX,
          y: baselineY + organicY
        });
      });
    }
  });

  return indexToPos;
}

// Legacy function for backward compatibility (returns vertical offset only)
export function computeIndexToVerticalOffset(nodes: Node[], config: LayoutConfig): Map<number, number> {
  const posMap = computeIndexToOffset(nodes, config);
  const offsetMap = new Map<number, number>();
  posMap.forEach((pos, idx) => {
    // Extract just the Y offset from baseline
    offsetMap.set(idx, pos.y - config.baselineY);
  });
  return offsetMap;
}


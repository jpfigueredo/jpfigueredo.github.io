import type { Node, Transform } from '../types';
import { yearOf } from '../utils';

export function clampTransform(
  t: Transform,
  canvasEl: HTMLCanvasElement | null,
  height: number,
  nodes: Node[],
  branchSpacing: number
): Transform {
  if (!canvasEl) return t;

  const vh = height;
  const clampedX = t.offsetX; // horizontal stays fixed (changed via centerOnYear)

  // Estimate scene vertical bounds from data (baseline at 80% = 20% do fundo)
  const baselineY = height * 0.8;
  let maxLevel = 0;
  const yearToCount = new Map<number, number>();
  nodes.forEach(n => {
    const y = yearOf(n.date);
    yearToCount.set(y, (yearToCount.get(y) ?? 0) + 1);
  });
  for (const cnt of yearToCount.values()) maxLevel = Math.max(maxLevel, cnt);

  const sceneTop = baselineY - Math.max(1, maxLevel) * branchSpacing - 60;
  const sceneBottom = baselineY + 40; // margem abaixo da baseline
  const s = Math.min(3, Math.max(0.25, t.scale));
  const oMin = vh - sceneBottom * s;
  const oMax = -sceneTop * s;
  const clampedY = Math.min(oMax, Math.max(oMin, t.offsetY));
  const clampedScale = Math.min(3, Math.max(0.25, t.scale));

  return { offsetX: clampedX, offsetY: clampedY, scale: clampedScale };
}

export function easeInOutQuad(x: number): number {
  return x < 0.5 ? 2 * x * x : -1 + (4 - 2 * x) * x;
}


import type { Node, Transform } from '../types';
import { yearOf } from '../utils';

export function clampTransform(
  t: Transform,
  canvasEl: HTMLCanvasElement | null,
  height: number,
  nodes: Node[],
  branchSpacing: number,
  layoutConfig?: { minYear: number; maxYear: number; canvasWidth: number; baselineY: number },
  forceHorizontalCenter: boolean = false // Only center during zoom, not during pan/navigation
): Transform {
  if (!canvasEl) return t;

  const vw = canvasEl.clientWidth;
  const vh = height;
  const scale = Math.min(3, Math.max(0.25, t.scale));
  
  // === HORIZONTAL CENTERING: Keep baseline centered during zoom ===
  let clampedX = t.offsetX;
  if (layoutConfig && forceHorizontalCenter) {
    // Calculate center of timeline in world coordinates
    const centerYear = (layoutConfig.minYear + layoutConfig.maxYear) / 2;
    const centerX = 40 + ((centerYear - layoutConfig.minYear) / (layoutConfig.maxYear - layoutConfig.minYear || 1)) * (layoutConfig.canvasWidth - 80);
    const targetScreenX = vw / 2;
    // Keep baseline centered: screenX = worldX * scale + offsetX
    // => offsetX = screenX - worldX * scale
    clampedX = targetScreenX - centerX * scale;
  } else if (layoutConfig) {
    // Allow horizontal pan but clamp to scene bounds
    const sceneLeft = 40;
    const sceneRight = layoutConfig.canvasWidth - 40;
    const screenLeft = sceneLeft * scale + clampedX;
    const screenRight = sceneRight * scale + clampedX;
    
    // Clamp horizontal position to keep scene visible
    if (screenRight < vw * 0.1) {
      // Scene too far left, allow some pan to the right
      clampedX = vw * 0.1 - sceneRight * scale;
    } else if (screenLeft > vw * 0.9) {
      // Scene too far right, allow some pan to the left
      clampedX = vw * 0.9 - sceneLeft * scale;
    }
    // Otherwise allow free horizontal movement
  }

  // === VERTICAL CLAMPING: Keep within scene bounds ===
  // Calculate bounds from constellation layout (2D, organic spread)
  const baselineY = height * 0.7;
  
  // Estimate bounds: for nodes in same year, max spread is branchSpacing * count
  // Constellation layout spreads organically (spiral pattern), estimate bounds
  const yearToCount = new Map<number, number>();
  nodes.forEach(n => {
    const y = yearOf(n.date);
    yearToCount.set(y, (yearToCount.get(y) ?? 0) + 1);
  });
  let maxLevel = 0;
  for (const cnt of yearToCount.values()) maxLevel = Math.max(maxLevel, cnt);
  
  // Constellation layout spreads more organically (spiral can go 2.5-3x branchSpacing per level)
  const estimatedMaxHeight = Math.max(1, maxLevel) * branchSpacing * 2.8;
  const sceneTop = baselineY - estimatedMaxHeight - 60;
  const sceneBottom = baselineY + 40;
  const oMin = vh - sceneBottom * scale;
  const oMax = -sceneTop * scale;
  const clampedY = Math.min(oMax, Math.max(oMin, t.offsetY));

  return { offsetX: clampedX, offsetY: clampedY, scale };
}

export function easeInOutQuad(x: number): number {
  return x < 0.5 ? 2 * x * x : -1 + (4 - 2 * x) * x;
}


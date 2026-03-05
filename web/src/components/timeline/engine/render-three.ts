import * as THREE from 'three';
import type { Node, Edge, Transform } from '../types';
import type { SearchMode } from '../SearchBar';
import type { LayoutConfig } from './layout';
import { TimelineThreeRenderer } from './three-renderer';
import {
  createBaselineThree,
  createCometThree,
  createStarsThree,
  createConstellationLinesThree,
  createEdgesThree,
  createInformationGrid
} from './three-scene-optimized';

export type ThreeRenderContext = {
  renderer: TimelineThreeRenderer;
  canvasWidth: number;
  height: number;
  transform: Transform;
  layoutConfig: LayoutConfig;
  indexToPosition: Map<number, { x: number; y: number }>;
  nodes: Node[];
  edges: Edge[];
  query: string;
  mode: SearchMode;
  showConstellations: boolean;
  selectedIndex: number | null;
  animationTime: number;
};

// Cache for reusing objects (object pooling)
let cachedBaselineGroup: THREE.Group | null = null;
let cachedGridGroup: THREE.Group | null = null; // Information grid overlay
let cachedComet: { mesh: THREE.Mesh; particles: THREE.Points } | null = null;
let cachedStarsGroup: THREE.Group | null = null;
let cachedConstellationLines: THREE.LineSegments | null = null;
let cachedEdgesGroup: THREE.Group | null = null;

// Function to clear cache (call when renderer is disposed)
export function clearTimelineCache() {
  cachedBaselineGroup = null;
  cachedGridGroup = null;
  cachedComet = null;
  cachedStarsGroup = null;
  cachedConstellationLines = null;
  cachedEdgesGroup = null;
  lastRenderState = null;
}

/**
 * Render state cache to detect when rebuild is needed.
 * Prevents unnecessary recreation of Three.js objects.
 */
let lastRenderState: {
  canvasWidth: number;
  height: number;
  layoutConfig: LayoutConfig;
  query: string;
  mode: SearchMode;
  showConstellations: boolean;
  selectedIndex: number | null;
} | null = null;

/**
 * Progressive initialization state (prevents lag on first render).
 * Spreads object creation across multiple frames.
 */
let isInitializing = false;
let initializationFrame = 0;

/**
 * Checks if a rebuild is needed by comparing current context with last render state.
 * @param context - Current render context
 * @param lastState - Previous render state
 * @returns true if rebuild is required
 */
function needsRebuild(
  context: ThreeRenderContext,
  lastState: typeof lastRenderState
): boolean {
  if (!lastState) return true;
  
  return (
    lastState.canvasWidth !== context.canvasWidth ||
    lastState.height !== context.height ||
    lastState.layoutConfig.minYear !== context.layoutConfig.minYear ||
    lastState.layoutConfig.maxYear !== context.layoutConfig.maxYear ||
    lastState.query !== context.query ||
    lastState.mode !== context.mode ||
    lastState.showConstellations !== context.showConstellations ||
    lastState.selectedIndex !== context.selectedIndex
  );
}

/**
 * Clears all cached Three.js objects from the scene.
 * @param scene - Three.js scene to clear
 */
function clearCachedObjects(scene: THREE.Scene): void {
  if (cachedBaselineGroup) {
    scene.remove(cachedBaselineGroup);
    cachedBaselineGroup = null;
  }
  if (cachedGridGroup) {
    scene.remove(cachedGridGroup);
    cachedGridGroup = null;
  }
  if (cachedComet) {
    scene.remove(cachedComet.mesh);
    scene.remove(cachedComet.particles);
    cachedComet = null;
  }
  if (cachedStarsGroup) {
    scene.remove(cachedStarsGroup);
    cachedStarsGroup = null;
  }
  if (cachedConstellationLines) {
    scene.remove(cachedConstellationLines);
    cachedConstellationLines = null;
  }
  if (cachedEdgesGroup) {
    scene.remove(cachedEdgesGroup);
    cachedEdgesGroup = null;
  }
}

/**
 * Main rendering function for Three.js timeline.
 * Handles object pooling, progressive initialization, and state management.
 * @param context - Complete render context with all necessary data
 */
export function renderTimelineThree(context: ThreeRenderContext) {
  const {
    renderer,
    canvasWidth,
    height,
    layoutConfig,
    indexToPosition,
    nodes,
    edges,
    query,
    mode,
    showConstellations,
    selectedIndex,
    animationTime,
  } = context;
  
  const scene = renderer.getScene();
  
  // Detect if we need to recreate objects (config changed)
  const shouldRebuild = needsRebuild(context, lastRenderState);
  
  if (shouldRebuild) {
    handleRebuild(
      scene,
      renderer,
      context,
      layoutConfig,
      canvasWidth,
      height,
      nodes,
      edges,
      indexToPosition,
      query,
      mode,
      showConstellations,
      selectedIndex,
      animationTime
    );
  } else {
    // No rebuild needed - only update animations if actively animating
    // Skip comet animation update for now (static particles = better performance)
    // updateCometAnimation(cachedComet, animationTime);
  }
  
  // Render scene only if there's a visible change or active animation
  // This prevents unnecessary renders when scene is static
  renderer.render({
    transform: context.transform,
    canvasWidth: context.canvasWidth,
    height: context.height,
  });
}

/**
 * Handles the rebuild process with progressive initialization.
 * Spreads object creation across multiple frames to prevent lag.
 */
function handleRebuild(
  scene: THREE.Scene,
  renderer: TimelineThreeRenderer,
  context: ThreeRenderContext,
  layoutConfig: LayoutConfig,
  canvasWidth: number,
  height: number,
  nodes: Node[],
  edges: Edge[],
  indexToPosition: Map<number, { x: number; y: number }>,
  query: string,
  mode: SearchMode,
  showConstellations: boolean,
  selectedIndex: number | null,
  animationTime: number
): void {
  // Start progressive initialization if this is the first render
  if (!lastRenderState) {
    isInitializing = true;
    initializationFrame = 0;
  }
  
  // Frame 0: Clear old objects and create baseline + grid + stars (critical for visibility)
  if (initializationFrame === 0 || !isInitializing) {
    clearCachedObjects(scene);
    cachedBaselineGroup = createBaselineThree(renderer, layoutConfig, canvasWidth, animationTime);
    scene.add(cachedBaselineGroup);
    
    // Create information grid (moves with constellation, provides context)
    cachedGridGroup = createInformationGrid(layoutConfig, canvasWidth);
    scene.add(cachedGridGroup);
    
    // Create stars immediately (don't wait for next frame)
    cachedStarsGroup = createStarsThree(
      renderer,
      nodes,
      indexToPosition,
      canvasWidth,
      layoutConfig,
      query,
      mode,
      selectedIndex
    );
    scene.add(cachedStarsGroup);
    console.log(`[handleRebuild] Stars group added to scene, children: ${scene.children.length}`);
  }
  
  // Frame 2: Add edges (connections)
  if ((initializationFrame >= 2 || !isInitializing) && !cachedEdgesGroup) {
    cachedEdgesGroup = createEdgesThree(
      renderer,
      edges,
      nodes,
      indexToPosition,
      canvasWidth,
      layoutConfig,
      query,
      mode
    );
    scene.add(cachedEdgesGroup);
  }
  
  // Frame 3: Add constellation lines (optional, can be skipped if disabled)
  if (
    (initializationFrame >= 3 || !isInitializing) &&
    showConstellations &&
    !cachedConstellationLines
  ) {
    cachedConstellationLines = createConstellationLinesThree(
      renderer,
      nodes,
      indexToPosition,
      canvasWidth,
      layoutConfig,
      showConstellations
    );
    if (cachedConstellationLines) {
      scene.add(cachedConstellationLines);
    }
  }
  
  // Frame 4: Add comet (decorative, can be delayed)
  // Temporarily disabled to fix rendering issues with giant circles
  // TODO: Re-enable after fixing particle sizing and z-ordering
  // if ((initializationFrame >= 4 || !isInitializing) && !cachedComet) {
  //   const endX = canvasWidth - 40;
  //   const baselineY = layoutConfig.baselineY;
  //   cachedComet = createCometThree(renderer, endX, baselineY, canvasWidth, height, animationTime);
  // }
  
  // Advance initialization frame counter
  if (isInitializing) {
    initializationFrame++;
    const maxFrames = 5; // Total frames for progressive init
    if (initializationFrame >= maxFrames) {
      isInitializing = false;
      initializationFrame = 0;
    }
  }
  
  // Save render state when initialization is complete
  if (!isInitializing) {
    lastRenderState = {
      canvasWidth,
      height,
      layoutConfig: { ...layoutConfig },
      query,
      mode,
      showConstellations,
      selectedIndex,
    };
  }
}

/**
 * Updates comet particle animation (called only when no rebuild is needed).
 * Performs minimal work by updating particle positions in-place.
 * Note: Currently comet animation is handled by recreating particles on rebuild.
 * This function is kept for future optimization of particle updates.
 */
function updateCometAnimation(
  comet: { mesh: THREE.Mesh; particles: THREE.Points } | null,
  animationTime: number
): void {
  if (!comet) return;
  
  // For now, we skip particle updates for performance
  // Particles are static after creation - animation is visual-only (bloom/glow effects)
  // If needed, uncomment below to animate particle positions:
  
  // const positions = comet.particles.geometry.attributes.position.array as Float32Array;
  // const normalizedTime = animationTime * 0.001;
  // const animationSpeed = COMET_CONFIG.ANIMATION_SPEED;
  // const tailLength = COMET_CONFIG.ION_TAIL_LENGTH;
  // 
  // for (let i = 0; i < positions.length / 3; i++) {
  //   const offset = (normalizedTime * animationSpeed + i * 12) % tailLength;
  //   positions[i * 3] = /* update X position */;
  // }
  // 
  // comet.particles.geometry.attributes.position.needsUpdate = true;
}


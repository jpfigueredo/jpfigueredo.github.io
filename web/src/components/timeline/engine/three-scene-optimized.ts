import * as THREE from 'three';
import type { Node, Edge } from '../types';
import type { SearchMode } from '../SearchBar';
import type { LayoutConfig } from './layout';
import { yearOf } from '../utils';
import { xScaleYear } from './layout';
import type { TimelineThreeRenderer } from './three-renderer';
import {
  STAR_CONFIG,
  STAR_COLORS,
  BASELINE_CONFIG,
  COMET_CONFIG,
  CONSTELLATION_CONFIG,
  EDGE_CONFIG,
} from './constants';

/**
 * Checks if text matches query (case-insensitive, trimmed).
 * @param text - Text to search in
 * @param query - Search query
 * @returns true if text contains query
 */
function matchesQuery(text: string, query: string): boolean {
  if (query.length === 0) return true;
  const normalizedText = text.toLowerCase();
  const normalizedQuery = query.trim().toLowerCase();
  return normalizedText.includes(normalizedQuery);
}

/**
 * Calculates RGB color for baseline gradient based on position (0-1).
 * Creates a shooting star effect: cyan → purple → white.
 * @param t - Position along baseline (0 = start, 1 = end)
 * @returns RGB values normalized 0-1 as array [r, g, b]
 */
function calculateBaselineGradientColor(t: number): [number, number, number] {
  // Cyan phase (0-0.5): solid cyan
  if (t < 0.5) {
    return [0, 240 / 255, 255 / 255];
  }
  
  // Transition phase (0.5-0.7): cyan → purple
  if (t < 0.7) {
    const transitionT = (t - 0.5) / 0.2; // 0-1 within this phase
    const g = (240 - transitionT * 1200) / 255;
    const b = 255 / 255;
    const r = (transitionT * 1275) / 255;
    return [r, g, b];
  }
  
  // Final phase (0.7-1.0): purple → white
  if (t < 1.0) {
    const transitionT = (t - 0.7) / 0.3; // 0-1 within this phase
    const r = 255 / 255;
    const g = (transitionT * 1275) / 255;
    const b = (255 - transitionT * 375) / 255;
    return [r, g, b];
  }
  
  // End: white
  return [1, 1, 1];
}

/**
 * Creates a canvas texture with text for year labels.
 * @param text - Text to render
 * @param fontSize - Font size in pixels (default: 11)
 * @returns THREE.Texture with rendered text
 */
function createTextTexture(text: string, fontSize: number = 11): THREE.Texture {
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d', { alpha: true });
  if (!context) {
    throw new Error('Could not get 2D context for text texture');
  }
  
  const fontFamily = 'Inter, system-ui, sans-serif';
  const padding = 4;
  
  // Measure text to determine canvas size
  context.font = `bold ${fontSize}px ${fontFamily}`;
  const metrics = context.measureText(text);
  const width = Math.ceil(metrics.width) + padding * 2;
  const height = fontSize + padding * 2;
  
  canvas.width = width;
  canvas.height = height;
  
  // Clear and redraw with proper font
  context.clearRect(0, 0, width, height);
  context.font = `bold ${fontSize}px ${fontFamily}`;
  context.fillStyle = 'rgba(226, 232, 240, 0.75)'; // Light slate color
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.fillText(text, width / 2, height / 2);
  
  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  return texture;
}

/**
 * Creates a high-quality star texture with radial gradient and cross pattern.
 * Optimized for visibility with increased resolution (64x64).
 * @returns THREE.Texture with star pattern
 */
function createStarTexture(): THREE.Texture {
  const canvas = document.createElement('canvas');
  const size = STAR_CONFIG.TEXTURE_SIZE;
  canvas.width = size;
  canvas.height = size;
  
  const ctx = canvas.getContext('2d', { alpha: true });
  if (!ctx) {
    throw new Error('Could not get 2D context for star texture');
  }
  
  const center = size / 2;
  
  // Create radial gradient for soft-edged star glow (more visible)
  const gradient = ctx.createRadialGradient(center, center, 0, center, center, center);
  gradient.addColorStop(0, 'rgba(255, 255, 255, 1.0)'); // Bright core
  gradient.addColorStop(0.3, 'rgba(255, 255, 255, 0.9)'); // Strong inner glow
  gradient.addColorStop(0.6, 'rgba(255, 255, 255, 0.5)'); // Medium glow
  gradient.addColorStop(0.8, 'rgba(255, 255, 255, 0.2)'); // Outer glow
  gradient.addColorStop(1, 'rgba(255, 255, 255, 0)'); // Fade out
  
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);
  
  // Add visible cross pattern for star-like appearance
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.7)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(center, 0);
  ctx.lineTo(center, size);
  ctx.moveTo(0, center);
  ctx.lineTo(size, center);
  ctx.stroke();
  
  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  return texture;
}


/**
 * Creates a text sprite for year labels positioned below the baseline.
 * @param year - Year to display
 * @param x - Screen X coordinate
 * @param y - Screen Y coordinate
 * @param canvasWidth - Canvas width for coordinate conversion
 * @param height - Canvas height for coordinate conversion
 * @returns THREE.Sprite with year text
 */
function createYearLabelSprite(
  year: number,
  x: number,
  y: number,
  canvasWidth: number,
  height: number
): THREE.Sprite {
  const fontSize = 11;
  const texture = createTextTexture(String(year), fontSize);
  const material = new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
  });
  
  const sprite = new THREE.Sprite(material);
  
  // Convert screen coordinates to Three.js world coordinates
  const worldX = x - canvasWidth / 2;
  const worldY = -y + height / 2;
  sprite.position.set(
    worldX,
    worldY - BASELINE_CONFIG.YEAR_LABEL_OFFSET_Y,
    0
  );
  
  // Scale sprite to readable size
  sprite.scale.set(
    BASELINE_CONFIG.YEAR_LABEL_SCALE_X,
    BASELINE_CONFIG.YEAR_LABEL_SCALE_Y,
    1
  );
  
  return sprite;
}

/**
 * Creates an information grid overlay that moves with the constellation.
 * The grid shows year intervals and thematic clusters for better navigation.
 * Similar to Grok's information overlay approach.
 * @param config - Layout configuration
 * @param canvasWidth - Current canvas width
 * @returns A THREE.Group containing grid lines and labels
 */
export function createInformationGrid(
  config: LayoutConfig,
  canvasWidth: number
): THREE.Group {
  const group = new THREE.Group();
  group.userData.isTimelineObject = true;
  
  const baselineY = -config.baselineY + config.height / 2;
  const startX = BASELINE_CONFIG.HORIZONTAL_PADDING - canvasWidth / 2;
  const endX = canvasWidth - BASELINE_CONFIG.HORIZONTAL_PADDING - canvasWidth / 2;
  
  // Vertical grid lines (year intervals) - every 5 years for finer grid
  const yearInterval = 5;
  const startYear = Math.floor(config.minYear / yearInterval) * yearInterval;
  
  const gridLines: THREE.Vector3[] = [];
  const gridColors: number[] = [];
  
  for (let year = startYear; year <= config.maxYear; year += yearInterval) {
    const tickX = xScaleYear(year, config);
    const worldTickX = tickX - canvasWidth / 2;
    
    // Vertical grid line (subtle, from top to bottom of visible area)
    const topY = config.height / 2 - 100; // Start above baseline
    const bottomY = -config.height / 2 + 100; // End below baseline
    
    // Line color: darker for non-decade years, slightly brighter for decades
    const isDecade = year % 10 === 0;
    const opacity = isDecade ? 0.06 : 0.03;
    const color = [0.0, 0.94, 1.0]; // Cyan
    
    gridLines.push(
      new THREE.Vector3(worldTickX, topY, 0),
      new THREE.Vector3(worldTickX, bottomY, 0)
    );
    gridColors.push(...color, opacity);
    gridColors.push(...color, opacity);
  }
  
  // Horizontal grid lines (theme clusters) - spaced by branch spacing
  const horizontalSpacing = config.branchSpacing;
  const gridLevels = 5; // Number of horizontal grid levels
  for (let i = 0; i < gridLevels; i++) {
    const gridY = baselineY - (i + 1) * horizontalSpacing;
    const opacity = 0.02; // Very subtle horizontal lines
    const color = [0.0, 0.94, 1.0]; // Cyan
    
    gridLines.push(
      new THREE.Vector3(startX, gridY, 0),
      new THREE.Vector3(endX, gridY, 0)
    );
    gridColors.push(...color, opacity);
    gridColors.push(...color, opacity);
  }
  
  if (gridLines.length > 0) {
    const geometry = new THREE.BufferGeometry().setFromPoints(gridLines);
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(gridColors, 4));
    
    const material = new THREE.LineBasicMaterial({
      vertexColors: true,
      transparent: true,
      opacity: 1.0,
      linewidth: 0.5,
      depthWrite: false,
    });
    
    const lines = new THREE.LineSegments(geometry, material);
    lines.renderOrder = 25; // Render between baseline and stars (before edges)
    group.add(lines);
  }
  
  return group;
}

/**
 * Creates the baseline with a shooting star gradient effect and year labels.
 * @param renderer - The Three.js renderer instance
 * @param config - Layout configuration
 * @param canvasWidth - Current canvas width
 * @param animationTime - Current animation time for dynamic effects
 * @returns A THREE.Group containing the baseline line, glow, ticks, and year labels
 */
export function createBaselineThree(
  renderer: TimelineThreeRenderer,
  config: LayoutConfig,
  canvasWidth: number,
  animationTime: number
): THREE.Group {
  const group = new THREE.Group();
  group.userData.isTimelineObject = true;
  
  const startX = BASELINE_CONFIG.HORIZONTAL_PADDING - canvasWidth / 2;
  const endX = canvasWidth - BASELINE_CONFIG.HORIZONTAL_PADDING - canvasWidth / 2;
  const baselineY = -config.baselineY + config.height / 2; // Convert to Three.js Y
  
  // Create gradient line with color transitions
  const segments = BASELINE_CONFIG.GRADIENT_SEGMENTS;
  const points: THREE.Vector3[] = [];
  const colors: number[] = [];
  
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const x = startX + (endX - startX) * t;
    points.push(new THREE.Vector3(x, baselineY, 0));
    
    // Color gradient: cyan → purple → white (shooting star effect)
    const rgb = calculateBaselineGradientColor(t);
    colors.push(...rgb);
  }
  
  const geometry = new THREE.BufferGeometry().setFromPoints(points);
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  
  // Main baseline line with gradient
  const material = new THREE.LineBasicMaterial({
    vertexColors: true,
    linewidth: BASELINE_CONFIG.LINE_WIDTH,
    transparent: true,
    opacity: 1.0,
  });
  
  const line = new THREE.Line(geometry, material);
  line.renderOrder = 0; // Baseline renders first (behind stars)
  group.add(line);
  
  // Glow layer for atmospheric effect
  const glowGeometry = new THREE.BufferGeometry().setFromPoints(points);
  const glowMaterial = new THREE.LineBasicMaterial({
    color: 0x00f0ff,
    linewidth: BASELINE_CONFIG.GLOW_LINE_WIDTH,
    transparent: true,
    opacity: BASELINE_CONFIG.GLOW_OPACITY,
    depthWrite: false, // Prevent depth issues
  });
  const glowLine = new THREE.Line(glowGeometry, glowMaterial);
  glowLine.renderOrder = 0; // Glow renders with baseline
  group.add(glowLine);
  
  // Decade ticks and year labels
  const decadeInterval = BASELINE_CONFIG.TICK_DECADE_INTERVAL;
  const startYear = Math.floor(config.minYear / decadeInterval) * decadeInterval;
  
  for (let year = startYear; year <= config.maxYear; year += decadeInterval) {
    const tickX = xScaleYear(year, config);
    const worldTickX = tickX - canvasWidth / 2;
    
    // Tick mark (vertical line)
    const tickHeight = BASELINE_CONFIG.TICK_HEIGHT;
    const tickGeometry = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(worldTickX, baselineY - tickHeight, 0),
      new THREE.Vector3(worldTickX, baselineY + tickHeight, 0),
    ]);
    
    const tickMaterial = new THREE.LineBasicMaterial({
      color: 0x00f0ff,
      linewidth: 1.5,
      transparent: true,
      opacity: BASELINE_CONFIG.TICK_OPACITY,
    });
    
    const tick = new THREE.Line(tickGeometry, tickMaterial);
    tick.renderOrder = 1; // Ticks render above baseline
    group.add(tick);
    
    // Year label (sprite)
    const labelSprite = createYearLabelSprite(
      year,
      tickX,
      config.baselineY,
      canvasWidth,
      config.height
    );
    labelSprite.userData.isTimelineObject = true;
    labelSprite.renderOrder = 200; // Labels render on top
    group.add(labelSprite);
  }
  
  return group;
}

/**
 * Creates a scientific comet visualization with nucleus and particle tails.
 * Simplified and performance-friendly.
 */
export function createCometThree(
  renderer: TimelineThreeRenderer,
  x: number,
  y: number,
  canvasWidth: number,
  height: number,
  animationTime: number
): { mesh: THREE.Mesh; particles: THREE.Points } {
  const worldX = x - canvasWidth / 2;
  const worldY = height / 2 - y;
  const scene = renderer.getScene();

  const nucleusGeometry = new THREE.SphereGeometry(
    COMET_CONFIG.NUCLEUS_RADIUS,
    COMET_CONFIG.NUCLEUS_SEGMENTS,
    COMET_CONFIG.NUCLEUS_SEGMENTS
  );
  const nucleusMaterial = new THREE.MeshBasicMaterial({ color: 0x4a3a2a });
  const nucleus = new THREE.Mesh(nucleusGeometry, nucleusMaterial);
  nucleus.position.set(worldX, worldY, 0);
  nucleus.userData.isTimelineObject = true;

  const particleCount = COMET_CONFIG.PARTICLE_COUNT;
  const positions = new Float32Array(particleCount * 3);
  const colors = new Float32Array(particleCount * 3);
  const sizes = new Float32Array(particleCount);

  const normalizedTime = animationTime * 0.001;
  for (let i = 0; i < particleCount; i++) {
    const offset = (normalizedTime * COMET_CONFIG.ANIMATION_SPEED + i * 12) % COMET_CONFIG.ION_TAIL_LENGTH;
    positions[i * 3] = worldX + offset;
    positions[i * 3 + 1] = worldY + (Math.random() - 0.5) * 10;
    positions[i * 3 + 2] = (Math.random() - 0.5) * 4;
    if (i < particleCount / 2) {
      colors[i * 3] = 0.6; colors[i * 3 + 1] = 0.8; colors[i * 3 + 2] = 1.0;
    } else {
      colors[i * 3] = 1.0; colors[i * 3 + 1] = 0.95; colors[i * 3 + 2] = 0.8;
    }
    sizes[i] = 0.8 + Math.random() * 0.7;
  }

  const particleGeometry = new THREE.BufferGeometry();
  particleGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  particleGeometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  particleGeometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));

  const particleMaterial = new THREE.PointsMaterial({
    size: COMET_CONFIG.PARTICLE_BASE_SIZE,
    vertexColors: true,
    transparent: true,
    opacity: COMET_CONFIG.PARTICLE_OPACITY,
    blending: THREE.AdditiveBlending,
    sizeAttenuation: false,
  });

  const particles = new THREE.Points(particleGeometry, particleMaterial);
  particles.userData.isTimelineObject = true;

  scene.add(nucleus);
  scene.add(particles);
  return { mesh: nucleus, particles };
}

/**
 * Creates stars (nodes) as Three.js Points for the timeline.
 * Uses separate materials per size category for proper rendering.
 */
export function createStarsThree(
  renderer: TimelineThreeRenderer,
  nodes: Node[],
  indexToPosition: Map<number, { x: number; y: number }>,
  canvasWidth: number,
  config: LayoutConfig,
  query: string,
  mode: SearchMode,
  selectedIndex: number | null
): THREE.Group {
  const group = new THREE.Group();
  group.userData.isTimelineObject = true;

  const selectedPositions: number[] = [];
  const selectedColors: number[] = [];
  const selectedIndices: number[] = [];

  const highlightedPositions: number[] = [];
  const highlightedColors: number[] = [];
  const highlightedIndices: number[] = [];

  const normalPositions: number[] = [];
  const normalColors: number[] = [];
  const normalIndices: number[] = [];

  nodes.forEach((node, i) => {
    const pos = indexToPosition.get(i);
    if (!pos) return;
    const nodeText = `${node.label} ${(node.tags ?? []).join(' ')}`;
    const isQueryMatch = matchesQuery(nodeText, query);
    if (mode === 'filter' && query && !isQueryMatch) return;

    const worldX = pos.x - canvasWidth / 2;
    const worldY = config.height / 2 - pos.y;

    if (selectedIndex === i) {
      selectedPositions.push(worldX, worldY, 0);
      selectedColors.push(...STAR_COLORS.SELECTED);
      selectedIndices.push(i);
    } else if ((isQueryMatch && query) || node.tags?.includes('ai')) {
      highlightedPositions.push(worldX, worldY, 0);
      highlightedColors.push(...(node.tags?.includes('ai') ? STAR_COLORS.AI_TAG : STAR_COLORS.QUERY_MATCH));
      highlightedIndices.push(i);
    } else {
      normalPositions.push(worldX, worldY, 0);
      normalColors.push(...STAR_COLORS.NORMAL);
      normalIndices.push(i);
    }
  });

  const starTexture = (() => {
    const canvas = document.createElement('canvas');
    const size = STAR_CONFIG.TEXTURE_SIZE;
    canvas.width = size; canvas.height = size;
    const ctx = canvas.getContext('2d', { alpha: true })!;
    const c = size / 2;
    const g = ctx.createRadialGradient(c, c, 0, c, c, c);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.6, 'rgba(255,255,255,0.45)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, size, size);
    ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(c, 0); ctx.lineTo(c, size); ctx.moveTo(0, c); ctx.lineTo(size, c); ctx.stroke();
    const tex = new THREE.CanvasTexture(canvas); tex.needsUpdate = true; return tex;
  })();

  function makePoints(positions: number[], colors: number[], indices: number[], size: number): THREE.Points | null {
    if (positions.length === 0) return null;
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    geometry.userData.nodeIndices = indices;
    const material = new THREE.PointsMaterial({
      size,
      vertexColors: true,
      transparent: true,
      opacity: 1.0,
      blending: THREE.AdditiveBlending,
      sizeAttenuation: false,
      map: starTexture,
      alphaTest: 0.01,
      depthWrite: false,
    });
    const points = new THREE.Points(geometry, material);
    points.userData.isTimelineObject = true;
    points.renderOrder = 100;
    return points;
  }

  const selected = makePoints(selectedPositions, selectedColors, selectedIndices, STAR_CONFIG.SELECTED_SIZE);
  const highlighted = makePoints(highlightedPositions, highlightedColors, highlightedIndices, STAR_CONFIG.QUERY_MATCH_SIZE);
  const normal = makePoints(normalPositions, normalColors, normalIndices, STAR_CONFIG.NORMAL_SIZE);
  if (selected) group.add(selected);
  if (highlighted) group.add(highlighted);
  if (normal) group.add(normal);
  return group;
}

/**
 * Creates and renders constellation lines between nearby nodes.
 */
export function createConstellationLinesThree(
  renderer: TimelineThreeRenderer,
  nodes: Node[],
  indexToPosition: Map<number, { x: number; y: number }>,
  canvasWidth: number,
  config: LayoutConfig,
  showConstellations: boolean
): THREE.LineSegments | null {
  if (!showConstellations) return null;
  const maxConnectionDist = Math.min(config.canvasWidth, config.height) * CONSTELLATION_CONFIG.MAX_CONNECTION_DISTANCE_FACTOR;
  const points: THREE.Vector3[] = [];
  const colors: number[] = [];
  let connectionCount = 0;
  const maxConnections = CONSTELLATION_CONFIG.MAX_CONNECTIONS;

  for (let i = 0; i < nodes.length && connectionCount < maxConnections; i++) {
    for (let j = i + 1; j < nodes.length && connectionCount < maxConnections; j++) {
      const posA = indexToPosition.get(i);
      const posB = indexToPosition.get(j);
      if (!posA || !posB) continue;
      const dx = posA.x - posB.x; const dy = posA.y - posB.y;
      const dist = Math.hypot(dx, dy);
      if (dist <= maxConnectionDist) {
        const worldAX = posA.x - canvasWidth / 2;
        const worldAY = config.height / 2 - posA.y;
        const worldBX = posB.x - canvasWidth / 2;
        const worldBY = config.height / 2 - posB.y;
        points.push(new THREE.Vector3(worldAX, worldAY, 0));
        points.push(new THREE.Vector3(worldBX, worldBY, 0));
        const t = 1 - dist / maxConnectionDist;
        const alpha = CONSTELLATION_CONFIG.BASE_OPACITY * t * t;
        colors.push(0.0, 0.94, 1.0, alpha);
        colors.push(0.0, 0.94, 1.0, alpha);
        connectionCount++;
      }
    }
  }
  if (points.length === 0) return null;
  const geometry = new THREE.BufferGeometry().setFromPoints(points);
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 4));
  const material = new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 1.0, linewidth: CONSTELLATION_CONFIG.LINE_WIDTH, depthWrite: false });
  const lines = new THREE.LineSegments(geometry, material);
  lines.userData.isTimelineObject = true;
  lines.renderOrder = 50;
  return lines;
}

/**
 * Creates and renders curved edges (connections) between nodes.
 */
export function createEdgesThree(
  renderer: TimelineThreeRenderer,
  edges: Edge[],
  nodes: Node[],
  indexToPosition: Map<number, { x: number; y: number }>,
  canvasWidth: number,
  config: LayoutConfig,
  query: string,
  mode: SearchMode
): THREE.Group {
  const group = new THREE.Group();
  group.userData.isTimelineObject = true;

  edges.forEach(edge => {
    const nodeA = nodes.find(n => n.id === edge.from);
    const nodeB = nodes.find(n => n.id === edge.to);
    if (!nodeA || !nodeB) return;

    if (mode === 'filter') {
      const aText = `${nodeA.label} ${nodeA.tags?.join(' ') ?? ''}`;
      const bText = `${nodeB.label} ${nodeB.tags?.join(' ') ?? ''}`;
      if (!(matchesQuery(aText, query) || matchesQuery(bText, query))) return;
    }

    const ia = nodes.findIndex(n => n.id === nodeA.id);
    const ib = nodes.findIndex(n => n.id === nodeB.id);
    const posA = indexToPosition.get(ia);
    const posB = indexToPosition.get(ib);
    if (!posA || !posB) return;

    const worldAX = posA.x - canvasWidth / 2;
    const worldAY = config.height / 2 - posA.y;
    const worldBX = posB.x - canvasWidth / 2;
    const worldBY = config.height / 2 - posB.y;

    const dx = worldBX - worldAX;
    const curveH = Math.max(EDGE_CONFIG.MIN_CURVE_HEIGHT, Math.min(EDGE_CONFIG.MAX_CURVE_HEIGHT, Math.abs(dx) * EDGE_CONFIG.CURVE_HEIGHT_FACTOR));
    const pts: THREE.Vector3[] = [];
    const segs = EDGE_CONFIG.CURVE_SEGMENTS;
    for (let i = 0; i <= segs; i++) {
      const t = i / segs;
      const x = worldAX + dx * t;
      const y = worldAY + curveH * 4 * t * (1 - t);
      pts.push(new THREE.Vector3(x, y, 0));
    }
    const geometry = new THREE.BufferGeometry().setFromPoints(pts);

    const isHighlighted = mode === 'highlight' && query && (
      matchesQuery(`${nodeA.label} ${nodeA.tags?.join(' ') ?? ''}`, query) ||
      matchesQuery(`${nodeB.label} ${nodeB.tags?.join(' ') ?? ''}`, query)
    );

    const material = new THREE.LineBasicMaterial({
      color: EDGE_CONFIG.COLOR,
      transparent: true,
      opacity: isHighlighted ? EDGE_CONFIG.HIGHLIGHTED_OPACITY : EDGE_CONFIG.NORMAL_OPACITY,
      linewidth: isHighlighted ? EDGE_CONFIG.HIGHLIGHTED_LINE_WIDTH : EDGE_CONFIG.NORMAL_LINE_WIDTH,
      depthWrite: false,
    });
    const line = new THREE.Line(geometry, material);
    line.renderOrder = 50;
    group.add(line);
  });
  return group;
}

/**
 * Raycaster-based hit testing to find a node at a given screen position.
 */
export function getNodeAtPosition(
  renderer: TimelineThreeRenderer,
  mouseX: number,
  mouseY: number,
  canvasWidth: number,
  height: number
): number | null {
  if (!renderer) return null;
  try {
    const raycaster = new THREE.Raycaster();
    const camera = renderer.getCamera();
    const scene = renderer.getScene();
    const x = (mouseX / canvasWidth) * 2 - 1;
    const y = -(mouseY / height) * 2 + 1;
    raycaster.setFromCamera(new THREE.Vector2(x, y), camera);
    const pointsObjects: THREE.Points[] = [];
    scene.traverse(child => {
      if (child instanceof THREE.Points && (child as any).geometry?.userData?.nodeIndices) {
        pointsObjects.push(child as THREE.Points);
      }
    });
    if (pointsObjects.length === 0) return null;
    const intersects = raycaster.intersectObjects(pointsObjects, false);
    for (const inter of intersects) {
      const obj = inter.object as any;
      const indices: number[] = obj.geometry.userData.nodeIndices;
      const idx = inter.index;
      if (idx !== undefined && idx < indices.length) return indices[idx];
    }

    // Fallback: screen-space distance check
    const worldPos = new THREE.Vector3();
    for (const pts of pointsObjects) {
      const indices = (pts as any).geometry.userData.nodeIndices as number[];
      const positions = (pts.geometry as THREE.BufferGeometry).attributes.position as THREE.BufferAttribute;
      if (!positions || !indices) continue;
      for (let i = 0; i < indices.length; i++) {
        worldPos.set(positions.getX(i), positions.getY(i), positions.getZ(i));
        worldPos.project(camera);
        const sx = (worldPos.x * 0.5 + 0.5) * canvasWidth;
        const sy = (worldPos.y * -0.5 + 0.5) * height;
        const dx = sx - mouseX; const dy = sy - mouseY;
        if (Math.sqrt(dx * dx + dy * dy) < STAR_CONFIG.HIT_RADIUS_PX) return indices[i];
      }
    }
  } catch {
    // ignore
  }
  return null;
}

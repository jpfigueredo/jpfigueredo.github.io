import * as THREE from 'three';
import type { Node, Edge } from '../types';
import type { SearchMode } from '../SearchBar';
import type { LayoutConfig } from './layout';
import { yearOf } from '../utils';
import { xScaleYear } from './layout';
import type { TimelineThreeRenderer } from './three-renderer';

function matchesQuery(text: string, query: string): boolean {
  return query.length === 0 || text.toLowerCase().includes(query.trim().toLowerCase());
}

// Baseline with shooting star effect (gradient line)
export function createBaselineThree(
  renderer: TimelineThreeRenderer,
  config: LayoutConfig,
  canvasWidth: number,
  animationTime: number
): THREE.Group {
  const group = new THREE.Group();
  group.userData.isTimelineObject = true;
  
  const startX = 40 - canvasWidth / 2;
  const endX = canvasWidth - 40 - canvasWidth / 2;
  const baselineY = -config.baselineY + config.height / 2; // Convert to Three.js coordinates
  
  // Create gradient line using multiple segments with different colors
  const segments = 50;
  const points: THREE.Vector3[] = [];
  const colors: number[] = [];
  
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const x = startX + (endX - startX) * t;
    points.push(new THREE.Vector3(x, baselineY, 0));
    
    // Gradient colors matching Canvas 2D version
    let r = 0, g = 0, b = 0, a = 0;
    if (t < 0.1) {
      a = t * 1.5;
      g = 240;
      b = 255;
    } else if (t < 0.3) {
      a = 0.15 + (t - 0.1) * 2.25;
      g = 240;
      b = 255;
    } else if (t < 0.5) {
      a = 0.6 + (t - 0.3) * 1.25;
      g = 240;
      b = 255;
    } else if (t < 0.7) {
      a = 0.85 - (t - 0.5) * 0.5;
      g = 240 - (t - 0.5) * 1200;
      b = 255;
      r = (t - 0.5) * 1275;
    } else if (t < 0.9) {
      a = 0.75 - (t - 0.7) * 1.75;
      r = 255;
      g = (t - 0.7) * 1275;
      b = 255 - (t - 0.7) * 375;
    } else {
      a = (1 - t) * 4;
      r = 255;
      g = 255;
      b = 255;
    }
    
    colors.push(r / 255, g / 255, b / 255);
  }
  
  const geometry = new THREE.BufferGeometry().setFromPoints(points);
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  
  const material = new THREE.LineBasicMaterial({
    vertexColors: true,
    linewidth: 2.5,
    transparent: true,
    opacity: 1.0
  });
  
  const line = new THREE.Line(geometry, material);
  group.add(line);
  
  // Outer glow layer (thicker, more transparent)
  const glowGeometry = new THREE.BufferGeometry().setFromPoints(points);
  const glowMaterial = new THREE.LineBasicMaterial({
    color: 0x00f0ff,
    linewidth: 5,
    transparent: true,
    opacity: 0.2
  });
  const glowLine = new THREE.Line(glowGeometry, glowMaterial);
  group.add(glowLine);
  
  // Decade ticks
  const decade = 10;
  for (let year = Math.floor(config.minYear / decade) * decade; year <= config.maxYear; year += decade) {
    const tickX = xScaleYear(year, config) - canvasWidth / 2;
    
    const tickGeometry = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(tickX, baselineY - 8, 0),
      new THREE.Vector3(tickX, baselineY + 8, 0)
    ]);
    
    const tickMaterial = new THREE.LineBasicMaterial({
      color: 0x00f0ff,
      linewidth: 1.5,
      transparent: true,
      opacity: 0.4
    });
    
    const tick = new THREE.Line(tickGeometry, tickMaterial);
    group.add(tick);
  }
  
  return group;
}

// Scientific comet with PBR material (NASA-style, Skyrim-quality)
export function createCometThree(
  renderer: TimelineThreeRenderer,
  x: number,
  y: number,
  canvasWidth: number,
  height: number,
  animationTime: number
): { mesh: THREE.Mesh; particles: THREE.Points } {
  const worldX = x - canvasWidth / 2;
  const worldY = height / 2 - y; // Convert to Three.js coordinates
  
  const scene = renderer.getScene();
  
  // === NUCLEUS (PBR Material - Skyrim quality) ===
  const nucleusGeometry = new THREE.SphereGeometry(4.5, 32, 32);
  
  // PBR Material for realistic comet surface
  const nucleusMaterial = new THREE.MeshStandardMaterial({
    color: 0x2a1e14, // Dark brown/charcoal base
    roughness: 0.85, // Rough surface (rocky)
    metalness: 0.1,  // Slight metallic (minerals)
    emissive: 0xffaa44, // Warm glow (sunlit side)
    emissiveIntensity: 0.3,
    transparent: false
  });
  
  const nucleus = new THREE.Mesh(nucleusGeometry, nucleusMaterial);
  nucleus.position.set(worldX, worldY, 0);
  nucleus.userData.isTimelineObject = true;
  
  // === COMA (atmosphere around nucleus) ===
  const comaGeometry = new THREE.SphereGeometry(14, 16, 16);
  const comaMaterial = new THREE.MeshBasicMaterial({
    color: 0xfffffa,
    transparent: true,
    opacity: 0.15,
    side: THREE.DoubleSide
  });
  const coma = new THREE.Mesh(comaGeometry, comaMaterial);
  coma.position.set(worldX, worldY, 0);
  coma.userData.isTimelineObject = true;
  scene.add(coma);
  
  // === PARTICLE TAILS (ion + dust) ===
  const particleCount = 100;
  const positions = new Float32Array(particleCount * 3);
  const colors = new Float32Array(particleCount * 3);
  const sizes = new Float32Array(particleCount);
  
  const time = animationTime * 0.001;
  
  // Ion tail particles (blue/cyan, smaller, straight, horizontal)
  for (let i = 0; i < particleCount / 2; i++) {
    const t = i / (particleCount / 2);
    const offset = (time * 25 + i * 12) % 140;
    positions[i * 3] = worldX + offset; // Horizontal (future direction)
    positions[i * 3 + 1] = worldY + (Math.random() - 0.5) * 8; // Small vertical spread
    positions[i * 3 + 2] = (Math.random() - 0.5) * 4;
    
    // Cyan/blue color
    colors[i * 3] = 0.6;
    colors[i * 3 + 1] = 0.8;
    colors[i * 3 + 2] = 1.0;
    
    const alpha = (1 - offset / 140) * 0.15 * 0.3;
    sizes[i] = (1.5 + Math.random() * 1.0) * alpha * 10;
  }
  
  // Dust tail particles (yellow-white, larger, curved, horizontal)
  for (let i = particleCount / 2; i < particleCount; i++) {
    const t = (i - particleCount / 2) / (particleCount / 2);
    const offset = 120 * t;
    const curve = -18 * t * t; // Curvature upward
    positions[i * 3] = worldX + offset + Math.sin(time * 2 + i) * 4;
    positions[i * 3 + 1] = worldY + curve + (Math.random() - 0.5) * 12;
    positions[i * 3 + 2] = (Math.random() - 0.5) * 6;
    
    // Yellow-white color
    colors[i * 3] = 1.0;
    colors[i * 3 + 1] = 0.95;
    colors[i * 3 + 2] = 0.8;
    
    const alpha = (1 - t) * 0.08;
    sizes[i] = (2.0 + Math.random() * 2.0) * alpha * 10;
  }
  
  const particleGeometry = new THREE.BufferGeometry();
  particleGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  particleGeometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  particleGeometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));
  
  // Particle material with additive blending for glow
  const particleMaterial = new THREE.PointsMaterial({
    size: 2,
    vertexColors: true,
    transparent: true,
    opacity: 0.6,
    blending: THREE.AdditiveBlending,
    sizeAttenuation: true,
    map: createParticleTexture() // Custom texture for better particles
  });
  
  const particles = new THREE.Points(particleGeometry, particleMaterial);
  particles.userData.isTimelineObject = true;
  
  scene.add(nucleus);
  scene.add(particles);
  
  return { mesh: nucleus, particles };
}

// Create particle texture (small white circle)
function createParticleTexture(): THREE.Texture {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext('2d')!;
  
  const gradient = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  gradient.addColorStop(0, 'rgba(255,255,255,1)');
  gradient.addColorStop(0.5, 'rgba(255,255,255,0.5)');
  gradient.addColorStop(1, 'rgba(255,255,255,0)');
  
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 64, 64);
  
  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  return texture;
}

// Stars with glow effect
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
  
  const positions: number[] = [];
  const colors: number[] = [];
  const sizes: number[] = [];
  
  nodes.forEach((node, i) => {
    const pos = indexToPosition.get(i);
    if (!pos) return;
    
    const nodeText = `${node.label} ${(node.tags ?? []).join(' ')}`;
    const isQueryMatch = matchesQuery(nodeText, query);
    if (mode === 'filter' && query && !isQueryMatch) return;
    
    const worldX = pos.x - canvasWidth / 2;
    const worldY = config.height / 2 - pos.y;
    
    positions.push(worldX, worldY, 0);
    
    // Color based on query match and selection
    if (selectedIndex === i) {
      colors.push(0.0, 0.94, 1.0); // Neon cyan for selected
      sizes.push(12); // Larger
    } else if (isQueryMatch && query) {
      colors.push(0.0, 0.94, 1.0); // Neon cyan for matches
      sizes.push(6);
    } else if (node.tags?.includes('ai')) {
      colors.push(0.0, 0.9, 1.0); // Cyan for AI nodes
      sizes.push(5);
    } else {
      colors.push(1.0, 1.0, 1.0); // White for normal nodes
      sizes.push(4);
    }
  });
  
  if (positions.length === 0) return group;
  
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.setAttribute('size', new THREE.Float32BufferAttribute(sizes, 1));
  
  // Star material with glow
  const material = new THREE.PointsMaterial({
    size: 8,
    vertexColors: true,
    transparent: true,
    opacity: 0.9,
    blending: THREE.AdditiveBlending,
    sizeAttenuation: true,
    map: createParticleTexture()
  });
  
  const stars = new THREE.Points(geometry, material);
  group.add(stars);
  
  return group;
}

// Constellation connections
export function createConstellationLinesThree(
  renderer: TimelineThreeRenderer,
  nodes: Node[],
  indexToPosition: Map<number, { x: number; y: number }>,
  canvasWidth: number,
  config: LayoutConfig,
  showConstellations: boolean
): THREE.LineSegments | null {
  if (!showConstellations) return null;
  
  const maxConnectionDist = Math.min(config.canvasWidth, config.height) * 0.15;
  const points: THREE.Vector3[] = [];
  const colors: number[] = [];
  
  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      const posA = indexToPosition.get(i);
      const posB = indexToPosition.get(j);
      if (!posA || !posB) continue;
      
      const deltaX = posA.x - posB.x;
      const deltaY = posA.y - posB.y;
      const distance = Math.hypot(deltaX, deltaY);
      
      if (distance <= maxConnectionDist) {
        const worldAX = posA.x - canvasWidth / 2;
        const worldAY = config.height / 2 - posA.y;
        const worldBX = posB.x - canvasWidth / 2;
        const worldBY = config.height / 2 - posB.y;
        
        points.push(new THREE.Vector3(worldAX, worldAY, 0));
        points.push(new THREE.Vector3(worldBX, worldBY, 0));
        
        const distanceFactor = 1 - (distance / maxConnectionDist);
        const alpha = 0.08 * distanceFactor * distanceFactor;
        
        // Cyan gradient
        colors.push(0.0, 0.94, 1.0, alpha);
        colors.push(0.0, 0.94, 1.0, alpha);
      }
    }
  }
  
  if (points.length === 0) return null;
  
  const geometry = new THREE.BufferGeometry().setFromPoints(points);
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 4));
  
  const material = new THREE.LineBasicMaterial({
    vertexColors: true,
    transparent: true,
    opacity: 1.0,
    linewidth: 0.6
  });
  
  const lines = new THREE.LineSegments(geometry, material);
  lines.userData.isTimelineObject = true;
  
  return lines;
}

// Edges (connections between nodes)
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
  
  edges.forEach((edge) => {
    const nodeA = nodes.find(n => n.id === edge.from);
    const nodeB = nodes.find(n => n.id === edge.to);
    if (!nodeA || !nodeB) return;
    
    if (mode === 'filter') {
      const nodeAText = `${nodeA.label} ${nodeA.tags?.join(' ') ?? ''}`;
      const nodeBText = `${nodeB.label} ${nodeB.tags?.join(' ') ?? ''}`;
      if (!(matchesQuery(nodeAText, query) || matchesQuery(nodeBText, query))) return;
    }
    
    const nodeAIndex = nodes.findIndex(n => n.id === nodeA.id);
    const nodeBIndex = nodes.findIndex(n => n.id === nodeB.id);
    const posA = indexToPosition.get(nodeAIndex);
    const posB = indexToPosition.get(nodeBIndex);
    if (!posA || !posB) return;
    
    const worldAX = posA.x - canvasWidth / 2;
    const worldAY = config.height / 2 - posA.y;
    const worldBX = posB.x - canvasWidth / 2;
    const worldBY = config.height / 2 - posB.y;
    
    // Create curved edge (bezier-like)
    const deltaX = worldBX - worldAX;
    const curveHeight = Math.max(40, Math.min(140, Math.abs(deltaX) * 0.25));
    const controlPoint1X = worldAX + deltaX * 0.33;
    const controlPoint2X = worldAX + deltaX * 0.66;
    const controlPoint1Y = worldAY + curveHeight;
    const controlPoint2Y = worldBY + curveHeight;
    
    // Create curve using CatmullRomCurve3
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(worldAX, worldAY, 0),
      new THREE.Vector3(controlPoint1X, controlPoint1Y, 0),
      new THREE.Vector3(controlPoint2X, controlPoint2Y, 0),
      new THREE.Vector3(worldBX, worldBY, 0)
    ]);
    
    const points = curve.getPoints(50);
    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    
    const isHighlighted = mode === 'highlight' && query && 
      (matchesQuery(`${nodeA.label} ${nodeA.tags?.join(' ') ?? ''}`, query) ||
       matchesQuery(`${nodeB.label} ${nodeB.tags?.join(' ') ?? ''}`, query));
    
    const material = new THREE.LineBasicMaterial({
      color: isHighlighted ? 0x00f0ff : 0x00f0ff,
      transparent: true,
      opacity: isHighlighted ? 0.6 : 0.12,
      linewidth: isHighlighted ? 2.5 : 1
    });
    
    const line = new THREE.Line(geometry, material);
    group.add(line);
  });
  
  return group;
}

// Helper: convert world coordinates to screen for hit testing
export function worldToScreen(
  worldX: number,
  worldY: number,
  camera: THREE.OrthographicCamera
): { x: number; y: number } {
  const vector = new THREE.Vector3(worldX, worldY, 0);
  vector.project(camera);
  
  return {
    x: (vector.x * 0.5 + 0.5) * window.innerWidth,
    y: (vector.y * -0.5 + 0.5) * window.innerHeight
  };
}


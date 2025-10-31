import type { Node, Edge, LayoutPoint, Transform } from '../types';
import type { SearchMode } from '../SearchBar';
import { yearOf } from '../utils';
import type { LayoutConfig } from './layout';
import { xScaleYear } from './layout';

type RenderContext = {
  ctx: CanvasRenderingContext2D;
  canvasWidth: number;
  height: number;
  transform: Transform;
  layoutConfig: LayoutConfig;
  indexToOffset: Map<number, number>;
  nodes: Node[];
  edges: Edge[];
  query: string;
  mode: SearchMode;
  showConstellations: boolean;
  selectedIndex: number | null;
  layoutPoints: LayoutPoint[];
  animationTime?: number;
};

function matchesQuery(text: string, query: string): boolean {
  return query.length === 0 || text.toLowerCase().includes(query.trim().toLowerCase());
}

function drawBaseline(ctx: CanvasRenderingContext2D, config: LayoutConfig, canvasWidth: number, animationTime?: number) {
  const startX = 40;
  const endX = canvasWidth - 40;
  const baselineY = config.baselineY;
  
  // Enhanced shooting star baseline with multiple layers for depth
  const mainGradient = ctx.createLinearGradient(startX, baselineY, endX, baselineY);
  mainGradient.addColorStop(0.0, 'rgba(0,0,0,0)');
  mainGradient.addColorStop(0.1, 'rgba(0,240,255,0.15)');
  mainGradient.addColorStop(0.3, 'rgba(0,240,255,0.6)');
  mainGradient.addColorStop(0.5, 'rgba(0,240,255,0.85)');
  mainGradient.addColorStop(0.7, 'rgba(255,0,230,0.75)');
  mainGradient.addColorStop(0.9, 'rgba(255,255,255,0.4)');
  mainGradient.addColorStop(1.0, 'rgba(0,0,0,0)');
  
  // Outer glow layer
  ctx.strokeStyle = 'rgba(0,240,255,0.2)';
  ctx.lineWidth = 5;
  ctx.shadowBlur = 15;
  ctx.shadowColor = 'rgba(0,240,255,0.5)';
  ctx.beginPath();
  ctx.moveTo(startX, baselineY);
  ctx.lineTo(endX, baselineY);
  ctx.stroke();
  
  // Main line
  ctx.shadowBlur = 0;
  ctx.strokeStyle = mainGradient as CanvasGradient;
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(startX, baselineY);
  ctx.lineTo(endX, baselineY);
  ctx.stroke();

  // Draw animated meteorite with fire particles at the end (anime-style)
  drawMeteorite(ctx, endX, baselineY, animationTime || 0);
}

// Animated meteorite with fire particles (realistic anime-style burning effect)
function drawMeteorite(ctx: CanvasRenderingContext2D, x: number, y: number, animationTime: number) {
  const time = animationTime * 0.001; // Convert to seconds
  
  // Fire trail - draw first (behind meteorite) for proper layering
  const particleCount = 20;
  for (let i = 0; i < particleCount; i++) {
    const particleTime = time + i * 0.15; // Stagger particles
    const angle = (i / particleCount) * Math.PI * 0.7 - Math.PI * 0.35; // Fan out behind (wider spread)
    const speed = 25 + (i % 4) * 12;
    const distance = (particleTime * speed) % 80; // Longer trail
    
    const px = x - Math.cos(angle) * distance;
    const py = y - Math.sin(angle) * distance;
    
    // Particle size decreases with distance
    const size = Math.max(1.5, 8 - distance * 0.1);
    
    // Fire colors: white-hot -> orange -> red -> dark (realistic progression)
    const life = 1 - (distance / 80);
    const fireGradient = ctx.createRadialGradient(px, py, 0, px, py, size * 2.5);
    
    if (life > 0.6) {
      // White-hot core: intense white-yellow
      fireGradient.addColorStop(0, `rgba(255,255,220,${life * 0.8})`);
      fireGradient.addColorStop(0.3, `rgba(255,240,150,${life * 0.7})`);
      fireGradient.addColorStop(0.6, `rgba(255,180,80,${life * 0.6})`);
      fireGradient.addColorStop(1, `rgba(255,120,40,${life * 0.4})`);
    } else if (life > 0.3) {
      // Orange-red: main fire
      fireGradient.addColorStop(0, `rgba(255,180,60,${life * 0.7})`);
      fireGradient.addColorStop(0.4, `rgba(255,120,30,${life * 0.6})`);
      fireGradient.addColorStop(0.8, `rgba(200,60,10,${life * 0.4})`);
      fireGradient.addColorStop(1, `rgba(150,30,5,${life * 0.2})`);
    } else {
      // Cooling: dark red embers
      fireGradient.addColorStop(0, `rgba(200,80,20,${life * 0.5})`);
      fireGradient.addColorStop(0.5, `rgba(150,40,10,${life * 0.3})`);
      fireGradient.addColorStop(1, `rgba(80,20,5,${life * 0.1})`);
    }
    
    ctx.fillStyle = fireGradient as CanvasGradient;
    ctx.beginPath();
    ctx.arc(px, py, size * 2.5, 0, Math.PI * 2);
    ctx.fill();
    
    // Bright sparks (intense flickering)
    if (i % 2 === 0 && life > 0.4) {
      const sparkSize = size * 0.8;
      const sparkX = px + Math.sin(particleTime * 8) * 4;
      const sparkY = py + Math.cos(particleTime * 8) * 4;
      ctx.fillStyle = `rgba(255,255,180,${life * 0.8})`;
      ctx.beginPath();
      ctx.arc(sparkX, sparkY, sparkSize, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Subtle outer glow (much reduced brightness)
  const outerGlow = ctx.createRadialGradient(x, y, 0, x, y, 18);
  outerGlow.addColorStop(0, 'rgba(255,200,120,0.25)'); // Much reduced from 0.4
  outerGlow.addColorStop(0.5, 'rgba(255,150,60,0.15)');
  outerGlow.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = outerGlow as CanvasGradient;
  ctx.beginPath();
  ctx.arc(x, y, 18, 0, Math.PI * 2);
  ctx.fill();

  // Meteorite core (rocky, solid appearance with fire highlights)
  // Main body - dark brown/charcoal with metallic highlights
  const meteoriteGradient = ctx.createRadialGradient(x, y - 3, 0, x, y, 7);
  meteoriteGradient.addColorStop(0, 'rgba(180,100,50,0.95)'); // Hot spots
  meteoriteGradient.addColorStop(0.3, 'rgba(120,60,30,0.9)'); // Main body
  meteoriteGradient.addColorStop(0.7, 'rgba(60,30,15,0.85)'); // Shadow
  meteoriteGradient.addColorStop(1, 'rgba(30,15,8,0.7)'); // Edge
  ctx.fillStyle = meteoriteGradient as CanvasGradient;
  ctx.beginPath();
  ctx.arc(x, y, 7, 0, Math.PI * 2);
  ctx.fill();

  // Fire highlights on front (entry side)
  const fireHighlights = ctx.createRadialGradient(x - 2, y - 2, 0, x, y, 6);
  fireHighlights.addColorStop(0, 'rgba(255,200,100,0.6)'); // Intense heat
  fireHighlights.addColorStop(0.5, 'rgba(255,150,50,0.4)');
  fireHighlights.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = fireHighlights as CanvasGradient;
  ctx.beginPath();
  ctx.arc(x, y, 6, 0, Math.PI * 2);
  ctx.fill();

  // Very subtle atmospheric glow (reduced significantly)
  const atmosphericGlow = ctx.createRadialGradient(x, y, 0, x, y, 35);
  atmosphericGlow.addColorStop(0, 'rgba(255,180,80,0.12)'); // Much reduced
  atmosphericGlow.addColorStop(0.4, 'rgba(255,120,40,0.08)');
  atmosphericGlow.addColorStop(0.7, 'rgba(200,60,20,0.05)');
  atmosphericGlow.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = atmosphericGlow as CanvasGradient;
  ctx.beginPath();
  ctx.arc(x, y, 35, 0, Math.PI * 2);
  ctx.fill();
}

function drawDecadeTicks(ctx: CanvasRenderingContext2D, config: LayoutConfig) {
  const decade = 10;
  for (let year = Math.floor(config.minYear / decade) * decade; year <= config.maxYear; year += decade) {
    const tickX = xScaleYear(year, config);
    const baselineY = config.baselineY;
    
    // Tick mark with subtle glow
    ctx.strokeStyle = 'rgba(0,240,255,0.4)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(tickX, baselineY - 8);
    ctx.lineTo(tickX, baselineY + 8);
    ctx.stroke();
    
    // Year label with better typography
    ctx.fillStyle = 'rgba(226,232,240,0.75)';
    ctx.font = 'bold 11px Inter, system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText(String(year), tickX, baselineY + 12);
    ctx.textAlign = 'left'; // reset
    ctx.textBaseline = 'alphabetic'; // reset
  }
}

function drawConstellations(ctx: CanvasRenderingContext2D, rc: RenderContext) {
  if (!rc.showConstellations) return;

  const constellationPoints = rc.nodes.map((n, i) => ({
    x: xScaleYear(yearOf(n.date), rc.layoutConfig),
    y: rc.layoutConfig.baselineY + (rc.indexToOffset.get(i) ?? 0),
    nodeIndex: i,
  }));

  const maxConnectionDist = Math.min(rc.canvasWidth, rc.height) * 0.15;
  
  // Draw constellation connections with distance-based alpha
  for (let i = 0; i < constellationPoints.length; i++) {
    for (let j = i + 1; j < constellationPoints.length; j++) {
      const pointA = constellationPoints[i];
      const pointB = constellationPoints[j];
      const deltaX = pointA.x - pointB.x;
      const deltaY = pointA.y - pointB.y;
      const distance = Math.hypot(deltaX, deltaY);
      
      if (distance <= maxConnectionDist) {
        const distanceFactor = 1 - (distance / maxConnectionDist);
        const alpha = 0.08 * distanceFactor * distanceFactor; // Quadratic falloff for smoother gradient
        
        // Gradient line: brighter near nodes, dimmer in middle
        const midX = (pointA.x + pointB.x) / 2;
        const midY = (pointA.y + pointB.y) / 2;
        const gradient = ctx.createLinearGradient(pointA.x, pointA.y, pointB.x, pointB.y);
        gradient.addColorStop(0, `rgba(0,240,255,${alpha * 0.5})`);
        gradient.addColorStop(0.5, `rgba(255,0,230,${alpha * 0.3})`);
        gradient.addColorStop(1, `rgba(0,240,255,${alpha * 0.5})`);
        
        ctx.strokeStyle = gradient as CanvasGradient;
        ctx.lineWidth = 0.6;
        ctx.globalAlpha = 1;
        ctx.beginPath();
        ctx.moveTo(pointA.x, pointA.y);
        ctx.lineTo(pointB.x, pointB.y);
        ctx.stroke();
      }
    }
  }
  ctx.globalAlpha = 1;
}

function drawEdges(ctx: CanvasRenderingContext2D, rc: RenderContext) {
  const query = rc.query.trim();

  rc.edges.forEach((edge: Edge) => {
    const nodeA = rc.nodes.find(n => n.id === edge.from);
    const nodeB = rc.nodes.find(n => n.id === edge.to);
    if (!nodeA || !nodeB) return;

    if (rc.mode === 'filter') {
      const nodeAText = `${nodeA.label} ${nodeA.tags?.join(' ') ?? ''}`;
      const nodeBText = `${nodeB.label} ${nodeB.tags?.join(' ') ?? ''}`;
      if (!(matchesQuery(nodeAText, query) || matchesQuery(nodeBText, query))) return;
    }

    const yearA = yearOf(nodeA.date);
    const yearB = yearOf(nodeB.date);
    const nodeAX = xScaleYear(yearA, rc.layoutConfig);
    const nodeBX = xScaleYear(yearB, rc.layoutConfig);
    const nodeAIndex = rc.nodes.findIndex(n => n.id === nodeA.id);
    const nodeBIndex = rc.nodes.findIndex(n => n.id === nodeB.id);
    const nodeAOffset = rc.indexToOffset.get(nodeAIndex) ?? 0;
    const nodeBOffset = rc.indexToOffset.get(nodeBIndex) ?? 0;
    const nodeAY = rc.layoutConfig.baselineY + nodeAOffset;
    const nodeBY = rc.layoutConfig.baselineY + nodeBOffset;

    const deltaX = nodeBX - nodeAX;
    const curveHeight = Math.max(40, Math.min(140, Math.abs(deltaX) * 0.25));
    const controlPoint1X = nodeAX + deltaX * 0.33;
    const controlPoint2X = nodeAX + deltaX * 0.66;
    const controlPoint1Y = nodeAY - curveHeight;
    const controlPoint2Y = nodeBY - curveHeight;

    // Edge with gradient based on query match
    const isHighlighted = rc.mode === 'highlight' && query && 
      (matchesQuery(`${nodeA.label} ${nodeA.tags?.join(' ') ?? ''}`, query) ||
       matchesQuery(`${nodeB.label} ${nodeB.tags?.join(' ') ?? ''}`, query));

    if (isHighlighted) {
      // Highlighted edge: brighter and thicker
      const highlightGradient = ctx.createLinearGradient(nodeAX, nodeAY, nodeBX, nodeBY);
      highlightGradient.addColorStop(0, 'rgba(0,240,255,0.6)');
      highlightGradient.addColorStop(0.5, 'rgba(255,0,230,0.5)');
      highlightGradient.addColorStop(1, 'rgba(0,240,255,0.6)');
      ctx.strokeStyle = highlightGradient as CanvasGradient;
      ctx.lineWidth = 2.5;
      ctx.shadowBlur = 8;
      ctx.shadowColor = 'rgba(0,240,255,0.4)';
    } else {
      // Normal edge: subtle and thin
      const normalGradient = ctx.createLinearGradient(nodeAX, nodeAY, nodeBX, nodeBY);
      normalGradient.addColorStop(0, 'rgba(0,240,255,0.12)');
      normalGradient.addColorStop(1, 'rgba(255,0,230,0.12)');
      ctx.strokeStyle = normalGradient as CanvasGradient;
      ctx.lineWidth = 1;
      ctx.shadowBlur = 0;
    }

    ctx.beginPath();
    ctx.moveTo(nodeAX, nodeAY);
    ctx.bezierCurveTo(controlPoint1X, controlPoint1Y, controlPoint2X, controlPoint2Y, nodeBX, nodeBY);
    ctx.stroke();
    ctx.shadowBlur = 0; // reset
  });
}

function drawNodes(ctx: CanvasRenderingContext2D, rc: RenderContext) {
  const query = rc.query.trim();

  rc.layoutPoints.length = 0; // clear and reuse
  rc.nodes.forEach((node: Node, nodeIndex: number) => {
    const nodeYear = yearOf(node.date);
    const nodeWorldX = xScaleYear(nodeYear, rc.layoutConfig);
    const nodeWorldY = rc.layoutConfig.baselineY + (rc.indexToOffset.get(nodeIndex) ?? 0);
    rc.layoutPoints.push({ x: nodeWorldX, y: nodeWorldY, index: nodeIndex });

    const nodeText = `${node.label} ${(node.tags ?? []).join(' ')}`;
    const isQueryMatch = matchesQuery(nodeText, query);
    if (rc.mode === 'filter' && query && !isQueryMatch) return;

    const isSelected = rc.selectedIndex === nodeIndex;

    // Branch line from baseline to node with subtle glow
    ctx.strokeStyle = isSelected ? 'rgba(0,240,255,0.3)' : 'rgba(226,232,240,0.2)';
    ctx.lineWidth = isSelected ? 1.5 : 1;
    ctx.beginPath();
    ctx.moveTo(nodeWorldX, rc.layoutConfig.baselineY);
    ctx.lineTo(nodeWorldX, nodeWorldY);
    ctx.stroke();

    // Star glow effect (outer halo)
    const baseRadius = isQueryMatch && query ? 5 : 4;
    const selectedRadiusBoost = isSelected ? 3 : 0;
    const finalRadius = baseRadius + selectedRadiusBoost;
    
    // Outer glow
    const outerGlowGradient = ctx.createRadialGradient(nodeWorldX, nodeWorldY, 0, nodeWorldX, nodeWorldY, finalRadius * 3);
    if (isSelected) {
      outerGlowGradient.addColorStop(0, 'rgba(0,240,255,0.6)');
      outerGlowGradient.addColorStop(0.5, 'rgba(0,240,255,0.2)');
      outerGlowGradient.addColorStop(1, 'rgba(0,240,255,0)');
    } else if (isQueryMatch && query) {
      outerGlowGradient.addColorStop(0, 'rgba(0,240,255,0.4)');
      outerGlowGradient.addColorStop(0.7, 'rgba(0,240,255,0.1)');
      outerGlowGradient.addColorStop(1, 'rgba(0,240,255,0)');
    } else {
      outerGlowGradient.addColorStop(0, 'rgba(255,255,255,0.3)');
      outerGlowGradient.addColorStop(1, 'rgba(255,255,255,0)');
    }
    ctx.fillStyle = outerGlowGradient as CanvasGradient;
    ctx.beginPath();
    ctx.arc(nodeWorldX, nodeWorldY, finalRadius * 3, 0, Math.PI * 2);
    ctx.fill();

    // Star core (bright center)
    const coreColor = isQueryMatch && query ? '#00f0ff' : isSelected ? '#00f0ff' : '#ffffff';
    ctx.fillStyle = coreColor;
    ctx.beginPath();
    ctx.arc(nodeWorldX, nodeWorldY, finalRadius, 0, Math.PI * 2);
    ctx.fill();

    // Star flare (cross pattern for star-like appearance)
    if (!isSelected) {
      ctx.strokeStyle = isQueryMatch && query ? 'rgba(0,240,255,0.4)' : 'rgba(255,255,255,0.3)';
      ctx.lineWidth = 1;
      ctx.globalAlpha = 0.6;
      const flareSize = finalRadius * 2;
      ctx.beginPath();
      ctx.moveTo(nodeWorldX - flareSize, nodeWorldY);
      ctx.lineTo(nodeWorldX + flareSize, nodeWorldY);
      ctx.moveTo(nodeWorldX, nodeWorldY - flareSize);
      ctx.lineTo(nodeWorldX, nodeWorldY + flareSize);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }

    // Selection ring + beam (Skyrim-like highlight)
    if (isSelected) {
      // Outer selection ring
      ctx.strokeStyle = 'rgba(0,240,255,0.95)';
      ctx.lineWidth = 2.5;
      ctx.shadowBlur = 12;
      ctx.shadowColor = 'rgba(0,240,255,0.8)';
      ctx.beginPath();
      ctx.arc(nodeWorldX, nodeWorldY, 11, 0, Math.PI * 2);
      ctx.stroke();
      
      // Inner ring
      ctx.strokeStyle = 'rgba(255,255,255,0.8)';
      ctx.lineWidth = 1;
      ctx.shadowBlur = 0;
      ctx.beginPath();
      ctx.arc(nodeWorldX, nodeWorldY, 8, 0, Math.PI * 2);
      ctx.stroke();

      // Upward beam glow (Skyrim selection beam)
      const beamHeight = 160;
      const beamGradient = ctx.createLinearGradient(nodeWorldX, nodeWorldY - beamHeight, nodeWorldX, nodeWorldY);
      beamGradient.addColorStop(0, 'rgba(0,240,255,0)');
      beamGradient.addColorStop(0.3, 'rgba(0,240,255,0.2)');
      beamGradient.addColorStop(1, 'rgba(0,240,255,0.7)');
      ctx.strokeStyle = beamGradient as CanvasGradient;
      ctx.lineWidth = 4;
      ctx.shadowBlur = 10;
      ctx.shadowColor = 'rgba(0,240,255,0.6)';
      ctx.beginPath();
      ctx.moveTo(nodeWorldX, nodeWorldY - beamHeight);
      ctx.lineTo(nodeWorldX, nodeWorldY - finalRadius - 2);
      ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.lineWidth = 1;
    }

    // Node label with improved typography
    const labelColor = isQueryMatch && query ? 'rgba(0,240,255,0.98)' : isSelected ? 'rgba(0,240,255,0.95)' : 'rgba(226,232,240,0.9)';
    ctx.fillStyle = labelColor;
    ctx.font = isSelected ? 'bold 13px Inter, system-ui, sans-serif' : '12px Inter, system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    
    // Label background for better readability
    const labelText = `${node.label} (${nodeYear})`;
    const labelMetrics = ctx.measureText(labelText);
    const labelPadding = 4;
    ctx.fillStyle = 'rgba(15, 23, 42, 0.75)';
    ctx.fillRect(
      nodeWorldX + 10,
      nodeWorldY - 12,
      labelMetrics.width + labelPadding * 2,
      16
    );
    
    // Label text
    ctx.fillStyle = labelColor;
    ctx.fillText(labelText, nodeWorldX + 10 + labelPadding, nodeWorldY - 4);
    ctx.textBaseline = 'alphabetic'; // reset
  });
}

export function renderTimeline(rc: RenderContext) {
  const { ctx, transform, canvasWidth, animationTime } = rc;

  ctx.save();
  ctx.translate(transform.offsetX, transform.offsetY);
  ctx.scale(transform.scale, transform.scale);

  drawBaseline(ctx, rc.layoutConfig, canvasWidth, animationTime);
  drawDecadeTicks(ctx, rc.layoutConfig);
  drawConstellations(ctx, rc);
  drawEdges(ctx, rc);
  drawNodes(ctx, rc);

  ctx.restore();
}


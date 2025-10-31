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
  indexToPosition: Map<number, { x: number; y: number }>; // 2D position (constellation layout)
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

  // Draw scientific comet visualization at timeline end (NASA-style: nucleus, coma, dust tail, ion tail)
  drawMeteorite(ctx, endX, baselineY, animationTime || 0);
}

// Scientific comet visualization (NASA-style): nucleus, coma, dust tail, ion tail
// Horizontal orientation: comet moves right (towards future)
function drawMeteorite(ctx: CanvasRenderingContext2D, x: number, y: number, animationTime: number) {
  const time = animationTime * 0.001;
  // Horizontal direction: moving right (towards future)
  
  // === ION TAIL (blue, straight, affected by solar wind) ===
  // Ion tail extends horizontally to the right (towards future)
  const ionTailLength = 140;
  const ionTailWidth = 8;
  const ionTailOpacity = 0.15;
  
  // Ion tail gradient (cyan/blue, faint) - horizontal
  const ionTailGradient = ctx.createLinearGradient(x, y, x + ionTailLength, y);
  ionTailGradient.addColorStop(0, `rgba(150,220,255,${ionTailOpacity * 0.8})`);
  ionTailGradient.addColorStop(0.3, `rgba(100,180,255,${ionTailOpacity * 0.6})`);
  ionTailGradient.addColorStop(0.7, `rgba(80,160,255,${ionTailOpacity * 0.4})`);
  ionTailGradient.addColorStop(1, 'rgba(0,0,0,0)');
  
  // Draw ion tail as a subtle, straight streak (horizontal)
  ctx.strokeStyle = ionTailGradient as CanvasGradient;
  ctx.lineWidth = ionTailWidth;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x + ionTailLength, y);
  ctx.stroke();
  
  // Ion tail particles (subtle, sparse, moving horizontally)
  for (let i = 0; i < 12; i++) {
    const offset = (time * 25 + i * 12) % ionTailLength;
    const alpha = (1 - offset / ionTailLength) * ionTailOpacity * 0.3;
    const spread = (i % 3 - 1) * 2; // Small vertical spread
    ctx.fillStyle = `rgba(120,200,255,${alpha})`;
    ctx.beginPath();
    ctx.arc(x + offset, y + spread, 1.5, 0, Math.PI * 2);
    ctx.fill();
  }
  
  // === DUST TAIL (curved, yellow-white, broader) ===
  // Dust tail curves slightly due to orbital mechanics (horizontal orientation)
  const dustTailLength = 120;
  const dustTailCurve = -18; // Curvature amount (negative = curves slightly upward)
  
  // Create curved dust tail path (horizontal with slight upward curve)
  ctx.beginPath();
  ctx.moveTo(x, y);
  // Quadratic curve for natural dust tail shape (horizontal)
  const controlX = x + dustTailLength * 0.5;
  const controlY = y + dustTailCurve * 0.5; // Slight upward curve
  const endX = x + dustTailLength;
  const endY = y + dustTailCurve;
  ctx.quadraticCurveTo(controlX, controlY, endX, endY);
  
  // Dust tail gradient (yellow-white, broader) - horizontal
  const dustTailGradient = ctx.createLinearGradient(x, y, endX, endY);
  dustTailGradient.addColorStop(0, `rgba(255,255,240,0.12)`);
  dustTailGradient.addColorStop(0.2, `rgba(255,255,220,0.10)`);
  dustTailGradient.addColorStop(0.5, `rgba(255,250,200,0.08)`);
  dustTailGradient.addColorStop(0.8, `rgba(255,240,180,0.05)`);
  dustTailGradient.addColorStop(1, 'rgba(0,0,0,0)');
  
  ctx.strokeStyle = dustTailGradient as CanvasGradient;
  ctx.lineWidth = 12;
  ctx.lineCap = 'round';
  ctx.stroke();
  
  // Secondary dust tail layer (wider, fainter)
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.quadraticCurveTo(controlX * 0.9, controlY * 0.8, endX * 0.95, endY * 0.9);
  ctx.strokeStyle = `rgba(255,255,230,0.04)`;
  ctx.lineWidth = 18;
  ctx.stroke();
  
  // Dust particles (subtle, sparse, larger than ions, moving horizontally)
  for (let i = 0; i < 25; i++) {
    const t = i / 25;
    const offsetX = dustTailLength * t;
    const offsetY = dustTailCurve * t * t; // Quadratic curve (upward)
    const particleX = x + offsetX + (Math.sin(time * 2 + i) * 4);
    const particleY = y + offsetY + (Math.cos(time * 1.5 + i) * 3);
    const alpha = (1 - t) * 0.08;
    const size = 1.5 + Math.sin(time + i) * 0.5;
    ctx.fillStyle = `rgba(255,255,220,${alpha})`;
    ctx.beginPath();
    ctx.arc(particleX, particleY, size, 0, Math.PI * 2);
    ctx.fill();
  }
  
  // === COMA (atmosphere around nucleus) ===
  // Coma: diffuse cloud of gas and dust around the nucleus
  const comaRadius = 14;
  const comaGradient = ctx.createRadialGradient(x, y, 0, x, y, comaRadius);
  comaGradient.addColorStop(0, 'rgba(255,255,250,0.15)');
  comaGradient.addColorStop(0.4, 'rgba(255,255,240,0.10)');
  comaGradient.addColorStop(0.7, 'rgba(255,250,230,0.06)');
  comaGradient.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = comaGradient as CanvasGradient;
  ctx.beginPath();
  ctx.arc(x, y, comaRadius, 0, Math.PI * 2);
  ctx.fill();
  
  // === NUCLEUS (solid core) ===
  // Comet nucleus: dark, irregular, rocky body
  const nucleusRadius = 4.5;
  
  // Nucleus shadow (dark side)
  ctx.fillStyle = 'rgba(30,25,20,0.95)';
  ctx.beginPath();
  ctx.arc(x, y + 1, nucleusRadius, 0, Math.PI * 2);
  ctx.fill();
  
  // Nucleus main body (charcoal/dark brown)
  const nucleusGradient = ctx.createRadialGradient(
    x - 1.5, y, 0,
    x, y, nucleusRadius
  );
  nucleusGradient.addColorStop(0, 'rgba(80,70,60,0.98)');
  nucleusGradient.addColorStop(0.5, 'rgba(50,45,40,0.95)');
  nucleusGradient.addColorStop(1, 'rgba(35,30,25,0.90)');
  ctx.fillStyle = nucleusGradient as CanvasGradient;
  ctx.beginPath();
  ctx.arc(x, y, nucleusRadius, 0, Math.PI * 2);
  ctx.fill();
  
  // Nucleus texture (subtle surface irregularities)
  ctx.fillStyle = 'rgba(60,55,50,0.4)';
  ctx.beginPath();
  ctx.arc(x - 0.8, y - 0.3, 1.0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(x + 1.0, y + 0.6, 0.7, 0, Math.PI * 2);
  ctx.fill();
  
  // Sunlit side highlight (sun is to the left, so highlight left side)
  const highlightGradient = ctx.createRadialGradient(
    x - 2, y, 0,
    x, y, nucleusRadius * 0.8
  );
  highlightGradient.addColorStop(0, 'rgba(255,255,250,0.3)');
  highlightGradient.addColorStop(0.6, 'rgba(255,250,230,0.15)');
  highlightGradient.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = highlightGradient as CanvasGradient;
  ctx.beginPath();
  ctx.arc(x - 0.8, y, nucleusRadius * 0.7, 0, Math.PI * 2);
  ctx.fill();
  
  // === SUBTLE OPTICAL EFFECTS ===
  // Very faint atmospheric scattering (minimal, scientific)
  const scatteringRadius = 25;
  const scatteringGradient = ctx.createRadialGradient(x, y, 0, x, y, scatteringRadius);
  scatteringGradient.addColorStop(0, 'rgba(200,220,255,0.04)');
  scatteringGradient.addColorStop(0.5, 'rgba(180,200,255,0.02)');
  scatteringGradient.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = scatteringGradient as CanvasGradient;
  ctx.beginPath();
  ctx.arc(x, y, scatteringRadius, 0, Math.PI * 2);
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

  const constellationPoints = rc.nodes.map((n, i) => {
    const pos = rc.indexToPosition.get(i);
    return {
      x: pos?.x ?? xScaleYear(yearOf(n.date), rc.layoutConfig),
      y: pos?.y ?? rc.layoutConfig.baselineY,
      nodeIndex: i,
    };
  });

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

    const nodeAIndex = rc.nodes.findIndex(n => n.id === nodeA.id);
    const nodeBIndex = rc.nodes.findIndex(n => n.id === nodeB.id);
    const posA = rc.indexToPosition.get(nodeAIndex);
    const posB = rc.indexToPosition.get(nodeBIndex);
    // Fallback to baseline if position not found
    const nodeAX = posA?.x ?? xScaleYear(yearOf(nodeA.date), rc.layoutConfig);
    const nodeAY = posA?.y ?? rc.layoutConfig.baselineY;
    const nodeBX = posB?.x ?? xScaleYear(yearOf(nodeB.date), rc.layoutConfig);
    const nodeBY = posB?.y ?? rc.layoutConfig.baselineY;

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
    // Use constellation position (2D) or fallback to baseline
    const pos = rc.indexToPosition.get(nodeIndex);
    const nodeYear = yearOf(node.date);
    const baseX = xScaleYear(nodeYear, rc.layoutConfig);
    const nodeWorldX = pos?.x ?? baseX;
    const nodeWorldY = pos?.y ?? rc.layoutConfig.baselineY;
    rc.layoutPoints.push({ x: nodeWorldX, y: nodeWorldY, index: nodeIndex });

    const nodeText = `${node.label} ${(node.tags ?? []).join(' ')}`;
    const isQueryMatch = matchesQuery(nodeText, query);
    if (rc.mode === 'filter' && query && !isQueryMatch) return;

    const isSelected = rc.selectedIndex === nodeIndex;

    // Branch line from baseline to node (curved/organic for constellation feel)
    ctx.strokeStyle = isSelected ? 'rgba(0,240,255,0.3)' : 'rgba(226,232,240,0.2)';
    ctx.lineWidth = isSelected ? 1.5 : 1;
    ctx.beginPath();
    const baseXAtYear = baseX; // Baseline X at the node's year
    // Draw curved branch for more organic feel
    const controlY = (rc.layoutConfig.baselineY + nodeWorldY) / 2;
    const controlX = baseXAtYear + (nodeWorldX - baseXAtYear) * 0.3; // Slight curve
    ctx.moveTo(baseXAtYear, rc.layoutConfig.baselineY);
    ctx.quadraticCurveTo(controlX, controlY, nodeWorldX, nodeWorldY);
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


import { motion } from 'framer-motion';
import type { Layout } from '../domain/graph';
import type { TrailNode as TNode } from '../types';
import { TrailNode } from './TrailNode';

const PAD = 90;

export function TrailCanvas({
  layout,
  onSelect,
}: {
  layout: Layout;
  onSelect: (node: TNode) => void;
}) {
  const w = layout.width + PAD * 2;
  const h = layout.height + PAD * 2;

  return (
    <div className="canvas-scroll">
      <div className="canvas" style={{ width: w, height: h }}>
        <svg className="canvas__edges" width={w} height={h} aria-hidden="true">
          {layout.edges.map((e, i) => {
            const a = layout.pos.get(e.from);
            const b = layout.pos.get(e.to);
            if (!a || !b) return null;
            const x1 = a.x + PAD;
            const y1 = a.y + PAD;
            const x2 = b.x + PAD;
            const y2 = b.y + PAD;
            const my = (y1 + y2) / 2;
            return (
              <motion.path
                key={`${e.from}-${e.to}`}
                d={`M ${x1} ${y1} C ${x1} ${my}, ${x2} ${my}, ${x2} ${y2}`}
                fill="none"
                className="edge"
                initial={{ pathLength: 0, opacity: 0 }}
                animate={{ pathLength: 1, opacity: 1 }}
                transition={{ duration: 0.7, delay: Math.min(i * 0.05, 0.6), ease: 'easeInOut' }}
              />
            );
          })}
        </svg>

        {layout.nodes.map((p) => (
          <div
            key={p.node.id}
            className="node-anchor"
            style={{ left: p.x + PAD, top: p.y + PAD }}
          >
            <TrailNode p={p} onSelect={() => onSelect(p.node)} />
          </div>
        ))}
      </div>
    </div>
  );
}

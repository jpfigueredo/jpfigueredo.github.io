import { motion } from 'framer-motion';
import type { Positioned } from '../domain/graph';

export function TrailNode({ p, onSelect }: { p: Positioned; onSelect: () => void }) {
  const { node, state } = p;
  return (
    <motion.button
      type="button"
      className={`node node--${state}`}
      onClick={onSelect}
      aria-label={`${node.label} (${node.year})`}
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ type: 'spring', stiffness: 260, damping: 22 }}
      whileHover={{ y: -8 }}
      whileTap={{ scale: 0.95 }}
    >
      <span className="node__aura" aria-hidden="true" />
      <span className="node__cover">
        <span className="node__cover-title">{node.label}</span>
      </span>
      <span className="node__disc" aria-hidden="true" />
      <span className="node__year">{node.year}</span>
    </motion.button>
  );
}

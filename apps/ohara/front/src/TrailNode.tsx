import { primaryState, type TrailNode } from './types';

const STATE_LABEL: Record<'free' | 'retail', string> = {
  free: 'fonte livre',
  retail: 'adquirir',
};

export function TrailNodeCard({ node }: { node: TrailNode }) {
  const state = primaryState(node);
  return (
    <li className={`node node--${state}`}>
      <div className="node__year">{node.year}</div>
      <div className="node__body">
        <h3 className="node__label">{node.label}</h3>
        {node.author ? <p className="node__author">{node.author}</p> : null}
      </div>
      <span className={`tag tag--${state}`}>{STATE_LABEL[state]}</span>
    </li>
  );
}

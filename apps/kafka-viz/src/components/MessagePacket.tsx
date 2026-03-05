import React from 'react';
import type { InFlightMessage } from '../engine/types';

type Props = {
  message: InFlightMessage;
  x: number;
  y: number;
};

const PHASE_COLOR: Record<InFlightMessage['phase'], string> = {
  sending: 'var(--ds-neon, #00e5ff)',
  stored: 'var(--ds-magenta, #ff00e6)',
  consuming: '#7cff01',
  done: 'transparent',
};

export const MessagePacket: React.FC<Props> = ({ message, x, y }) => {
  const [hovered, setHovered] = React.useState(false);
  const color = PHASE_COLOR[message.phase];

  return (
    <g
      transform={`translate(${x}, ${y})`}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{ cursor: 'pointer' }}
    >
      <circle
        r={7}
        fill={color}
        opacity={0.9}
        style={{
          filter: `drop-shadow(0 0 6px ${color})`,
          transition: 'r 160ms ease',
        }}
      />
      {hovered && (
        <foreignObject x={12} y={-40} width={200} height={120} style={{ overflow: 'visible' }}>
          <div
            style={{
              background: 'rgba(7,10,18,0.96)',
              border: `1px solid ${color}`,
              borderRadius: '0.5rem',
              padding: '0.5rem 0.75rem',
              fontSize: '0.7rem',
              color: 'var(--ds-text-primary, #e2e8f0)',
              lineHeight: 1.5,
              whiteSpace: 'nowrap',
              boxShadow: `0 0 12px ${color}40`,
            }}
          >
            <div><strong style={{ color }}>offset:</strong> {message.offset}</div>
            <div><strong style={{ color }}>partition:</strong> {message.partitionId}</div>
            <div><strong style={{ color }}>key:</strong> {message.key}</div>
            <div><strong style={{ color }}>phase:</strong> {message.phase}</div>
            <div style={{ color: 'var(--ds-text-secondary, #9ca3af)', fontSize: '0.65rem' }}>
              {message.timestamp.slice(11, 19)}
            </div>
          </div>
        </foreignObject>
      )}
    </g>
  );
};

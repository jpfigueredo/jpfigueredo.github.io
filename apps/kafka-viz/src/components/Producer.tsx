import React from 'react';
import type { Producer as ProducerType } from '../engine/types';

export const PRODUCER_WIDTH = 80;
export const PRODUCER_HEIGHT = 44;

type Props = {
  producer: ProducerType;
  x: number;
  y: number;
  active: boolean;
};

export const Producer: React.FC<Props> = ({ producer, x, y, active }) => {
  return (
    <g transform={`translate(${x}, ${y})`}>
      <rect
        width={PRODUCER_WIDTH}
        height={PRODUCER_HEIGHT}
        rx={6}
        fill="rgba(15,23,42,0.92)"
        stroke={active ? 'var(--ds-neon, #00e5ff)' : 'rgba(0,229,255,0.2)'}
        strokeWidth={active ? 1.5 : 1}
        style={{ transition: 'stroke 200ms ease', filter: active ? 'drop-shadow(0 0 6px rgba(0,229,255,0.4))' : undefined }}
      />
      <text
        x={PRODUCER_WIDTH / 2}
        y={PRODUCER_HEIGHT * 0.35}
        textAnchor="middle"
        dominantBaseline="middle"
        fill="var(--ds-neon, #00e5ff)"
        fontSize={8}
        fontWeight="bold"
        fontFamily="monospace"
      >
        PRODUCER
      </text>
      <text
        x={PRODUCER_WIDTH / 2}
        y={PRODUCER_HEIGHT * 0.68}
        textAnchor="middle"
        dominantBaseline="middle"
        fill="var(--ds-text-secondary, #9ca3af)"
        fontSize={7}
        fontFamily="monospace"
      >
        {producer.id}
      </text>
    </g>
  );
};

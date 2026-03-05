import React from 'react';
import type { Consumer as ConsumerType } from '../engine/types';

export const CONSUMER_WIDTH = 80;
export const CONSUMER_HEIGHT = 50;

type Props = {
  consumer: ConsumerType;
  x: number;
  y: number;
  active: boolean;
};

export const Consumer: React.FC<Props> = ({ consumer, x, y, active }) => {
  const totalConsumed = Object.values(consumer.offsets).reduce((a, b) => a + b, 0);

  return (
    <g transform={`translate(${x}, ${y})`}>
      <rect
        width={CONSUMER_WIDTH}
        height={CONSUMER_HEIGHT}
        rx={6}
        fill="rgba(15,23,42,0.92)"
        stroke={active ? '#7cff01' : 'rgba(124,255,1,0.2)'}
        strokeWidth={active ? 1.5 : 1}
        style={{ transition: 'stroke 200ms ease', filter: active ? 'drop-shadow(0 0 6px rgba(124,255,1,0.35))' : undefined }}
      />
      <text
        x={CONSUMER_WIDTH / 2}
        y={CONSUMER_HEIGHT * 0.28}
        textAnchor="middle"
        dominantBaseline="middle"
        fill="#7cff01"
        fontSize={8}
        fontWeight="bold"
        fontFamily="monospace"
      >
        CONSUMER
      </text>
      <text
        x={CONSUMER_WIDTH / 2}
        y={CONSUMER_HEIGHT * 0.52}
        textAnchor="middle"
        dominantBaseline="middle"
        fill="var(--ds-text-secondary, #9ca3af)"
        fontSize={7}
        fontFamily="monospace"
      >
        {consumer.id}
      </text>
      <text
        x={CONSUMER_WIDTH / 2}
        y={CONSUMER_HEIGHT * 0.76}
        textAnchor="middle"
        dominantBaseline="middle"
        fill="rgba(124,255,1,0.6)"
        fontSize={7}
        fontFamily="monospace"
      >
        grp: {consumer.groupId} | +{totalConsumed}
      </text>
    </g>
  );
};

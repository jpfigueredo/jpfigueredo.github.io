import React from 'react';
import type { Partition as PartitionType } from '../engine/types';

type Props = {
  partition: PartitionType;
  x: number;
  y: number;
  width: number;
  height: number;
};

export const Partition: React.FC<Props> = ({ partition, x, y, width, height }) => {
  return (
    <g transform={`translate(${x}, ${y})`}>
      <rect
        width={width}
        height={height}
        rx={4}
        fill="rgba(15,23,42,0.8)"
        stroke="rgba(0,229,255,0.3)"
        strokeWidth={1}
      />
      <text
        x={width / 2}
        y={height * 0.35}
        textAnchor="middle"
        dominantBaseline="middle"
        fill="var(--ds-neon, #00e5ff)"
        fontSize={9}
        fontFamily="monospace"
      >
        P{partition.id}
      </text>
      <text
        x={width / 2}
        y={height * 0.7}
        textAnchor="middle"
        dominantBaseline="middle"
        fill="var(--ds-text-secondary, #9ca3af)"
        fontSize={8}
        fontFamily="monospace"
      >
        +{partition.logSize}
      </text>
    </g>
  );
};

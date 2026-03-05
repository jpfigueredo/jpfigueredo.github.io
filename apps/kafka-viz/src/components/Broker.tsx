import React from 'react';
import type { Broker as BrokerType } from '../engine/types';
import { Partition } from './Partition';

export const BROKER_WIDTH = 160;
export const BROKER_HEADER_HEIGHT = 30;
const PARTITION_HEIGHT = 40;
const PARTITION_WIDTH = 44;
const PARTITION_GAP = 8;
const BROKER_PADDING = 12;

export function getBrokerHeight(_broker: BrokerType): number {
  return BROKER_HEADER_HEIGHT + BROKER_PADDING + PARTITION_HEIGHT + BROKER_PADDING;
}

export function getPartitionCenterX(partitionIndex: number): number {
  return BROKER_PADDING + partitionIndex * (PARTITION_WIDTH + PARTITION_GAP) + PARTITION_WIDTH / 2;
}

export function getPartitionCenterY(): number {
  return BROKER_HEADER_HEIGHT + BROKER_PADDING + PARTITION_HEIGHT / 2;
}

type Props = {
  broker: BrokerType;
  x: number;
  y: number;
};

export const Broker: React.FC<Props> = ({ broker, x, y }) => {
  const height = getBrokerHeight(broker);
  const borderColor = broker.isController
    ? 'var(--ds-neon, #00e5ff)'
    : 'rgba(0,229,255,0.25)';

  return (
    <g transform={`translate(${x}, ${y})`}>
      {/* Body */}
      <rect
        width={BROKER_WIDTH}
        height={height}
        rx={8}
        fill="rgba(15,23,42,0.92)"
        stroke={borderColor}
        strokeWidth={broker.isController ? 1.5 : 1}
        style={{ filter: broker.isController ? 'drop-shadow(0 0 8px rgba(0,229,255,0.3))' : undefined }}
      />

      {/* Header */}
      <rect width={BROKER_WIDTH} height={BROKER_HEADER_HEIGHT} rx={8} fill="rgba(0,229,255,0.07)" />
      <rect y={BROKER_HEADER_HEIGHT - 4} width={BROKER_WIDTH} height={4} fill="rgba(0,229,255,0.07)" />

      <text
        x={BROKER_WIDTH / 2}
        y={BROKER_HEADER_HEIGHT / 2}
        textAnchor="middle"
        dominantBaseline="middle"
        fill="var(--ds-neon, #00e5ff)"
        fontSize={11}
        fontWeight="bold"
        fontFamily="monospace"
      >
        {broker.id}
      </text>

      {broker.isController && (
        <text
          x={BROKER_WIDTH - 8}
          y={BROKER_HEADER_HEIGHT / 2}
          textAnchor="end"
          dominantBaseline="middle"
          fill="var(--ds-neon, #00e5ff)"
          fontSize={7}
          opacity={0.6}
          fontFamily="monospace"
        >
          CONTROLLER
        </text>
      )}

      {/* Partitions */}
      {broker.partitions.map((partition, i) => (
        <Partition
          key={`${partition.topic}-${partition.id}`}
          partition={partition}
          x={BROKER_PADDING + i * (PARTITION_WIDTH + PARTITION_GAP)}
          y={BROKER_HEADER_HEIGHT + BROKER_PADDING}
          width={PARTITION_WIDTH}
          height={PARTITION_HEIGHT}
        />
      ))}

      {broker.partitions.length === 0 && (
        <text
          x={BROKER_WIDTH / 2}
          y={BROKER_HEADER_HEIGHT + BROKER_PADDING + PARTITION_HEIGHT / 2}
          textAnchor="middle"
          dominantBaseline="middle"
          fill="rgba(156,163,175,0.4)"
          fontSize={9}
          fontFamily="monospace"
        >
          replica only
        </text>
      )}
    </g>
  );
};

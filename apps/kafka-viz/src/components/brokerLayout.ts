import type { Broker } from '../engine/types';

// Broker geometry, shared by Broker (drawing) and KafkaCanvas (placing brokers
// and routing message packets). Kept out of Broker.tsx so that file only
// exports components (React Fast Refresh).
export const BROKER_WIDTH = 160;
export const BROKER_HEADER_HEIGHT = 30;
export const PARTITION_HEIGHT = 40;
export const PARTITION_WIDTH = 44;
export const PARTITION_GAP = 8;
export const BROKER_PADDING = 12;

export function getBrokerHeight(_broker: Broker): number {
  return BROKER_HEADER_HEIGHT + BROKER_PADDING + PARTITION_HEIGHT + BROKER_PADDING;
}

export function getPartitionCenterX(partitionIndex: number): number {
  return BROKER_PADDING + partitionIndex * (PARTITION_WIDTH + PARTITION_GAP) + PARTITION_WIDTH / 2;
}

export function getPartitionCenterY(): number {
  return BROKER_HEADER_HEIGHT + BROKER_PADDING + PARTITION_HEIGHT / 2;
}

import React from 'react';
import type { SimulatorState } from '../engine/types';
import { Broker, BROKER_WIDTH, getBrokerHeight, getPartitionCenterX, getPartitionCenterY } from './Broker';
import { Producer, PRODUCER_WIDTH, PRODUCER_HEIGHT } from './Producer';
import { Consumer, CONSUMER_WIDTH, CONSUMER_HEIGHT } from './Consumer';
import { MessagePacket } from './MessagePacket';

type Props = {
  state: SimulatorState;
};

const CANVAS_PADDING = 32;
const BROKER_GAP = 24;
const VERTICAL_GAP = 80;

export const KafkaCanvas: React.FC<Props> = ({ state }) => {
  const { brokers, producers, consumers, inFlightMessages } = state;

  // Layout calculations
  const brokerCount = brokers.length;
  const canvasWidth = Math.max(
    600,
    CANVAS_PADDING * 2 + brokerCount * BROKER_WIDTH + (brokerCount - 1) * BROKER_GAP
  );

  const maxBrokerHeight = Math.max(...brokers.map(getBrokerHeight), 80);
  const brokerY = CANVAS_PADDING + PRODUCER_HEIGHT + VERTICAL_GAP;
  const consumerY = brokerY + maxBrokerHeight + VERTICAL_GAP;
  const canvasHeight = consumerY + CONSUMER_HEIGHT + CANVAS_PADDING;

  const brokerPositions = brokers.map((_, i) => ({
    x: CANVAS_PADDING + i * (BROKER_WIDTH + BROKER_GAP),
    y: brokerY,
  }));

  const producerPositions = producers.map((_, i) => ({
    x: CANVAS_PADDING + i * (PRODUCER_WIDTH + 16),
    y: CANVAS_PADDING,
  }));

  const consumerPositions = consumers.map((_, i) => ({
    x: CANVAS_PADDING + i * (CONSUMER_WIDTH + 16),
    y: consumerY,
  }));

  // Find if a producer/consumer is active (has in-flight messages)
  const activeProducerIds = new Set(inFlightMessages.filter(m => m.phase === 'sending').map(m => m.producerId));
  const activeConsumerIds = new Set(inFlightMessages.filter(m => m.phase === 'consuming').map(m => m.consumerId));

  // Compute message positions interpolating along producer→broker→consumer path
  const messagePositions = inFlightMessages.map(msg => {
    const pIdx = producers.findIndex(p => p.id === msg.producerId);
    const bIdx = brokers.findIndex(b => b.partitions.some(p => p.id === msg.partitionId && p.topic === msg.topic));
    const cIdx = consumers.findIndex(c => c.id === msg.consumerId);

    const prod = producerPositions[pIdx] ?? producerPositions[0];
    const bPos = brokerPositions[bIdx >= 0 ? bIdx : 0];
    const partIdx = brokers[bIdx >= 0 ? bIdx : 0]?.partitions.findIndex(p => p.id === msg.partitionId) ?? 0;

    const bx = bPos.x + getPartitionCenterX(partIdx >= 0 ? partIdx : 0);
    const by = bPos.y + getPartitionCenterY();

    const px = prod.x + PRODUCER_WIDTH / 2;
    const py = prod.y + PRODUCER_HEIGHT;

    let x: number;
    let y: number;

    if (msg.phase === 'sending') {
      x = px + (bx - px) * msg.progress;
      y = py + (by - py) * msg.progress;
    } else if (msg.phase === 'stored') {
      x = bx;
      y = by;
    } else if (msg.phase === 'consuming' && cIdx >= 0) {
      const cons = consumerPositions[cIdx];
      const cx = cons.x + CONSUMER_WIDTH / 2;
      const cy = cons.y;
      x = bx + (cx - bx) * msg.progress;
      y = by + (cy - by) * msg.progress;
    } else {
      x = bx;
      y = by;
    }

    return { ...msg, x, y };
  });

  return (
    <svg
      width="100%"
      viewBox={`0 0 ${canvasWidth} ${canvasHeight}`}
      style={{ display: 'block', overflow: 'visible' }}
      aria-label="Kafka cluster visualization"
    >
      {/* Background grid */}
      <defs>
        <pattern id="kv-grid" width="32" height="32" patternUnits="userSpaceOnUse">
          <path d="M 32 0 L 0 0 0 32" fill="none" stroke="rgba(0,229,255,0.04)" strokeWidth="0.5" />
        </pattern>
      </defs>
      <rect width={canvasWidth} height={canvasHeight} fill="url(#kv-grid)" rx={12} />

      {/* Producers */}
      {producers.map((producer, i) => (
        <Producer
          key={producer.id}
          producer={producer}
          x={producerPositions[i].x}
          y={producerPositions[i].y}
          active={activeProducerIds.has(producer.id)}
        />
      ))}

      {/* Brokers */}
      {brokers.map((broker, i) => (
        <Broker
          key={broker.id}
          broker={broker}
          x={brokerPositions[i].x}
          y={brokerPositions[i].y}
        />
      ))}

      {/* Consumers */}
      {consumers.map((consumer, i) => (
        <Consumer
          key={consumer.id}
          consumer={consumer}
          x={consumerPositions[i].x}
          y={consumerPositions[i].y}
          active={activeConsumerIds.has(consumer.id)}
        />
      ))}

      {/* In-flight messages */}
      {messagePositions.map(msg => (
        <MessagePacket key={msg.id} message={msg} x={msg.x} y={msg.y} />
      ))}
    </svg>
  );
};

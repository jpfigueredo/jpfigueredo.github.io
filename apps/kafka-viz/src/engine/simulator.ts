import type { SimulatorState, InFlightMessage, Producer, Consumer, Partition } from './types';

const MESSAGE_KEYS = ['user-id', 'order-id', 'session-id', 'product-sku', 'click-event'];
const MESSAGE_ACTIONS = ['click', 'purchase', 'view', 'signup', 'logout'];

let messageCounter = 0;

function nextMessageId(): string {
  return `msg-${++messageCounter}`;
}

function pickPartition(producer: Producer, partitions: Partition[]): Partition {
  const topicPartitions = partitions.filter(p => p.topic === producer.topic);
  if (topicPartitions.length === 0) return partitions[0];

  if (producer.partitionStrategy === 'round-robin') {
    return topicPartitions[producer.nextPartitionIndex % topicPartitions.length];
  }
  // key-hash / sticky: deterministic by producer index
  return topicPartitions[parseInt(producer.id.replace(/\D/g, '') || '0', 10) % topicPartitions.length];
}

function findBrokerForPartition(state: SimulatorState, partitionId: number, topic: string): string {
  for (const broker of state.brokers) {
    if (broker.partitions.some(p => p.id === partitionId && p.topic === topic)) {
      return broker.id;
    }
  }
  return state.brokers[0]?.id ?? 'broker-0';
}

export function tickSimulator(state: SimulatorState): SimulatorState {
  if (state.paused) return state;

  const newState = { ...state, tick: state.tick + 1 };
  const newMessages: InFlightMessage[] = [];
  const updatedBrokers = newState.brokers.map(b => ({ ...b, partitions: b.partitions.map(p => ({ ...p })) }));
  const updatedConsumers: Consumer[] = newState.consumers.map(c => ({ ...c, offsets: { ...c.offsets } }));
  const updatedProducers = newState.producers.map(p => ({ ...p }));

  // Progress existing messages
  const existingMessages = newState.inFlightMessages
    .map(msg => ({ ...msg, progress: msg.progress + 0.08 * state.speed }))
    .filter(msg => {
      if (msg.phase === 'sending' && msg.progress >= 1) {
        // Message arrived at broker — update logSize
        for (const broker of updatedBrokers) {
          const partition = broker.partitions.find(p => p.id === msg.partitionId && p.topic === msg.topic);
          if (partition) {
            partition.logSize += 1;
            partition.highWatermark += 1;
          }
        }
        newMessages.push({ ...msg, phase: 'stored', progress: 0 });
        return false;
      }
      if (msg.phase === 'consuming' && msg.progress >= 1) {
        // Consumer committed offset
        const consumer = updatedConsumers.find(c => c.id === msg.consumerId);
        if (consumer) {
          consumer.offsets[msg.partitionId] = (consumer.offsets[msg.partitionId] ?? 0) + 1;
        }
        return false; // remove done message
      }
      return msg.phase !== 'done';
    });

  // Transition stored messages → consuming (one per consumer per tick)
  const storedByPartition: Record<number, InFlightMessage[]> = {};
  for (const msg of existingMessages) {
    if (msg.phase === 'stored') {
      storedByPartition[msg.partitionId] = storedByPartition[msg.partitionId] ?? [];
      storedByPartition[msg.partitionId].push(msg);
    }
  }

  for (const consumer of updatedConsumers) {
    for (const pid of consumer.assignedPartitions) {
      const stored = storedByPartition[pid];
      if (stored && stored.length > 0) {
        const msg = stored.shift()!;
        const idx = existingMessages.findIndex(m => m.id === msg.id);
        if (idx >= 0) {
          existingMessages[idx] = { ...msg, phase: 'consuming', progress: 0, consumerId: consumer.id };
        }
      }
    }
  }

  // Produce new messages every ~3 ticks
  if (state.tick % Math.max(1, Math.round(3 / state.speed)) === 0) {
    for (const producer of updatedProducers) {
      const allPartitions = updatedBrokers.flatMap(b => b.partitions);
      const partition = pickPartition(producer, allPartitions);
      if (!partition) continue;

      const key = MESSAGE_KEYS[state.tick % MESSAGE_KEYS.length];
      const action = MESSAGE_ACTIONS[state.tick % MESSAGE_ACTIONS.length];
      const offset = partition.logSize;
      const brokerId = findBrokerForPartition(newState, partition.id, partition.topic);

      const msg: InFlightMessage = {
        id: nextMessageId(),
        producerId: producer.id,
        topic: producer.topic,
        partitionId: partition.id,
        key,
        value: { action, userId: state.tick, brokerId },
        offset,
        timestamp: new Date().toISOString(),
        progress: 0,
        phase: 'sending',
      };

      newMessages.push(msg);
      producer.nextPartitionIndex = (producer.nextPartitionIndex + 1) % Math.max(1, allPartitions.filter(p => p.topic === producer.topic).length);
    }
  }

  return {
    ...newState,
    brokers: updatedBrokers,
    consumers: updatedConsumers,
    producers: updatedProducers,
    inFlightMessages: [...existingMessages, ...newMessages].slice(-60), // cap at 60
  };
}

export function buildInitialState(
  partial: Omit<SimulatorState, 'inFlightMessages' | 'tick' | 'speed' | 'paused'>,
  speed = 1,
): SimulatorState {
  return {
    ...partial,
    inFlightMessages: [],
    tick: 0,
    speed,
    paused: false,
  };
}

import type { Scenario } from './types';

export const scenarios: Scenario[] = [
  {
    id: 'single-broker',
    label: 'Single Broker',
    description: '1 broker, 3 partições, 1 producer, 1 consumer. Cenário básico de um tópico.',
    initialState: {
      brokers: [
        {
          id: 'broker-0',
          host: 'kafka-0:9092',
          isController: true,
          partitions: [
            { id: 0, topic: 'user-events', leader: 'broker-0', replicas: ['broker-0'], logSize: 0, highWatermark: 0 },
            { id: 1, topic: 'user-events', leader: 'broker-0', replicas: ['broker-0'], logSize: 0, highWatermark: 0 },
            { id: 2, topic: 'user-events', leader: 'broker-0', replicas: ['broker-0'], logSize: 0, highWatermark: 0 },
          ],
        },
      ],
      producers: [
        { id: 'prod-0', topic: 'user-events', partitionStrategy: 'round-robin', nextPartitionIndex: 0 },
      ],
      consumers: [
        { id: 'cons-0', groupId: 'my-group', topic: 'user-events', assignedPartitions: [0, 1, 2], offsets: { 0: 0, 1: 0, 2: 0 } },
      ],
    },
  },
  {
    id: 'multi-broker',
    label: 'Multi Broker',
    description: '3 brokers, replication factor 2, 2 producers, 3 consumers em consumer group.',
    initialState: {
      brokers: [
        {
          id: 'broker-0',
          host: 'kafka-0:9092',
          isController: true,
          partitions: [
            { id: 0, topic: 'orders', leader: 'broker-0', replicas: ['broker-0', 'broker-1'], logSize: 0, highWatermark: 0 },
            { id: 1, topic: 'orders', leader: 'broker-0', replicas: ['broker-0', 'broker-2'], logSize: 0, highWatermark: 0 },
          ],
        },
        {
          id: 'broker-1',
          host: 'kafka-1:9092',
          isController: false,
          partitions: [
            { id: 2, topic: 'orders', leader: 'broker-1', replicas: ['broker-1', 'broker-0'], logSize: 0, highWatermark: 0 },
          ],
        },
        {
          id: 'broker-2',
          host: 'kafka-2:9092',
          isController: false,
          partitions: [],
        },
      ],
      producers: [
        { id: 'prod-0', topic: 'orders', partitionStrategy: 'key-hash', nextPartitionIndex: 0 },
        { id: 'prod-1', topic: 'orders', partitionStrategy: 'key-hash', nextPartitionIndex: 1 },
      ],
      consumers: [
        { id: 'cons-0', groupId: 'order-processors', topic: 'orders', assignedPartitions: [0], offsets: { 0: 0 } },
        { id: 'cons-1', groupId: 'order-processors', topic: 'orders', assignedPartitions: [1], offsets: { 1: 0 } },
        { id: 'cons-2', groupId: 'order-processors', topic: 'orders', assignedPartitions: [2], offsets: { 2: 0 } },
      ],
    },
  },
  {
    id: 'consumer-group',
    label: 'Consumer Group',
    description: '1 tópico, 3 partições, 1 consumer group com 3 consumers — cada um consome 1 partição.',
    initialState: {
      brokers: [
        {
          id: 'broker-0',
          host: 'kafka-0:9092',
          isController: true,
          partitions: [
            { id: 0, topic: 'events', leader: 'broker-0', replicas: ['broker-0'], logSize: 0, highWatermark: 0 },
            { id: 1, topic: 'events', leader: 'broker-0', replicas: ['broker-0'], logSize: 0, highWatermark: 0 },
            { id: 2, topic: 'events', leader: 'broker-0', replicas: ['broker-0'], logSize: 0, highWatermark: 0 },
          ],
        },
      ],
      producers: [
        { id: 'prod-0', topic: 'events', partitionStrategy: 'round-robin', nextPartitionIndex: 0 },
      ],
      consumers: [
        { id: 'cons-0', groupId: 'analytics', topic: 'events', assignedPartitions: [0], offsets: { 0: 0 } },
        { id: 'cons-1', groupId: 'analytics', topic: 'events', assignedPartitions: [1], offsets: { 1: 0 } },
        { id: 'cons-2', groupId: 'analytics', topic: 'events', assignedPartitions: [2], offsets: { 2: 0 } },
      ],
    },
  },
];

export const defaultScenario = scenarios[0];

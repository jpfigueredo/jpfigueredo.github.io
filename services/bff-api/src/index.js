import express from 'express';
import cors from 'cors';

const app = express();
app.use(cors({ origin: [/^https:\/\/(.*\.)?github\.io$/, /localhost:\d+$/] }));
app.use(express.json());

// Health
app.get('/health', (_req, res) => res.json({ status: 'ok', version: '1.0.0-beta.1' }));
app.get('/api/health', (_req, res) => res.json({ ok: true }));
app.get('/api/echo', (req, res) => res.json({ query: req.query }));

// Kafka Viz simulated state
app.get('/api/kafka-viz/state', (_req, res) => {
  const scenario = /** @type {string} */ (_req.query['scenario']) || 'single-broker';

  const singleBroker = {
    scenario: 'single-broker',
    brokers: [
      {
        id: 'broker-0', host: 'kafka-0:9092', isLeader: true,
        partitions: [
          { id: 0, topic: 'user-events', leader: 'broker-0', replicas: ['broker-0'], logSize: 42 },
          { id: 1, topic: 'user-events', leader: 'broker-0', replicas: ['broker-0'], logSize: 37 },
          { id: 2, topic: 'user-events', leader: 'broker-0', replicas: ['broker-0'], logSize: 55 },
        ],
      },
    ],
    producers: [{ id: 'prod-0', topic: 'user-events', partitionStrategy: 'round-robin' }],
    consumers: [{ id: 'cons-0', groupId: 'my-group', topic: 'user-events', assignedPartitions: [0, 1, 2], lag: 3 }],
  };

  const multiBroker = {
    scenario: 'multi-broker',
    brokers: [
      {
        id: 'broker-0', host: 'kafka-0:9092', isLeader: true,
        partitions: [
          { id: 0, topic: 'orders', leader: 'broker-0', replicas: ['broker-0', 'broker-1'], logSize: 120 },
          { id: 1, topic: 'orders', leader: 'broker-0', replicas: ['broker-0', 'broker-2'], logSize: 98 },
        ],
      },
      {
        id: 'broker-1', host: 'kafka-1:9092', isLeader: false,
        partitions: [
          { id: 2, topic: 'orders', leader: 'broker-1', replicas: ['broker-1', 'broker-0'], logSize: 110 },
        ],
      },
      {
        id: 'broker-2', host: 'kafka-2:9092', isLeader: false,
        partitions: [],
      },
    ],
    producers: [
      { id: 'prod-0', topic: 'orders', partitionStrategy: 'key-hash' },
      { id: 'prod-1', topic: 'orders', partitionStrategy: 'key-hash' },
    ],
    consumers: [
      { id: 'cons-0', groupId: 'order-processors', topic: 'orders', assignedPartitions: [0], lag: 0 },
      { id: 'cons-1', groupId: 'order-processors', topic: 'orders', assignedPartitions: [1], lag: 5 },
      { id: 'cons-2', groupId: 'order-processors', topic: 'orders', assignedPartitions: [2], lag: 2 },
    ],
  };

  const state = scenario === 'multi-broker' ? multiBroker : singleBroker;
  res.json(state);
});

const port = process.env.PORT || 8080;
app.listen(port, () => console.log(`bff-api listening on :${port}`));

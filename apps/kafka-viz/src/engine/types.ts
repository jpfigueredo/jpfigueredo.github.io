export type BrokerId = string;
export type PartitionId = number;
export type ProducerId = string;
export type ConsumerId = string;
export type MessageId = string;

export type Partition = {
  id: PartitionId;
  topic: string;
  leader: BrokerId;
  replicas: BrokerId[];
  logSize: number;
  highWatermark: number;
};

export type Broker = {
  id: BrokerId;
  host: string;
  isController: boolean;
  partitions: Partition[];
};

export type Producer = {
  id: ProducerId;
  topic: string;
  partitionStrategy: 'round-robin' | 'key-hash' | 'sticky';
  nextPartitionIndex: number;
};

export type Consumer = {
  id: ConsumerId;
  groupId: string;
  topic: string;
  assignedPartitions: PartitionId[];
  offsets: Record<PartitionId, number>;
};

export type InFlightMessage = {
  id: MessageId;
  producerId: ProducerId;
  topic: string;
  partitionId: PartitionId;
  key: string;
  value: Record<string, unknown>;
  offset: number;
  timestamp: string;
  /** 0..1 progress along the animation path */
  progress: number;
  phase: 'sending' | 'stored' | 'consuming' | 'done';
  consumerId?: ConsumerId;
};

export type SimulatorState = {
  brokers: Broker[];
  producers: Producer[];
  consumers: Consumer[];
  inFlightMessages: InFlightMessage[];
  tick: number;
  speed: number;
  paused: boolean;
};

export type Scenario = {
  id: string;
  label: string;
  description: string;
  initialState: Omit<SimulatorState, 'inFlightMessages' | 'tick' | 'speed' | 'paused'>;
};

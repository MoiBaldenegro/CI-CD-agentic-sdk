import type { JobsOptions } from 'bullmq';
import type { RedisOptions } from 'ioredis';

export interface BullMqQueueDefinition {
  name: string;
  defaultJobOptions?: JobsOptions;
}

export interface BullMqModuleOptions {
  connection: RedisOptions;
  queues: readonly BullMqQueueDefinition[];
}

export interface BullMqConnectionOptions {
  host: string;
  port: number;
  password?: string;
  db?: number;
}

export interface TaskQueueJobData {
  taskId: string;
}

import {
  BullMqConfig,
  TASK_QUEUE_NAME,
  type BullMqModuleOptions,
} from 'lib/queue';

export interface QueueRuntimeConfig {
  enabled: boolean;
  concurrency: number;
  options: BullMqModuleOptions;
}

export function resolveQueueConfig(): QueueRuntimeConfig {
  const concurrency = Number(process.env.QUEUE_CONCURRENCY ?? 1);

  return {
    enabled: isTruthy(process.env.QUEUE_ENABLED),
    concurrency:
      Number.isFinite(concurrency) && concurrency > 0 ? concurrency : 1,
    options: {
      connection: BullMqConfig.getConnection({
        host: process.env.REDIS_HOST?.trim() || 'localhost',
        port: Number(process.env.REDIS_PORT ?? 6379),
        password: optionalEnv('REDIS_PASSWORD'),
        db: Number(process.env.REDIS_DB ?? 0),
      }),
      queues: [
        {
          name: TASK_QUEUE_NAME,
          defaultJobOptions: {
            attempts: 1,
            removeOnComplete: { age: 3_600, count: 1_000 },
            removeOnFail: { age: 86_400, count: 5_000 },
          },
        },
      ],
    },
  };
}

function isTruthy(value: string | undefined): boolean {
  const normalized = value?.trim().toLowerCase();
  return normalized === 'true' || normalized === '1';
}

function optionalEnv(name: string): string | undefined {
  const value = process.env[name]?.trim();
  return value !== undefined && value.length > 0 ? value : undefined;
}

import type { RedisOptions } from 'ioredis';
import type { BullMqConnectionOptions } from './bullmq.types';

export class BullMqConfig {
  static getConnection(options: BullMqConnectionOptions): RedisOptions {
    return {
      host: options.host,
      port: options.port,
      password: options.password,
      db: options.db ?? 0,
      maxRetriesPerRequest: null,
    };
  }
}

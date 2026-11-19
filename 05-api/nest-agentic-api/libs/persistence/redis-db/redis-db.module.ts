import { DynamicModule, Module } from '@nestjs/common';
import Redis from 'ioredis';
import { RedisDbConfig } from './config/redis-db.config';

export const REDIS_CLIENT = 'REDIS_CLIENT';

export interface RedisDbConfigOptions {
  host?: string;
  port?: number;
  password?: string;
  db?: number;
  connectionString?: string;
}

@Module({})
export class RedisDbModule {
  static register(options: RedisDbConfigOptions): DynamicModule {
    const redis_config = RedisDbConfig.getConfig(options);
    return {
      module: RedisDbModule,
      global: true,
      providers: [
        {
          provide: REDIS_CLIENT,
          useFactory: () => {
            if (typeof redis_config === 'string') {
              return new Redis(redis_config);
            }
            return new Redis(redis_config);
          },
        },
      ],
      exports: [REDIS_CLIENT],
    };
  }
}

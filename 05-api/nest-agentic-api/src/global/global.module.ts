import { DynamicModule, Global, Logger, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { BullMqModule } from 'lib/queue';
import { DatabaseModule } from './database/database.module';
import { resolvePersistenceDriver } from './persistence.config';
import { resolveQueueConfig } from './queue.config';

@Global()
@Module({})
export class GlobalModule {
  static register(): DynamicModule {
    const imports: DynamicModule['imports'] = [
      ConfigModule.forRoot({ isGlobal: true }),
    ];
    const queue = resolveQueueConfig();

    if (resolvePersistenceDriver() === 'postgres') {
      imports.push(DatabaseModule.register());
    }

    if (queue.enabled) {
      imports.push(BullMqModule.register(queue.options));
    }

    new Logger('GlobalModule').log(
      `persistence=${resolvePersistenceDriver()} queue=${queue.enabled ? 'bullmq' : 'disabled'}`,
    );

    return {
      module: GlobalModule,
      imports,
    };
  }
}

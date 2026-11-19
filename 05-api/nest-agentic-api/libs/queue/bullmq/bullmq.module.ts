import { BullModule } from '@nestjs/bullmq';
import { DynamicModule, Module } from '@nestjs/common';
import type { BullMqModuleOptions } from './bullmq.types';

@Module({})
export class BullMqModule {
  static register(options: BullMqModuleOptions): DynamicModule {
    const queues = options.queues.map((queue) =>
      BullModule.registerQueue({
        name: queue.name,
        defaultJobOptions: queue.defaultJobOptions,
      }),
    );
    const root = BullModule.forRoot({ connection: options.connection });

    return {
      module: BullMqModule,
      global: true,
      imports: [root, ...queues],
      exports: [root, ...queues],
    };
  }
}

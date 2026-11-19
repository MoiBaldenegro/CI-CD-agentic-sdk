import { DynamicModule, Module } from '@nestjs/common';
import { resolveQueueConfig } from '../../../global/queue.config';
import { FactoryController } from './controllers/factory.controller';
import { CoreModule } from './core/core.module';
import { TaskProcessor } from './infrastructure/queue/task.processor';

@Module({})
export class FactoryModule {
  static register(): DynamicModule {
    const queue = resolveQueueConfig();

    return {
      module: FactoryModule,
      imports: [CoreModule.register()],
      controllers: [FactoryController],
      providers: queue.enabled ? [TaskProcessor] : [],
    };
  }
}

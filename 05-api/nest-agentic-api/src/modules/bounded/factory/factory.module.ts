import { DynamicModule, Module } from '@nestjs/common';
import { resolveQueueConfig } from '../../../global/queue.config';
import { FactoryController } from './controllers/factory.controller';
import { IntakeController } from './controllers/intake.controller';
import { CoreModule } from './core/core.module';
import { TaskIntakeService } from './intake/task-intake.service';
import { GhCliRepositoryWorkspace } from './infrastructure/github/gh-cli-repository-workspace';
import { TaskProcessor } from './infrastructure/queue/task.processor';

@Module({})
export class FactoryModule {
  static register(): DynamicModule {
    const queue = resolveQueueConfig();

    return {
      module: FactoryModule,
      imports: [CoreModule.register()],
      controllers: [FactoryController, IntakeController],
      providers: [
        TaskIntakeService,
        ...(queue.enabled ? [TaskProcessor, GhCliRepositoryWorkspace] : []),
      ],
    };
  }
}
